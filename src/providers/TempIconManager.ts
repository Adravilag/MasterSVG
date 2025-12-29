import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { SvgContentCache } from './SvgContentCache';

// Directory for temporary SVG icon files
let tempIconDir: string | undefined;

// In-memory cache for temp icon paths to avoid file system checks
const tempIconPathCache: Map<string, string> = new Map();

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
      try {
        fs.unlinkSync(path.join(iconDir, file));
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore errors
  }
  // Clear in-memory cache
  tempIconPathCache.clear();
  // Clear temp paths in SvgContentCache
  SvgContentCache.getInstance().clearTempPaths();
}

/**
 * Normalize SVG content for display in tree view
 * Extracted for reuse and caching
 */
function normalizeSvgForDisplay(svgContent: string): string {
  let normalizedSvg = svgContent;
  
  // Ensure SVG has xmlns namespace (required for VS Code to render correctly)
  if (!normalizedSvg.includes('xmlns=')) {
    normalizedSvg = normalizedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  // If SVG doesn't have width/height, add them for proper display
  if (!normalizedSvg.includes('width=') && !normalizedSvg.includes('height=')) {
    normalizedSvg = normalizedSvg.replace('<svg', '<svg width="16" height="16"');
  }
  
  // Check if SVG has real colors (not just black/none/currentColor)
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
    hasRealColors = true;
    break;
  }
  
  // If no real colors (monochrome black or no fill at all), use currentColor
  if (!hasRealColors) {
    normalizedSvg = normalizedSvg
      .replace(/fill="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'fill="currentColor"')
      .replace(/stroke="(#000|#000000|black|rgb\(0,\s*0,\s*0\))"/gi, 'stroke="currentColor"');
    
    if (!normalizedSvg.includes('fill="')) {
      normalizedSvg = normalizedSvg.replace('<svg', '<svg fill="currentColor"');
    }
  }
  
  return normalizedSvg;
}

export function saveTempSvgIcon(name: string, svgContent: string): string {
  const contentHash = crypto.createHash('md5').update(svgContent).digest('hex').substring(0, 8);
  const cacheKey = `${name}_${contentHash}`;
  
  // Check in-memory cache first (fastest)
  const cachedPath = tempIconPathCache.get(cacheKey);
  if (cachedPath) {
    return cachedPath;
  }

  // Check SvgContentCache
  const svgCache = SvgContentCache.getInstance();
  const cachedTempPath = svgCache.getTempPath(contentHash);
  if (cachedTempPath && fs.existsSync(cachedTempPath)) {
    tempIconPathCache.set(cacheKey, cachedTempPath);
    return cachedTempPath;
  }

  const iconDir = getTempIconDir();
  const safeName = name.replace(/[^a-z0-9-]/gi, '_');
  const iconPath = path.join(iconDir, `${safeName}_${contentHash}.svg`);
  
  // Skip if file already exists
  if (fs.existsSync(iconPath)) {
    tempIconPathCache.set(cacheKey, iconPath);
    svgCache.cacheTempPath(contentHash, iconPath);
    return iconPath;
  }
  
  // Normalize and write
  const normalizedSvg = normalizeSvgForDisplay(svgContent);
  fs.writeFileSync(iconPath, normalizedSvg);
  
  // Cache the path
  tempIconPathCache.set(cacheKey, iconPath);
  svgCache.cacheTempPath(contentHash, iconPath);
  
  return iconPath;
}

