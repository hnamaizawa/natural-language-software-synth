@echo off
setlocal
cd /d %~dp0
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe scripts\harness_check.py
) else (
  py -3 scripts\harness_check.py
)
