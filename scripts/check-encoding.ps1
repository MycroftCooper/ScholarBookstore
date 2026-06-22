$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

# Keep this script ASCII-only so Windows PowerShell never misreads the
# patterns before it has a chance to detect mojibake in project files.
$patternCodepoints = @(
  0x951B,
  0x9286,
  0x7EE0,
  0x93C2,
  0x95AB,
  0x935A,
  0x9422,
  0x59AF,
  0x7487,
  0x93C8,
  0x9352,
  0x9418,
  0x8930,
  0x6FB6,
  0x6D93,
  0x6D63,
  0x93C9
)
$patterns = $patternCodepoints | ForEach-Object { [char]::ConvertFromUtf32($_) }

$excludeDirs = @(
  ".git",
  ".next",
  ".codex-runtime",
  ".gocache",
  ".gomodcache",
  "node_modules",
  "uploads"
)

$includeExtensions = @(
  ".go",
  ".ts",
  ".tsx",
  ".js",
  ".json",
  ".md",
  ".sql",
  ".ps1",
  ".css",
  ".html",
  ".env",
  ".example"
)

$files = Get-ChildItem -Path $root -File -Recurse | Where-Object {
  $fullName = $_.FullName
  foreach ($dir in $excludeDirs) {
    if ($fullName -like "*\$dir\*") {
      return $false
    }
  }
  if ($includeExtensions -notcontains $_.Extension -and $_.Name -notlike "*.env*") {
    return $false
  }
  return $true
}

$hits = @()
foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  foreach ($pattern in $patterns) {
    if ($content.Contains($pattern)) {
      $hits += [pscustomobject]@{
        File = $file.FullName.Substring($root.Length + 1)
        Codepoint = "U+{0:X4}" -f [int][char]$pattern
      }
      break
    }
  }
}

if ($hits.Count -gt 0) {
  $hits | Sort-Object File | Format-Table -AutoSize
  throw "Potential mojibake detected. Fix or whitelist intentional text before committing."
}

Write-Host "Encoding check passed."
