import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { isSuperAdmin } from '../utils/tenant.util';
import { checkModulePermission } from '../constants/permissions.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permission metadata is defined on the handler or class, allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // 1. Super Admins bypass module restrictions
    if (isSuperAdmin(user)) {
      return true;
    }

    const userRoleName = typeof user.role === 'string' ? user.role : user.role?.name;
    const normalizedRole = userRoleName ? userRoleName.toUpperCase().replace(/\s+/g, '_') : '';

    // 2. Allow Student / Public Learner access to endpoints specifically permitting their role
    if (normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER') {
      const allowedRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (allowedRoles && (allowedRoles.includes('STUDENT') || allowedRoles.includes('PUBLIC_LEARNER'))) {
        return true;
      }
    }

    // 3. Extract granted actions from user overridden permissions or role permissions
    if (Array.isArray(user.customModules)) {
      for (const required of requiredPermissions) {
        const modKey = required.split('.')[0].toUpperCase();
        if (!user.customModules.map((m: string) => m.toUpperCase()).includes(modKey)) {
          throw new ForbiddenException(
            `Access denied: Administrator has restricted your access to the ${modKey} module.`
          );
        }
      }
    }

    let grantedActions: string[] = [];
    if (Array.isArray(user.permissions)) {
      grantedActions = user.permissions;
    } else if (Array.isArray(user.role?.permissions)) {
      grantedActions = user.role.permissions
        .map((p: any) => p.permission?.action || p.action)
        .filter(Boolean);
    }

    // 4. Verify all required permissions are granted
    const missingPermissions: string[] = [];
    for (const required of requiredPermissions) {
      const hasAccess = checkModulePermission(grantedActions, required);
      if (!hasAccess) {
        missingPermissions.push(required);
      }
    }

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Access denied: Your role (${userRoleName || 'Unassigned'}) does not have permission for: ${missingPermissions.join(', ')}`
      );
    }

    return true;
  }
}
