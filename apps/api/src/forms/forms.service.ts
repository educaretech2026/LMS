import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  async createForm(data: { title: string; description?: string; isActive?: boolean; fields: any; centreId?: string }): Promise<any> {
    return this.prisma.customForm.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true,
        fields: data.fields,
        centreId: data.centreId,
      },
    });
  }

  async getForms(): Promise<any> {
    return this.prisma.customForm.findMany({
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

  async updateForm(id: string, data: { title?: string; description?: string; isActive?: boolean; fields?: any }): Promise<any> {
    return this.prisma.customForm.update({
      where: { id },
      data,
    });
  }

  async deleteForm(id: string): Promise<any> {
    return this.prisma.customForm.delete({
      where: { id },
    });
  }

  async submitResponse(formId: string, data: any): Promise<any> {
    // Validate form exists and is active
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) {
      throw new Error('Form is not active or does not exist');
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

  async getFormResponses(formId: string): Promise<any> {
    return this.prisma.customFormResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
