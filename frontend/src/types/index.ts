export type UserRole = 'admin' | 'member'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface User {
  id: string
  email: string
  name: string
  avatar_color: string
  created_at: string
}

export interface ProjectMember {
  id: string
  user: User
  role: UserRole
  joined_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  owner_id: string
  is_archived: boolean
  created_at: string
  updated_at: string
  members: ProjectMember[]
  task_count: number
  done_count: number
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  project_id: string
  assignee_id?: string
  creator_id: string
  due_date?: string
  created_at: string
  updated_at: string
  assignee?: User
  creator?: User
  comment_count: number
  is_overdue: boolean
}

export interface Comment {
  id: string
  content: string
  task_id: string
  author_id: string
  created_at: string
  author: User
}

export interface Notification {
  id: string
  title: string
  message: string
  is_read: boolean
  type: string
  related_task_id?: string
  related_project_id?: string
  created_at: string
}

export interface DashboardStats {
  total_tasks: number
  todo_count: number
  in_progress_count: number
  done_count: number
  overdue_count: number
  total_projects: number
  my_tasks: number
  completion_rate: number
}

export interface MyTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  is_overdue: boolean
  project_id: string
  project_name: string
  project_color: string
}
