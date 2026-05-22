import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { TaskPriority, TaskStatus } from '@/types'
import clsx from 'clsx'

export { clsx }

export function formatDate(date: string | undefined | null): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatRelative(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDueDate(date: string | undefined | null): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d')
}

export function isOverdue(date: string | undefined | null, status: TaskStatus): boolean {
  if (!date || status === 'done') return false
  return isPast(new Date(date))
}

export const priorityConfig: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  high: { label: 'High', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
  medium: { label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  low: { label: 'Low', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
}

export const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'text-slate-600', bg: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100' },
  done: { label: 'Done', color: 'text-emerald-600', bg: 'bg-emerald-100' },
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getErrorMessage(err: any): string {
  return err?.response?.data?.detail || err?.message || 'Something went wrong'
}

export const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#84cc16', '#f472b6',
]
