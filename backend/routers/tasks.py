from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import Task, Project, ProjectMember, User, Notification, TaskStatus, UserRole
from schemas import TaskCreate, TaskUpdate, TaskOut, CommentCreate, CommentOut
from auth import get_current_user
from socket_manager import emit_to_project, emit_to_user
from models import Comment

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

def get_member_or_403(project_id: str, user_id: str, db: Session) -> ProjectMember:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member and project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    return member, project

def require_admin_or_creator(project: Project, task: Task, user_id: str, db: Session):
    if project.owner_id == user_id or task.creator_id == user_id:
        return
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user_id
    ).first()
    if not member or member.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin or creator access required")

def enrich_task(task: Task, db: Session) -> dict:
    comment_count = db.query(Comment).filter(Comment.task_id == task.id).count()
    now = datetime.utcnow()
    is_overdue = bool(task.due_date and task.due_date < now and task.status != TaskStatus.done)
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "project_id": task.project_id,
        "assignee_id": task.assignee_id,
        "creator_id": task.creator_id,
        "due_date": task.due_date,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "assignee": task.assignee,
        "creator": task.creator,
        "comment_count": comment_count,
        "is_overdue": is_overdue,
    }

async def create_notification(db: Session, user_id: str, title: str, message: str,
                               ntype: str, task_id: str = None, project_id: str = None):
    from models import Notification
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=ntype,
        related_task_id=task_id,
        related_project_id=project_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    
    await emit_to_user(user_id, "notification", {
        "notification": {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "is_read": notif.is_read,
            "type": notif.type,
            "related_task_id": notif.related_task_id,
            "related_project_id": notif.related_project_id,
            "created_at": notif.created_at.isoformat(),
        }
    })

@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    project_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member, project = get_member_or_403(project_id, current_user.id, db)
    
    if payload.assignee_id:
        assignee_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == payload.assignee_id
        ).first()
        if not assignee_member and project.owner_id != payload.assignee_id:
            raise HTTPException(status_code=400, detail="Assignee is not a project member")
    
    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        project_id=project_id,
        assignee_id=payload.assignee_id,
        creator_id=current_user.id,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.creator)
    ).filter(Task.id == task.id).first()
    
    enriched = enrich_task(task, db)
    
    # Serialize for socket
    socket_data = {**enriched}
    for k in ["assignee", "creator"]:
        if socket_data.get(k):
            u = socket_data[k]
            socket_data[k] = {"id": u.id, "name": u.name, "email": u.email, "avatar_color": u.avatar_color}
    if socket_data.get("due_date"):
        socket_data["due_date"] = socket_data["due_date"].isoformat()
    socket_data["created_at"] = socket_data["created_at"].isoformat()
    socket_data["updated_at"] = socket_data["updated_at"].isoformat()
    
    await emit_to_project(project_id, "task_created", {"task": socket_data})
    
    # Notify assignee
    if payload.assignee_id and payload.assignee_id != current_user.id:
        await create_notification(
            db, payload.assignee_id,
            "New Task Assigned",
            f'{current_user.name} assigned you "{payload.title}" in {project.name}',
            "task_assigned", task_id=task.id, project_id=project_id
        )
    
    return enriched

@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: str,
    status: Optional[TaskStatus] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    get_member_or_403(project_id, current_user.id, db)
    
    query = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.creator)
    ).filter(Task.project_id == project_id)
    
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    
    tasks = query.order_by(Task.created_at.desc()).all()
    return [enrich_task(t, db) for t in tasks]

@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    get_member_or_403(project_id, current_user.id, db)
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.creator)
    ).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return enrich_task(task, db)

@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member, project = get_member_or_403(project_id, current_user.id, db)
    
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.creator)
    ).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_assignee_id = task.assignee_id
    
    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.assignee_id is not None:
        if payload.assignee_id:
            assignee_member = db.query(ProjectMember).filter(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == payload.assignee_id
            ).first()
            if not assignee_member and project.owner_id != payload.assignee_id:
                raise HTTPException(status_code=400, detail="Assignee is not a project member")
        task.assignee_id = payload.assignee_id
    
    task.updated_at = datetime.utcnow()
    db.commit()
    
    task = db.query(Task).options(
        joinedload(Task.assignee), joinedload(Task.creator)
    ).filter(Task.id == task_id).first()
    
    enriched = enrich_task(task, db)
    
    socket_data = {**enriched}
    for k in ["assignee", "creator"]:
        if socket_data.get(k):
            u = socket_data[k]
            socket_data[k] = {"id": u.id, "name": u.name, "email": u.email, "avatar_color": u.avatar_color}
    if socket_data.get("due_date"):
        socket_data["due_date"] = socket_data["due_date"].isoformat()
    socket_data["created_at"] = socket_data["created_at"].isoformat()
    socket_data["updated_at"] = socket_data["updated_at"].isoformat()
    
    await emit_to_project(project_id, "task_updated", {"task": socket_data})
    
    # Notify new assignee
    if payload.assignee_id and payload.assignee_id != old_assignee_id and payload.assignee_id != current_user.id:
        await create_notification(
            db, payload.assignee_id,
            "Task Assigned to You",
            f'{current_user.name} assigned you "{task.title}" in {project.name}',
            "task_assigned", task_id=task.id, project_id=project_id
        )
    
    return enriched

@router.delete("/{task_id}", status_code=204)
async def delete_task(
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member, project = get_member_or_403(project_id, current_user.id, db)
    
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    require_admin_or_creator(project, task, current_user.id, db)
    
    db.delete(task)
    db.commit()
    
    await emit_to_project(project_id, "task_deleted", {"task_id": task_id})

# ─── Comments ────────────────────────────────────────────────────
@router.post("/{task_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    project_id: str,
    task_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    get_member_or_403(project_id, current_user.id, db)
    
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comment = Comment(
        content=payload.content,
        task_id=task_id,
        author_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    comment = db.query(Comment).options(joinedload(Comment.author)).filter(Comment.id == comment.id).first()
    
    comment_data = {
        "id": comment.id,
        "content": comment.content,
        "task_id": comment.task_id,
        "author_id": comment.author_id,
        "created_at": comment.created_at.isoformat(),
        "author": {
            "id": comment.author.id,
            "name": comment.author.name,
            "email": comment.author.email,
            "avatar_color": comment.author.avatar_color,
        }
    }
    
    await emit_to_project(project_id, "comment_added", {"task_id": task_id, "comment": comment_data})
    
    # Notify task assignee
    if task.assignee_id and task.assignee_id != current_user.id:
        await create_notification(
            db, task.assignee_id,
            "New Comment",
            f'{current_user.name} commented on "{task.title}"',
            "comment", task_id=task_id, project_id=project_id
        )
    
    return comment

@router.get("/{task_id}/comments", response_model=List[CommentOut])
def list_comments(
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    get_member_or_403(project_id, current_user.id, db)
    
    comments = db.query(Comment).options(joinedload(Comment.author)).filter(
        Comment.task_id == task_id
    ).order_by(Comment.created_at.asc()).all()
    return comments
