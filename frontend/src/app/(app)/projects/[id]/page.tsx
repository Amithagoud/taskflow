'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { projectsApi, tasksApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useSocket, joinProjectRoom, leaveProjectRoom } from '@/lib/socket'
import { Project, Task, TaskStatus, ProjectMember } from '@/types'
import {
  priorityConfig, statusConfig, getInitials, getErrorMessage,
  formatDate, formatDueDate, formatRelative, PROJECT_COLORS
} from '@/lib/utils'
import {
  Plus, Settings, Users, X, Loader2, Trash2, MessageSquare,
  Calendar, Flag, ChevronDown, UserPlus, ArrowLeft, Edit2,
  MoreHorizontal, Clock, CheckCircle2, Circle, AlertCircle
} from 'lucide-react'

const COLUMNS: { id: TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'todo', label: 'To Do', icon: Circle, color: 'text-slate-500' },
  { id: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-emerald-500' },
]

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const socket = useSocket()
  const [tab, setTab] = useState<'board' | 'members' | 'settings'>('board')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [createTask, setCreateTask] = useState<{ open: boolean; status: TaskStatus }>({ open: false, status: 'todo' })

  const { data: project, isLoading: projLoading } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id).then(r => r.data),
  })

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.list(id).then(r => r.data),
  })

  // Real-time updates
  useEffect(() => {
    if (!socket || !id) return
    joinProjectRoom(id)

    const onTaskCreated = (data: { task: Task }) => {
      qc.setQueryData<Task[]>(['tasks', id], (old) => [data.task, ...(old || [])])
      qc.invalidateQueries({ queryKey: ['project', id] })
    }
    const onTaskUpdated = (data: { task: Task }) => {
      qc.setQueryData<Task[]>(['tasks', id], (old) =>
        (old || []).map(t => t.id === data.task.id ? data.task : t)
      )
      setSelectedTask(prev => prev?.id === data.task.id ? data.task : prev)
    }
    const onTaskDeleted = (data: { task_id: string }) => {
      qc.setQueryData<Task[]>(['tasks', id], (old) =>
        (old || []).filter(t => t.id !== data.task_id)
      )
      setSelectedTask(prev => prev?.id === data.task_id ? null : prev)
    }
    const onMemberAdded = () => qc.invalidateQueries({ queryKey: ['project', id] })
    const onMemberRemoved = () => qc.invalidateQueries({ queryKey: ['project', id] })
    const onCommentAdded = () => {
      if (selectedTask) qc.invalidateQueries({ queryKey: ['comments', selectedTask.id] })
      qc.invalidateQueries({ queryKey: ['tasks', id] })
    }

    socket.on('task_created', onTaskCreated)
    socket.on('task_updated', onTaskUpdated)
    socket.on('task_deleted', onTaskDeleted)
    socket.on('member_added', onMemberAdded)
    socket.on('member_removed', onMemberRemoved)
    socket.on('comment_added', onCommentAdded)

    return () => {
      leaveProjectRoom(id)
      socket.off('task_created', onTaskCreated)
      socket.off('task_updated', onTaskUpdated)
      socket.off('task_deleted', onTaskDeleted)
      socket.off('member_added', onMemberAdded)
      socket.off('member_removed', onMemberRemoved)
      socket.off('comment_added', onCommentAdded)
    }
  }, [socket, id, selectedTask])

  const myMember = project?.members.find(m => m.user.id === user?.id)
  const isAdmin = project?.owner_id === user?.id || myMember?.role === 'admin'

  if (projLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Project not found</p>
        <button onClick={() => router.push('/projects')} className="btn-secondary mt-4">
          Back to Projects
        </button>
      </div>
    )
  }

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = (tasks || []).filter(t => t.status === col.id)
    return acc
  }, {} as Record<TaskStatus, Task[]>)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/projects')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: project.color }}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg leading-tight">{project.name}</h1>
            {project.description && <p className="text-xs text-slate-500">{project.description}</p>}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <div className="flex -space-x-1 mr-2">
              {project.members.slice(0, 5).map(m => (
                <div key={m.id} title={m.user.name}
                  className="w-6 h-6 rounded-full border-2 border-white text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: m.user.avatar_color }}>
                  {getInitials(m.user.name)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-3 ml-10">
          {(['board', 'members', ...(isAdmin ? ['settings'] : [])] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${tab === t
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'board' && (
          <div className="flex gap-4 p-6 h-full overflow-x-auto">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col w-72 shrink-0">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <col.icon className={`w-4 h-4 ${col.color}`} />
                    <span className="font-semibold text-sm text-slate-700">{col.label}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {tasksByStatus[col.id].length}
                    </span>
                  </div>
                  <button
                    onClick={() => setCreateTask({ open: true, status: col.id })}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto space-y-2 pb-4">
                  {tasksLoading ? (
                    [...Array(3)].map((_, i) => <div key={i} className="h-24 skeleton rounded-lg" />)
                  ) : tasksByStatus[col.id].length === 0 ? (
                    <div
                      className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                      onClick={() => setCreateTask({ open: true, status: col.id })}
                    >
                      <p className="text-xs text-slate-400">+ Add task</p>
                    </div>
                  ) : (
                    tasksByStatus[col.id].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => setSelectedTask(task)}
                        isAdmin={isAdmin}
                        projectId={id}
                      />
                    ))
                  )}
                </div>

                {/* Add task button */}
                <button
                  onClick={() => setCreateTask({ open: true, status: col.id })}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors w-full"
                >
                  <Plus className="w-4 h-4" /> Add task
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'members' && (
          <MembersTab project={project} isAdmin={isAdmin} userId={user?.id || ''} />
        )}

        {tab === 'settings' && isAdmin && (
          <SettingsTab project={project} userId={user?.id || ''} />
        )}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          project={project}
          isAdmin={isAdmin}
          userId={user?.id || ''}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => setSelectedTask(updated)}
        />
      )}

      {/* Create task modal */}
      {createTask.open && (
        <CreateTaskModal
          projectId={id}
          defaultStatus={createTask.status}
          members={project.members}
          onClose={() => setCreateTask({ open: false, status: 'todo' })}
        />
      )}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick, isAdmin, projectId }: {
  task: Task; onClick: () => void; isAdmin: boolean; projectId: string
}) {
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const updateStatus = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.update(projectId, task.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (e: any) => toast.error(getErrorMessage(e)),
  })

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(projectId, task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task deleted')
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  })

  const nextStatus: Record<TaskStatus, TaskStatus> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: 'todo',
  }

  return (
    <div
      className="card p-3.5 hover:shadow-md transition-all cursor-pointer group animate-fade-in"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.title}
        </p>
        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
          <button
            title={`Move to ${nextStatus[task.status]}`}
            onClick={(e) => { e.stopPropagation(); updateStatus.mutate(nextStatus[task.status]) }}
            className="p-1 rounded hover:bg-slate-100"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </button>
          {isAdmin && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
                className="p-1 rounded hover:bg-slate-100"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
                  <div className="absolute right-0 top-full mt-1 w-32 card shadow-lg z-20 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this task?')) deleteTask.mutate()
                        setMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge ${priorityConfig[task.priority].color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig[task.priority].dot}`} />
          {priorityConfig[task.priority].label}
        </span>
        {task.due_date && (
          <span className={`flex items-center gap-1 text-xs ${task.is_overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            {formatDueDate(task.due_date)}
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="w-3 h-3" /> {task.comment_count}
          </span>
        )}
      </div>

      {task.assignee && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
            style={{ backgroundColor: task.assignee.avatar_color }}
          >
            {getInitials(task.assignee.name)}
          </div>
          <span className="text-xs text-slate-500">{task.assignee.name}</span>
        </div>
      )}
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
function TaskDetailModal({ task, project, isAdmin, userId, onClose, onUpdate }: {
  task: Task; project: Project; isAdmin: boolean; userId: string
  onClose: () => void; onUpdate: (t: Task) => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: task.title, description: task.description || '',
    priority: task.priority, status: task.status,
    assignee_id: task.assignee_id || '', due_date: task.due_date ? task.due_date.split('T')[0] : '',
  })
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => tasksApi.listComments(project.id, task.id).then(r => r.data),
  })

  useEffect(() => {
    setEditForm({
      title: task.title, description: task.description || '',
      priority: task.priority, status: task.status,
      assignee_id: task.assignee_id || '', due_date: task.due_date ? task.due_date.split('T')[0] : '',
    })
  }, [task])

  const updateMutation = useMutation({
    mutationFn: (data: any) => tasksApi.update(project.id, task.id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks', project.id] })
      onUpdate(res.data)
      setEditing(false)
      toast.success('Task updated')
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  })

  const handleSave = () => {
    const data: any = {
      title: editForm.title,
      description: editForm.description || null,
      priority: editForm.priority,
      status: editForm.status,
      assignee_id: editForm.assignee_id || null,
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
    }
    updateMutation.mutate(data)
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSubmittingComment(true)
    try {
      await tasksApi.addComment(project.id, task.id, comment.trim())
      setComment('')
      refetchComments()
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    } finally {
      setSubmittingComment(false)
    }
  }

  const canEdit = isAdmin || task.creator_id === userId || task.assignee_id === userId

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/40">
      <div className="w-full max-w-lg h-full bg-white rounded-xl shadow-2xl flex flex-col animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`badge ${statusConfig[task.status].color} ${statusConfig[task.status].bg} border-transparent`}>
              {statusConfig[task.status].label}
            </span>
            {task.is_overdue && (
              <span className="badge text-red-600 bg-red-50 border-red-200">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="btn-ghost p-2">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input className="input" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={4} value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editForm.status}
                    onChange={e => setEditForm({...editForm, status: e.target.value as TaskStatus})}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={editForm.priority}
                    onChange={e => setEditForm({...editForm, priority: e.target.value as any})}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Assignee</label>
                  <select className="input" value={editForm.assignee_id}
                    onChange={e => setEditForm({...editForm, assignee_id: e.target.value})}>
                    <option value="">Unassigned</option>
                    {project.members.map(m => (
                      <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={editForm.due_date}
                    onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">{task.title}</h2>
                {task.description ? (
                  <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No description</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Priority</p>
                  <span className={`badge ${priorityConfig[task.priority].color}`}>
                    {priorityConfig[task.priority].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Due Date</p>
                  <p className={`text-sm font-medium ${task.is_overdue ? 'text-red-600' : 'text-slate-700'}`}>
                    {task.due_date ? formatDate(task.due_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Assignee</p>
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: task.assignee.avatar_color }}>
                        {getInitials(task.assignee.name)}
                      </div>
                      <span className="text-sm text-slate-700">{task.assignee.name}</span>
                    </div>
                  ) : <p className="text-sm text-slate-400">Unassigned</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Created</p>
                  <p className="text-sm text-slate-700">{formatRelative(task.created_at)}</p>
                </div>
              </div>
            </>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Comments ({comments?.length || 0})
            </h3>
            <div className="space-y-3 mb-4">
              {comments?.map((c: any) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: c.author.avatar_color }}>
                    {getInitials(c.author.name)}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-900">{c.author.name}</span>
                      <span className="text-xs text-slate-400">{formatRelative(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{c.content}</p>
                  </div>
                </div>
              ))}
              {!comments?.length && (
                <p className="text-sm text-slate-400 text-center py-4">No comments yet. Be the first!</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Write a comment…"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment() }}}
              />
              <button
                onClick={handleComment}
                className="btn-primary px-3"
                disabled={submittingComment || !comment.trim()}
              >
                {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Task Modal ────────────────────────────────────────────────────────
function CreateTaskModal({ projectId, defaultStatus, members, onClose }: {
  projectId: string; defaultStatus: TaskStatus; members: ProjectMember[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '', description: '', status: defaultStatus,
    priority: 'medium', assignee_id: '', due_date: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    setLoading(true)
    try {
      await tasksApi.create(projectId, {
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        assignee_id: form.assignee_id || undefined,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task created!')
      onClose()
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Create Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="What needs to be done?" value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Optional details…"
              value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status}
                onChange={e => setForm({...form, status: e.target.value as TaskStatus})}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority}
                onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assign To</label>
              <select className="input" value={form.assignee_id}
                onChange={e => setForm({...form, assignee_id: e.target.value})}>
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date}
                onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Members Tab ─────────────────────────────────────────────────────────────
function MembersTab({ project, isAdmin, userId }: { project: Project; isAdmin: boolean; userId: string }) {
  const qc = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setLoading(true)
    try {
      await projectsApi.addMember(project.id, { email: inviteEmail.trim(), role: inviteRole })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      setInviteEmail('')
      toast.success('Member added!')
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return
    try {
      await projectsApi.removeMember(project.id, memberId)
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      toast.success('Member removed')
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    }
  }

  const handleRoleChange = async (memberId: string, role: string) => {
    try {
      await projectsApi.updateMember(project.id, memberId, { role })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      toast.success('Role updated')
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {isAdmin && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Invite Member
          </h3>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              className="input flex-1"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <select className="input w-32" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary shrink-0" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Members ({project.members.length})</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {project.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-9 h-9 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0"
                style={{ backgroundColor: m.user.avatar_color }}>
                {getInitials(m.user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{m.user.name}</p>
                  {m.user_id === project.owner_id && (
                    <span className="badge text-amber-600 bg-amber-50 border-amber-200 text-[10px]">Owner</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              {isAdmin && m.user_id !== project.owner_id && (
                <div className="flex items-center gap-2">
                  <select
                    className="input py-1 text-xs w-24"
                    value={m.role}
                    onChange={e => handleRoleChange(m.user_id, e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {!isAdmin && (
                <span className="badge text-slate-600 bg-slate-100 border-transparent capitalize">
                  {m.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ project, userId }: { project: Project; userId: string }) {
  const qc = useQueryClient()
  const router = useRouter()
  const [form, setForm] = useState({ name: project.name, description: project.description || '', color: project.color })
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await projectsApi.update(project.id, form)
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('This will permanently delete the project and ALL its tasks. Are you sure?')) return
    try {
      await projectsApi.delete(project.id)
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      router.push('/projects')
    } catch (e: any) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-slate-900 mb-4">Project Settings</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input className="input" value={form.name}
              onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description}
              onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button"
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({...form, color: c})} />
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </div>

      {project.owner_id === userId && (
        <div className="card p-5 border-red-200">
          <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
          <p className="text-sm text-slate-500 mb-4">
            Permanently delete this project and all its tasks. This cannot be undone.
          </p>
          <button onClick={handleDelete} className="btn-danger w-full">
            <Trash2 className="w-4 h-4" /> Delete Project
          </button>
        </div>
      )}
    </div>
  )
}
