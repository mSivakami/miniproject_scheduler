# AutoScheduler

Automatic Timetable Scheduler using a Genetic Algorithm.
One folder. One command. Everything runs.

---

## Quick start

### 1 — Install prerequisites (one time only)

- **Node.js** 18+ → https://nodejs.org
- **Python** 3.10+ → https://python.org

### 2 — Install all dependencies (one time only)

Double-click `setup.bat` (or run it in the terminal). 

This script will automatically check if Node.js and Python are installed, and install all required Node and Python packages.

### 3 — Configure environment

The `.env` file is already present with sensible defaults (or will be automatically created by the setup script).
For local development **you don't need to change anything**.

### 4 — Run everything

Double-click `start.bat` (or run it in the terminal).

This script will automatically start both the frontend and backend servers simultaneously and open the web app in your default browser.

| Server | URL | What it is |
|--------|-----|-----------|
| Frontend (Vite) | http://localhost:5173 | The React web app |
| Backend (Uvicorn) | http://localhost:8000 | The FastAPI + GA engine |
| API Docs | http://localhost:8000/docs | Auto-generated Swagger UI |

Open **http://localhost:5173** in your browser.

---

## First-time login

On first run, the database is empty.
The login screen will show **"Create admin account"** — enter any username and password (min 6 chars) to set up your account.

On every subsequent run it shows the normal **"Sign in"** screen.

---

## Where your keys go

Everything is in the **single `.env` file** at the root:

```
AutoScheduler/
└── .env   ← THE ONLY FILE YOU NEED TO EDIT
```

| Variable | What it does | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL the frontend uses to talk to the backend | `http://localhost:8000` |
| `JWT_SECRET` | Secret used to sign login tokens | `autoscheduler-change-this-...` |

The `.env` is automatically copied to `frontend/.env` so Vite can read `VITE_API_URL`.

---

## Project structure

```
AutoScheduler/
├── .env                   ← YOUR KEYS (never commit this)
├── .env.example           ← template — safe to commit
├── .gitignore
├── package.json           ← root scripts (dev, setup, build)
├── README.md
│
├── frontend/              ← React + TypeScript + Vite
│   ├── src/app/
│   │   ├── api.ts         ← all backend HTTP calls
│   │   ├── App.tsx        ← auth check + router
│   │   ├── auth/
│   │   │   └── client.ts  ← JWT auth helpers
│   │   ├── store/
│   │   │   └── useStore.ts ← Zustand store (data + generation)
│   │   ├── ga/
│   │   │   └── scheduler.ts ← local GA fallback (runs in browser)
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   └── pages/
│   │       ├── AuthPage.tsx
│   │       ├── Dashboard.tsx
│   │       ├── Subjects.tsx
│   │       ├── Teachers.tsx
│   │       ├── Classes.tsx
│   │       ├── Classrooms.tsx
│   │       ├── Lessons.tsx
│   │       ├── Timetable.tsx
│   │       ├── SavedTimetables.tsx
│   │       ├── Groups.tsx
│   │       └── Settings.tsx
│   └── package.json
│
└── backend/               ← FastAPI + SQLite + GA Engine
    ├── main.py            ← server entry point
    ├── database.py        ← SQLite setup
    ├── models.py          ← SQLAlchemy ORM models
    ├── schemas.py         ← Pydantic request/response models
    ├── requirements.txt   ← Python dependencies
    ├── app.db             ← SQLite database (auto-created)
    ├── routers/
    │   ├── auth.py        ← POST /auth/setup, /auth/login, /auth/me
    │   ├── data.py        ← GET/POST /api/data
    │   ├── generate.py    ← POST /api/generate/main
    │   ├── timetables.py  ← GET/POST /api/timetables
    │   └── mini_groups.py ← /api/mini-groups
    ├── engine/            ← Genetic Algorithm implementation
    │   ├── ga_engine.py
    │   ├── ga_fitness.py
    │   ├── ga_operators.py
    │   └── ...
    └── services/
        └── ga_bridge.py   ← connects DB data to GA engine
```

---

## Available scripts

Run all from the `AutoScheduler/` root:

```bash
npm run dev           # Start frontend + backend together
npm run dev:frontend  # Start only the frontend (Vite)
npm run dev:backend   # Start only the backend (Uvicorn)
npm run setup         # Install all dependencies (run once)
npm run build         # Build frontend for production (output: frontend/dist/)
```

---

## How it works

### Authentication
- Backend uses its own JWT system — no external auth service needed
- Tokens stored in browser `localStorage`
- Tokens valid for 7 days

### Data storage & Safeguarding
- All data saved to `backend/app.db` (SQLite file, auto-created on first run).
- The file lives in `backend/` — delete it to reset all data.
- **Backups**: To safeguard your data, double-click `backup_db.bat`. This will create a timestamped copy of your `app.db` file in the `backups/` folder. Do this periodically or before making massive changes.

### Timetable generation
- **With backend running:** frontend sends data to `/api/generate/main` and the Python GA runs server-side (faster, uses your full CPU)

### Saving data
- "Save All" button syncs your current state to the backend database
- In local mode (backend not running) data is saved to browser `localStorage`

---

## Deploying

1. Build the frontend: `npm run build` → output in `frontend/dist/`
2. Serve `frontend/dist/` from any static host (Netlify, Vercel, GitHub Pages)
3. Deploy `backend/` to any Python host (Railway, Render, Fly.io)
4. Set environment variables on your hosting platform:
   - Frontend host: `VITE_API_URL=https://your-backend-url.railway.app`
   - Backend host: `JWT_SECRET=your-production-secret`

---

## Troubleshooting

**"Cannot reach the backend server"** on the login screen
→ Make sure `npm run dev` is running and the backend started successfully.
→ Check the terminal for Python errors.

**Login fails after restarting**
→ Your token may have expired. Click "Sign in" again — tokens last 7 days.

**"No lesson blocks configured"** when generating
→ Add Subjects → Teachers → Classes → Rooms → then create Lessons linking them together. Then generate.

**Want to reset everything**
→ Delete `backend/app.db` and restart. You'll be prompted to create a new account.
