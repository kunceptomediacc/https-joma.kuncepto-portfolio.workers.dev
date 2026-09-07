$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$publicPath = Join-Path $projectRoot 'public'

if (-not (Test-Path -LiteralPath $publicPath)) {
  New-Item -ItemType Directory -Path $publicPath | Out-Null
}

$resolvedPublic = (Resolve-Path -LiteralPath $publicPath).Path
if (-not $resolvedPublic.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedPublic -Leaf) -ne 'public') {
  throw "Refusing to clean an unexpected public directory: $resolvedPublic"
}

Get-ChildItem -LiteralPath $resolvedPublic -Force | Remove-Item -Recurse -Force

$rootFiles = @(
  'index.html',
  'style.css',
  'hero.css',
  'reference-style.css',
  'script.js',
  'favicon.ico',
  'og.png',
  'og-joma-avatar.png',
  'robots.txt',
  'sitemap.xml',
  '_headers'
)

foreach ($file in $rootFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $resolvedPublic
}

$imageTarget = Join-Path $resolvedPublic 'assets\img'
$iconTarget = Join-Path $resolvedPublic 'assets\icons'
$portfolioTarget = Join-Path $resolvedPublic 'assets\portfolio'
New-Item -ItemType Directory -Force -Path $imageTarget, $iconTarget, $portfolioTarget | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets\img\hero-cutout.webp'), (Join-Path $projectRoot 'assets\img\logo.webp') -Destination $imageTarget
Copy-Item -Path (Join-Path $projectRoot 'assets\icons\*.svg') -Destination $iconTarget
Copy-Item -Path (Join-Path $projectRoot 'assets\portfolio\*.webp') -Destination $portfolioTarget
Copy-Item -Path (Join-Path $projectRoot 'assets\portfolio\*.png') -Destination $portfolioTarget
Copy-Item -Path (Join-Path $projectRoot 'assets\portfolio\*.mp4') -Destination $portfolioTarget

Write-Output "Prepared public deployment files in $resolvedPublic"
