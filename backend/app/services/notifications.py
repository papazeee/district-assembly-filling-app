"""
Notification service – creates in-app notifications for users.
"""
from sqlalchemy.orm import Session

from app.models.user import Notification, NotificationType, Letter, User


def notify(
    db: Session,
    recipient: User,
    letter: Letter,
    notif_type: NotificationType,
    message: str,
) -> Notification:
    notif = Notification(
        recipient_id=recipient.id,
        letter_id=letter.id,
        type=notif_type,
        message=message,
    )
    db.add(notif)
    # caller is responsible for db.commit()
    return notif


def notify_letter_forwarded(db: Session, recipient: User, letter: Letter, from_role: str) -> Notification:
    return notify(
        db, recipient, letter,
        NotificationType.LETTER_FORWARDED,
        f"Letter '{letter.serial_number}' has been forwarded to you by {from_role}.",
    )


def notify_letter_assigned(db: Session, recipient: User, letter: Letter) -> Notification:
    return notify(
        db, recipient, letter,
        NotificationType.LETTER_ASSIGNED,
        f"Letter '{letter.serial_number}' has been assigned to your department for action.",
    )


def notify_letter_returned(db: Session, recipient: User, letter: Letter) -> Notification:
    return notify(
        db, recipient, letter,
        NotificationType.LETTER_RETURNED,
        f"Letter '{letter.serial_number}' has been returned to you.",
    )


def notify_letter_closed(db: Session, recipient: User, letter: Letter) -> Notification:
    return notify(
        db, recipient, letter,
        NotificationType.LETTER_CLOSED,
        f"Letter '{letter.serial_number}' has been marked as closed.",
    )
