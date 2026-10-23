@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo node_modules не найден. Выполни: npm install
    pause
    exit /b 1
)
echo Frontend: http://localhost:3000
echo.
npm run dev
echo.
echo Frontend остановлен.
pause
