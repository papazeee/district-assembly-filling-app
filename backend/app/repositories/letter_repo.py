"""
LetterRepository – all database queries related to letters.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import Letter, LetterType, LetterStatus, AuditTrail, User
from app.repositories.base import BaseRepository


class LetterRepository(BaseRepository[Letter]):
    def __init__(self, db: Session):
        super().__init__(Letter, db)

    def get_by_serial(self, serial_number: str) -> Optional[Letter]:
        return self.db.query(Letter).filter(Letter.serial_number == serial_number).first()

    def get_with_trail(self, letter_id: int) -> Optional[Letter]:
        """Fetch a letter and eagerly load its audit trail."""
        return self.db.query(Letter).filter(Letter.id == letter_id).first()

    def list_letters(
        self,
        letter_type: Optional[LetterType] = None,
        status: Optional[LetterStatus] = None,
        department_id: Optional[int] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Letter]:
        q = self.db.query(Letter)

        if letter_type:
            q = q.filter(Letter.letter_type == letter_type)
        if status:
            q = q.filter(Letter.status == status)
        if department_id:
            q = q.filter(Letter.assigned_department_id == department_id)
        if search:
            like = f"%{search}%"
            q = q.filter(
                Letter.subject.ilike(like)
                | Letter.serial_number.ilike(like)
                | Letter.sender_name.ilike(like)
                | Letter.recipient_name.ilike(like)
            )

        return q.order_by(Letter.created_at.desc()).offset(skip).limit(limit).all()

    def count_by_type_and_year(self, letter_type: LetterType, year: int) -> int:
        """Used by the serial number generator."""
        prefix = "IN" if letter_type == LetterType.INCOMING else "OUT"
        return (
            self.db.query(func.count(Letter.id))
            .filter(
                Letter.letter_type == letter_type,
                Letter.serial_number.like(f"{year}/{prefix}/%"),
            )
            .scalar()
        ) or 0

    def get_letters_by_department(self, department_id: int) -> List[Letter]:
        return (
            self.db.query(Letter)
            .filter(Letter.assigned_department_id == department_id)
            .order_by(Letter.created_at.desc())
            .all()
        )

    def get_letters_by_status(self, status: LetterStatus) -> List[Letter]:
        return (
            self.db.query(Letter)
            .filter(Letter.status == status)
            .order_by(Letter.created_at.desc())
            .all()
        )

    def update_status(self, letter: Letter, new_status: LetterStatus) -> Letter:
        letter.status = new_status
        self.db.commit()
        self.db.refresh(letter)
        return letter


class AuditTrailRepository(BaseRepository[AuditTrail]):
    def __init__(self, db: Session):
        super().__init__(AuditTrail, db)

    def get_trail_for_letter(self, letter_id: int) -> List[AuditTrail]:
        return (
            self.db.query(AuditTrail)
            .filter(AuditTrail.letter_id == letter_id)
            .order_by(AuditTrail.created_at.asc())
            .all()
        )

    def log(
        self,
        letter: Letter,
        actor: User,
        action: str,
        from_status: Optional[LetterStatus],
        to_status: Optional[LetterStatus],
        remarks: Optional[str] = None,
    ) -> AuditTrail:
        entry = AuditTrail(
            letter_id=letter.id,
            actor_id=actor.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            remarks=remarks,
        )
        self.db.add(entry)
        # Caller commits
        return entry
