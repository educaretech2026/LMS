import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  async sendSms(to: string, message: string, senderId?: string) {
    const metaToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;

    if (!metaToken || !phoneId) {
      throw new BadRequestException('Meta WhatsApp credentials are not configured.');
    }

    // Format phone number: remove +, spaces, dashes, etc.
    const formattedTo = to.replace(/\D/g, '');

    try {
      // 1. Send via Meta WhatsApp Cloud API
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedTo,
          type: 'text',
          text: { body: message }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Meta WhatsApp API Error:', data);
        throw new Error(data.error?.message || 'Failed to send WhatsApp message');
      }

      const messageId = data.messages?.[0]?.id || 'UNKNOWN_ID';

      // 2. Save log to database
      return this.prisma.smsLog.create({
        data: {
          recipientName: "Unknown", 
          phoneNumber: to,
          message,
          status: 'SENT',
          providerId: messageId,
          sentById: senderId,
        }
      });
    } catch (error: any) {
      console.error(error);
      throw new BadRequestException(`Failed to send WhatsApp message: ${error.message}`);
    }
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
      message: `Bulk WhatsApp job queued for ${type} ${targetId || ''}`,
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
