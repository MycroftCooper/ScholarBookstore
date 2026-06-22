param(
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [string]$User = "postgres",
  [string]$Password = "postgres123",
  [string]$DatabaseName = "kb_test",
  [string]$SslMode = "disable"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$psql = Get-Command psql -ErrorAction Stop
$goose = Get-Command goose -ErrorAction Stop

$env:PGPASSWORD = $Password
$exists = & $psql.Source -h $HostName -p $Port -U $User -d postgres -tAc "select 1 from pg_database where datname = '$DatabaseName'"
if ($exists.Trim() -ne "1") {
  & $psql.Source -h $HostName -p $Port -U $User -d postgres -c "create database $DatabaseName"
}

$testDatabaseUrl = "postgres://${User}:${Password}@${HostName}:${Port}/${DatabaseName}?sslmode=${SslMode}"
& $goose.Source -dir (Join-Path $root "services/api/migrations") postgres $testDatabaseUrl up

Write-Host "TEST_DATABASE_URL=$testDatabaseUrl"
