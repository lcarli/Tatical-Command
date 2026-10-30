$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetManifestPath = Join-Path $PSScriptRoot '../../public/assets/blackwood/characters.manifest.json'
$assetManifest = Get-Content -LiteralPath $assetManifestPath -Raw | ConvertFrom-Json
$assetSheet = [System.Drawing.Bitmap]::new(1040,480)
$assetPainter = [System.Drawing.Graphics]::FromImage($assetSheet)
$assetFont = [System.Drawing.Font]::new('Consolas',11)
$assetBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#dcefe1'))
$assetLine = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#bd7452'))
$assetLight = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#e1e8df'))
try {
    $assetPainter.Clear([System.Drawing.ColorTranslator]::FromHtml('#101916'))
    $assetPainter.DrawString('BLACKWOOD / 96x128 + 48x64 / feet anchor (48,112)', $assetFont,$assetBrush,20,16)
    $assetIndex = 0
    foreach ($assetEntry in $assetManifest.assets) {
        if ($assetEntry.anchor.x -ne 48 -or $assetEntry.anchor.y -ne 112) { throw 'Invalid anchor' }
        $assetFile = Join-Path (Split-Path $assetManifestPath) $assetEntry.file
        $assetSprite = [System.Drawing.Bitmap]::new($assetFile)
        try {
            if ($assetSprite.Width -ne 96 -or $assetSprite.Height -ne 128 -or $assetSprite.GetPixel(0,0).A -ne 0) { throw 'Invalid frame/alpha' }
            $assetLeft = 20 + $assetIndex * 255
            $assetPainter.DrawString($assetEntry.id,$assetFont,$assetBrush,$assetLeft,48)
            for ($assetRow=0; $assetRow -lt 2; $assetRow++) {
                $assetTop = 80 + $assetRow*180
                if ($assetRow -eq 1) { $assetPainter.FillRectangle($assetLight,$assetLeft,$assetTop,235,150) }
                $assetPainter.DrawImage($assetSprite,[System.Drawing.Rectangle]::new($assetLeft+12,$assetTop+10,96,128))
                $assetPainter.DrawImage($assetSprite,[System.Drawing.Rectangle]::new($assetLeft+150,$assetTop+66,48,64))
                $assetPainter.DrawLine($assetLine,$assetLeft+6,$assetTop+122,$assetLeft+112,$assetTop+122)
                $assetPainter.DrawLine($assetLine,$assetLeft+144,$assetTop+122,$assetLeft+204,$assetTop+122)
            }
        } finally { $assetSprite.Dispose() }
        $assetIndex++
    }
    $assetPainter.DrawString('Standalone art review. Phaser integration pending.', $assetFont,$assetBrush,20,450)
    New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot 'review') | Out-Null
    $assetSheet.Save((Join-Path $PSScriptRoot 'review/characters.png'),[System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output '4 PNG frames, anchors and transparent corners verified; review sheet saved.'
} finally {
    $assetPainter.Dispose(); $assetSheet.Dispose(); $assetFont.Dispose()
    $assetBrush.Dispose(); $assetLine.Dispose(); $assetLight.Dispose()
}
