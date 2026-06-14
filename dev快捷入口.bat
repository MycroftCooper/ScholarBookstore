@echo off
setlocal

set "ROOT=%~dp0"

start "ScholarBookstore API" /D "%ROOT%services\api" cmd /k "go run ./cmd/server"
start "ScholarBookstore Web" /D "%ROOT%apps\web" cmd /k "npm.cmd run dev"

endlocal
