"""
Letters router – handles the full incoming/outgoing letter workflow:

INCOMING WORKFLOW
─────────────────
  Records Officer  →  logs letter (status: RECEIVED_BY_RECORDS)
      ↓  [forward]
  Director         →  reviews   (status: WITH_DIRECTOR)
      ↓  [forward]
  DCE              →  reviews   (status: WITH_DCE)
      ↓  [return to director]
  Director         →  (status: RETURNED_TO_DIRECTOR)
      ↓  [dispatch to department]
  Department       →  executes task (status: DISPATCHED_TO_DEPT)
      ↓  [mark done + report + return]
  Director         →  closes case (status: CLOSED)

OUTGOING WORKFLOW
─────────────────
  Records Officer  →  logs outgoing letter (status: OUTGOING_DRAFT)
       ↓  [mark sent]
  Sent             →  (status: OUTGOING_SENT)
"""
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import (
    DispatchMode, Letter, LetterStatus, LetterType,
    NotificationType, User, UserRole,
)
from app.repositories import (
    LetterRepository, AuditTrailRepository,
    DepartmentRepository, UserRepository, NotificationRepository,
)
from app.schemas.schemas import (
    LetterDispatchToDept, LetterForward, LetterListOut, LetterOut,
)

router = APIRouter(prefix="/letters", tags=["Letters"])

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/tiff"}
MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


def _save_file(upload: UploadFile, letter_type: LetterType, serial: str) -> tuple[str, str]:
    """Saves the uploaded file and returns (relative_path, original_filename)."""
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {upload.content_type}")
    content = upload.file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    sub = "incoming" if letter_type == LetterType.INCOMING else "outgoing"
    safe_serial = serial.replace("/", "-")
    ext = os.path.splitext(upload.filename)[1] or ".bin"
    filename = f"{safe_serial}{ext}"
    # Always store URL-safe relative paths regardless of OS path separator.
    rel_path = Path(sub, filename).as_posix()
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)

    with open(abs_path, "wb") as f:
        f.write(content)

    return rel_path, upload.filename


# ─── CREATE ──────────────────────────────────────────────────────────────────

@router.post("/incoming", response_model=LetterOut, status_code=status.HTTP_201_CREATED)
def create_incoming(
    subject: str = Form(...),
    sender_name: str = Form(...),
    date_received: str = Form(...),
    received_by_name: str = Form(...),
    reference_number: Optional[str] = Form(None),
    sender_org: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RECORDS, UserRole.ADMIN)),
):
    """Records officer logs a new incoming letter."""
    from datetime import datetime
    letter_repo = LetterRepository(db)
    trail_repo = AuditTrailRepository(db)

    serial = f"{datetime.now().year}/IN/{letter_repo.count_by_type_and_year(LetterType.INCOMING, datetime.now().year) + 1:03d}"

    file_path, file_name = None, None
    if file and file.filename:
        file_path, file_name = _save_file(file, LetterType.INCOMING, serial)

    letter = Letter(
        serial_number=serial,
        letter_type=LetterType.INCOMING,
        status=LetterStatus.RECEIVED_BY_RECORDS,
        subject=subject,
        sender_name=sender_name,
        sender_org=sender_org,
        reference_number=reference_number,
        date_received=datetime.fromisoformat(date_received),
        received_by_id=current_user.id,
        notes=notes,
        file_path=file_path,
        file_name=file_name,
    )
    db.add(letter)
    db.flush()

    trail_repo.log(letter, current_user,
                   "Letter received and logged by Records",
                   LetterStatus.RECEIVED_BY_RECORDS, LetterStatus.RECEIVED_BY_RECORDS)
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/outgoing", response_model=LetterOut, status_code=status.HTTP_201_CREATED)
def create_outgoing(
    subject: str = Form(...),
    recipient_name: str = Form(...),
    dispatch_mode: DispatchMode = Form(...),
    reference_number: Optional[str] = Form(None),
    recipient_org: Optional[str] = Form(None),
    date_sent: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RECORDS, UserRole.ADMIN)),
):
    """Records officer logs a new outgoing letter."""
    from datetime import datetime, timezone
    letter_repo = LetterRepository(db)
    trail_repo = AuditTrailRepository(db)

    serial = f"{datetime.now().year}/OUT/{letter_repo.count_by_type_and_year(LetterType.OUTGOING, datetime.now().year) + 1:03d}"

    file_path, file_name = None, None
    if file and file.filename:
        file_path, file_name = _save_file(file, LetterType.OUTGOING, serial)

    letter = Letter(
        serial_number=serial,
        letter_type=LetterType.OUTGOING,
        status=LetterStatus.OUTGOING_DRAFT,
        subject=subject,
        recipient_name=recipient_name,
        recipient_org=recipient_org,
        reference_number=reference_number,
        date_sent=datetime.fromisoformat(date_sent) if date_sent else datetime.now(timezone.utc),
        dispatch_mode=dispatch_mode,
        received_by_id=current_user.id,
        notes=notes,
        file_path=file_path,
        file_name=file_name,
    )
    db.add(letter)
    db.flush()

    trail_repo.log(letter, current_user,
                   "Outgoing letter logged by Records",
                   LetterStatus.OUTGOING_DRAFT, LetterStatus.OUTGOING_DRAFT)
    db.commit()
    db.refresh(letter)
    return letter


