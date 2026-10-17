import { ForbiddenException } from '@nestjs/common';

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

export function assertCentreAccess(user: any, centreId?: string | null): void {
  if (!centreId) return;
  if (isSuperAdmin(user)) return;
  const allowed = getUserCentreIds(user);
  if (!allowed.includes(centreId)) {
    throw new ForbiddenException('Access denied: You are not authorized for this centre.');
  }
}
