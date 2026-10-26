import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getUserCentreIds } from '../common/utils/tenant.util';
import { SupportTicketStatus } from '@educare/database';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async createTicket(userId: string, subject: string, description: string, imageUrl?: string) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject,
        description,
        imageUrl,
      },
    });
  }

  async getMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllTickets(currentUser?: any) {
    if (isSuperAdmin(currentUser)) {
      return this.prisma.supportTicket.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const centreIds = getUserCentreIds(currentUser);
    if (!centreIds || centreIds.length === 0) {
      // Fail closed
      return [];
    }

    return this.prisma.supportTicket.findMany({
      where: {
        user: {
          OR: [
            { userCentres: { some: { centreId: { in: centreIds } } } },
            { studentProfile: { enrollments: { some: { batch: { centreId: { in: centreIds } } } } } },
          ],
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTicketStatus(id: string, status: any, currentUser?: any) {
    if (!Object.values(SupportTicketStatus).includes(status)) {
      throw new BadRequestException(`Invalid ticket status: ${status}`);
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            userCentres: true,
            studentProfile: {
              include: {
                enrollments: {
                  include: { batch: true },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (!isSuperAdmin(currentUser)) {
      const centreIds = getUserCentreIds(currentUser);
      if (!centreIds || centreIds.length === 0) {
        throw new ForbiddenException('Access denied: No centre assignments found for your account.');
      }

      // Check user centre link
      const userCentreMatches = ticket.user.userCentres?.some((uc: any) => centreIds.includes(uc.centreId));
      const studentBatchMatches = ticket.user.studentProfile?.enrollments?.some((e: any) =>
        centreIds.includes(e.batch?.centreId),
      );

      if (!userCentreMatches && !studentBatchMatches) {
        // Fail closed for out-of-scope ticket or owner with no centre association
        throw new ForbiddenException('Access denied: You are not authorized to manage tickets for this centre.');
      }
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: status as SupportTicketStatus },
    });
  }
}

