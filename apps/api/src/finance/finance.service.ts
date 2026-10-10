import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType } from '@educare/database';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(data: any, userId: string) {
    return this.prisma.transaction.create({
      data: {
        ...data,
        amount: parseFloat(data.amount),
        date: data.date ? new Date(data.date) : new Date(),
        recordedById: userId,
      }
    });
  }

  async getTransactions() {
    const adhocTransactions = await this.prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    const paidFees = await this.prisma.feeRecord.findMany({
      where: { status: 'PAID' },
      include: {
        student: { select: { firstName: true, lastName: true } }
      }
    });

    const mappedFees = paidFees.map(f => ({
      id: f.id,
      type: TransactionType.INCOME,
      category: f.feeHead || 'Tuition Fee',
      amount: f.amount,
      date: f.date,
      reference: f.receiptNo,
      description: `Fee payment by ${f.student.firstName} ${f.student.lastName}`,
      paymentMode: f.paymentMode || 'N/A',
      recordedBy: { firstName: 'System', lastName: 'Auto' }
    }));

    const allTransactions = [...adhocTransactions, ...mappedFees] as any[];
    allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return allTransactions;
  }

  async getSummary() {
    const transactions = await this.prisma.transaction.findMany();
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) totalIncome += t.amount;
      if (t.type === TransactionType.EXPENSE) totalExpense += t.amount;
    });

    // Also factor in FeeRecords as Income
    const fees = await this.prisma.feeRecord.findMany({
      where: { status: 'PAID' }
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
