'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { dashboardApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/lib/socket'
import { priorityConfig, statusConfig, formatDueDate, formatRelative } from '@/lib/utils'
import { MyTask, DashboardStats } from '@/types'
import {
  CheckSquare, Clock, AlertTriangle, FolderKanban,
  TrendingUp, ListTodo, Loader2, ArrowRight
} from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats().then(r => r.data),
  })

  const { data: myTasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: () => dashboardApi.myTasks().then(r => r.data),
  })

  const socket = useSocket()
  useEffect(() => {
    if (!socket) return
    const handler = () => {
      refetchStats()
      refetchTasks()
    }
    socket.on('task_created', handler)
    socket.on('task_updated', handler)
    socket.on('task_deleted', handler)
    return () => {
      socket.off('task_created', handler)
      socket.off('task_updated', handler)
      socket.off('task_deleted', handler)
    }
  }, [socket])

  const statCards = stats ? [
    { label: 'Total Tasks', value: stats.total_tasks, icon: ListTodo, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'In Progress', value: stats.in_progress_count, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Completed', value: stats.done_count, icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Overdue', value: stats.overdue_count, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'My Tasks', value: stats.my_tasks, icon: FolderKanban, color: 'text-violet-600', bg: 'bg-violet-100' },
    { label: 'Completion', value: `${stats.completion_rate}%`, icon: TrendingUp, color: 'text-brand-600', bg: 'bg-brand-100' },
  ] : []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1">Here's what's happening with your projects today.</p>
      </div>

      {/* Stats grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 h-24 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500 font-medium">{label}</p>
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {stats && (
        <div className="card p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Overall Progress</h2>
            <span className="text-sm font-medium text-brand-600">{stats.completion_rate}% complete</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_rate}%` }}
            />
          </div>
          <div className="flex gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-500">To Do: {stats.todo_count}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-500">In Progress: {stats.in_progress_count}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-500">Done: {stats.done_count}</span>
            </div>
          </div>
        </div>
      )}

      {/* My tasks */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">My Assigned Tasks</h2>
          <Link href="/projects" className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            All projects <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {tasksLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}
          </div>
        ) : !myTasks?.length ? (
          <div className="py-12 text-center">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No tasks assigned to you</p>
            <p className="text-slate-400 text-sm mt-1">Tasks assigned to you will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {myTasks.map((task) => (
              <Link
                key={task.id}
                href={`/projects/${task.project_id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: task.project_color }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{task.project_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${priorityConfig[task.priority].color}`}>
                    {priorityConfig[task.priority].label}
                  </span>
                  <span className={`badge ${statusConfig[task.status].color} ${statusConfig[task.status].bg} border-transparent`}>
                    {statusConfig[task.status].label}
                  </span>
                  {task.due_date && (
                    <span className={`text-xs ${task.is_overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                      {task.is_overdue ? '⚠ ' : ''}{formatDueDate(task.due_date)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
