"use client";

import { useState, useEffect } from "react";
import { Bell, Check, ExternalLink, X } from "lucide-react";
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
import { fetchApi } from "@/lib/api";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
};

export function NotificationBell() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!role) return;
    try {
      const data = await fetchApi<any[]>('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.isRead).length);
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [role]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      // Revert if failed
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetchApi('/notifications/mark-all-read', { method: 'POST' });
    } catch (err) {
      fetchNotifications();
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'WARNING': return 'bg-warning/20 text-warning';
      case 'ERROR': return 'bg-brand-red/20 text-brand-red';
      case 'SUCCESS': return 'bg-success/20 text-success';
      default: return 'bg-brand-blue/20 text-brand-blue';
    }
  };

  const getRelativeTime = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const daysDifference = Math.round((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference === 0) {
        const hoursDifference = Math.round((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60 * 60));
        if (hoursDifference === 0) {
            const minDifference = Math.round((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60));
            return rtf.format(minDifference, 'minute');
        }
        return rtf.format(hoursDifference, 'hour');
    }
    return rtf.format(daysDifference, 'day');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft bg-surface-2 text-text-secondary hover:bg-surface hover:border-brand-blue/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30" />
        }
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-red text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0 overflow-hidden border-border-soft shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border-soft">
          <DropdownMenuLabel className="p-0 font-semibold text-text-primary">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button 
              onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
              className="text-xs font-medium text-brand-blue hover:text-brand-blue-dark transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-text-muted flex flex-col items-center">
              <Bell className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm">You have no notifications</p>
            </div>
          ) : (
            <DropdownMenuGroup>
              {notifications.map((notification) => {
                const isUnread = !notification.isRead;
                
                const NotificationContent = (
                  <div className={`relative flex gap-3 p-4 hover:bg-surface transition-colors cursor-pointer border-b border-border-soft last:border-0 ${isUnread ? 'bg-brand-blue/5' : ''}`}>
                    {isUnread && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-full bg-brand-blue rounded-r-md" />
                    )}
                    <div className={`mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-full ${getTypeColor(notification.type)}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className={`text-sm truncate pr-2 ${isUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'}`}>
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                          {getRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                );

                if (notification.link) {
                  return (
                    <DropdownMenuItem key={notification.id} className="p-0 cursor-pointer rounded-none focus:bg-transparent">
                      <Link 
                        href={notification.link} 
                        className="w-full"
                        onClick={(e) => {
                          if (isUnread) markAsRead(notification.id);
                        }}
                      >
                        {NotificationContent}
                      </Link>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className="p-0 cursor-pointer rounded-none focus:bg-transparent"
                    onSelect={(e) => {
                      e.preventDefault(); // Don't close if no link
                      if (isUnread) markAsRead(notification.id);
                    }}
                  >
                    {NotificationContent}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
