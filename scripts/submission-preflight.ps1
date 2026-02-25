Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Dinner Bell submission preflight"
Write-Host "================================"

function Test-PathExists {
  param([string]$PathToCheck, [string]$Label)
  if (Test-Path -Path $PathToCheck) {
    Write-Host "[PASS] $Label"
    return $true
  }
  Write-Host "[FAIL] $Label"
  return $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$allPassed = $true

$allPassed = (Test-PathExists "$repoRoot\assets\images\icon.png" "iOS/Android icon exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\assets\images\splash-icon.png" "Splash icon exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\assets\images\adaptive-icon.png" "Adaptive icon exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\assets\images\favicon.png" "Web favicon exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\app\privacy.tsx" "Privacy route exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\app\terms.tsx" "Terms route exists") -and $allPassed
$allPassed = (Test-PathExists "$repoRoot\docs\PRE_SUBMIT_CHECKLIST.md" "Pre-submit checklist exists") -and $allPassed

Write-Host ""
Write-Host "Checking eas.json placeholders..."
$easJsonPath = "$repoRoot\eas.json"
$easRaw = Get-Content -Path $easJsonPath -Raw

if ($easRaw -match "YOUR_APPLE_ID@example.com|1234567890|ABCDE12345") {
  Write-Host "[WARN] iOS submit placeholders still present in eas.json"
  $allPassed = $false
} else {
  Write-Host "[PASS] iOS submit values do not look like placeholders"
}

if ($easRaw -match "keys/google-play-service-account.json") {
  if (Test-Path -Path "$repoRoot\keys\google-play-service-account.json") {
    Write-Host "[PASS] Google Play service account file found"
  } else {
    Write-Host "[WARN] Google Play service account path set but file missing"
    $allPassed = $false
  }
}

Write-Host ""
Write-Host "Reminder checks (manual):"
Write-Host "- EAS login: eas whoami"
Write-Host "- EAS env vars: EXPO_PUBLIC_SUPABASE_URL / ANON_KEY / APP_URL / legal URLs"
Write-Host "- Production Supabase migrations applied"
Write-Host "- Deployed /privacy and /terms URLs"
Write-Host "- Reviewer demo account documented"

Write-Host ""
if ($allPassed) {
  Write-Host "Preflight status: PASS"
  exit 0
}

Write-Host "Preflight status: CHECK WARNINGS"
exit 1
