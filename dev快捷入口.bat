@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "GOCACHE=%ROOT%.cache\go-build"
if not defined DATABASE_URL set "DATABASE_URL=postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable"
if not defined PGHOST set "PGHOST=localhost"
if not defined PGPORT set "PGPORT=5432"
if not defined PGUSER set "PGUSER=postgres"
if not defined PGDATABASE set "PGDATABASE=kb_dev"
if not defined PGPASSWORD set "PGPASSWORD=postgres123"
if not defined WEB_URL set "WEB_URL=http://localhost:3000"

if "%~1"=="--start-postgres-service" (
  call :start_postgres_service_elevated
  if errorlevel 1 exit /b 1
  exit /b 0
)

if not exist "%ROOT%.cache" mkdir "%ROOT%.cache"

where go >nul 2>nul
if errorlevel 1 (
  echo go not found in PATH. Please install Go or add it to PATH.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd not found in PATH. Please install Node.js or add it to PATH.
  pause
  exit /b 1
)

where psql >nul 2>nul
if errorlevel 1 (
  echo psql not found in PATH. Please install PostgreSQL client tools or add psql to PATH.
  pause
  exit /b 1
)

psql -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" -tAc "select 1" >nul 2>nul
if errorlevel 1 (
  echo PostgreSQL is not reachable at %PGHOST%:%PGPORT%/%PGDATABASE%.
  call :ensure_postgres
  if errorlevel 1 (
    echo PostgreSQL is still unavailable.
    echo If you use a custom database, set DATABASE_URL and PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD before running this file.
    pause
    exit /b 1
  )
)

where goose >nul 2>nul
if not errorlevel 1 (
  goose -dir "%ROOT%services\api\migrations" postgres "%DATABASE_URL%" up
  if errorlevel 1 (
    echo Database migration failed.
    pause
    exit /b 1
  )
) else (
  echo goose not found in PATH, skip database migration.
)

start "ScholarBookstore API" /D "%ROOT%services\api" cmd /k "go run ./cmd/server"
start "ScholarBookstore Web" /D "%ROOT%apps\web" cmd /k "npm.cmd run dev"
call :sleep_seconds 3
start "" "%WEB_URL%"

endlocal
exit /b 0

:ensure_postgres
call :check_postgres
if not errorlevel 1 exit /b 0

call :start_postgres_docker
call :check_postgres
if not errorlevel 1 exit /b 0

call :start_postgres_service
call :check_postgres
if not errorlevel 1 exit /b 0

exit /b 1

:check_postgres
psql -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" -tAc "select 1" >nul 2>nul
exit /b %errorlevel%

:start_postgres_docker
where docker >nul 2>nul
if errorlevel 1 exit /b 1

docker inspect kb-postgres >nul 2>nul
if errorlevel 1 (
  echo Docker container kb-postgres was not found. Creating it...
  docker run --name kb-postgres -e POSTGRES_USER=%PGUSER% -e POSTGRES_PASSWORD=%PGPASSWORD% -e POSTGRES_DB=%PGDATABASE% -p %PGPORT%:5432 -d postgres:17 >nul
  if errorlevel 1 exit /b 1
) else (
  echo Starting Docker container kb-postgres...
  docker start kb-postgres >nul 2>nul
)

for /L %%I in (1,1,20) do (
  call :check_postgres
  if not errorlevel 1 exit /b 0
  call :sleep_seconds 1
)
exit /b 1

:start_postgres_service
for /f "tokens=2 delims=:" %%S in ('sc query state^= all ^| findstr /R /C:"SERVICE_NAME: postgresql"') do (
  for /f "tokens=* delims= " %%T in ("%%S") do (
    net session >nul 2>nul
    if errorlevel 1 (
      echo Administrator permission is required to start PostgreSQL service %%T.
      echo Requesting administrator permission...
      powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '--start-postgres-service' -Verb RunAs -Wait"
      psql -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" -tAc "select 1" >nul 2>nul
      if not errorlevel 1 exit /b 0
      exit /b 1
    )
    call :start_named_postgres_service "%%T"
    if not errorlevel 1 exit /b 0
  )
)
echo Could not auto-start PostgreSQL. Try starting PostgreSQL manually or run this bat as administrator.
exit /b 1

:start_postgres_service_elevated
for /f "tokens=2 delims=:" %%S in ('sc query state^= all ^| findstr /R /C:"SERVICE_NAME: postgresql"') do (
  for /f "tokens=* delims= " %%T in ("%%S") do (
    call :start_named_postgres_service "%%T"
    if not errorlevel 1 exit /b 0
  )
)
exit /b 1

:start_named_postgres_service
echo Trying to start PostgreSQL service %~1...
net start "%~1" >nul 2>nul
call :sleep_seconds 3
psql -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" -tAc "select 1" >nul 2>nul
if not errorlevel 1 exit /b 0
exit /b 1

:sleep_seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds %~1" >nul 2>nul
if errorlevel 1 ping 127.0.0.1 -n %~1 >nul 2>nul
exit /b 0
