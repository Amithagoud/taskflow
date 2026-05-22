'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { projectsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Project } from '@/types'
import { PROJECT_COLORS, getErrorMessage, getInitials } from '@/lib/utils'
import { Plus, FolderKanban, Users, CheckSquare, MoreHorizontal, Archive, Trash2, Loader2, X } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

export default function ProjectsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(r => r.data),
  })

  const active = projects?.filter(p => !p.is_archived) || []
  const archived = projects?.filter(p => p.is_archived) || []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Manage your team projects and tasks</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 skeleton rounded-xl" />)}
        </div>
      ) : active.length === 0 ? (
        <div className="card py-16 text-center">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">No projects yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first project to get started</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} userId={user?.id || ''} />
            ))}
          </div>

          {archived.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <Archive className="w-4 h-4" /> Archived ({archived.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archived.map((p) => (
                  <ProjectCard key={p.id} project={p} userId={user?.id || ''} archived />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function ProjectCard({ project, userId, archived }: { project: Project; userId: string; archived?: boolean }) {
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const isOwner = project.owner_id === userId
  const progress = project.task_count > 0
    ? Math.round((project.done_count / project.task_count) * 100)
    : 0

  const archiveMutation = useMutation({
    mutationFn: () => projectsApi.update(project.id, { is_archived: !project.is_archived }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(project.is_archived ? 'Project unarchived' : 'Project archived')
    },
    onError: (err: any) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: (err: any) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className={`card hover:shadow-md transition-all group ${archived ? 'opacity-60' : ''}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: project.color }}
            >
              {project.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link
                href={`/projects/${project.id}`}
                className="font-semibold text-slate-900 hover:text-brand-600 transition-colors line-clamp-1"
              >
                {project.name}
              </Link>
              {project.description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="relative">
              <button
                className="p-1 rounded hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen) }}
              >
                <MoreHorizontal className="w-4 h-4 text-slate-500" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 card shadow-lg z-20 py-1 animate-scale-in">
                    <button
                      onClick={() => { archiveMutation.mutate(); setMenuOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {project.is_archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this project and all its tasks?')) {
                          deleteMutation.mutate()
                        }
                        setMenuOpen(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" />
            {project.task_count} tasks
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {project.members.length} members
          </span>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500">Progress</span>
            <span className="font-medium text-slate-700">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: project.color }}
            />
          </div>
        </div>

        {/* Members */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-1">
            {project.members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                title={m.user.name}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: m.user.avatar_color }}
              >
                {getInitials(m.user.name)}
              </div>
            ))}
            {project.members.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
                +{project.members.length - 4}
              </div>
            )}
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Open →
          </Link>
        </div>
      </div>
    </div>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Project name is required')
    setLoading(true)
    try {
      await projectsApi.create(form)
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created!')
      onClose()
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">New Project</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Project Name *</label>
            <input
              type="text"
              className="input"
              placeholder="My Awesome Project"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="What's this project about?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
