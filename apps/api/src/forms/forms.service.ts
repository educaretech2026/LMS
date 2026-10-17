import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  async createForm(data: { title: string; description?: string; isActive?: boolean; fields: any; centreId?: string }, user?: any): Promise<any> {
    let centreId = data.centreId;
    if (user && !isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      if (centreId) {
        assertCentreAccess(user, centreId);
      } else if (authorizedCentres.length > 0) {
        centreId = authorizedCentres[0];
      }
    }

    return this.prisma.customForm.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true,
        fields: data.fields,
        centreId: centreId || null,
      },
    });
  }

  async getForms(user?: any): Promise<any> {
    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      where.OR = [
        { centreId: { in: authorizedCentres } },
        { centreId: null }
      ];
    }

    return this.prisma.customForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });
  }

  async getFormById(id: string): Promise<any> {
    const form = await this.prisma.customForm.findUnique({
      where: { id },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async updateForm(id: string, data: { title?: string; description?: string; isActive?: boolean; fields?: any; centreId?: string }, user?: any): Promise<any> {
    const existing = await this.prisma.customForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user)) {
      if (existing.centreId) {
        assertCentreAccess(user, existing.centreId);
      }
      if (data.centreId) {
        assertCentreAccess(user, data.centreId);
      }
    }

    return this.prisma.customForm.update({
      where: { id },
      data,
    });
  }

  async deleteForm(id: string, user?: any): Promise<any> {
    const existing = await this.prisma.customForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user) && existing.centreId) {
      assertCentreAccess(user, existing.centreId);
    }

    return this.prisma.customForm.delete({
      where: { id },
    });
  }

  async submitResponse(formId: string, data: any): Promise<any> {
    // Validate form exists and is active
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) {
      throw new BadRequestException('Form is not active or does not exist');
    }

    const response = await this.prisma.customFormResponse.create({
      data: {
        formId,
        data,
      },
    });

    // Notify Admins
    try {
      const admins = await this.prisma.user.findMany({ where: { role: { name: 'SUPER_ADMIN' } } });
      for (const admin of admins) {
        await this.notificationsService.sendNotification({
          userId: admin.id,
          title: 'New Form Response',
          message: `A new response was submitted for "${form.title}"`,
          type: 'INFO',
          link: `/forms/${form.id}/responses`,
        });
      }
    } catch (e) {}

    return response;
  }

  async getFormResponses(formId: string, user?: any): Promise<any> {
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user) && form.centreId) {
      assertCentreAccess(user, form.centreId);
    }

    return this.prisma.customFormResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
