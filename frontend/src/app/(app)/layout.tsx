'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { notificationsApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { getInitials } from '@/lib/utils'
import {
  LayoutDashboard, FolderKanban, Bell, LogOut, CheckSquare,
  Menu, X, User, ChevronDown
} from 'lucide-react'
import { Notification } from '@/types'
import { formatRelative } from '@/lib/utils'
import toast from 'react-hot-toast'
import { disconnectSocket } from '@/lib/socket'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loadFromStorage, clearAuth } = useAuthStore()
  const { setNotifications, addNotification, unreadCount, markRead, markAllRead } = useNotificationStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const socket = useSocket()

  useEffect(() => { loadFromStorage() }, [])

  useEffect(() => {
    if (!user) {
      router.replace('/login')
      return
    }
    // Load notifications
    notificationsApi.list().then(r => setNotifications(r.data)).catch(() => {})
  }, [user])

  // Real-time notifications
  useEffect(() => {
    if (!socket) return
    const handler = (data: { notification: Notification }) => {
      addNotification(data.notification)
      toast(data.notification.message, {
        icon: data.notification.type === 'task_assigned' ? '📋' : '💬',
        duration: 4000,
      })
    }
    socket.on('notification', handler)
    return () => { socket.off('notification', handler) }
  }, [socket])

  const handleLogout = () => {
    disconnectSocket()
    clearAuth()
    router.push('/login')
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    markAllRead()
  }

  if (!user) return null

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r border-slate-200
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-200 shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">TaskFlow</span>
          <button
            className="ml-auto lg:hidden p-1 rounded hover:bg-slate-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: user.avatar_color }}
            >
              {getInitials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link w-full mt-1 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <div className="flex-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-slow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl z-50 animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-sm text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <NotificationList onClose={() => setNotifOpen(false)} />
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Close dropdowns on outside click */}
      {(notifOpen || profileOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setNotifOpen(false); setProfileOpen(false) }}
        />
      )}
    </div>
  )
}

function NotificationList({ onClose }: { onClose: () => void }) {
  const { notifications, markRead: markReadLocal } = useNotificationStore()

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await notificationsApi.markRead(n.id)
      markReadLocal(n.id)
    }
    onClose()
  }

  if (notifications.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No notifications yet</p>
      </div>
    )
  }

  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
      {notifications.map((n) => (
        <button
          key={n.id}
          onClick={() => handleClick(n)}
          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-brand-50/50' : ''}`}
        >
          <div className="flex items-start gap-2">
            {!n.is_read && <span className="w-2 h-2 bg-brand-500 rounded-full mt-1.5 shrink-0" />}
            <div className={!n.is_read ? '' : 'ml-4'}>
              <p className="text-sm font-medium text-slate-900">{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">{formatRelative(n.created_at)}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
