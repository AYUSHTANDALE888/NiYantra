@echo off
echo Stopping NiYantra services...
taskkill /f /im node.exe 2>nul
taskkill /f /im postgres.exe 2>nul
if exist ".test-pgdata\postmaster.pid" del /f /q ".test-pgdata\postmaster.pid" 2>nul
echo All NiYantra services stopped.
pause

