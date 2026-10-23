@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
if not exist "venv\Scripts\python.exe" (
    echo venv не найден. Запусти install-backend.bat
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo Backend: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
python main.py
echo.
echo Backend остановлен.
pause
