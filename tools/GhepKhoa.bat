@echo off
REM Mo giao dien bam nut cua bo cong cu lap danh sach ghep khoa.
setlocal
set "PYTHONPATH=%~dp0"
set "PYTHONIOENCODING=utf-8"
cd /d "%~dp0"
python -m ghepkhoa gui
if errorlevel 1 (
  echo.
  echo Co loi xay ra. Kiem tra da cai chua:
  echo     python -m pip install xlrd pywin32 openpyxl
  pause
)
endlocal
