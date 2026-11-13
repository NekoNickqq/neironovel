@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
if not exist "node_modules\vite\bin\vite.js" (
    echo Зависимости не установлены или установка повреждена. Выполняю npm install...
    call npm install
    if errorlevel 1 (
        echo ОШИБКА: npm install не удался
        pause
        exit /b 1
    )
)
echo Frontend: http://localhost:3000
echo.
if exist "node_modules\vite\bin\vite.js" (
    node node_modules\vite\bin\vite.js
) else (
    npm run dev
)
echo.
echo Frontend остановлен.
pause
