import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  // Twilio Client
  private twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

  async sendSms(to: string, message: string, senderId?: string) {
    // 1. Send via Twilio
    const response = await this.twilioClient.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER || 'EDUCARE', to });
    const twilioSid = response.sid;

    // 2. Save log to database
    return this.prisma.smsLog.create({
      data: {
        recipientName: "Unknown", // Can be resolved via DB lookup if needed
        phoneNumber: to,
        message,
        status: 'SENT',
        providerId: twilioSid,
        sentById: senderId,
      }
    });
  }

  async sendBulkSms(data: { type: 'CLASS' | 'BOARD' | 'CENTRE' | 'ALL', targetId?: string, message: string }, senderId: string) {
    const { type, targetId, message } = data;
    
    // In a real scenario, you would fetch students based on the target
    // e.g., if (type === 'CLASS') students = await this.prisma.studentProfile.findMany({ where: { enrollments: { some: { batch: { standardId: targetId } } } } });
    
    // Mocking the behavior for the demo:
    const logs = [];
    const dummyNumbers = ['+919876543210', '+919876543211'];
    
    for (const phone of dummyNumbers) {
      logs.push(await this.sendSms(phone, message, senderId));
    }
    
    return {
      message: `Bulk SMS job queued for ${type} ${targetId || ''}`,
      queuedCount: logs.length
    };
  }

  async getLogs() {
    return this.prisma.smsLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sentBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }
}
