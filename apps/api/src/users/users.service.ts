import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        studentProfile: {
          include: {
            enrollments: {
              include: {
                batch: { include: { standard: true, board: true } },
                subjects: true
              }
            }
          }
        },
        teacherProfile: true,
        userCentres: {
          include: {
            centre: true
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');
    
    // Omit password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.email) updateData.email = data.email;
    if (data.avatar) updateData.avatar = data.avatar;
    if (data.password) updateData.password = await argon2.hash(data.password);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }
}
