import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import Base, get_or_create_institution
from models import Account, LessonBlock, Teacher, Subject, Room, Classroom, MiniGroup
from routers.auth import (
    LoginRequest,
    RegisterRequest,
    SetupRequest,
    login,
    get_current_user,
    setup,
)
from routers.data import sync_all_data, get_all_data
from schemas import (
    AllDataSave,
    TeacherCreate,
    SubjectCreate,
    RoomCreate,
    ClassroomCreate,
    LessonBlockCreate,
    ConstraintSettingsCreate,
    InstitutionUpdate,
)


class LessonSyncTests(unittest.TestCase):
    def setUp(self):
        # Create an in-memory SQLite database for testing
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = SessionLocal()

        # Set up a demo/test account
        setup(SetupRequest(username="demo_admin", password="password123"), self.db)
        self.current_user = self._login_as("demo_admin", "password123")
        self.inst = get_or_create_institution(self.db, self.current_user.id)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _login_as(self, username: str, password: str):
        token = login(LoginRequest(username=username, password=password), self.db).access_token
        return get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
            self.db,
        )

    def test_main_scope_lesson_sync_add_delete_edit(self):
        # 1. First sync to populate core entities (Teacher, Subject, Room, Classroom)
        # and create 3 lesson blocks in the MAIN schedule
        payload_1 = AllDataSave(
            institution=InstitutionUpdate(name="Main Test School"),
            teachers=[TeacherCreate(id="t1", name="Teacher 1", short_name="T1")],
            subjects=[SubjectCreate(id="s1", name="Subject 1", short_name="S1")],
            rooms=[RoomCreate(id="r1", name="Room 1", short_name="R1")],
            classrooms=[ClassroomCreate(id="c1", name="Class 1", short_name="C1")],
            lesson_blocks=[
                LessonBlockCreate(
                    id="lb1",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=1,
                    count=2,
                    subject_name="Subject 1",
                ),
                LessonBlockCreate(
                    id="lb2",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=2,
                    count=1,
                    subject_name="Subject 1",
                ),
                LessonBlockCreate(
                    id="lb3",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=1,
                    count=1,
                    subject_name="Subject 1",
                ),
            ],
            constraint_settings=ConstraintSettingsCreate(settings_json="{}", constraint_mask=123),
        )

        # Call sync_all_data without mini_group_id (simulates main schedule saving)
        res1 = sync_all_data(payload_1, self.db, self.current_user, mini_group_id=None)
        
        # Verify 3 lesson blocks were added
        db_lbs = self.db.query(LessonBlock).filter(LessonBlock.institution_id == self.inst.id).all()
        self.assertEqual(len(db_lbs), 3)
        self.assertEqual(len(res1["lesson_blocks"]), 3)

        # 2. Sync again but DELETE one lesson (lb3) and EDIT one lesson (lb2 duration from 2 to 3)
        payload_2 = AllDataSave(
            teachers=[TeacherCreate(id="t1", name="Teacher 1", short_name="T1")],
            subjects=[SubjectCreate(id="s1", name="Subject 1", short_name="S1")],
            rooms=[RoomCreate(id="r1", name="Room 1", short_name="R1")],
            classrooms=[ClassroomCreate(id="c1", name="Class 1", short_name="C1")],
            lesson_blocks=[
                LessonBlockCreate(
                    id="lb1",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=1,
                    count=2,
                    subject_name="Subject 1",
                ),
                LessonBlockCreate(
                    id="lb2",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=3, # Edited duration
                    count=1,
                    subject_name="Subject 1",
                ),
            ],
            constraint_settings=ConstraintSettingsCreate(settings_json="{}", constraint_mask=123),
        )

        # Save changes
        res2 = sync_all_data(payload_2, self.db, self.current_user, mini_group_id=None)

        # Fetch all lesson blocks directly from database
        db_lbs = self.db.query(LessonBlock).filter(LessonBlock.institution_id == self.inst.id).all()

        # Check deletions: lb3 should be completely deleted!
        self.assertEqual(len(db_lbs), 2, "Deleted lesson was not removed from the database")
        
        # Check edits: lb2's duration should be updated to 3
        lb2_db = self.db.query(LessonBlock).filter(LessonBlock.id == "lb2").first()
        self.assertIsNotNone(lb2_db)
        self.assertEqual(lb2_db.duration, 3)

        # Check sync return value: should only have 2 lesson blocks (none restored back!)
        self.assertEqual(len(res2["lesson_blocks"]), 2, "Deleted lesson was restored back in API response")
        lb_ids = {lb["id"] for lb in res2["lesson_blocks"]}
        self.assertNotIn("lb3", lb_ids)

    def test_mini_group_scope_lesson_sync_isolation(self):
        # Create a mini group first
        mg = MiniGroup(
            id="mg-uuid-1",
            name="Mini Group 1",
            institution_id=self.inst.id,
        )
        self.db.add(mg)
        self.db.commit()

        # 1. Populate core entities and create 2 lessons under main schedule
        # and 2 lessons under the mini-group schedule scope.
        payload_main = AllDataSave(
            teachers=[TeacherCreate(id="t1", name="Teacher 1", short_name="T1")],
            subjects=[SubjectCreate(id="s1", name="Subject 1", short_name="S1")],
            rooms=[RoomCreate(id="r1", name="Room 1", short_name="R1")],
            classrooms=[ClassroomCreate(id="c1", name="Class 1", short_name="C1")],
            lesson_blocks=[
                LessonBlockCreate(
                    id="lb-main-1",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=1,
                    count=1,
                    subject_name="Subject 1",
                ),
                LessonBlockCreate(
                    id="lb-main-2",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=1,
                    count=1,
                    subject_name="Subject 1",
                ),
            ]
        )
        sync_all_data(payload_main, self.db, self.current_user, mini_group_id=None)

        payload_mini = AllDataSave(
            teachers=[TeacherCreate(id="t1", name="Teacher 1", short_name="T1")],
            subjects=[SubjectCreate(id="s1", name="Subject 1", short_name="S1")],
            rooms=[RoomCreate(id="r1", name="Room 1", short_name="R1")],
            classrooms=[ClassroomCreate(id="c1", name="Class 1", short_name="C1")],
            lesson_blocks=[
                LessonBlockCreate(
                    id="lb-mini-1",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=2,
                    count=1,
                    subject_name="Subject 1",
                    mini_group_id="mg-uuid-1",
                ),
                LessonBlockCreate(
                    id="lb-mini-2",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=2,
                    count=1,
                    subject_name="Subject 1",
                    mini_group_id="mg-uuid-1",
                ),
            ]
        )
        sync_all_data(payload_mini, self.db, self.current_user, mini_group_id="mg-uuid-1")

        # Verify all 4 blocks exist in db
        total_lbs = self.db.query(LessonBlock).count()
        self.assertEqual(total_lbs, 4)

        # 2. Sync mini group again, deleting "lb-mini-2" from the mini group payload
        payload_mini_deleted = AllDataSave(
            teachers=[TeacherCreate(id="t1", name="Teacher 1", short_name="T1")],
            subjects=[SubjectCreate(id="s1", name="Subject 1", short_name="S1")],
            rooms=[RoomCreate(id="r1", name="Room 1", short_name="R1")],
            classrooms=[ClassroomCreate(id="c1", name="Class 1", short_name="C1")],
            lesson_blocks=[
                LessonBlockCreate(
                    id="lb-mini-1",
                    teacher_ids=["t1"],
                    subject_ids=["s1"],
                    room_ids=["r1"],
                    classroom_ids=["c1"],
                    duration=2,
                    count=1,
                    subject_name="Subject 1",
                    mini_group_id="mg-uuid-1",
                )
            ]
        )
        res_mini = sync_all_data(payload_mini_deleted, self.db, self.current_user, mini_group_id="mg-uuid-1")

        # Assertions
        # 1. Main lessons should remain untouched (still 2 of them)
        main_lbs = self.db.query(LessonBlock).filter(LessonBlock.mini_group_id == None).all()
        self.assertEqual(len(main_lbs), 2)
        main_ids = {lb.id for lb in main_lbs}
        self.assertEqual(main_ids, {"lb-main-1", "lb-main-2"})

        # 2. Mini group lessons should only have "lb-mini-1", "lb-mini-2" should be deleted!
        mini_lbs = self.db.query(LessonBlock).filter(LessonBlock.mini_group_id == "mg-uuid-1").all()
        self.assertEqual(len(mini_lbs), 1)
        self.assertEqual(mini_lbs[0].id, "lb-mini-1")

        # 3. Response should only contain active mini group lessons
        self.assertEqual(len(res_mini["lesson_blocks"]), 1)
        self.assertEqual(res_mini["lesson_blocks"][0]["id"], "lb-mini-1")


if __name__ == "__main__":
    unittest.main()
