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
      } else {
        throw new ForbiddenException('A centre assignment is required to create a form.');
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
      where.centreId = { in: authorizedCentres };
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
      if (!existing.centreId) {
        throw new ForbiddenException('Only super administrators can modify global forms.');
      }
      assertCentreAccess(user, existing.centreId);

      if (data.centreId !== undefined) {
        if (!data.centreId) {
          throw new ForbiddenException('Cannot convert a centre form to a global form.');
        }
        assertCentreAccess(user, data.centreId);
      }
    }

    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = String(data.title);
    if (data.description !== undefined) updatePayload.description = data.description ? String(data.description) : null;
    if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);
    if (data.fields !== undefined) updatePayload.fields = data.fields;
    if (data.centreId !== undefined) updatePayload.centreId = data.centreId || null;

    return this.prisma.customForm.update({
      where: { id },
      data: updatePayload,
    });
  }

  async deleteForm(id: string, user?: any): Promise<any> {
    const existing = await this.prisma.customForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user)) {
      if (!existing.centreId) {
        throw new ForbiddenException('Only super administrators can delete global forms.');
      }
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

    if (user && !isSuperAdmin(user)) {
      if (!form.centreId) {
        throw new ForbiddenException('Only super administrators can view responses to global forms.');
      }
      assertCentreAccess(user, form.centreId);
    }

    return this.prisma.customFormResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
