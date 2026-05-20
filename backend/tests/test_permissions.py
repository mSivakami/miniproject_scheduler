import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import Base, get_or_create_institution  # noqa: E402
from main import app  # noqa: E402
from models import Account, AdminUser, UserAccount  # noqa: E402
from routers.auth import (  # noqa: E402
    LoginRequest,
    RegisterRequest,
    SetupRequest,
    _hash_password,
    auth_status,
    get_current_user,
    login,
    register,
    setup,
)
from routers.timetables import get_timetable, list_timetables, save_timetable  # noqa: E402
from schemas import TimetableSave  # noqa: E402


class PermissionRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _login_as(self, username: str, password: str):
        token = login(LoginRequest(username=username, password=password), self.db).access_token
        return get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
            self.db,
        )

    def test_setup_and_register_store_accounts_in_shared_table(self):
        setup(SetupRequest(username="first1", password="secret123"), self.db)
        register(RegisterRequest(username="second1", password="secret123"), self.db)

        accounts = self.db.query(Account).order_by(Account.username.asc()).all()

        self.assertEqual([account.username for account in accounts], ["first1", "second1"])
        self.assertEqual(self.db.query(AdminUser).count(), 0)
        self.assertEqual(self.db.query(UserAccount).count(), 0)

    def test_login_rejects_nonexistent_account(self):
        setup(SetupRequest(username="first1", password="secret123"), self.db)

        with self.assertRaises(HTTPException) as exc:
            login(LoginRequest(username="missing1", password="secret123"), self.db)

        self.assertEqual(exc.exception.status_code, 401)
        self.assertEqual(exc.exception.detail, "Incorrect username or password")

    def test_legacy_accounts_are_migrated_and_can_sign_in(self):
        self.db.add(AdminUser(id="legacy-admin", username="legacy_admin", password_hash="hash-a"))
        self.db.add(UserAccount(id="legacy-user", username="legacy_user", password_hash="hash-b"))
        self.db.commit()

        # Use real password hashes so authentication exercises the migrated accounts.
        legacy_admin = self.db.query(AdminUser).filter(AdminUser.username == "legacy_admin").first()
        legacy_user = self.db.query(UserAccount).filter(UserAccount.username == "legacy_user").first()
        legacy_admin.password_hash = _hash_password("secret123")
        legacy_user.password_hash = _hash_password("secret123")
        self.db.commit()

        status = auth_status(self.db)
        current_admin = self._login_as("legacy_admin", "secret123")
        current_user = self._login_as("legacy_user", "secret123")

        accounts = self.db.query(Account).order_by(Account.username.asc()).all()

        self.assertFalse(status.setup_required)
        self.assertEqual([account.username for account in accounts], ["legacy_admin", "legacy_user"])
        self.assertEqual(current_admin.role, "account")
        self.assertEqual(current_user.role, "account")

    def test_route_dependency_matrix_matches_permission_model(self):
        expected = {
            ("/api/data", "GET"): {"get_db", "get_current_user"},
            ("/api/data", "POST"): {"get_db", "get_current_user"},
            ("/api/timetables", "GET"): {"get_db", "get_current_user"},
            ("/api/timetables", "POST"): {"get_db", "get_current_user"},
            ("/api/generate/main", "POST"): {"get_db", "get_current_user"},
            ("/api/generate/mini/{group_id}", "POST"): {"get_db", "get_current_user"},
            ("/api/mini-groups", "GET"): {"get_db", "get_current_user"},
            ("/api/mini-groups", "POST"): {"get_db", "get_current_user"},
        }

        actual = {}
        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            for method in route.methods:
                key = (route.path, method)
                if key in expected:
                    actual[key] = {dep.call.__name__ for dep in route.dependant.dependencies}

        self.assertEqual(actual, expected)

    def test_saved_timetable_is_readable_after_any_account_save(self):
        setup(SetupRequest(username="first1", password="secret123"), self.db)
        register(RegisterRequest(username="second1", password="secret123"), self.db)

        first_current = self._login_as("first1", "secret123")
        second_current = self._login_as("second1", "secret123")
        get_or_create_institution(self.db, first_current.id)

        saved = save_timetable(
            TimetableSave(
                name="Snapshot 1",
                timetable_json='{"timetable_id":"tt1","fitness":99.5,"entries":[],"generation_time_seconds":1.5}',
                fitness_score=99.5,
                hard_violations=0,
                soft_violations=1,
            ),
            self.db,
            second_current,
        )

        listed = list_timetables(self.db, second_current)
        detail = get_timetable(saved.id, self.db, second_current)

        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0].id, saved.id)
        self.assertEqual(detail.id, saved.id)
        self.assertIn('"timetable_id":"tt1"', detail.timetable_json)


if __name__ == "__main__":
    unittest.main()
