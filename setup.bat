@echo off
echo Setting up MiniProject Scheduler...

REM Stop on error
setlocal

REM Create virtual environment if it does not exist
if not exist ".venv" (
echo Creating Python virtual environment...
python -m venv .venv
) else (
echo Virtual environment already exists.
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install backend dependencies
echo Installing backend dependencies...
pip install -r api\requirements.txt

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
npm install
cd ..

echo Setup completed successfully.

echo.
echo To run backend:
echo uvicorn api.main:app --reload
echo.
echo To run frontend:
echo cd frontend ^&^& npm run dev

endlocal