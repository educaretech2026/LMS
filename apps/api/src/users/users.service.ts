import { Injectable, NotFoundException, Optional, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { isSuperAdmin } from '../common/utils/tenant.util';
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
    let permissions = user.role?.permissions?.map((p: any) => p.permission?.action).filter(Boolean) || [];

    const customModules = await this.redisService.getUserModulePermissions(userId);
    if (customModules !== null) {
      permissions = permissions.filter((act: string) => {
        const modKey = act.split('.')[0].toUpperCase();
        return customModules.map(m => m.toUpperCase()).includes(modKey);
      });
    }

    const mustChangePassword = await this.redisService.isMustChangePassword(userId);

    return {
      ...userWithoutPassword,
      permissions,
      customModules,
      mustChangePassword,
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
    if (data.password) {
      updateData.password = await argon2.hash(data.password);
      await this.redisService.clearMustChangePassword(userId);
    }

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

  async getUserModuleAccess(targetUserId: string, currentUser?: any) {
    if (currentUser && !isSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only Super Administrators can view or edit custom user module permissions.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user) throw new NotFoundException('User not found');

    const customModules = await this.redisService.getUserModulePermissions(targetUserId);
    const roleDefaultActions = user.role?.permissions?.map((p: any) => p.permission?.action).filter(Boolean) || [];
    
    // Extract unique modules available to this role
    const defaultModules = Array.from(
      new Set(
        roleDefaultActions.map((act: string) => act.split('.')[0].toUpperCase())
      )
    );

    return {
      userId: targetUserId,
      email: user.email,
      role: user.role.name,
      defaultModules,
      customModules,
      isCustomized: customModules !== null,
    };
  }

  async updateUserModuleAccess(targetUserId: string, modules: string[] | null, currentUser?: any) {
    if (currentUser && !isSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only Super Administrators can manage user module access.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    if (modules === null) {
      await this.redisService.clearUserModulePermissions(targetUserId);
      return {
        success: true,
        message: 'Custom user module permissions reset to role defaults.',
        customModules: null,
      };
    }

    if (!Array.isArray(modules)) {
      throw new BadRequestException('Modules must be an array of module keys or null to reset.');
    }

    const normalized = modules.map(m => String(m).trim().toUpperCase()).filter(Boolean);
    await this.redisService.setUserModulePermissions(targetUserId, normalized);

    return {
      success: true,
      message: 'User module permissions updated successfully.',
      customModules: normalized,
    };
  }
}
