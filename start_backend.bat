@echo off
echo ========================================
echo  Risk Guard AI - Backend Setup
echo ========================================

cd /d "%~dp0backend"

echo.
echo [1/3] Creating virtual environment...
python -m venv venv

echo.
echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [3/3] Starting FastAPI server on http://localhost:8000
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
