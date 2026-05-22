'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function Home() {
  const router = useRouter()
  const { loadFromStorage, user } = useAuthStore()

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" style={{borderWidth: '3px'}} />
        <p className="text-sm text-slate-500">Loading TaskFlow…</p>
      </div>
    </div>
  )
}
