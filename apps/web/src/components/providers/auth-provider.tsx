"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<{
  role: string | null;
  email: string | null;
  centreName: string | null;
  userId: string | null;
}>({ role: null, email: null, centreName: null, userId: null });

export function AuthProvider({
  children,
  initialRole = null,
  initialEmail = null,
  initialCentreName = null,
  initialUserId = null,
}: {
  children: React.ReactNode;
  initialRole?: string | null;
  initialEmail?: string | null;
  initialCentreName?: string | null;
  initialUserId?: string | null;
}) {
  const [role, setRole] = useState<string | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [centreName, setCentreName] = useState<string | null>(initialCentreName);
  const [userId, setUserId] = useState<string | null>(initialUserId);

  useEffect(() => {
    // If state wasn't populated from server initial props, query the same-origin BFF /api/auth/me
    if (!role) {
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
          }
        })
        .catch(() => {});
    }
  }, [role]);

  return (
    <AuthContext.Provider value={{ role, email, centreName, userId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
