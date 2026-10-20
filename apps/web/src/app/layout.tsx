import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SplashScreen } from "@/components/splash-screen";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

import { getUserFromToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Educare LMS — Learning Management System",
  description: "A professional learning management system for educational centres.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUserFromToken();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-inter">
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
