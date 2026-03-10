@echo off
REM ============================================================================
REM SERVICE CENTER MANAGEMENT - Full Database Setup Script for New PC
REM ============================================================================
REM Run this from the Backend folder after:
REM   1. PostgreSQL is installed and running
REM   2. Python virtualenv is activated
REM   3. pip install -r requirements.txt is done
REM ============================================================================

echo.
echo ========================================
echo  Service Center Management - DB Setup
echo ========================================
echo.

REM Step 1: Run Django migrations
echo [1/4] Running Django migrations...
python manage.py migrate
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Migrations failed! Check database connection in .env
    pause
    exit /b 1
)
echo       Migrations completed successfully!
echo.

REM Step 2: Run the SQL seed script
echo [2/4] Running SQL seed script (stored procedures + seed data)...
set /p PGPASSWORD="Enter PostgreSQL password: "
psql -U postgres -d service_center_db -f db_setup_script.sql
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: SQL script may have had issues. You can run it manually in pgAdmin.
)
echo.

REM Step 3: Seed inventory categories
echo [3/4] Seeding inventory categories for all branches...
python manage.py seed_categories
echo       Categories seeded!
echo.

REM Step 4: Create superuser
echo [4/4] Creating superuser account...
python manage.py createsuperuser
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo You can now start the server with:
echo   python manage.py runserver
echo.
pause
