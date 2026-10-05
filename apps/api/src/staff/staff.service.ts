import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async createStaff(data: any) {
    try {
      const roleName = data.role;
      const role = await this.prisma.role.findUnique({ where: { name: roleName } });
      if (!role) throw new NotFoundException(`Role "${roleName}" not found.`);

      const centre = await this.prisma.centre.findFirst({ where: { name: data.centre } });
      if (!centre) throw new NotFoundException(`Centre "${data.centre}" not found.`);

      // 3. Generate credentials
      const email = data.email || `staff.${Date.now()}@educare.com`;
      const password = await argon2.hash(data.password || 'password123');

      // 4. Create User, TeacherProfile, and UserCentre in a transaction
      const newStaff = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email,
            password,
            firstName: data.name ? data.name.split(' ')[0] : 'New',
            lastName: data.name ? data.name.split(' ').slice(1).join(' ') : 'Staff',
            roleId: role.id,
          }
        });

        let profile = null;
        if (roleName === 'TEACHER') {
          profile = await prisma.teacherProfile.create({
            data: {
              userId: user.id,
              qualification: data.qualification || '',
              experience: data.experience || 0,
            }
          });
        }

        // Link User to Centre
        await prisma.userCentre.create({
          data: {
            userId: user.id,
            centreId: centre.id,
          }
        });

        return { user, profile };
      });

      return newStaff;
    } catch (error: any) {
      console.error('Error creating staff:', error);
      throw new InternalServerErrorException(error.message || 'Failed to create staff');
    }
  }

  async getStaff() {
    return this.prisma.user.findMany({
      where: {
        role: {
          name: {
            notIn: ['STUDENT', 'PUBLIC_LEARNER', 'SUPER_ADMIN']
          }
        }
      },
      include: {
        teacherProfile: true,
        userCentres: {
          include: {
            centre: true
          }
        },
        role: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStaff(userId: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Staff not found');

    const centre = data.centre ? await this.prisma.centre.findFirst({ where: { name: data.centre } }) : null;

    return this.prisma.$transaction(async (prisma) => {
      let roleId = user.roleId;
      if (data.role) {
        const role = await prisma.role.findUnique({ where: { name: data.role } });
        if (role) roleId = role.id;
        else throw new NotFoundException(`Role "${data.role}" not found`);
      }

      const updateData: any = {
        email: data.email || undefined,
        firstName: data.name ? data.name.split(' ')[0] : undefined,
        lastName: data.name ? data.name.split(' ').slice(1).join(' ') : undefined,
        roleId,
        status: data.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
      };

      if (data.password) {
        updateData.password = await argon2.hash(data.password);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      if (centre) {
        await prisma.userCentre.deleteMany({ where: { userId } });
        await prisma.userCentre.create({ data: { userId, centreId: centre.id } });
      }

      return updatedUser;
    });
  }

  async deleteStaff(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Staff not found');
    
    return this.prisma.$transaction(async (prisma) => {
      await prisma.userCentre.deleteMany({ where: { userId } });
      await prisma.teacherProfile.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      return { success: true };
    });
  }

}
