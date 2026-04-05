@echo off
echo =======================================================
echo Sycing Code to both Vercel (Frontend) and Render (Backend)
echo =======================================================
echo.

echo Pushing Frontend changes to Personal Repo (triggers Vercel)...
git push origin Dev
echo.

echo Pushing Backend changes to Org Repo (triggers Render/DEV branch)...
git push org Dev:DEV
echo.

echo =======================================================
echo Done! Both frontend and backend are now up to date.
echo =======================================================
pause
