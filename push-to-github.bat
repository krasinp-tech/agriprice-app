@echo off
echo ====================================================
echo   AgriPrice Auto Git & GitHub Push Helper
echo ====================================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b
)

:: Get GitHub Repository URL
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/user/repo.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] Repository URL cannot be empty!
    pause
    exit /b
)

:: Initialize git if not already initialized
if not exist .git (
    echo.
    echo [*] Initializing Git repository...
    git init
)

:: Add all files to staging
echo [*] Adding files to Git staging...
git add .

:: Commit files
echo [*] Committing files...
git commit -m "Configure Firebase OTP and Render blueprints"

:: Set default branch to main
git branch -M main

:: Configure Remote URL
echo [*] Configuring remote origin...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

:: Push to GitHub
echo [*] Pushing files to GitHub...
echo.
git push -u origin main

if %errorlevel% eq 0 (
    echo.
    echo ====================================================
    echo [SUCCESS] Code pushed to GitHub successfully!
    echo.
    echo Next Steps:
    echo 1. Go to https://dashboard.render.com/
    echo 2. Click "New +" > "Blueprint"
    echo 3. Connect your repository
    echo 4. Fill in the Supabase config keys from .env
    echo ====================================================
) else (
    echo.
    echo [ERROR] Failed to push code to GitHub.
    echo Please make sure you created the repository and have correct permissions.
)

pause
