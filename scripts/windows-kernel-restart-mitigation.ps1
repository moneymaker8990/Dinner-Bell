param(
  [switch]$DisableAutoReboot,
  [switch]$DisableRealtekEthernet,
  [switch]$CollectCrashReport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script in an elevated PowerShell session (Run as Administrator)."
  }
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ==="
}

function Set-AutoRebootDisabled {
  Write-Section "Disabling automatic restart after bugcheck"
  wmic recoveros set AutoReboot=False | Out-Host
  wmic recoveros get AutoReboot,DebugInfoType,WriteToSystemLog | Out-Host
}

function Disable-RealtekEthernet {
  Write-Section "Disabling Realtek Ethernet adapter"
  $adapter = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceDescription -like "*Realtek PCIe GbE Family Controller*" } |
    Select-Object -First 1

  if ($null -eq $adapter) {
    Write-Host "Realtek Ethernet adapter not found."
    return
  }

  Disable-NetAdapter -Name $adapter.Name -Confirm:$false | Out-Null
  Write-Host "Disabled adapter: $($adapter.Name) / $($adapter.InterfaceDescription)"
}

function Collect-CrashReport {
  Write-Section "Collecting kernel crash context"
  $reportDir = Join-Path -Path $PSScriptRoot -ChildPath "..\\artifacts"
  $null = New-Item -ItemType Directory -Path $reportDir -Force
  $reportPath = Join-Path -Path $reportDir -ChildPath ("kernel-crash-report-{0}.txt" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("Generated: $(Get-Date -Format o)")
  $lines.Add("")
  $lines.Add("== Bugcheck events (last 14 days) ==")
  Get-WinEvent -FilterHashtable @{ LogName = "System"; Id = 1001; StartTime = (Get-Date).AddDays(-14) } -ErrorAction SilentlyContinue |
    Where-Object { $_.ProviderName -match "BugCheck|Microsoft-Windows-WER-SystemErrorReporting" } |
    Select-Object -First 20 TimeCreated, Id, ProviderName, Message |
    ForEach-Object { $lines.Add(("{0:u} [{1}] {2} - {3}" -f $_.TimeCreated, $_.Id, $_.ProviderName, $_.Message)) }

  $lines.Add("")
  $lines.Add("== Kernel-Power 41 events (last 14 days) ==")
  Get-WinEvent -FilterHashtable @{ LogName = "System"; Id = 41; StartTime = (Get-Date).AddDays(-14) } -ErrorAction SilentlyContinue |
    Select-Object -First 20 TimeCreated, Id, ProviderName, Message |
    ForEach-Object { $lines.Add(("{0:u} [{1}] {2} - {3}" -f $_.TimeCreated, $_.Id, $_.ProviderName, $_.Message)) }

  $lines.Add("")
  $lines.Add("== WHEA events (last 14 days) ==")
  Get-WinEvent -FilterHashtable @{ LogName = "System"; ProviderName = "Microsoft-Windows-WHEA-Logger"; StartTime = (Get-Date).AddDays(-14) } -ErrorAction SilentlyContinue |
    Select-Object -First 30 TimeCreated, Id, LevelDisplayName, Message |
    ForEach-Object { $lines.Add(("{0:u} [{1}] {2} - {3}" -f $_.TimeCreated, $_.Id, $_.LevelDisplayName, $_.Message)) }

  $lines.Add("")
  $lines.Add("== Realtek / NDIS events (last 14 days) ==")
  Get-WinEvent -FilterHashtable @{ LogName = "System"; StartTime = (Get-Date).AddDays(-14) } -ErrorAction SilentlyContinue |
    Where-Object { $_.ProviderName -in @("rt68cx21", "Microsoft-Windows-NDIS") } |
    Select-Object -First 30 TimeCreated, ProviderName, Id, LevelDisplayName, Message |
    ForEach-Object { $lines.Add(("{0:u} [{1}] {2}/{3} - {4}" -f $_.TimeCreated, $_.Id, $_.ProviderName, $_.LevelDisplayName, $_.Message)) }

  Set-Content -Path $reportPath -Value $lines -Encoding UTF8
  Write-Host "Saved report to: $reportPath"
}

if (-not ($DisableAutoReboot -or $DisableRealtekEthernet -or $CollectCrashReport)) {
  Write-Host "No switches provided. Available:"
  Write-Host "  -DisableAutoReboot"
  Write-Host "  -DisableRealtekEthernet"
  Write-Host "  -CollectCrashReport"
  exit 0
}

Assert-Admin

if ($DisableAutoReboot) { Set-AutoRebootDisabled }
if ($DisableRealtekEthernet) { Disable-RealtekEthernet }
if ($CollectCrashReport) { Collect-CrashReport }
