import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  async createForm(data: { title: string; description?: string; isActive?: boolean; fields: any; centreId?: string }) {
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

  async getForms() {
    return this.prisma.customForm.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });
  }

  async getFormById(id: string) {
    const form = await this.prisma.customForm.findUnique({
      where: { id },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async updateForm(id: string, data: { title?: string; description?: string; isActive?: boolean; fields?: any }) {
    return this.prisma.customForm.update({
      where: { id },
      data,
    });
  }

  async deleteForm(id: string) {
    return this.prisma.customForm.delete({
      where: { id },
    });
  }

  async submitResponse(formId: string, data: any) {
    // Validate form exists and is active
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) {
      throw new Error('Form is not active or does not exist');
    }

    return this.prisma.customFormResponse.create({
      data: {
        formId,
        data,
      },
    });
  }

  async getFormResponses(formId: string) {
    return this.prisma.customFormResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
