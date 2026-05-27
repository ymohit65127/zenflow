# ZenFlow — Local Development Setup Script
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1

param(
  [switch]$SkipDocker,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

Write-Host ""
Write-Host "  $Cyan╔════════════════════════════════════════╗$Reset"
Write-Host "  $Cyan║         ZenFlow Setup Script           ║$Reset"
Write-Host "  $Cyan║         Everything Flows. 🚀           ║$Reset"
Write-Host "  $Cyan╚════════════════════════════════════════╝$Reset"
Write-Host ""

Set-Location $PSScriptRoot

# Step 1: Check prerequisites
Write-Host "$Cyan[1/6] Checking prerequisites...$Reset"

$nodeVersion = node --version 2>$null
if (-not $nodeVersion) { Write-Error "Node.js not found. Install from https://nodejs.org"; exit 1 }
Write-Host "  $Green✓ Node.js$Reset $nodeVersion"

$pnpmVersion = pnpm --version 2>$null
if (-not $pnpmVersion) {
  Write-Host "  Installing pnpm..."
  npm install -g pnpm
}
Write-Host "  $Green✓ pnpm$Reset $(pnpm --version)"

if (-not $SkipDocker) {
  $dockerVersion = docker --version 2>$null
  if (-not $dockerVersion) { Write-Host "  $Yellow⚠ Docker not found. Install Docker Desktop.$Reset" }
  else { Write-Host "  $Green✓ Docker$Reset $dockerVersion" }
}

# Step 2: Environment setup
Write-Host ""
Write-Host "$Cyan[2/6] Setting up environment...$Reset"

if (-not (Test-Path "apps\web\.env.local")) {
  Copy-Item "apps\web\.env.example" "apps\web\.env.local"
  Write-Host "  $Green✓ Created apps\web\.env.local (fill in OAuth credentials)$Reset"
} else {
  Write-Host "  $Green✓ .env.local already exists$Reset"
}

# Step 3: Install dependencies
if (-not $SkipInstall) {
  Write-Host ""
  Write-Host "$Cyan[3/6] Installing dependencies...$Reset"
  pnpm install
  Write-Host "  $Green✓ Dependencies installed$Reset"
}

# Step 4: Start Docker services
if (-not $SkipDocker) {
  Write-Host ""
  Write-Host "$Cyan[4/6] Starting Docker services...$Reset"
  docker-compose up -d
  Write-Host "  $Green✓ Services started$Reset"
  Write-Host "  Waiting 5s for PostgreSQL to be ready..."
  Start-Sleep -Seconds 5
}

# Step 5: Database setup
Write-Host ""
Write-Host "$Cyan[5/6] Setting up database...$Reset"
pnpm db:push
pnpm db:seed
Write-Host "  $Green✓ Database ready$Reset"

# Step 6: Done!
Write-Host ""
Write-Host "$Cyan[6/6] Setup complete!$Reset"
Write-Host ""
Write-Host "  $Green╔════════════════════════════════════════╗$Reset"
Write-Host "  $Green║   ZenFlow is ready to launch! 🎉      ║$Reset"
Write-Host "  $Green╚════════════════════════════════════════╝$Reset"
Write-Host ""
Write-Host "  Run: $Cyan pnpm dev $Reset"
Write-Host ""
Write-Host "  Services:"
Write-Host "  $Cyan Web App:      $Reset http://localhost:3000"
Write-Host "  $Cyan MinIO:        $Reset http://localhost:9001"
Write-Host "  $Cyan Mailhog:      $Reset http://localhost:8025"
Write-Host "  $Cyan Prisma Studio:$Reset Run 'pnpm db:studio'"
Write-Host ""
Write-Host "  Default login: admin@demo.com (set password via OAuth or /api/auth/register)"
Write-Host ""
