from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models import Task, Project, ProjectMember, Notification, TaskStatus, User
from schemas import DashboardStats, NotificationOut
from auth import get_current_user

router = APIRouter(tags=["dashboard"])

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all projects user is part of
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    project_ids = [m.project_id for m in memberships]
    
    # All tasks in those projects
    all_tasks = db.query(Task).filter(Task.project_id.in_(project_ids)).all()
    
    now = datetime.utcnow()
    total = len(all_tasks)
    todo = sum(1 for t in all_tasks if t.status == TaskStatus.todo)
    in_progress = sum(1 for t in all_tasks if t.status == TaskStatus.in_progress)
    done = sum(1 for t in all_tasks if t.status == TaskStatus.done)
    overdue = sum(1 for t in all_tasks if t.due_date and t.due_date < now and t.status != TaskStatus.done)
    my_tasks = sum(1 for t in all_tasks if t.assignee_id == current_user.id)
    
    completion_rate = round((done / total * 100) if total > 0 else 0, 1)
    
    return DashboardStats(
        total_tasks=total,
        todo_count=todo,
        in_progress_count=in_progress,
        done_count=done,
        overdue_count=overdue,
        total_projects=len(project_ids),
        my_tasks=my_tasks,
        completion_rate=completion_rate,
    )

@router.get("/my-tasks", response_model=List[dict])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tasks = db.query(Task).filter(
        Task.assignee_id == current_user.id
    ).order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).limit(20).all()
    
    now = datetime.utcnow()
    result = []
    for t in tasks:
        project = db.query(Project).filter(Project.id == t.project_id).first()
        result.append({
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "is_overdue": bool(t.due_date and t.due_date < now and t.status != TaskStatus.done),
            "project_id": t.project_id,
            "project_name": project.name if project else "Unknown",
            "project_color": project.color if project else "#6366f1",
        })
    return result

# ─── Notifications ──────────────────────────────────────────────
notif_router = APIRouter(prefix="/notifications", tags=["notifications"])

@notif_router.get("", response_model=List[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

@notif_router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return {"count": count}

@notif_router.patch("/{notif_id}/read", response_model=NotificationOut)
def mark_read(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

@notif_router.patch("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
