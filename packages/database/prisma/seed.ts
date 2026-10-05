import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full access',
    },
  });

  const centreAdminRole = await prisma.role.upsert({
    where: { name: 'CENTRE_ADMIN' },
    update: {},
    create: {
      name: 'CENTRE_ADMIN',
      description: 'Administrator for a specific centre',
    },
  });

  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: {
      name: 'TEACHER',
      description: 'Teacher staff member',
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      description: 'Enrolled student',
    },
  });

  // Create Permissions
  const permissions = [
    'students.view', 'students.create', 'students.update', 'students.delete',
    'staff.view', 'staff.create', 'staff.update', 'staff.delete',
    'courses.view', 'courses.manage',
    'attendance.view', 'attendance.manage',
    'reports.view'
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { action: p },
      update: {},
      create: { action: p, description: `Permission for ${p}` },
    });
  }

  // Create Centres
  const centreA = await prisma.centre.upsert({
    where: { code: 'CENTRE_A' },
    update: {},
    create: {
      name: 'Educare Kalathipady',
      code: 'CENTRE_A',
      address: '123 Education St, Knowledge City',
      contactNo: '+1234567890',
    },
  });

  const centreB = await prisma.centre.upsert({
    where: { code: 'CENTRE_B' },
    update: {},
    create: {
      name: 'Educare North Wing',
      code: 'CENTRE_B',
      address: '456 Learning Blvd, North City',
      contactNo: '+0987654321',
    },
  });

  // Create Super Admin User
  const superAdminPassword = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@educare.com' },
    update: { roleId: superAdminRole.id },
    create: {
      email: 'admin@educare.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      roleId: superAdminRole.id,
    },
  });

  // Create Centre Admin for Centre A
  const centreAdminPassword = await argon2.hash('centre123');
  const centreAdminA = await prisma.user.upsert({
    where: { email: 'centrea@educare.com' },
    update: {},
    create: {
      email: 'centrea@educare.com',
      password: centreAdminPassword,
      firstName: 'Centre A',
      lastName: 'Admin',
      roleId: centreAdminRole.id,
    },
  });

  // Link Centre Admin to Centre A
  await prisma.userCentre.upsert({
    where: { userId_centreId: { userId: centreAdminA.id, centreId: centreA.id } },
    update: {},
    create: {
      userId: centreAdminA.id,
      centreId: centreA.id,
    },
  });

  // Seed Academic Structure for Mock UI
  console.log('Seeding Academic Structure...');
  await prisma.academicYear.upsert({
    where: { name: '2025-26' },
    update: {},
    create: { name: '2025-26', isActive: true },
  });

  await prisma.academicYear.upsert({
    where: { name: '2026-27' },
    update: {},
    create: { name: '2026-27', isActive: false },
  });

  await prisma.board.upsert({
    where: { name: 'CBSE' },
    update: {},
    create: { name: 'CBSE' },
  });
  
  await prisma.board.upsert({
    where: { name: 'State' },
    update: {},
    create: { name: 'State' },
  });
  
  await prisma.board.upsert({
    where: { name: 'ICSE' },
    update: {},
    create: { name: 'ICSE' },
  });
  
  await prisma.board.upsert({
    where: { name: 'ISC' },
    update: {},
    create: { name: 'ISC' },
  });

  let class11 = await prisma.standard.findFirst({ where: { name: 'Class 11' } });
  if (!class11) {
    class11 = await prisma.standard.create({ data: { name: 'Class 11' } });
  }
  
  let class12 = await prisma.standard.findFirst({ where: { name: 'Class 12' } });
  if (!class12) {
    class12 = await prisma.standard.create({ data: { name: 'Class 12' } });
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
