"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<{ role: string | null; email: string | null; centreName: string | null }>({ role: null, email: null, centreName: null });

export function AuthProvider({ children, initialRole = null, initialEmail = null, initialCentreName = null }: { children: React.ReactNode, initialRole?: string | null, initialEmail?: string | null, initialCentreName?: string | null }) {
  const [role, setRole] = useState<string | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [centreName, setCentreName] = useState<string | null>(initialCentreName);

  useEffect(() => {
    const match = document.cookie.match(/(^| )AccessToken=([^;]+)/);
    if (match) {
      try {
        const payload = JSON.parse(atob(match[2].split('.')[1]));
        setRole(payload.role);
        setEmail(payload.email);
        if (payload.centreName) setCentreName(payload.centreName);
      } catch (e) {}
    }
  }, []);

  return <AuthContext.Provider value={{ role, email, centreName }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
