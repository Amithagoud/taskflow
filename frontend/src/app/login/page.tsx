'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { getErrorMessage } from '@/lib/utils'
import { CheckSquare, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth, loadFromStorage, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Please fill in all fields')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      setAuth(res.data.user, res.data.access_token)
      toast.success(`Welcome back, ${res.data.user.name}!`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 to-brand-800 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg">TaskFlow</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Manage tasks.<br />Ship faster.<br />Together.
          </h1>
          <p className="text-brand-200 text-lg">
            Real-time collaboration for high-performing teams.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              ['Real-time updates', 'See changes instantly via WebSockets'],
              ['Role-based access', 'Admin & member permissions'],
              ['Task tracking', 'Kanban board with priorities'],
              ['Team management', 'Invite members by email'],
            ].map(([title, desc]) => (
              <div key={title} className="bg-white/10 rounded-xl p-4">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-brand-200 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-brand-300 text-sm">© 2024 TaskFlow. Built for modern teams.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-slate-900">TaskFlow</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
          <p className="text-slate-500 text-sm mb-8">
            Don't have an account?{' '}
            <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Create one
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full h-11" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 font-medium mb-2">Demo credentials</p>
            <p className="text-xs text-slate-600">Email: <span className="font-mono">demo@taskflow.app</span></p>
            <p className="text-xs text-slate-600">Password: <span className="font-mono">demo123</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
