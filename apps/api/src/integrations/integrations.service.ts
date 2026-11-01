import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EnquiryStatus } from '@educare/database';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  role: { select: { id: true, name: true } },
};

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    const ddlStatements = [
      `CREATE TABLE IF NOT EXISTS "api_integrations" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL DEFAULT 'CRM Integration',
        "apiKey" TEXT UNIQUE,
        "apiKeyHash" TEXT UNIQUE,
        "keyPrefix" TEXT NOT NULL DEFAULT 'edc_live_',
        "keySuffix" TEXT,
        "webhookSecret" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "centreId" TEXT,
        "lastUsedAt" TIMESTAMP(3),
        "totalRequests" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS "webhook_logs" (
        "id" TEXT PRIMARY KEY,
        "apiIntegrationId" TEXT,
        "event" TEXT NOT NULL DEFAULT 'student.enrolled',
        "status" TEXT NOT NULL,
        "statusCode" INTEGER NOT NULL DEFAULT 200,
        "crmId" TEXT,
        "studentName" TEXT,
        "studentEmail" TEXT,
        "admissionNo" TEXT,
        "payload" JSONB,
        "response" JSONB,
        "errorMessage" TEXT,
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS "webhook_logs_crmId_idx" ON "webhook_logs"("crmId");`,
      `CREATE INDEX IF NOT EXISTS "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt" DESC);`,
      `ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;`,
      `ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "keySuffix" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'DIRECT';`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "externalCrmId" TEXT;`,
      `ALTER TABLE "enquiries" ADD COLUMN IF NOT EXISTS "externalCrmId" TEXT;`,
    ];

    for (const ddl of ddlStatements) {
      try {
        if (this.prisma?.$executeRawUnsafe) {
          await this.prisma.$executeRawUnsafe(ddl);
        }
      } catch (err: any) {
        this.logger.debug?.(`Non-fatal DDL notice: ${err?.message}`);
      }
    }
  }

  /**
   * Retrieves active CRM API integration credentials, or initializes a default keypair if none exists.
   */
  async getOrCreateIntegration(centreId?: string) {
    try {
      return await this._findOrCreateIntegrationInternal(centreId);
    } catch (err: any) {
      this.logger.warn(`Initial getOrCreateIntegration failed (${err?.message}). Attempting self-healing DDL...`);
      await this.ensureSchema();
      return await this._findOrCreateIntegrationInternal(centreId);
    }
  }

  private async _findOrCreateIntegrationInternal(centreId?: string) {
    const where: any = { isActive: true };
    if (centreId) {
      where.centreId = centreId;
    }

    let integration = await this.prisma.apiIntegration.findFirst({
      where,
      include: { centre: { select: { id: true, name: true, code: true } } },
    });

    if (!integration) {
      const apiKey = `edc_live_${crypto.randomBytes(24).toString('hex')}`;
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
      const keySuffix = apiKey.slice(-4);

      integration = await this.prisma.apiIntegration.create({
        data: {
          name: 'Primary CRM Integration',
          apiKey,
          apiKeyHash,
          keyPrefix: 'edc_live_',
          keySuffix,
          webhookSecret,
          isActive: true,
          centreId: centreId || null,
        },
        include: { centre: { select: { id: true, name: true, code: true } } },
      });

      this.logger.log(`Initialized default CRM API integration credentials: ${integration.id}`);
    }

    return integration;
  }

  /**
   * Regenerates API key and webhook signing secret.
   */
  async regenerateCredentials(id: string) {
    const existing = await this.prisma.apiIntegration.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Integration with ID "${id}" not found.`);
    }

    const newApiKey = `edc_live_${crypto.randomBytes(24).toString('hex')}`;
    const newApiKeyHash = crypto.createHash('sha256').update(newApiKey).digest('hex');
    const newWebhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    const keySuffix = newApiKey.slice(-4);

    const updated = await this.prisma.apiIntegration.update({
      where: { id },
      data: {
        apiKey: newApiKey,
        apiKeyHash: newApiKeyHash,
        keySuffix,
        webhookSecret: newWebhookSecret,
        updatedAt: new Date(),
      },
      include: { centre: { select: { id: true, name: true, code: true } } },
    });

    this.logger.log(`Regenerated CRM credentials for integration ${id}`);
    return updated;
  }

  /**
   * Core Webhook Ingestion Engine:
   * Processes CRM enrollment dispatch (`student.enrolled` / `opportunity.won`) idempotently.
   */
  async processCrmAdmissionWebhook(
    rawPayload: any,
    integration: any,
    ip?: string,
  ) {
    // 1. Resilient normalization (Event envelope vs Flat JSON)
    const eventName = rawPayload?.event || 'student.enrolled';
    const data =
      rawPayload?.data && typeof rawPayload.data === 'object'
        ? rawPayload.data
        : rawPayload || {};

    const crmId = String(
      data.crmEnquiryId ||
        data.crmId ||
        data.opportunityId ||
        data.enquiryId ||
        data.id ||
        `CRM-${Date.now()}`,
    ).trim();

    const fullName = String(
      data.studentName ||
        data.name ||
        `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
        'CRM Enrolled Student',
    ).trim();

    const email = data.email || data.studentEmail ? String(data.email || data.studentEmail).trim() : null;
    const phone = data.phone || data.contactNumber || data.studentPhone ? String(data.phone || data.contactNumber || data.studentPhone).trim() : null;
    const parentName = data.parentName || data.guardianName ? String(data.parentName || data.guardianName).trim() : null;
    const parentPhone = data.parentPhone || data.parentContact ? String(data.parentPhone || data.parentContact).trim() : phone;
    const parentEmail = data.parentEmail ? String(data.parentEmail).trim() : null;
    const address = data.address ? String(data.address).trim() : null;
    const bloodGroup = data.bloodGroup ? String(data.bloodGroup).trim() : null;
    const notes = data.notes ? String(data.notes).trim() : `Enrolled via CRM Dispatch (${crmId})`;

    let dateOfBirth: Date | null = null;
    if (data.dateOfBirth || data.dob) {
      try {
        const parsed = new Date(data.dateOfBirth || data.dob);
        if (!isNaN(parsed.getTime())) dateOfBirth = parsed;
      } catch {}
    }

    try {
      // 2. IDEMPOTENCY CHECK
      // Check if this CRM ID or student with identical email/phone already exists
      let existingProfile = await this.prisma.studentProfile.findFirst({
        where: {
          OR: [
            { externalCrmId: crmId },
            ...(email ? [{ user: { email } }] : []),
          ],
        },
        include: {
          user: { select: SAFE_USER_SELECT },
          enrollments: {
            include: {
              batch: {
                include: {
                  centre: true,
                  academicYear: true,
                  board: true,
                  standard: true,
                },
              },
            },
          },
        },
      });

      if (existingProfile) {
        this.logger.log(`Idempotent webhook replay for existing student ${existingProfile.id} (CRM: ${crmId})`);

        // Update profile with latest fields & ensure externalCrmId is stored
        const updatedProfile = await this.prisma.studentProfile.update({
          where: { id: existingProfile.id },
          data: {
            externalCrmId: crmId,
            source: 'CRM_WEBHOOK',
            parentName: parentName || existingProfile.parentName,
            parentEmail: parentEmail || existingProfile.parentEmail,
            parentPhone: parentPhone || existingProfile.parentPhone,
            address: address || existingProfile.address,
            bloodGroup: bloodGroup || existingProfile.bloodGroup,
            dateOfBirth: dateOfBirth || existingProfile.dateOfBirth,
          },
        });

        // Ensure enquiry status is marked CONVERTED
        let linkedEnquiry = await this.prisma.enquiry.findFirst({
          where: {
            OR: [
              { externalCrmId: crmId },
              ...(email ? [{ email }] : []),
              ...(phone ? [{ contactNumber: phone }] : []),
            ],
          },
        });

        if (linkedEnquiry) {
          await this.prisma.enquiry.update({
            where: { id: linkedEnquiry.id },
            data: {
              status: EnquiryStatus.CONVERTED,
              externalCrmId: crmId,
              notes: notes ? `${linkedEnquiry.notes || ''}\n[CRM Update]: ${notes}`.trim() : linkedEnquiry.notes,
            },
          });
        }

        const primaryEnrollment = existingProfile.enrollments?.[0];
        const responseData = {
          success: true,
          message: 'Student already enrolled; updated idempotently',
          isNew: false,
          studentId: updatedProfile.id,
          admissionNo: updatedProfile.admissionNo,
          userId: existingProfile.userId,
          email: existingProfile.user?.email,
          centreId: primaryEnrollment?.batch?.centreId || null,
          batchId: primaryEnrollment?.batchId || null,
          enquiryId: linkedEnquiry?.id || null,
        };

        // Record successful webhook log
        await this.prisma.webhookLog.create({
          data: {
            apiIntegrationId: integration?.id || null,
            event: eventName,
            status: 'DUPLICATE_UPDATED',
            statusCode: 200,
            crmId,
            studentName: fullName,
            studentEmail: existingProfile.user?.email || email,
            admissionNo: updatedProfile.admissionNo,
            payload: rawPayload,
            response: responseData,
            ipAddress: ip || null,
          },
        });

        return responseData;
      }

      // 3. RESOLVE ENTITIES (Centre, Academic Year, Board, Standard, Batch)
      // Strict Multi-Tenant Isolation: If integration credentials belong to a specific centre, lock to that centre!
      let centre: any = null;
      if (integration?.centreId) {
        centre = await this.prisma.centre.findUnique({
          where: { id: integration.centreId },
        });
      }

      const targetCentreQuery = data.centre || data.centreName || data.centreCode;
      if (!centre && targetCentreQuery) {
        centre = await this.prisma.centre.findFirst({
          where: {
            OR: [
              { name: { contains: targetCentreQuery, mode: 'insensitive' } },
              { code: { equals: targetCentreQuery, mode: 'insensitive' } },
            ],
          },
        });
      }

      if (!centre) {
        centre = await this.prisma.centre.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!centre) {
        throw new BadRequestException('No active centre found in LMS to allocate admission.');
      }

      // Academic Year Resolution
      let academicYear: any = null;
      const targetYear = data.academicYear || data.year;
      if (targetYear) {
        academicYear = await this.prisma.academicYear.findFirst({
          where: { name: { contains: targetYear, mode: 'insensitive' } },
        });
      }

      if (!academicYear) {
        academicYear = await this.prisma.academicYear.findFirst({
          where: { isActive: true },
        });
      }

      if (!academicYear) {
        academicYear = await this.prisma.academicYear.findFirst({
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!academicYear) {
        throw new BadRequestException('No academic year configured in LMS.');
      }

      // Board Resolution
      let board: any = null;
      const targetBoard = data.board || data.targetBoard;
      if (targetBoard) {
        board = await this.prisma.board.findFirst({
          where: { name: { contains: targetBoard, mode: 'insensitive' } },
        });
      }

      if (!board) {
        board = await this.prisma.board.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!board) {
        board = await this.prisma.board.create({
          data: { name: targetBoard || 'CBSE' },
        });
      }

      // Standard / Class Resolution
      let standard: any = null;
      const targetStandard = data.standard || data.classLevel || data.targetStandard || data.grade;
      if (targetStandard) {
        standard = await this.prisma.standard.findFirst({
          where: {
            name: { contains: targetStandard, mode: 'insensitive' },
          },
        });
      }

      if (!standard) {
        standard = await this.prisma.standard.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!standard) {
        standard = await this.prisma.standard.create({
          data: {
            name: targetStandard || 'Class 10',
            boardId: board.id,
          },
        });
      }

      // Batch Resolution & Fallback Creation
      const batchName = data.division || data.batch || data.section || 'Default Batch';
      let batch = await this.prisma.batch.findFirst({
        where: {
          name: batchName,
          academicYearId: academicYear.id,
          boardId: board.id,
          standardId: standard.id,
          centreId: centre.id,
        },
      });

      if (!batch) {
        batch = await this.prisma.batch.create({
          data: {
            name: batchName,
            academicYearId: academicYear.id,
            boardId: board.id,
            standardId: standard.id,
            centreId: centre.id,
          },
        });
      }

      // 4. STUDENT USER & PROFILE PROVISIONING
      const studentRole = await this.prisma.role.findFirst({
        where: { name: 'STUDENT' },
      });

      if (!studentRole) {
        throw new BadRequestException('STUDENT role not found in LMS system.');
      }

      // Unique student login email
      let studentEmail = email;
      if (!studentEmail) {
        const cleanCrm = crmId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        studentEmail = `student.${cleanCrm || Date.now()}@educare.com`;
      }

      // Check if user with that email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: studentEmail },
      });

      if (existingUser) {
        studentEmail = `student.${Date.now()}@educare.com`;
      }

      const tempPassword = crypto.randomBytes(6).toString('hex');
      const hashedPassword = await argon2.hash(tempPassword);

      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'CRM';
      const lastName = nameParts.slice(1).join(' ') || 'Student';

      const admissionNo = `${centre.code || 'ADM'}-${Date.now().toString().slice(-5)}`;

      // 5. TRANSACTIONAL CREATION
      const createdRecord = await this.prisma.$transaction(async (tx) => {
        // Create User
        const user = await tx.user.create({
          data: {
            email: studentEmail,
            password: hashedPassword,
            firstName,
            lastName,
            roleId: studentRole.id,
          },
        });

        // Create Student Profile
        const profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            admissionNo,
            parentName,
            parentEmail,
            parentPhone,
            bloodGroup,
            dateOfBirth,
            address,
            source: 'CRM_WEBHOOK',
            externalCrmId: crmId,
          },
        });

        // Create Batch Enrollment
        const enrollment = await tx.enrollment.create({
          data: {
            studentProfileId: profile.id,
            batchId: batch.id,
          },
        });

        // Link User to Centre
        await tx.userCentre.create({
          data: {
            userId: user.id,
            centreId: centre.id,
          },
        });

        // Create or Update Converted Enquiry in LMS
        let enquiry = await tx.enquiry.findFirst({
          where: {
            OR: [
              { externalCrmId: crmId },
              ...(email ? [{ email }] : []),
              ...(phone ? [{ contactNumber: phone }] : []),
            ],
          },
        });

        if (enquiry) {
          enquiry = await tx.enquiry.update({
            where: { id: enquiry.id },
            data: {
              status: EnquiryStatus.CONVERTED,
              externalCrmId: crmId,
              notes: notes ? `${enquiry.notes || ''}\n[CRM Enrolled]: ${notes}`.trim() : enquiry.notes,
            },
          });
        } else {
          enquiry = await tx.enquiry.create({
            data: {
              studentName: fullName,
              parentName,
              contactNumber: phone || parentPhone || 'N/A',
              email: email || studentEmail,
              address,
              source: 'CRM',
              targetBoard: board.name,
              targetStandard: standard.name,
              status: EnquiryStatus.CONVERTED,
              centreId: centre.id,
              externalCrmId: crmId,
              notes,
            },
          });
        }

        return { user, profile, enrollment, enquiry };
      });

      const responsePayload = {
        success: true,
        message: 'Student successfully enrolled from CRM dispatch',
        isNew: true,
        studentId: createdRecord.profile.id,
        admissionNo: createdRecord.profile.admissionNo,
        userId: createdRecord.user.id,
        email: createdRecord.user.email,
        temporaryPassword: tempPassword,
        centreId: centre.id,
        batchId: batch.id,
        enquiryId: createdRecord.enquiry.id,
      };

      // Record successful webhook log
      await this.prisma.webhookLog.create({
        data: {
          apiIntegrationId: integration?.id || null,
          event: eventName,
          status: 'SUCCESS',
          statusCode: 201,
          crmId,
          studentName: fullName,
          studentEmail,
          admissionNo,
          payload: rawPayload,
          response: responsePayload,
          ipAddress: ip || null,
        },
      });

      this.logger.log(`Successfully enrolled CRM student: ${fullName} (${admissionNo})`);
      return responsePayload;
    } catch (err: any) {
      this.logger.error(`Failed to process CRM webhook: ${err.message}`, err.stack);

      // Log failure in webhook activity log
      await this.prisma.webhookLog.create({
        data: {
          apiIntegrationId: integration?.id || null,
          event: eventName,
          status: 'FAILED',
          statusCode: err.status || 500,
          crmId,
          studentName: fullName,
          studentEmail: email,
          payload: rawPayload,
          errorMessage: err.message,
          ipAddress: ip || null,
        },
      }).catch(() => null);

      throw err;
    }
  }

  /**
   * Retrieves list of CRM-enrolled admissions with stats and pagination.
   */
  async getCrmAdmissions(params: {
    centreId?: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      return await this._getCrmAdmissionsInternal(params);
    } catch (err: any) {
      this.logger.warn(`Initial getCrmAdmissions failed (${err?.message}). Running self-healing DDL...`);
      await this.ensureSchema();
      return await this._getCrmAdmissionsInternal(params);
    }
  }

  private async _getCrmAdmissionsInternal(params: {
    centreId?: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const statusFilter = (params.status || 'ACTIVE').toUpperCase();
    const where: any = {
      ...(statusFilter === 'ALL'
        ? {}
        : { user: { status: statusFilter === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' } }),
      OR: [
        { source: 'CRM_WEBHOOK' },
        { externalCrmId: { not: null } },
      ],
    };

    if (params.centreId) {
      where.enrollments = {
        some: {
          batch: { centreId: params.centreId },
        },
      };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.AND = [
        {
          OR: [
            { admissionNo: { contains: q, mode: 'insensitive' } },
            { externalCrmId: { contains: q, mode: 'insensitive' } },
            { parentName: { contains: q, mode: 'insensitive' } },
            { parentPhone: { contains: q, mode: 'insensitive' } },
            {
              user: {
                OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      ];
    }

    const [total, profiles] = await Promise.all([
      this.prisma.studentProfile.count({ where }),
      this.prisma.studentProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: SAFE_USER_SELECT },
          enrollments: {
            include: {
              batch: {
                include: {
                  centre: true,
                  academicYear: true,
                  board: true,
                  standard: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Stats
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = await this.prisma.studentProfile.count({
      where: {
        ...where,
        createdAt: { gte: firstDay },
      },
    });

    return {
      data: profiles,
      total,
      thisMonth,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Permanently deletes a CRM admission, cascading to User, Enrollments, linked Enquiry, and Webhook Logs.
   * This completely clears test data so the CRM ID can be reused fresh.
   */
  async deleteCrmAdmission(id: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!profile) {
      throw new NotFoundException(`CRM admission record with ID "${id}" not found.`);
    }

    const crmId = profile.externalCrmId;
    const userId = profile.userId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete associated child records
      await tx.enrollment.deleteMany({ where: { studentProfileId: id } }).catch(() => null);
      await tx.feeRecord.deleteMany({ where: { studentId: id } }).catch(() => null);
      await tx.assignmentSubmission.deleteMany({ where: { studentId: id } }).catch(() => null);
      await tx.attendanceRecord.deleteMany({ where: { studentId: id } }).catch(() => null);
      await tx.examResult.deleteMany({ where: { studentId: id } }).catch(() => null);

      // 2. Delete linked enquiry if created via CRM
      if (crmId) {
        await tx.enquiry.deleteMany({
          where: {
            OR: [
              { externalCrmId: crmId },
              {
                AND: [
                  { studentName: `${profile.user?.firstName || ''} ${profile.user?.lastName || ''}`.trim() },
                  { source: 'CRM' },
                ],
              },
            ],
          },
        }).catch(() => null);
      }

      // 3. Delete Profile and User account
      await tx.studentProfile.delete({ where: { id } }).catch(() => null);
      if (userId) {
        await tx.userCentre.deleteMany({ where: { userId } }).catch(() => null);
        await tx.user.delete({ where: { id: userId } }).catch(() => null);
      }

      // 4. Delete webhook logs matching this CRM ID
      if (crmId) {
        await tx.webhookLog.deleteMany({ where: { crmId } }).catch(() => null);
      }
    });

    this.logger.log(`Purged CRM admission ${id} (CRM ID: ${crmId || 'N/A'})`);
    return { success: true, message: 'CRM admission permanently deleted.' };
  }

  /**
   * Retrieves latest webhook activity logs.
   */
  async getWebhookLogs(limit: number = 50): Promise<any[]> {
    try {
      return await this.prisma.webhookLog.findMany({
        take: Math.min(100, Math.max(1, limit)),
        orderBy: { createdAt: 'desc' },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to fetch webhook logs (${err?.message}). Running self-healing DDL...`);
      await this.ensureSchema();
      try {
        return await this.prisma.webhookLog.findMany({
          take: Math.min(100, Math.max(1, limit)),
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        return [];
      }
    }
  }

  /**
   * Clears all webhook delivery audit logs.
   */
  async clearWebhookLogs(): Promise<{ success: boolean; deletedCount: number }> {
    const res = await this.prisma.webhookLog.deleteMany({});
    this.logger.log(`Cleared ${res.count} webhook logs`);
    return { success: true, deletedCount: res.count };
  }
}
