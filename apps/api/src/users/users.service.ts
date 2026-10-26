import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    @Optional() private storageService?: StorageService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        studentProfile: {
          include: {
            enrollments: {
              include: {
                batch: {
                  include: {
                    standard: true,
                    board: true,
                    centre: true,
                    academicYear: true,
                  }
                },
                subjects: true,
                track: true,
              }
            }
          }
        },
        teacherProfile: {
          include: {
            assignments: {
              include: {
                board: true,
                standard: true,
                subject: true,
                academicYear: true,
              }
            }
          }
        },
        userCentres: {
          include: {
            centre: true
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');
    
    // Omit password and extract permissions
    const { password, ...userWithoutPassword } = user;
    const permissions = user.role?.permissions?.map((p: any) => p.permission?.action).filter(Boolean) || [];
    return {
      ...userWithoutPassword,
      permissions,
    };
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.email) updateData.email = data.email;
    if (data.avatar) {
      if (this.storageService?.validateAndEnforceObjectSize) {
        await this.storageService.validateAndEnforceObjectSize(data.avatar, 20 * 1024 * 1024);
      }
      updateData.avatar = data.avatar;
    }
    if (data.password) updateData.password = await argon2.hash(data.password);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (data.password) {
      await this.redisService.revokeAllSessions(userId);
    }

    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }
}
