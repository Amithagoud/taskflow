from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from models import UserRole, TaskStatus, TaskPriority

# ─── Auth ───────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

# ─── User ───────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_color: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar_color: Optional[str] = None

# ─── Project ────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_archived: Optional[bool] = None

class ProjectMemberOut(BaseModel):
    id: str
    user: UserOut
    role: UserRole
    joined_at: datetime

    class Config:
        from_attributes = True

class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str
    owner_id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    members: List[ProjectMemberOut] = []
    task_count: Optional[int] = 0
    done_count: Optional[int] = 0

    class Config:
        from_attributes = True

class AddMemberRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.member

class UpdateMemberRole(BaseModel):
    role: UserRole

# ─── Task ───────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Task title cannot be empty")
        return v.strip()

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    project_id: str
    assignee_id: Optional[str]
    creator_id: str
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserOut] = None
    creator: Optional[UserOut] = None
    comment_count: Optional[int] = 0
    is_overdue: Optional[bool] = False

    class Config:
        from_attributes = True

# ─── Comment ────────────────────────────────────────────────────
class CommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Comment cannot be empty")
        return v.strip()

class CommentOut(BaseModel):
    id: str
    content: str
    task_id: str
    author_id: str
    created_at: datetime
    author: UserOut

    class Config:
        from_attributes = True

# ─── Notification ───────────────────────────────────────────────
class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    is_read: bool
    type: str
    related_task_id: Optional[str]
    related_project_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Dashboard ──────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_tasks: int
    todo_count: int
    in_progress_count: int
    done_count: int
    overdue_count: int
    total_projects: int
    my_tasks: int
    completion_rate: float

TokenResponse.model_rebuild()
