import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EnquiryStatus } from '@educare/database';
import { isSuperAdmin, getUserCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class EnquiryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Public enquiry creation (e.g. from website admission form).
   * Strictly whitelists allowed contact/interest fields.
   * Strips all internal / privileged fields (status, assignedToId, notes, followUpDate).
   */
  async createPublicEnquiry(data: any) {
    if (!data || !data.studentName || !data.contactNumber) {
      throw new BadRequestException('Student name and contact number are required.');
    }

    let targetCentreId: string | null = null;
    if (data.centreId) {
      const centre = await this.prisma.centre.findUnique({
        where: { id: data.centreId },
      });
      if (centre && centre.status === 'ACTIVE') {
        targetCentreId = centre.id;
      }
    }

    return this.prisma.enquiry.create({
      data: {
        studentName: String(data.studentName).trim(),
        parentName: data.parentName ? String(data.parentName).trim() : null,
        contactNumber: String(data.contactNumber).trim(),
        email: data.email ? String(data.email).trim() : null,
        address: data.address ? String(data.address).trim() : null,
        source: data.source ? String(data.source).trim() : 'Website Form',
        targetBoard: data.targetBoard ? String(data.targetBoard).trim() : null,
        targetStandard: data.targetStandard ? String(data.targetStandard).trim() : null,
        targetCourse: data.targetCourse ? String(data.targetCourse).trim() : null,
        status: EnquiryStatus.NEW,
        centreId: targetCentreId,
      },
    });
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

    return this.prisma.enquiry.create({
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

    return this.prisma.enquiry.findMany({
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

    const total = await this.prisma.enquiry.count({ where: baseWhere });

    // Beginning of current month
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

    return this.prisma.enquiry.update({
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
  }

  /**
   * Super Admin reconciliation tool:
   * Returns legacy enquiries where centreId is null and suggests backfills based on assigned staff's centre.
   */
  async getUnreconciledEnquiries() {
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
      const isUnambiguous = assignedCentres.length === 1;
      return {
        id: e.id,
        studentName: e.studentName,
        contactNumber: e.contactNumber,
        assignedToId: e.assignedToId,
        assignedToName: e.assignedTo ? `${e.assignedTo.firstName} ${e.assignedTo.lastName}` : null,
        suggestedCentreId: isUnambiguous ? assignedCentres[0].centreId : null,
        suggestedCentreName: isUnambiguous ? assignedCentres[0].centre.name : null,
        isAmbiguous: !isUnambiguous,
        reason: isUnambiguous
          ? 'Unambiguously inferred from assigned staff centre'
          : assignedCentres.length === 0
          ? 'No assigned staff or staff has no centre'
          : 'Staff is assigned to multiple centres',
      };
    });
  }
}
