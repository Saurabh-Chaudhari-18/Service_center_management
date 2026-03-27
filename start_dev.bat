@echo off
color 0a
echo ==========================================
echo    Starting Service Center Management App
echo ==========================================
echo.

echo [1/2] Starting Django Backend in a new window...
start "Django Backend" cmd /k "cd Backend && call venv\Scripts\activate && python manage.py migrate && python manage.py runserver 8001"

echo [2/2] Starting Next.js Frontend in a new window...
start "Next.js Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting up! You can close this small window.
timeout /t 5 >nul
