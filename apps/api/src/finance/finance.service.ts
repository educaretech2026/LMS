import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType } from '@educare/database';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess, getUserCentreIds, getAuthoritativeFeeWhere } from '../common/utils/tenant.util';

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

    const amountNum = Number(data.amount);
    if (!data.category || data.amount === undefined || !Number.isFinite(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Valid category and positive numeric amount are required');
    }

    const type = data.type || TransactionType.EXPENSE;
    if (!Object.values(TransactionType).includes(type)) {
      throw new BadRequestException(`Invalid transaction type: ${data.type}`);
    }

    if (data.date && isNaN(new Date(data.date).getTime())) {
      throw new BadRequestException('Invalid transaction date');
    }

    return this.prisma.transaction.create({
      data: {
        type,
        category: data.category,
        amount: amountNum,
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
    const authorizedCentres = isSuper ? [] : getUserCentreIds(user);
    if (!isSuper && authorizedCentres.length === 0) {
      return [];
    }

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
      Object.assign(feeWhere, getAuthoritativeFeeWhere(authorizedCentres));
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
      amount: Number(f.amount) || 0,
      date: f.date,
      reference: f.receiptNo,
      description: `Fee payment by ${f.student?.user?.firstName || 'Student'} ${f.student?.user?.lastName || ''}`.trim(),
      paymentMode: f.paymentMode || 'N/A',
      recordedBy: { firstName: 'System', lastName: 'Auto' }
    }));

    const allTransactions = [...adhocTransactions, ...mappedFees] as any[];
    allTransactions.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    return allTransactions;
  }

  async getSummary(user?: any) {
    const isSuper = isSuperAdmin(user);
    const authorizedCentres = isSuper ? [] : getUserCentreIds(user);
    if (!isSuper && authorizedCentres.length === 0) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        profit: 0,
        totalFees: 0
      };
    }

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
      const amt = Number(t.amount) || 0;
      if (t.type === TransactionType.INCOME) totalIncome += amt;
      if (t.type === TransactionType.EXPENSE) totalExpense += amt;
    });

    // Also factor in FeeRecords as Income
    const feeWhere: any = { status: 'PAID' };
    if (!isSuper) {
      Object.assign(feeWhere, getAuthoritativeFeeWhere(authorizedCentres));
    }

    const fees = await this.prisma.feeRecord.findMany({
      where: feeWhere
    });
    
    const totalFees = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    totalIncome += totalFees;

    return {
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
      totalFees
    };
  }
}
