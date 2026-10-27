"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { checkModulePermission } from "@/lib/permissions";

interface AuthContextType {
  role: string | null;
  email: string | null;
  centreName: string | null;
  userId: string | null;
  permissions: string[];
  mustChangePassword: boolean;
  setMustChangePassword: (val: boolean) => void;
  hasPermission: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  email: null,
  centreName: null,
  userId: null,
  permissions: [],
  mustChangePassword: false,
  setMustChangePassword: () => {},
  hasPermission: () => false,
});

export function AuthProvider({
  children,
  initialRole = null,
  initialEmail = null,
  initialCentreName = null,
  initialUserId = null,
  initialPermissions = [],
  initialMustChangePassword = false,
}: {
  children: React.ReactNode;
  initialRole?: string | null;
  initialEmail?: string | null;
  initialCentreName?: string | null;
  initialUserId?: string | null;
  initialPermissions?: string[];
  initialMustChangePassword?: boolean;
}) {
  const [role, setRole] = useState<string | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [centreName, setCentreName] = useState<string | null>(initialCentreName);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(initialMustChangePassword);

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
            if (typeof data.user.mustChangePassword === 'boolean') {
              setMustChangePassword(data.user.mustChangePassword);
            }

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

      // Public Learner strictly restricted to LIVE_CLASSES only
      if (normalizedRole === 'PUBLIC_LEARNER') {
        return moduleKey.toUpperCase() === 'LIVE_CLASSES';
      }

      // Default learner self-service access for enrolled students
      if (normalizedRole === 'STUDENT') {
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
          'REPORTS',
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
        mustChangePassword,
        setMustChangePassword,
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
