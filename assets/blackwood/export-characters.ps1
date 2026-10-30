# Mechanical sprite packing only. Artistic edits are performed with imagegen.
# Keeps originals and their alpha; crops transparent margins and resamples once.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (-not ('BlackwoodSpriteBounds' -as [type])) {
    Add-Type -ReferencedAssemblies @([System.Drawing.Bitmap].Assembly.Location, [System.Drawing.Rectangle].Assembly.Location) -TypeDefinition @'
using System.Drawing;
public static class BlackwoodSpriteBounds {
    public static Rectangle Find(Bitmap image) {
        int left=image.Width, top=image.Height, right=-1, bottom=-1;
        for (int y=0; y<image.Height; y++)
            for (int x=0; x<image.Width; x++)
                if (image.GetPixel(x,y).A >= 128) {
                    left=System.Math.Min(left,x); top=System.Math.Min(top,y);
                    right=System.Math.Max(right,x); bottom=System.Math.Max(bottom,y);
                }
        if (right<0) throw new System.InvalidOperationException("Empty sprite");
        return Rectangle.FromLTRB(System.Math.Max(0,left-2),System.Math.Max(0,top-2),
            System.Math.Min(image.Width,right+3),System.Math.Min(image.Height,bottom+3));
    }
}
'@
}
$assetRepo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$assetDestination = Join-Path $assetRepo 'public/assets/blackwood/characters'
New-Item -ItemType Directory -Force $assetDestination | Out-Null
$assetEntries = @()
foreach ($assetId in @('bravo-1-idle','bravo-2-idle','bravo-3-idle','civilian-idle')) {
    $assetSource = Join-Path $PSScriptRoot "sources/$assetId-v1.png"
    $assetInput = [System.Drawing.Bitmap]::new($assetSource)
    try {
        $assetBounds = [BlackwoodSpriteBounds]::Find($assetInput)
        $assetScale = [Math]::Min(96.0 / $assetBounds.Height, 76.0 / $assetBounds.Width)
        $assetWidth = [int][Math]::Round($assetBounds.Width * $assetScale)
        $assetHeight = [int][Math]::Round($assetBounds.Height * $assetScale)
        $assetX = [int][Math]::Floor((96 - $assetWidth) / 2.0)
        $assetY = 112 - $assetHeight
        $assetOutput = [System.Drawing.Bitmap]::new(96,128,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $assetGraphics = [System.Drawing.Graphics]::FromImage($assetOutput)
            try {
                $assetGraphics.Clear([System.Drawing.Color]::Transparent)
                $assetGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $assetGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $assetGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $assetTarget = [System.Drawing.Rectangle]::new($assetX,$assetY,$assetWidth,$assetHeight)
                $assetGraphics.DrawImage($assetInput,$assetTarget,$assetBounds,[System.Drawing.GraphicsUnit]::Pixel)
            } finally { $assetGraphics.Dispose() }
            $assetOutput.Save((Join-Path $assetDestination "$assetId.png"),[System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $assetOutput.Dispose() }
        $assetEntries += [ordered]@{
            id=$assetId; file="characters/$assetId.png"; source="assets/blackwood/sources/$assetId-v1.png"
            sourceSha256=(Get-FileHash -LiteralPath $assetSource -Algorithm SHA256).Hash.ToLowerInvariant()
            width=96; height=128; displayWidth=48; displayHeight=64
            anchor=@{x=48;y=112}; origin=@{x=0.5;y=0.875}; facing='screen-southeast'; animation='idle-static'
            sourceCrop=@{x=$assetBounds.X;y=$assetBounds.Y;width=$assetBounds.Width;height=$assetBounds.Height}
            destinationRect=@{x=$assetX;y=$assetY;width=$assetWidth;height=$assetHeight}
        }
    } finally { $assetInput.Dispose() }
}
[ordered]@{schemaVersion=1;status='integration-candidate';pixelRatio=2;assets=$assetEntries} |
    ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $assetDestination '../characters.manifest.json') -Encoding utf8
Write-Output "Exported $($assetEntries.Count) character PNGs and manifest."
