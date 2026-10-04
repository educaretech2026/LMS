import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(activeOnly: boolean = false) {
    const filter = activeOnly ? { isActive: true } : {};
    return this.prisma.notice.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { title: string; content: string; type?: string; isActive?: boolean }) {
    return this.prisma.notice.create({
      data: {
        title: data.title,
        content: data.content,
        type: data.type || 'GENERAL',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(id: string, data: { title?: string; content?: string; type?: string; isActive?: boolean }) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    return this.prisma.notice.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.notice.delete({ where: { id } });
  }
}
