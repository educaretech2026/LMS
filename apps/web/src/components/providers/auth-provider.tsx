"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<{ role: string | null; email: string | null; centreName: string | null; userId: string | null }>({ role: null, email: null, centreName: null, userId: null });

export function AuthProvider({ children, initialRole = null, initialEmail = null, initialCentreName = null }: { children: React.ReactNode, initialRole?: string | null, initialEmail?: string | null, initialCentreName?: string | null }) {
  const [role, setRole] = useState<string | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [centreName, setCentreName] = useState<string | null>(initialCentreName);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(^| )AccessToken=([^;]+)/);
    if (match) {
      try {
        const payload = JSON.parse(atob(match[2].split('.')[1]));
        setRole(payload.role);
        setEmail(payload.email);
        if (payload.centreName) setCentreName(payload.centreName);
        if (payload.sub) setUserId(payload.sub);
      } catch (e) {}
    }
  }, []);

  return <AuthContext.Provider value={{ role, email, centreName, userId }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
