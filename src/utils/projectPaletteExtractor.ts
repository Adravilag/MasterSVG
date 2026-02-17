import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Extracts a color palette from CSS/HTML/config files in the user's project.
 * Scans for hex, rgb, hsl, and CSS custom-property color values.
 */

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
const RGB_RE = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*[\d.]+)?\s*\)/gi;
const HSL_RE = /hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?(?:\s*,\s*[\d.]+)?\s*\)/gi;
const META_THEME_RE = /<meta\s[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/gi;

/** Ignored generic colors */
const IGNORED = new Set([
  '#000', '#000000', '#fff', '#ffffff', '#333', '#333333',
  '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc',
  '#eee', '#eeeeee', '#f5f5f5', '#fafafa',
  'transparent', 'none', 'inherit', 'currentcolor',
]);

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

function extractColorsFromText(text: string): string[] {
  const colors = new Set<string>();

  for (const m of text.matchAll(HEX_RE)) {
    const n = normalizeHex(m[0]);
    if (!IGNORED.has(n)) colors.add(n);
  }

  for (const m of text.matchAll(RGB_RE)) {
    colors.add(m[0].toLowerCase());
  }

  for (const m of text.matchAll(HSL_RE)) {
    colors.add(m[0].toLowerCase());
  }

  for (const m of text.matchAll(META_THEME_RE)) {
    const val = m[1].trim().toLowerCase();
    if (!IGNORED.has(val)) colors.add(val);
  }

  return Array.from(colors);
}

/**
 * Scan the current workspace for CSS/HTML/config files and extract a color palette.
 * Returns unique, non-generic hex/rgb/hsl values found.
 */
export async function extractProjectPalette(maxFiles = 30): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return [];

  const patterns = [
    '**/*.css',
    '**/*.scss',
    '**/*.less',
    '**/*.html',
    '**/tailwind.config.{js,ts,mjs,cjs}',
    '**/theme.{js,ts,json}',
  ];

  const allColors = new Set<string>();
  let filesRead = 0;

  for (const pattern of patterns) {
    if (filesRead >= maxFiles) break;
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxFiles - filesRead);
    for (const uri of uris) {
      if (filesRead >= maxFiles) break;
      try {
        const content = fs.readFileSync(uri.fsPath, 'utf-8');
        for (const c of extractColorsFromText(content)) {
          allColors.add(c);
        }
        filesRead++;
      } catch {
        // skip unreadable files
      }
    }
  }

  return Array.from(allColors);
}

/** Exported for testing */
export { extractColorsFromText };

// ============================================================================
// Semantic Context Extraction
// ============================================================================

/** Common stopwords to filter out from context extraction */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'is', 'it',
  'this', 'that', 'with', 'as', 'by', 'at', 'from', 'be', 'are', 'was', 'has',
  'have', 'not', 'but', 'all', 'can', 'do', 'if', 'my', 'no', 'so', 'up',
  'we', 'you', 'your', 'will', 'use', 'using', 'used', 'should', 'would',
  'about', 'into', 'more', 'also', 'just', 'any', 'each', 'which', 'their',
  'new', 'only', 'how', 'when', 'what', 'who', 'out', 'its', 'may', 'than',
  'then', 'our', 'over', 'these', 'very', 'other', 'some', 'such', 'like',
  'project', 'file', 'files', 'code', 'src', 'dev', 'run', 'build', 'test',
  'version', 'install', 'npm', 'yarn', 'node', 'module', 'modules',
  'package', 'config', 'configuration', 'setup', 'start', 'scripts',
  'true', 'false', 'null', 'undefined', 'type', 'string', 'number',
]);

/** Minimum word length to consider as a keyword */
const MIN_WORD_LENGTH = 3;

/** Maximum keywords to return */
const MAX_KEYWORDS = 15;

/**
 * Extract semantic keywords from a text string.
 * Filters stopwords, short words, and returns the most frequent meaningful words.
 */
export function extractKeywordsFromText(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Sort by frequency, take top N
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);
}

/**
 * Scan the workspace for semantic context: package.json description/keywords,
 * README headings, HTML meta description, and other project metadata.
 * Returns context keywords useful for icon search.
 */
export async function extractProjectContext(maxFiles = 10): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return [];

  const allKeywords = new Set<string>();

  // 1) package.json — keywords and description
  try {
    const pkgUris = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 5);
    for (const uri of pkgUris) {
      const content = fs.readFileSync(uri.fsPath, 'utf-8');
      const pkg = JSON.parse(content) as { description?: string; keywords?: string[] };

      if (pkg.keywords) {
        for (const kw of pkg.keywords) {
          const clean = kw.toLowerCase().trim();
          if (clean.length >= MIN_WORD_LENGTH && !STOPWORDS.has(clean)) {
            allKeywords.add(clean);
          }
        }
      }
      if (pkg.description) {
        for (const kw of extractKeywordsFromText(pkg.description)) {
          allKeywords.add(kw);
        }
      }
    }
  } catch {
    // skip JSON parse errors
  }

  // 2) README files — extract headings and first paragraphs
  try {
    const readmeUris = await vscode.workspace.findFiles('**/README*.{md,txt}', '**/node_modules/**', 3);
    for (const uri of readmeUris) {
      const content = fs.readFileSync(uri.fsPath, 'utf-8');
      // Extract headings
      const headings = content.match(/^#+\s+(.+)$/gm);
      if (headings) {
        const headingText = headings.map(h => h.replace(/^#+\s+/, '')).join(' ');
        for (const kw of extractKeywordsFromText(headingText)) {
          allKeywords.add(kw);
        }
      }
      // Extract first 500 chars for topic detection
      const intro = content.slice(0, 500);
      for (const kw of extractKeywordsFromText(intro)) {
        allKeywords.add(kw);
      }
    }
  } catch {
    // skip
  }

  // 3) HTML meta description and title
  let htmlFilesRead = 0;
  try {
    const htmlUris = await vscode.workspace.findFiles('**/*.html', '**/node_modules/**', maxFiles);
    for (const uri of htmlUris) {
      if (htmlFilesRead >= maxFiles) break;
      const content = fs.readFileSync(uri.fsPath, 'utf-8');

      // Extract <title>
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        for (const kw of extractKeywordsFromText(titleMatch[1])) {
          allKeywords.add(kw);
        }
      }

      // Extract meta description
      const descMatch = content.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) {
        for (const kw of extractKeywordsFromText(descMatch[1])) {
          allKeywords.add(kw);
        }
      }

      htmlFilesRead++;
    }
  } catch {
    // skip
  }

  return Array.from(allKeywords).slice(0, MAX_KEYWORDS);
}
