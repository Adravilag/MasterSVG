import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

// Directory for temporary SVG icon files
let tempIconDir: string | undefined;

function getTempIconDir(): string {
  if (!tempIconDir) {
    tempIconDir = path.join(os.tmpdir(), 'icon-manager-previews');
    if (!fs.existsSync(tempIconDir)) {
      fs.mkdirSync(tempIconDir, { recursive: true });
    }
  }
  return tempIconDir;
}

// Clear temp icon directory on refresh
export function clearTempIcons(): void {
  const iconDir = getTempIconDir();
  try {
    const files = fs.readdirSync(iconDir);
    for (const file of files) {
      fs.unlinkSync(path.join(iconDir, file));
    }
  } catch {
    // Ignore errors
  }
}

export function saveTempSvgIcon(name: string, svgContent: string): string {
  const iconDir = getTempIconDir();
  const safeName = name.replace(/[^a-z0-9-]/gi, '_');
  // Add hash of content to filename to force VS Code to reload when content changes
  const contentHash = crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8);
  const iconPath = path.join(iconDir, `${safeName}_${contentHash}.svg`);
  
  // Skip if file already exists with same content
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  
  // Normalize SVG for display - ensure it has proper viewBox and size
  let normalizedSvg = svgContent;
  
  // If SVG doesn't have width/height, add them for proper display
  if (!normalizedSvg.includes('width=') && !normalizedSvg.includes('height=')) {
    normalizedSvg = normalizedSvg.replace('<svg', '<svg width="16" height="16"');
  }
  
  // Check if SVG has real colors (not just black/none/currentColor)
  // Look for any color that is NOT black
  const hasGradient = /url\(#/.test(normalizedSvg);
  const colorPattern = /(?:fill|stroke)="([^"]+)"/gi;
  let match;
  let hasRealColors = hasGradient;
  
  while ((match = colorPattern.exec(normalizedSvg)) !== null) {
    const color = match[1].toLowerCase().trim();
    // Skip none, currentColor, and black variants
    if (color === 'none' || color === 'currentcolor') continue;
    if (color === '#000' || color === '#000000' || color === 'black' || 
        color === 'rgb(0,0,0)' || color === 'rgb(0, 0, 0)') continue;
    // Found a real color
    hasRealColors = true;
    break;
  }
  
  // If no real colors (monochrome black or no fill at all), use currentColor
  if (!hasRealColors) {
    // Replace existing black fills/strokes
    normalizedSvg = normalizedSvg
      .replace(/fill="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'fill="currentColor"')
      .replace(/stroke="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'stroke="currentColor"');
    
    // Add fill="currentColor" to svg element if no fill defined
    if (!normalizedSvg.includes('fill="')) {
      normalizedSvg = normalizedSvg.replace('<svg', '<svg fill="currentColor"');
    }
  }
  
  fs.writeFileSync(iconPath, normalizedSvg);
  return iconPath;
}
