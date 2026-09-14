param(
  [string]$RepoRoot = "."
)

$ErrorActionPreference = "Stop"
$Dest = Join-Path $RepoRoot "docs/plans/ai-content-editor-v2"
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $Dest -PathType Container)) {
  throw "Missing dossier directory: $Dest"
}

Copy-Item -Force (Join-Path $SourceDir "README.md") (Join-Path $Dest "README.md")
Get-ChildItem -Path $SourceDir -Filter "??-*.md" -File | ForEach-Object {
  Copy-Item -Force $_.FullName (Join-Path $Dest $_.Name)
}
Copy-Item -Force (Join-Path $SourceDir "architecture-baseline.json") (Join-Path $Dest "architecture-baseline.json")

$TaskDest = Join-Path $Dest "tasks"
New-Item -ItemType Directory -Force -Path $TaskDest | Out-Null
Get-ChildItem -Path (Join-Path $SourceDir "tasks") -Filter "*.md" -File | ForEach-Object {
  Copy-Item -Force $_.FullName (Join-Path $TaskDest $_.Name)
}

Write-Host "Applied complete BemTeVi AI Content Editor V2 Revision 8 dossier to $Dest"