# ─── LIST & DETAIL ───────────────────────────────────────────────────────────

@router.get("/", response_model=List[LetterListOut])
def list_letters(
    letter_type: Optional[LetterType] = Query(None),
    status: Optional[LetterStatus] = Query(None),
    department_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, description="Search by subject, serial, or sender"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LetterRepository(db).list_letters(
        letter_type=letter_type,
        status=status,
        department_id=department_id,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{letter_id}", response_model=LetterOut)
def get_letter(
    letter_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    letter = LetterRepository(db).get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    return letter


# ─── WORKFLOW TRANSITIONS ─────────────────────────────────────────────────────

@router.post("/{letter_id}/forward-to-director", response_model=LetterOut)
def forward_to_director(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RECORDS, UserRole.ADMIN)),
):
    """Records forwards letter to the Director."""
    letter_repo  = LetterRepository(db)
    trail_repo   = AuditTrailRepository(db)
    notif_repo   = NotificationRepository(db)
    user_repo    = UserRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.status != LetterStatus.RECEIVED_BY_RECORDS:
        raise HTTPException(status_code=400, detail="Letter is not in RECEIVED_BY_RECORDS status")

    old_status = letter.status
    letter.status = LetterStatus.WITH_DIRECTOR
    trail_repo.log(letter, current_user, "Forwarded to Director",
                   old_status, letter.status, payload.remarks)
    directors = user_repo.get_by_role(UserRole.DIRECTOR)
    notif_repo.notify_role(directors, letter, NotificationType.LETTER_FORWARDED,
                           f"Letter {letter.serial_number} has been forwarded to you by Records.")
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/forward-to-dce", response_model=LetterOut)
def forward_to_dce(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DIRECTOR, UserRole.ADMIN)),
):
    """Director forwards letter to the DCE."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)
    notif_repo  = NotificationRepository(db)
    user_repo   = UserRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.status != LetterStatus.WITH_DIRECTOR:
        raise HTTPException(status_code=400, detail="Letter is not WITH_DIRECTOR")

    old_status = letter.status
    letter.status = LetterStatus.WITH_DCE
    trail_repo.log(letter, current_user, "Forwarded to DCE",
                   old_status, letter.status, payload.remarks)
    dces = user_repo.get_by_role(UserRole.DCE)
    notif_repo.notify_role(dces, letter, NotificationType.LETTER_FORWARDED,
                           f"Letter {letter.serial_number} has been forwarded to you by the Director.")
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/return-to-director", response_model=LetterOut)
def return_to_director(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DCE, UserRole.ADMIN)),
):
    """DCE returns letter to the Director."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)
    notif_repo  = NotificationRepository(db)
    user_repo   = UserRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.status != LetterStatus.WITH_DCE:
        raise HTTPException(status_code=400, detail="Letter is not WITH_DCE")

    old_status = letter.status
    letter.status = LetterStatus.RETURNED_TO_DIRECTOR
    trail_repo.log(letter, current_user, "Returned to Director by DCE",
                   old_status, letter.status, payload.remarks)
    directors = user_repo.get_by_role(UserRole.DIRECTOR)
    notif_repo.notify_role(directors, letter, NotificationType.LETTER_RETURNED,
                           f"Letter {letter.serial_number} has been returned to you by the DCE.")
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/dispatch-to-department", response_model=LetterOut)
def dispatch_to_department(
    letter_id: int,
    payload: LetterDispatchToDept,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DIRECTOR, UserRole.ADMIN)),
):
    """Director dispatches letter to a specific department for action."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)
    notif_repo  = NotificationRepository(db)
    user_repo   = UserRepository(db)
    dept_repo   = DepartmentRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.status not in (LetterStatus.WITH_DIRECTOR, LetterStatus.RETURNED_TO_DIRECTOR):
        raise HTTPException(status_code=400, detail="Letter must be WITH_DIRECTOR or RETURNED_TO_DIRECTOR")

    dept = dept_repo.get_active_by_id(payload.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    old_status = letter.status
    letter.status = LetterStatus.DISPATCHED_TO_DEPT
    letter.assigned_department_id = payload.department_id
    trail_repo.log(letter, current_user, f"Dispatched to {dept.name}",
                   old_status, letter.status, payload.remarks)

    heads = user_repo.get_by_role_and_department(UserRole.DEPARTMENT_HEAD, dept.id)
    notif_repo.notify_role(heads, letter, NotificationType.LETTER_ASSIGNED,
                           f"Letter {letter.serial_number} has been dispatched to your department.")
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/return-from-department", response_model=LetterOut)
def return_from_department(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DEPARTMENT_HEAD, UserRole.ADMIN)),
):
    """Department marks task done, writes report remarks, and returns letter to Director."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)
    notif_repo  = NotificationRepository(db)
    user_repo   = UserRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.status != LetterStatus.DISPATCHED_TO_DEPT:
        raise HTTPException(status_code=400, detail="Letter is not currently with a department")
    if current_user.role != UserRole.ADMIN:
        if not current_user.department_id:
            raise HTTPException(status_code=403, detail="Department head account has no department assigned")
        if letter.assigned_department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only complete letters assigned to your department")
    if not (payload.remarks or "").strip():
        raise HTTPException(status_code=400, detail="Department report is required before marking done and returning to Director")

    old_status = letter.status
    letter.status = LetterStatus.RETURNED_TO_DIRECTOR
    trail_repo.log(
        letter,
        current_user,
        "Department marked task done and returned to Director",
        old_status,
        letter.status,
        payload.remarks.strip(),
    )

    directors = user_repo.get_by_role(UserRole.DIRECTOR)
    notif_repo.notify_role(
        directors,
        letter,
        NotificationType.LETTER_RETURNED,
        f"Letter {letter.serial_number} has been completed by department and returned for closure.",
    )
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/close", response_model=LetterOut)
def close_letter(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DIRECTOR)),
):
    """Director/Admin closes an incoming letter after it is returned for closure."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.letter_type != LetterType.INCOMING:
        raise HTTPException(status_code=400, detail="Only incoming letters can be closed with this action")
    if letter.status == LetterStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Letter is already closed")
    if letter.status != LetterStatus.RETURNED_TO_DIRECTOR:
        raise HTTPException(status_code=400, detail="Letter must be returned to Director before closure")

    old_status = letter.status
    letter.status = LetterStatus.CLOSED
    trail_repo.log(letter, current_user, "Letter closed",
                   old_status, letter.status, payload.remarks)
    db.commit()
    db.refresh(letter)
    return letter


@router.post("/{letter_id}/mark-outgoing-sent", response_model=LetterOut)
def mark_outgoing_sent(
    letter_id: int,
    payload: LetterForward,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RECORDS, UserRole.ADMIN)),
):
    """Mark an outgoing letter as sent."""
    letter_repo = LetterRepository(db)
    trail_repo  = AuditTrailRepository(db)

    letter = letter_repo.get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    if letter.letter_type != LetterType.OUTGOING:
        raise HTTPException(status_code=400, detail="This action is only for outgoing letters")
    if letter.status != LetterStatus.OUTGOING_DRAFT:
        raise HTTPException(status_code=400, detail="Letter is not in OUTGOING_DRAFT status")

    old_status = letter.status
    letter.status = LetterStatus.OUTGOING_SENT
    trail_repo.log(letter, current_user, "Outgoing letter marked as sent",
                   old_status, letter.status, payload.remarks)
    db.commit()
    db.refresh(letter)
    return letter


# ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────

@router.get("/{letter_id}/trail", response_model=LetterOut)
def get_trail(
    letter_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return full letter details including the complete audit trail."""
    letter = LetterRepository(db).get_by_id(letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Letter not found")
    return letter
