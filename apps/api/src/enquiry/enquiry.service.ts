import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EnquiryStatus } from '@educare/database';
import { isSuperAdmin, getUserCentreIds, assertCentreAccess } from '../common/utils/tenant.util';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EnquiryService {
  private readonly logger = new Logger(EnquiryService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  /**
   * Public enquiry creation (e.g. from website admission form).
   * Strictly whitelists allowed contact/interest fields.
   * Strips all internal / privileged fields (status, assignedToId, notes, followUpDate).
   * Supports optional Cloudflare Turnstile token validation when TURNSTILE_SECRET_KEY is configured.
   */
  async createPublicEnquiry(data: any, clientIp?: string) {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Request body must be a valid JSON object.');
    }

    const studentName = String(data.studentName || '').trim();
    const contactNumber = String(data.contactNumber || '').trim();

    if (!studentName || studentName.length < 2 || studentName.length > 100) {
      throw new BadRequestException('A valid student name between 2 and 100 characters is required.');
    }

    // Strip non-digit characters to validate phone length
    const cleanedContact = contactNumber.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanedContact || cleanedContact.length < 7 || cleanedContact.length > 20 || !/^\d+$/.test(cleanedContact)) {
      throw new BadRequestException('A valid contact phone number is required.');
    }

    // Validate email format if provided
    let email: string | null = null;
    if (data.email) {
      const emailCandidate = String(data.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate) || emailCandidate.length > 150) {
        throw new BadRequestException('Invalid email address format.');
      }
      email = emailCandidate;
    }

    // Production Turnstile bot protection policy
    const isProduction = process.env.NODE_ENV === 'production';
    const isTurnstileDisabled = process.env.DISABLE_TURNSTILE === 'true';
    const isTurnstileRequired = !isTurnstileDisabled && (isProduction || process.env.TURNSTILE_REQUIRED === 'true');

    if (isTurnstileRequired && !process.env.TURNSTILE_SECRET_KEY) {
      throw new HttpException(
        'Server configuration error: Turnstile bot protection is required in production but TURNSTILE_SECRET_KEY is not configured.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!isTurnstileDisabled && process.env.TURNSTILE_SECRET_KEY) {
      const token = data.turnstileToken || data['cf-turnstile-response'];
      if (!token) {
        throw new BadRequestException('CAPTCHA verification token is missing.');
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: token,
            ...(clientIp ? { remoteip: clientIp } : {}),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!verifyRes.ok) {
          throw new BadRequestException('CAPTCHA verification service returned an error. Please try again.');
        }

        let verifyData: any;
        try {
          verifyData = await verifyRes.json();
        } catch {
          throw new BadRequestException('CAPTCHA verification failed: invalid service response.');
        }

        if (!verifyData || !verifyData.success) {
          const errorCodes = Array.isArray(verifyData?.['error-codes']) ? verifyData['error-codes'] : [];
          console.warn('[Turnstile] Cloudflare siteverify rejected token:', JSON.stringify(errorCodes));
          if (errorCodes.includes('timeout-or-duplicate')) {
            throw new BadRequestException('CAPTCHA verification failed: token expired or already used.');
          }
          throw new BadRequestException('CAPTCHA verification failed. Please try again.');
        }

        // Hostname allowlist validation (exclude API hostname since widget is rendered strictly on web frontends)
        const isStagingTier = process.env.APP_ENV === 'staging' || process.env.NODE_ENV === 'staging';
        const isDummyTestSecret = process.env.TURNSTILE_SECRET_KEY?.startsWith('1x00000000000000000000');
        const defaultHostnames = [
          'lms.educarelearning.in',
          'educarelearning.in',
          ...(isStagingTier ? ['staging.educarelearning.in', 'lms.staging.educarelearning.in'] : []),
          ...(isDummyTestSecret ? ['example.com'] : []),
        ];
        const configuredHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES
          ? process.env.TURNSTILE_ALLOWED_HOSTNAMES.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
          : [];
        const allowedHostnames = new Set([
          ...defaultHostnames,
          ...configuredHostnames,
          ...((process.env.NODE_ENV !== 'production' && !isStagingTier) || process.env.ALLOW_LOCAL_STAGING_HOSTS === 'true'
            ? ['localhost', '127.0.0.1']
            : []),
        ]);

        let returnedHostname = String(verifyData.hostname || '').toLowerCase().trim();
        if (returnedHostname.includes('://')) {
          try {
            returnedHostname = new URL(returnedHostname).hostname.toLowerCase().trim();
          } catch {}
        }
        returnedHostname = returnedHostname.replace(/:\d+$/, '');

        if (!returnedHostname || !allowedHostnames.has(returnedHostname)) {
          throw new BadRequestException('CAPTCHA verification failed: origin hostname not authorized.');
        }

        // Widget action validation: strictly require exact expected action (reject missing or mismatched action)
        const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION || 'admission_enquiry';
        if (!isDummyTestSecret && (!verifyData.action || String(verifyData.action).trim() !== expectedAction)) {
          throw new BadRequestException('CAPTCHA verification failed: widget action missing or mismatched.');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof HttpException) throw err;
        console.error('[Turnstile] Verification failure:', err?.name || 'Error', err?.message || 'Network failure');
        throw new BadRequestException('CAPTCHA verification failed or timed out. Please try again.');
      }
    }

    // Authoritative centre derivation:
    // Only derive centreId if linked to a verified active CustomForm that has a configured active centre.
    let targetCentreId: string | null = null;
    if (data.formId) {
      const form = await (this.prisma as any).customForm?.findUnique?.({
        where: { id: String(data.formId).trim() },
        include: { centre: true },
      });

      if (form && form.isActive && form.centreId) {
        const centre = form.centre || (await this.prisma.centre.findUnique({
          where: { id: form.centreId },
        }));
        if (centre && centre.status === 'ACTIVE') {
          targetCentreId = centre.id;
        }
      }

      // If client supplied a centreId that conflicts with verified form configuration, reject it
      if (data.centreId && targetCentreId && String(data.centreId).trim() !== targetCentreId) {
        throw new BadRequestException('Client-supplied centreId conflicts with verified form configuration.');
      }
    }

    // Note: If no verified form configuration exists, client-supplied centreId, assignedToId,
    // and free-text source values (e.g. "Centre: ...") are NEVER trusted to assign tenant ownership.
    // Tenant ownership cannot be forged via public input. targetCentreId remains null.
    // Client-supplied status, assignedToId, followUpDate are completely discarded.

    // Upload student photo and signature directly to Cloudflare R2 if configured
    let signatureUrl: string | null = null;
    let photoUrl: string | null = null;

    if (this.storageService) {
      if (data.studentPhoto || data.photo) {
        try {
          const photoRaw = String(data.studentPhoto || data.photo).trim();
          if (photoRaw.startsWith('data:image')) {
            const uploadedPhoto = await this.storageService.uploadBase64(
              photoRaw,
              'admissions/photos',
              'student-photo',
            );
            if (uploadedPhoto?.finalUrl) {
              photoUrl = uploadedPhoto.finalUrl;
            }
          }
        } catch (err: any) {
          this.logger.warn(`Failed to upload student photo to R2: ${err?.message}`);
        }
      }

      if (data.signatureData || data.signature) {
        try {
          const sigRaw = String(data.signatureData || data.signature).trim();
          if (sigRaw.startsWith('data:image')) {
            const uploadedSig = await this.storageService.uploadBase64(
              sigRaw,
              'admissions/signatures',
              'signature',
            );
            if (uploadedSig?.finalUrl) {
              signatureUrl = uploadedSig.finalUrl;
            }
          }
        } catch (err: any) {
          this.logger.warn(`Failed to upload signature to R2: ${err?.message}`);
        }
      }
    }

    let signatureAuditNote: string | null = null;
    if (data.signatureData || data.signature) {
      const sigData = signatureUrl || String(data.signatureData || data.signature);
      const signer = data.signerName ? String(data.signerName).trim() : (data.parentName ? String(data.parentName).trim() : studentName);
      const sigType = data.signatureType ? String(data.signatureType).trim() : (String(data.signatureData || data.signature).startsWith('data:image') ? 'DRAWN_CANVAS' : 'UPLOADED_IMAGE');
      signatureAuditNote = `[DIGITAL SIGNATURE ACCEPTANCE]\nSigner: ${signer}\nType: ${sigType}\nAccepted Rules: Yes\nTimestamp: ${new Date().toISOString()}\nSignature: ${signatureUrl ? signatureUrl : sigData.slice(0, 5000)}`;
    }

    const notesSections: string[] = [];
    if (photoUrl) {
      notesSections.push(`[STUDENT PHOTO]\nPhoto: ${photoUrl}`);
    } else if (data.studentPhoto || data.photo) {
      const photoData = String(data.studentPhoto || data.photo);
      notesSections.push(`[STUDENT PHOTO]\nPhoto: ${photoData.slice(0, 100000)}`);
    }
    if (signatureAuditNote) {
      notesSections.push(signatureAuditNote);
    }
    const finalNotes = notesSections.length > 0 ? notesSections.join('\n\n') : null;

    try {
      const created = await this.prisma.enquiry.create({
        data: {
          studentName,
          parentName: data.parentName ? String(data.parentName).trim().slice(0, 100) : null,
          contactNumber,
          email,
          address: data.address ? String(data.address).trim().slice(0, 300) : null,
          source: data.source ? String(data.source).trim().slice(0, 100) : 'Website Form',
          targetBoard: data.targetBoard ? String(data.targetBoard).trim().slice(0, 100) : null,
          targetStandard: data.targetStandard ? String(data.targetStandard).trim().slice(0, 100) : null,
          targetCourse: data.targetCourse ? String(data.targetCourse).trim().slice(0, 100) : null,
          status: EnquiryStatus.NEW,
          centreId: targetCentreId,
          assignedToId: null,
          ...(finalNotes ? { notes: finalNotes } : {}),
        },
      });
      return Object.assign(created, {
        ...(photoUrl ? { photoUrl } : {}),
        ...(signatureUrl ? { signatureUrl } : {}),
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create public enquiry with centreId, falling back to legacy schema: ${err?.message}`);
      const created = await (this.prisma.enquiry as any).create({
        data: {
          studentName,
          parentName: data.parentName ? String(data.parentName).trim().slice(0, 100) : null,
          contactNumber,
          email,
          address: data.address ? String(data.address).trim().slice(0, 300) : null,
          source: data.source ? String(data.source).trim().slice(0, 100) : 'Website Form',
          targetBoard: data.targetBoard ? String(data.targetBoard).trim().slice(0, 100) : null,
          targetStandard: data.targetStandard ? String(data.targetStandard).trim().slice(0, 100) : null,
          targetCourse: data.targetCourse ? String(data.targetCourse).trim().slice(0, 100) : null,
          status: EnquiryStatus.NEW,
          assignedToId: null,
          ...(finalNotes ? { notes: finalNotes } : {}),
        },
      });
      return Object.assign(created, {
        ...(photoUrl ? { photoUrl } : {}),
        ...(signatureUrl ? { signatureUrl } : {}),
      });
    }
  }

  /**
   * Authenticated enquiry creation by staff/admin.
   * Scopes destination centre to authorized centres for non-super-admins.
   */
  async createEnquiry(data: any, currentUser?: any) {
    let resolvedCentreId: string | null = null;

    if (isSuperAdmin(currentUser)) {
      resolvedCentreId = data.centreId || null;
    } else {
      const allowedCentres = getUserCentreIds(currentUser);
      if (!allowedCentres || allowedCentres.length === 0) {
        throw new ForbiddenException('Access denied: No centre assignments found for your account.');
      }

      if (data.centreId) {
        assertCentreAccess(currentUser, data.centreId);
        resolvedCentreId = data.centreId;
      } else if (allowedCentres.length === 1) {
        resolvedCentreId = allowedCentres[0];
      } else {
        throw new BadRequestException('centreId is required when user has multiple assigned centres.');
      }
    }

    // If assignedToId is provided, verify user belongs to the target centre
    if (data.assignedToId && resolvedCentreId) {
      const assignedUser = await this.prisma.user.findFirst({
        where: {
          id: data.assignedToId,
          userCentres: { some: { centreId: resolvedCentreId } },
        },
      });
      if (!assignedUser && !isSuperAdmin(currentUser)) {
        throw new BadRequestException('Assigned staff does not belong to the target centre.');
      }
    }

    try {
      return await this.prisma.enquiry.create({
        data: {
          studentName: data.studentName,
          parentName: data.parentName || null,
          contactNumber: data.contactNumber,
          email: data.email || null,
          address: data.address || null,
          source: data.source || 'Direct',
          targetBoard: data.targetBoard || null,
          targetStandard: data.targetStandard || null,
          targetCourse: data.targetCourse || null,
          status: data.status || EnquiryStatus.NEW,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          notes: data.notes || null,
          assignedToId: data.assignedToId || null,
          centreId: resolvedCentreId,
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          centre: true,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create enquiry with centre relation, falling back to legacy insert: ${err?.message}`);
      return await (this.prisma.enquiry as any).create({
        data: {
          studentName: data.studentName,
          parentName: data.parentName || null,
          contactNumber: data.contactNumber,
          email: data.email || null,
          address: data.address || null,
          source: data.source || 'Direct',
          targetBoard: data.targetBoard || null,
          targetStandard: data.targetStandard || null,
          targetCourse: data.targetCourse || null,
          status: data.status || EnquiryStatus.NEW,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          notes: data.notes || null,
          assignedToId: data.assignedToId || null,
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    }
  }

  async getAllEnquiries(currentUser?: any) {
    let whereClause: any = {};

    if (!isSuperAdmin(currentUser)) {
      const centreIds = getUserCentreIds(currentUser);
      if (!centreIds || centreIds.length === 0) {
        return [];
      }
      whereClause = { centreId: { in: centreIds } };
    }

    try {
      return await this.prisma.enquiry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          centre: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to fetch enquiries with centre relation, falling back: ${err?.message}`);
      try {
        return await this.prisma.enquiry.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            studentName: true,
            parentName: true,
            contactNumber: true,
            email: true,
            address: true,
            source: true,
            targetBoard: true,
            targetStandard: true,
            targetCourse: true,
            status: true,
            followUpDate: true,
            notes: true,
            assignedToId: true,
            createdAt: true,
            updatedAt: true,
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      } catch (innerErr: any) {
        this.logger.warn(`Failed fallback with centreId filter, querying legacy enquiries: ${innerErr?.message}`);
        try {
          return await this.prisma.enquiry.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              studentName: true,
              parentName: true,
              contactNumber: true,
              email: true,
              address: true,
              source: true,
              targetBoard: true,
              targetStandard: true,
              targetCourse: true,
              status: true,
              followUpDate: true,
              notes: true,
              assignedToId: true,
              createdAt: true,
              updatedAt: true,
              assignedTo: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });
        } catch (finalErr: any) {
          this.logger.error(`Critical enquiry query failure: ${finalErr?.message}`);
          return [];
        }
      }
    }
  }

  async getEnquirySummary(currentUser?: any) {
    let baseWhere: any = {};

    if (!isSuperAdmin(currentUser)) {
      const centreIds = getUserCentreIds(currentUser);
      if (!centreIds || centreIds.length === 0) {
        return { total: 0, thisMonth: 0, converted: 0 };
      }
      baseWhere = { centreId: { in: centreIds } };
    }

    try {
      const total = await this.prisma.enquiry.count({ where: baseWhere });

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

      const thisMonth = await this.prisma.enquiry.count({
        where: {
          ...baseWhere,
          createdAt: { gte: firstDay },
        },
      });

      const converted = await this.prisma.enquiry.count({
        where: {
          ...baseWhere,
          status: EnquiryStatus.CONVERTED,
        },
      });

      return { total, thisMonth, converted };
    } catch (err: any) {
      this.logger.warn(`Failed to get enquiry summary with centre filter, falling back: ${err?.message}`);
      try {
        const total = await this.prisma.enquiry.count();
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonth = await this.prisma.enquiry.count({
          where: { createdAt: { gte: firstDay } },
        });
        const converted = await this.prisma.enquiry.count({
          where: { status: EnquiryStatus.CONVERTED },
        });
        return { total, thisMonth, converted };
      } catch (fallbackErr: any) {
        this.logger.error(`Failed fallback enquiry summary: ${fallbackErr?.message}`);
        return { total: 0, thisMonth: 0, converted: 0 };
      }
    }
  }

  async updateEnquiry(id: string, data: any, currentUser?: any) {
    const existing = await this.prisma.enquiry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Enquiry not found');
    }

    if (!isSuperAdmin(currentUser)) {
      const centreIds = getUserCentreIds(currentUser);
      if (!centreIds || centreIds.length === 0) {
        throw new ForbiddenException('Access denied: No centre assignments found for your account.');
      }

      // Check current enquiry ownership
      if (!existing.centreId || !centreIds.includes(existing.centreId)) {
        throw new ForbiddenException('Access denied: You are not authorized to update enquiries for this centre.');
      }

      // If updating centreId, ensure target is also an authorized centre
      if (data.centreId && data.centreId !== existing.centreId) {
        assertCentreAccess(currentUser, data.centreId);
      }
    }

    const targetCentreId = data.centreId !== undefined ? data.centreId : existing.centreId;

    if (data.assignedToId && targetCentreId && !isSuperAdmin(currentUser)) {
      const assignedUser = await this.prisma.user.findFirst({
        where: {
          id: data.assignedToId,
          userCentres: { some: { centreId: targetCentreId } },
        },
      });
      if (!assignedUser) {
        throw new BadRequestException('Assigned staff does not belong to the target centre.');
      }
    }

    try {
      return await this.prisma.enquiry.update({
        where: { id },
        data: {
          studentName: data.studentName !== undefined ? data.studentName : undefined,
          parentName: data.parentName !== undefined ? data.parentName : undefined,
          contactNumber: data.contactNumber !== undefined ? data.contactNumber : undefined,
          email: data.email !== undefined ? data.email : undefined,
          address: data.address !== undefined ? data.address : undefined,
          source: data.source !== undefined ? data.source : undefined,
          targetBoard: data.targetBoard !== undefined ? data.targetBoard : undefined,
          targetStandard: data.targetStandard !== undefined ? data.targetStandard : undefined,
          targetCourse: data.targetCourse !== undefined ? data.targetCourse : undefined,
          status: data.status !== undefined ? data.status : undefined,
          followUpDate: data.followUpDate !== undefined ? (data.followUpDate ? new Date(data.followUpDate) : null) : undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
          assignedToId: data.assignedToId !== undefined ? data.assignedToId : undefined,
          centreId: data.centreId !== undefined ? data.centreId : undefined,
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          centre: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to update enquiry with centre relation, falling back to legacy update: ${err?.message}`);
      return await (this.prisma.enquiry as any).update({
        where: { id },
        data: {
          studentName: data.studentName !== undefined ? data.studentName : undefined,
          parentName: data.parentName !== undefined ? data.parentName : undefined,
          contactNumber: data.contactNumber !== undefined ? data.contactNumber : undefined,
          email: data.email !== undefined ? data.email : undefined,
          address: data.address !== undefined ? data.address : undefined,
          source: data.source !== undefined ? data.source : undefined,
          targetBoard: data.targetBoard !== undefined ? data.targetBoard : undefined,
          targetStandard: data.targetStandard !== undefined ? data.targetStandard : undefined,
          targetCourse: data.targetCourse !== undefined ? data.targetCourse : undefined,
          status: data.status !== undefined ? data.status : undefined,
          followUpDate: data.followUpDate !== undefined ? (data.followUpDate ? new Date(data.followUpDate) : null) : undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
          assignedToId: data.assignedToId !== undefined ? data.assignedToId : undefined,
        },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    }
  }

  /**
   * Super Admin reconciliation tool:
   * Returns legacy enquiries where centreId is null and includes staff assignment suggestions
   * strictly for diagnostic review. All unassigned records fail closed.
   */
  async getUnreconciledEnquiries(currentUser?: any) {
    if (currentUser && !isSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only Super Admins can access unreconciled enquiries.');
    }

    const unassigned = await this.prisma.enquiry.findMany({
      where: { centreId: null },
      include: {
        assignedTo: {
          include: {
            userCentres: {
              include: { centre: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return unassigned.map((e) => {
      const assignedCentres = e.assignedTo?.userCentres || [];
      const isSingleStaffCentre = assignedCentres.length === 1;
      return {
        id: e.id,
        studentName: e.studentName,
        contactNumber: e.contactNumber,
        source: e.source,
        assignedToId: e.assignedToId,
        assignedToName: e.assignedTo ? `${e.assignedTo.firstName} ${e.assignedTo.lastName}` : null,
        suggestedCentreId: isSingleStaffCentre ? assignedCentres[0].centreId : null,
        suggestedCentreName: isSingleStaffCentre ? (assignedCentres[0].centre?.name || null) : null,
        isAmbiguous: !isSingleStaffCentre,
        reason: isSingleStaffCentre
          ? 'Suggested from assigned staff centre (requires Super Admin manual confirmation)'
          : assignedCentres.length === 0
          ? 'No assigned staff or staff has no centre memberships'
          : 'Staff is assigned to multiple centres',
      };
    });
  }

  /**
   * Manual enquiry reconciliation by Super Admin:
   * Explicitly assigns an unassigned enquiry to a verified centre.
   * Validates target centre, enforces Super Admin authorization, and creates an audit log.
   */
  async reconcileEnquiry(id: string, centreId: string, currentUser: any, reason?: string) {
    if (!isSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only Super Admins can perform manual enquiry ownership reconciliation.');
    }

    if (!centreId || typeof centreId !== 'string') {
      throw new BadRequestException('A valid centreId is required for reconciliation.');
    }

    const cleanCentreId = centreId.trim();
    const centre = await this.prisma.centre.findUnique({
      where: { id: cleanCentreId },
    });

    if (!centre || centre.status !== 'ACTIVE') {
      throw new BadRequestException('The selected centre does not exist or is not active.');
    }

    const existing = await this.prisma.enquiry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Enquiry not found.');
    }

    const updated = await this.prisma.enquiry.update({
      where: { id },
      data: { centreId: cleanCentreId },
      include: {
        centre: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (this.auditService) {
      this.auditService.record({
        userId: currentUser?.id,
        userRole: 'SUPER_ADMIN',
        action: 'RECONCILE_ENQUIRY_OWNERSHIP',
        category: 'ENQUIRY',
        entityType: 'Enquiry',
        entityId: id,
        centreId: cleanCentreId,
        details: {
          previousCentreId: existing.centreId,
          newCentreId: cleanCentreId,
          reason: reason || 'Manual Super Admin reconciliation',
        },
      });
    }

    return updated;
  }
}
