import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('taskflow_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('taskflow_token')
      localStorage.removeItem('taskflow_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ───────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: { name?: string; avatar_color?: string }) =>
    api.patch('/auth/me', data),
}

// ─── Projects ───────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; color?: string }) =>
    api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, data: { email: string; role: string }) =>
    api.post(`/projects/${id}/members`, data),
  updateMember: (projectId: string, userId: string, data: { role: string }) =>
    api.patch(`/projects/${projectId}/members/${userId}`, data),
  removeMember: (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
  listMembers: (id: string) => api.get(`/projects/${id}/members`),
}

// ─── Tasks ──────────────────────────────────────────────────────
export const tasksApi = {
  list: (projectId: string, params?: any) =>
    api.get(`/projects/${projectId}/tasks`, { params }),
  get: (projectId: string, taskId: string) =>
    api.get(`/projects/${projectId}/tasks/${taskId}`),
  create: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/tasks`, data),
  update: (projectId: string, taskId: string, data: any) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}`, data),
  delete: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`),
  listComments: (projectId: string, taskId: string) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/comments`),
  addComment: (projectId: string, taskId: string, content: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content }),
}

// ─── Dashboard ──────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard'),
  myTasks: () => api.get('/my-tasks'),
}

// ─── Notifications ──────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
}
