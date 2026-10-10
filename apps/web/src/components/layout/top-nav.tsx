"use client";

import { Search, Bell, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { NotificationBell } from "./notification-bell";

export function TopNav({ title = "Dashboard", onMenuClick }: { title?: string, onMenuClick?: () => void }) {
  const { email, role } = useAuth();
  
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border-soft bg-white px-4 md:px-6">
      {/* Left — Page title & Hamburger */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-base font-semibold text-text-primary tracking-tight">{title}</h1>
          {role !== 'SUPER_ADMIN' && <p className="text-xs text-text-muted mt-0.5 hidden sm:block">Educare Kalathipady</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <Input
            type="search"
            placeholder="Search..."
            className="h-9 pl-9 pr-3 text-sm bg-surface-2 border-border-soft rounded-lg focus-visible:ring-brand-blue/30 focus-visible:border-brand-blue/50 placeholder:text-text-muted"
          />
        </div>

        {/* Notification */}
        <NotificationBell />

        {/* Divider */}
        <div className="h-6 w-px bg-border-soft" />

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30" />}
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center text-white text-xs font-bold shadow-sm uppercase">
              {email ? email.charAt(0) : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-text-primary leading-none truncate max-w-[120px]">
                {email ? email.split('@')[0] : 'Akshay'}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5 leading-none capitalize">
                {role ? role.toLowerCase() : 'Admin'}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-text-secondary font-normal">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm">Profile</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Settings</DropdownMenuItem>
              <DropdownMenuItem className="text-sm">Support</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm text-brand-red focus:text-brand-red focus:bg-red-50">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
