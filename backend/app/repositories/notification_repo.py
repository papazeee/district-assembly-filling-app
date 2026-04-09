"""
NotificationRepository – all database queries related to notifications.
"""
from typing import List
from sqlalchemy.orm import Session

from app.models.user import Notification, NotificationType, Letter, User
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session):
        super().__init__(Notification, db)

    def get_for_user(self, user_id: int, unread_only: bool = False) -> List[Notification]:
        q = self.db.query(Notification).filter(Notification.recipient_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read == False)
        return q.order_by(Notification.created_at.desc()).all()

    def get_by_id_and_user(self, notif_id: int, user_id: int) -> Notification | None:
        return self.db.query(Notification).filter(
            Notification.id == notif_id,
            Notification.recipient_id == user_id,
        ).first()

    def mark_all_read(self, user_id: int) -> None:
        self.db.query(Notification).filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        ).update({"is_read": True})
        self.db.commit()

    def notify_role(
        self,
        users: List[User],
        letter: Letter,
        notif_type: NotificationType,
        message: str,
    ) -> None:
        """Create a notification for every user in the provided list."""
        for user in users:
            self.db.add(Notification(
                recipient_id=user.id,
                letter_id=letter.id,
                type=notif_type,
                message=message,
            ))
        # Caller commits
