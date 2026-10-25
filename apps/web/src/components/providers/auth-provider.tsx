"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { checkModulePermission } from "@/lib/permissions";

interface AuthContextType {
  role: string | null;
  email: string | null;
  centreName: string | null;
  userId: string | null;
  permissions: string[];
  hasPermission: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  email: null,
  centreName: null,
  userId: null,
  permissions: [],
  hasPermission: () => false,
});

export function AuthProvider({
  children,
  initialRole = null,
  initialEmail = null,
  initialCentreName = null,
  initialUserId = null,
  initialPermissions = [],
}: {
  children: React.ReactNode;
  initialRole?: string | null;
  initialEmail?: string | null;
  initialCentreName?: string | null;
  initialUserId?: string | null;
  initialPermissions?: string[];
}) {
  const [role, setRole] = useState<string | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [centreName, setCentreName] = useState<string | null>(initialCentreName);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);

  useEffect(() => {
    // If state wasn't populated from server initial props, query the same-origin BFF /api/auth/me
    if (!role || permissions.length === 0) {
      fetch('/api/auth/me', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated && data.user) {
            const userRole =
              typeof data.user.role === 'object'
                ? data.user.role?.name
                : data.user.role;
            setRole(userRole || null);
            setEmail(data.user.email || null);
            setUserId(data.user.id || null);
            if (data.user.centreName) setCentreName(data.user.centreName);

            // Extract permissions array
            let perms: string[] = [];
            if (Array.isArray(data.user.permissions)) {
              perms = data.user.permissions;
            } else if (Array.isArray(data.user.role?.permissions)) {
              perms = data.user.role.permissions
                .map((p: any) => p.permission?.action || p.action)
                .filter(Boolean);
            }
            setPermissions(perms);
          }
        })
        .catch(() => {});
    }
  }, [role, permissions.length]);

  const hasPermission = useCallback(
    (moduleKey: string): boolean => {
      if (!moduleKey) return true;
      const normalizedRole = role ? role.toUpperCase().replace(/\s+/g, '_') : '';

      // Super Admin and Admin have complete bypass
      if (normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'ADMIN') {
        return true;
      }

      // Default learner self-service access
      if (normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER') {
        const studentModules = [
          'STUDENTS',
          'ASSIGNMENTS',
          'DOUBTS',
          'LIVE_CLASSES',
          'FEES',
          'EXAMS',
          'ESTUDY',
          'SYLLABUS',
          'CERTIFICATES',
        ];
        if (studentModules.includes(moduleKey.toUpperCase())) {
          return true;
        }
      }

      return checkModulePermission(permissions, moduleKey);
    },
    [role, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        role,
        email,
        centreName,
        userId,
        permissions,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
