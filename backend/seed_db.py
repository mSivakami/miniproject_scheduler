"""
seed_db.py — Database Seeder for AutoScheduler
==============================================
Populates the SQLite database with demo data from backend/engine/tt_cs.py.
Creates a default admin user.
"""

import sys
import os
from pathlib import Path

# Add backend and engine to sys.path to allow imports
sys.path.append(str(Path(__file__).parent))
sys.path.append(str(Path(__file__).parent / "engine"))

from database import SessionLocal, engine, Base, get_or_create_institution
from models import AdminUser, Teacher, Subject, Room, Classroom, LessonBlock, Institution
from engine.tt_cs import create_comprehensive_test_case
from routers.auth import _hash_password
from services.bitmask_service import compute_break_mask, compute_working_mask

def seed():
    print("  [*] Starting database seeding...")
    
    # 1. Recreate tables
    print("  [*] Dropping and recreating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 2. Create Admin User
        print("  [*] Creating admin user (admin / admin123)...")
        admin = AdminUser(
            username="admin",
            password_hash=_hash_password("admin123")
        )
        db.add(admin)
        db.flush()

        # 3. Get/Create Institution
        inst = get_or_create_institution(db)
        print(f"  [*] Initialized Institution: {inst.name}")

        # 4. Load Demo Data from engine
        print("  [*] Loading demo data from engine/tt_cs.py...")
        e_teachers, e_subjects, e_rooms, e_classes, e_lesson_blocks = create_comprehensive_test_case()

        # 5. Map and Save Teachers
        db_teachers = {}
        for tid, t in e_teachers.items():
            dt = Teacher(
                id=tid,
                institution_id=inst.id,
                name=t.name,
                available_mask=str(t.available_mask),
                max_per_day=t.max_per_day,
                max_per_week=t.max_per_week
            )
            db.add(dt)
            db_teachers[tid] = dt
        print(f"  [+] Seeded {len(db_teachers)} teachers")

        # 6. Map and Save Subjects
        db_subjects = {}
        for sid, s in e_subjects.items():
            ds = Subject(
                id=sid,
                institution_id=inst.id,
                name=s.name,
                is_difficult=s.is_difficult,
                is_lab=s.is_lab,
                priority=s.priority
            )
            db.add(ds)
            db_subjects[sid] = ds
        print(f"  [+] Seeded {len(db_subjects)} subjects")

        # 7. Map and Save Rooms
        db_rooms = {}
        for rid, r in e_rooms.items():
            dr = Room(
                id=rid,
                institution_id=inst.id,
                name=r.name,
                is_lab=r.is_lab,
                available_mask=str(r.available_mask)
            )
            db.add(dr)
            db_rooms[rid] = dr
        print(f"  [+] Seeded {len(db_rooms)} rooms")

        # 8. Map and Save Classrooms (Classes in engine)
        db_classrooms = {}
        for cid, c in e_classes.items():
            dc = Classroom(
                id=cid,
                institution_id=inst.id,
                name=c.name
            )
            db.add(dc)
            db_classrooms[cid] = dc
        print(f"  [+] Seeded {len(db_classrooms)} classrooms")

        db.flush() # Ensure all entities have IDs in the session

        # 9. Map and Save Lesson Blocks
        for lb in e_lesson_blocks:
            dlb = LessonBlock(
                id=lb.id,
                institution_id=inst.id,
                duration=lb.duration,
                count=lb.count,
                is_locked=lb.is_locked,
                locked_day=lb.locked_day,
                locked_period=lb.locked_period,
                is_lab=lb.is_lab,
                is_difficult=lb.is_difficult,
                subject_name=lb.subject_name or (db_subjects.get(lb.subject_id).name if lb.subject_id in db_subjects else "Unknown")
            )
            
            # Resolve relationships
            dlb.teachers = [db_teachers[tid] for tid in lb.teacher_ids if tid in db_teachers]
            dlb.subjects = [db_subjects[lb.subject_id]] if lb.subject_id in db_subjects else []
            dlb.classrooms = [db_classrooms[cid] for cid in lb.class_ids if cid in db_classrooms]
            dlb.rooms = [db_rooms[rid] for rid in lb.room_ids if rid in db_rooms]
            
            db.add(dlb)
        
        print(f"  [+] Seeded {len(e_lesson_blocks)} lesson blocks")

        db.commit()
        print("\n  [!] Seeding completed successfully.")
        print("  [!] Use 'admin' / 'admin123' to log in.")

    except Exception as e:
        db.rollback()
        print(f"\n  [ERROR] Seeding failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
