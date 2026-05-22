import { create } from 'zustand'
import { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('taskflow_token', token)
      localStorage.setItem('taskflow_user', JSON.stringify(user))
    }
    set({ user, token })
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('taskflow_token')
      localStorage.removeItem('taskflow_user')
    }
    set({ user: null, token: null })
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('taskflow_token')
    const userStr = localStorage.getItem('taskflow_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ user, token })
      } catch {}
    }
  },
}))
