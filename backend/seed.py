"""Seed initial departments and a default admin user."""
from app.core.database import SessionLocal, engine
from app.models.user import Base, Department, User, UserRole
from app.core.security import hash_password

DEPARTMENTS = [
    ("Central Administration",               "CA"),
    ("Finance",                              "FIN"),
    ("Works",                                "WRK"),
   # ("Agriculture",                          "AGR"),
   # ("Education, Youth & Sports",            "EYS"),
   # ("Health",                               "HLT"),
   # ("Social Welfare & Community Dev.",      "SWC"),
    ("Physical Planning",                    "PPL"),
    ("NADMO (Disaster Prevention)",          "NDM"),
   # ("Trade, Industry & Tourism",            "TIT"),
    ("Human Resource Management",            "HRM"),
   # ("Statistics",                           "STA"),
]

DEFAULT_ADMIN = {
    "full_name": "System Administrator",
    "email": "admin@adaeast.gov.gh",
    "password": "Admin1234",
    "role": UserRole.ADMIN,
}

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Departments
        created_depts = 0
        for name, code in DEPARTMENTS:
            if not db.query(Department).filter(Department.code == code).first():
                db.add(Department(name=name, code=code))
                created_depts += 1

        # Admin user
        created_admin = False
        if not db.query(User).filter(User.email == DEFAULT_ADMIN["email"]).first():
            db.add(User(
                full_name=DEFAULT_ADMIN["full_name"],
                email=DEFAULT_ADMIN["email"],
                hashed_password=hash_password(DEFAULT_ADMIN["password"]),
                role=DEFAULT_ADMIN["role"],
            ))
            created_admin = True

        db.commit()
        print(f"Seeded {created_depts} department(s).")
        if created_admin:
            print(f"Admin created: {DEFAULT_ADMIN['email']} / {DEFAULT_ADMIN['password']}")
        else:
            print("Admin already exists, skipped.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
