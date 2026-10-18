import { ForbiddenException } from '@nestjs/common';

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
  status: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function isSuperAdmin(user: any): boolean {
  if (!user) return false;
  const roleName = typeof user.role === 'string' ? user.role : user.role?.name;
  return roleName?.toUpperCase() === 'SUPER_ADMIN';
}

export function getUserCentreIds(user: any): string[] {
  if (!user) return [];
  if (Array.isArray(user.userCentres)) {
    return user.userCentres.map((uc: any) => uc.centreId).filter(Boolean);
  }
  return [];
}

/**
 * Ensures non-superadmin users have at least one authorized centre.
 * Fails closed if no centres are assigned.
 */
export function getAuthorizedCentreIds(user: any): string[] {
  if (isSuperAdmin(user)) return [];
  const allowed = getUserCentreIds(user);
  if (!allowed || allowed.length === 0) {
    throw new ForbiddenException('Access denied: No centre assignments found for your account.');
  }
  return allowed;
}

export function assertCentreAccess(user: any, centreId?: string | null): void {
  if (isSuperAdmin(user)) return;
  if (!centreId) {
    throw new ForbiddenException('Access denied: Centre assignment is required.');
  }
  const allowed = getUserCentreIds(user);
  if (!allowed || allowed.length === 0 || !allowed.includes(centreId)) {
    throw new ForbiddenException('Access denied: You are not authorized for this centre.');
  }
}

/**
 * Authoritative fee-centre isolation condition.
 * 1. Matches records explicitly assigned to the authorized centre(s).
 * 2. Reconciles legacy records where centreId is null ONLY if the student's enrollments
 *    belong exclusively to the authorized centre(s). Excludes ambiguous multi-centre students.
 */
export function getAuthoritativeFeeWhere(centreIds: string[]) {
  if (!centreIds || centreIds.length === 0) {
    return { centreId: { in: [] } };
  }
  return {
    OR: [
      { centreId: { in: centreIds } },
      {
        centreId: null,
        student: {
          enrollments: {
            some: { batch: { centreId: { in: centreIds } } },
            none: { batch: { centreId: { notIn: centreIds } } },
          },
        },
      },
    ],
  };
}


