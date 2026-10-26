import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SplashScreen } from "@/components/splash-screen";
import { getUserFromToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Educare LMS — Learning Management System",
  description: "A professional learning management system for educational centres.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUserFromToken();
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col font-sans">
        <SplashScreen />
        <AuthProvider
          initialRole={user?.role}
          initialEmail={user?.email}
          initialCentreName={user?.centreName}
          initialUserId={user?.id}
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
