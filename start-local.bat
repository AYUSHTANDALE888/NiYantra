@echo off
title AICTE Platform - Local Dev
cd /d "%~dp0"
echo ========================================================
echo   Starting AICTE Platform (Local Environment)
echo ========================================================
echo.
echo [1/2] Starting local PostgreSQL on port 5433...
start "AICTE Postgres" /min ".\.pgsql\pgsql\bin\postgres.exe" -D ".\.pgsql\data" -p 5433
timeout /t 2 /nobreak >nul
echo.
echo [2/2] Starting API, Web UI, and Scheduler...
echo Open http://localhost:5173 in your browser.
echo.
npm run dev

