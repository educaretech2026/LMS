import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getUserCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class FeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user?: any) {
    let whereClause: any = {};
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;

    if (roleName === 'STUDENT') {
      whereClause = { student: { userId: user.id } };
    } else if (roleName === 'CENTRE_ADMIN') {
      const centreIds = getUserCentreIds(user);
      whereClause = {
        student: {
          enrollments: {
            some: {
              batch: {
                centreId: { in: centreIds }
              }
            }
          }
        }
      };
    }

    return this.prisma.feeRecord.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: true,
            enrollments: {
              include: {
                batch: {
                  include: {
                    centre: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  async create(data: any, user?: any) {
    if (!data.studentId) {
      throw new BadRequestException('studentId is required');
    }

    // Verify centre ownership for non-superadmin
    if (user && !isSuperAdmin(user)) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: data.studentId },
        include: { enrollments: { include: { batch: true } } }
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }
      const allowed = getUserCentreIds(user);
      const studentCentres = student.enrollments.map(e => e.batch.centreId);
      const hasAccess = studentCentres.some(cId => allowed.includes(cId));
      if (!hasAccess) {
        throw new ForbiddenException('Access denied: You cannot create fees for students outside your centre.');
      }
    }

    return this.prisma.feeRecord.create({
      data: {
        receiptNo: `FEE-${Date.now()}`,
        studentId: data.studentId,
        amount: Number(data.amount),
        status: data.status || 'PAID',
        paymentMode: data.paymentMode,
        feeHead: data.feeHead,
        targetTrackId: data.targetTrackId || null
      }
    });
  }

  async delete(id: string, user?: any) {
    const record = await this.prisma.feeRecord.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            enrollments: { include: { batch: true } }
          }
        }
      }
    });

    if (!record) {
      throw new NotFoundException('Fee record not found');
    }

    if (user && !isSuperAdmin(user)) {
      const allowed = getUserCentreIds(user);
      const studentCentres = record.student?.enrollments?.map(e => e.batch?.centreId).filter(Boolean) || [];
      const hasAccess = studentCentres.some(cId => allowed.includes(cId));
      if (!hasAccess) {
        throw new ForbiddenException('Access denied: You cannot delete fee records for other centres.');
      }
    }

    return this.prisma.feeRecord.delete({
      where: { id }
    });
  }

  async updateStatus(id: string, status: any, user?: any) {
    const record = await this.prisma.feeRecord.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            enrollments: { include: { batch: true } }
          }
        }
      }
    });

    if (!record) {
      throw new NotFoundException('Fee record not found');
    }

    if (user && !isSuperAdmin(user)) {
      const allowed = getUserCentreIds(user);
      const studentCentres = record.student?.enrollments?.map(e => e.batch?.centreId).filter(Boolean) || [];
      const hasAccess = studentCentres.some(cId => allowed.includes(cId));
      if (!hasAccess) {
        throw new ForbiddenException('Access denied: You cannot update fee records for other centres.');
      }
    }

    const feeRecord = await this.prisma.feeRecord.update({
      where: { id },
      data: { status },
      include: { student: true }
    });

    if (feeRecord && feeRecord.student && feeRecord.student.userId) {
      const userStatus = status === 'PAID' ? 'ACTIVE' : 'INACTIVE';
      await this.prisma.user.update({
        where: { id: feeRecord.student.userId },
        data: { status: userStatus }
      });
    }

    return feeRecord;
  }

  async sendReminder(studentId: string, payload: any, currentUser?: any) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { 
        user: true, 
        enrollments: { include: { batch: { include: { standard: true, centre: true } } } } 
      }
    });

    if (!student) throw new HttpException('Student not found', HttpStatus.NOT_FOUND);

    if (currentUser && !isSuperAdmin(currentUser)) {
      const studentCentreId = student.enrollments?.[0]?.batch?.centreId;
      if (studentCentreId) {
        assertCentreAccess(currentUser, studentCentreId);
      }
    }

    const phone = student.parentPhone;
    if (!phone) throw new HttpException('No contact number found for this student', HttpStatus.BAD_REQUEST);

    const cleanPhone = phone.replace(/\D/g, '');
    const to = cleanPhone.startsWith('91') ? cleanPhone : (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone);

    const amount = payload.amount;
    const lastDate = payload.lastDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
    
    const batch = student.enrollments?.[0]?.batch;
    const className = batch?.standard?.name || "N/A";
    const batchName = batch?.name || "N/A";
    const centreName = batch?.centre?.name || "N/A";

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      // Mock mode if env vars are not set
      console.log(`[MOCK WHATSAPP API] Message to ${to}`);
      console.log(`Template: fee_reminder_cutoff`);
      console.log(`Variables: ${student.user.firstName}, ${className}, ${batchName}, ${centreName}, ${amount}, ${lastDate}`);
      return { success: true, message: 'Message logged (Meta API keys not configured in .env)' };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: 'fee_reminder_cutoff', // Ensure you create this template in Meta Business Manager
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: student.user.firstName || 'Student' },
                  { type: 'text', text: className },
                  { type: 'text', text: batchName },
                  { type: 'text', text: centreName },
                  { type: 'text', text: String(amount) },
                  { type: 'text', text: lastDate }
                ]
              }
            ]
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'WhatsApp API Error');
      }

      return { success: true, data };
    } catch (error: any) {
      throw new HttpException(`Failed to send WhatsApp message: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
