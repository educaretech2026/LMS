import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType } from '@educare/database';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(data: any, user: any) {
    let centreId = data.centreId;
    if (!isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      if (centreId) {
        assertCentreAccess(user, centreId);
      } else if (authorizedCentres.length > 0) {
        centreId = authorizedCentres[0];
      } else {
        throw new ForbiddenException('User has no authorized centres to record transactions');
      }
    }

    if (!data.category || data.amount === undefined || isNaN(Number(data.amount))) {
      throw new BadRequestException('Valid category and numeric amount are required');
    }

    return this.prisma.transaction.create({
      data: {
        type: data.type || TransactionType.EXPENSE,
        category: data.category,
        amount: parseFloat(data.amount),
        date: data.date ? new Date(data.date) : new Date(),
        reference: data.reference || null,
        description: data.description || null,
        paymentMode: data.paymentMode || null,
        centreId: centreId || null,
        recordedById: user?.id || user,
      }
    });
  }

  async getTransactions(user?: any) {
    const isSuper = isSuperAdmin(user);
    const authorizedCentres = isSuper ? [] : getAuthorizedCentreIds(user);

    const txWhere: any = {};
    if (!isSuper) {
      txWhere.centreId = { in: authorizedCentres };
    }

    const adhocTransactions = await this.prisma.transaction.findMany({
      where: txWhere,
      orderBy: { date: 'desc' },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    const feeWhere: any = { status: 'PAID' };
    if (!isSuper) {
      feeWhere.student = {
        enrollments: {
          some: {
            batch: {
              centreId: { in: authorizedCentres }
            }
          }
        }
      };
    }

    const paidFees = await this.prisma.feeRecord.findMany({
      where: feeWhere,
      include: {
        student: { select: { user: { select: { firstName: true, lastName: true } } } }
      }
    });

    const mappedFees = paidFees.map(f => ({
      id: f.id,
      type: TransactionType.INCOME,
      category: f.feeHead || 'Tuition Fee',
      amount: f.amount,
      date: f.date,
      reference: f.receiptNo,
      description: `Fee payment by ${f.student?.user?.firstName || 'Student'} ${f.student?.user?.lastName || ''}`.trim(),
      paymentMode: f.paymentMode || 'N/A',
      recordedBy: { firstName: 'System', lastName: 'Auto' }
    }));

    const allTransactions = [...adhocTransactions, ...mappedFees] as any[];
    allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return allTransactions;
  }

  async getSummary(user?: any) {
    const isSuper = isSuperAdmin(user);
    const authorizedCentres = isSuper ? [] : getAuthorizedCentreIds(user);

    const txWhere: any = {};
    if (!isSuper) {
      txWhere.centreId = { in: authorizedCentres };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: txWhere,
    });
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) totalIncome += t.amount;
      if (t.type === TransactionType.EXPENSE) totalExpense += t.amount;
    });

    // Also factor in FeeRecords as Income
    const feeWhere: any = { status: 'PAID' };
    if (!isSuper) {
      feeWhere.student = {
        enrollments: {
          some: {
            batch: {
              centreId: { in: authorizedCentres }
            }
          }
        }
      };
    }

    const fees = await this.prisma.feeRecord.findMany({
      where: feeWhere
    });
    
    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    totalIncome += totalFees;

    return {
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      totalFees
    };
  }
}
