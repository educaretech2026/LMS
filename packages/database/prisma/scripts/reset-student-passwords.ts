import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Resets student passwords to the standard default ('password123').
 * 
 * Usage:
 *   pnpm --filter @educare/database ts-node prisma/scripts/reset-student-passwords.ts [--dry-run] [--target=email@example.com] [--new-password=xyz]
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const targetArg = args.find(a => a.startsWith('--target=') || a.startsWith('--email=') || a.startsWith('--admission='));
  const target = targetArg ? targetArg.split('=')[1] : null;

  const passwordArg = args.find(a => a.startsWith('--new-password=') || a.startsWith('--password='));
  const newPassword = passwordArg ? passwordArg.split('=')[1] : (process.env.DEFAULT_STUDENT_PASSWORD || 'password123');

  console.log(`============================================================`);
  console.log(` Student Password Reset Utility`);
  console.log(` Mode: ${isDryRun ? 'DRY RUN (no DB changes)' : 'LIVE RUN'}`);
  console.log(` Target: ${target ? target : 'ALL ACTIVE STUDENTS'}`);
  console.log(` Default Password To Set: ${newPassword}`);
  console.log(`============================================================\n`);

  const studentRole = await prisma.role.findUnique({
    where: { name: 'STUDENT' }
  });

  if (!studentRole) {
    console.error(`Error: 'STUDENT' role not found in database.`);
    process.exit(1);
  }

  const whereClause: any = {
    roleId: studentRole.id,
    status: 'ACTIVE',
  };

  if (target) {
    whereClause.OR = [
      { email: { equals: target, mode: 'insensitive' } },
      { studentProfile: { admissionNo: { equals: target, mode: 'insensitive' } } }
    ];
  }

  const students = await prisma.user.findMany({
    where: whereClause,
    include: {
      studentProfile: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${students.length} student account(s) matching criteria.\n`);

  if (students.length === 0) {
    console.log(`No matching student accounts found.`);
    return;
  }

  const hashedPassword = await argon2.hash(newPassword);

  let updatedCount = 0;
  for (const student of students) {
    const admNo = student.studentProfile?.admissionNo || 'N/A';
    const fullName = `${student.firstName} ${student.lastName}`.trim();

    if (isDryRun) {
      console.log(` [DRY RUN] Would reset: ${fullName} (${student.email}) [AdmNo: ${admNo}]`);
    } else {
      await prisma.user.update({
        where: { id: student.id },
        data: { password: hashedPassword }
      });
      console.log(` [UPDATED] Reset: ${fullName} (${student.email}) [AdmNo: ${admNo}]`);
      updatedCount++;
    }
  }

  console.log(`\n============================================================`);
  if (isDryRun) {
    console.log(`Dry run complete. Run without '--dry-run' to apply changes to ${students.length} account(s).`);
  } else {
    console.log(`Successfully reset password to '${newPassword}' for ${updatedCount} student(s).`);
  }
  console.log(`============================================================\n`);
}

main()
  .catch((e) => {
    console.error('Fatal error resetting passwords:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

