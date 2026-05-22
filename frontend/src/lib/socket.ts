import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    })
  }
  return socket
}

export function useSocket() {
  const { user } = useAuthStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (!user || initialized.current) return
    initialized.current = true

    const s = getSocket()
    if (!s.connected) s.connect()

    s.on('connect', () => {
      s.emit('authenticate', { user_id: user.id })
    })

    // If already connected
    if (s.connected) {
      s.emit('authenticate', { user_id: user.id })
    }

    return () => {
      initialized.current = false
    }
  }, [user])

  return getSocket()
}

export function joinProjectRoom(projectId: string) {
  const s = getSocket()
  if (s.connected) {
    s.emit('join_project', { project_id: projectId })
  } else {
    s.once('connect', () => s.emit('join_project', { project_id: projectId }))
  }
}

export function leaveProjectRoom(projectId: string) {
  const s = getSocket()
  s.emit('leave_project', { project_id: projectId })
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
