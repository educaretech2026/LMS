import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LiveClassService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.liveClass.findMany({
      include: {
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async create(data: {
    title: string;
    subject: string;
    teacherName: string;
    scheduledAt: string;
    duration: number;
    boardId?: string;
    standardId?: string;
    centreId?: string;
    zoomLink?: string;
  }) {
    return this.prisma.liveClass.create({
      data: {
        title: data.title,
        subject: data.subject,
        teacherName: data.teacherName,
        scheduledAt: new Date(data.scheduledAt),
        duration: Number(data.duration),
        roomId: data.zoomLink || undefined,
        boardId: data.boardId || null,
        standardId: data.standardId || null,
        centreId: data.centreId || null,
      },
      include: {
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(id: string, status: 'SCHEDULED' | 'LIVE' | 'ENDED') {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Live class not found');
    return this.prisma.liveClass.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string) {
    return this.prisma.liveClass.delete({ where: { id } });
  }

  async getStats() {
    const [total, live] = await Promise.all([
      this.prisma.liveClass.count(),
      this.prisma.liveClass.count({ where: { status: 'LIVE' } }),
    ]);
    return { total, live };
  }
}
