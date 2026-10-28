@echo off
title AICTE Platform - Stop
cd /d "%~dp0"
echo Stopping PostgreSQL...
.\.pgsql\pgsql\bin\pg_ctl.exe -D ".\.pgsql\data" stop
echo Done.

