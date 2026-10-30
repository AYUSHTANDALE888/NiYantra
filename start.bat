@echo off
echo ========================================================
echo    Starting NiYantra (AICTE Approval Workflow System)
echo ========================================================

cd /d "%~dp0"

echo [1/3] Starting Isolated PostgreSQL Database (Port 5433)...
if exist ".test-pgdata\postmaster.pid" (
    del /f /q ".test-pgdata\postmaster.pid" 2>nul
)
start "NiYantra - PostgreSQL (5433)" /min "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "%~dp0.test-pgdata" -p 5433
timeout /t 2 /nobreak >nul

echo [2/3] Starting Backend API Server (Port 4000)...
start "NiYantra - Backend API (4000)" cmd /k "npm --workspace api run dev"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Web Portal (Port 5173)...
start "NiYantra - Frontend Web (5173)" cmd /k "npm --workspace web run dev"

echo.
echo ========================================================
echo  All services launched!
echo  Open your browser at: http://localhost:5173
echo  All demo logins password: demo1234
echo ========================================================
timeout /t 3 >nul
start http://localhost:5173

