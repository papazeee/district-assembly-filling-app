
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import Letter, LetterType


def generate_serial_number(db: Session, letter_type: LetterType) -> str:
    year = datetime.now(timezone.utc).year
    prefix = "IN" if letter_type == LetterType.INCOMING else "OUT"

    # Count existing letters of the same type in the current year
    count = (
        db.query(func.count(Letter.id))
        .filter(
            Letter.letter_type == letter_type,
            Letter.serial_number.like(f"{year}/{prefix}/%"),
        )
        .scalar()
    ) or 0

    sequence = count + 1
    return f"{year}/{prefix}/{sequence:03d}"
