/**
 * Helper for reading and parsing variants file content
 */
import * as fs from 'node:fs';

export interface ParsedFileContent {
  variants?: Record<string, Record<string, string[]>>;
  defaults?: Record<string, string>;
  colorMappings?: Record<string, Record<string, string>>;
  animations?: Record<string, unknown[]>;
}

/**
 * Read and parse variants file content
 */
export function readVariantsFile(filePath: string | undefined): string | null {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Parse Variants object from file content
 */
export function parseVariants(content: string | null): Record<string, Record<string, string[]>> {
  if (!content) return {};

  const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*\});/);
  if (!match) return {};

  try {
    return new Function(`return ${match[1]}`)();
  } catch {
    return {};
  }
}

/**
 * Parse colorMappings object from file content
 */
export function parseColorMappings(content: string | null): Record<string, Record<string, string>> {
  if (!content) return {};

  const match = content.match(/export\s+const\s+colorMappings\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return {};

  try {
    return new Function(`return ${match[1]}`)();
  } catch {
    return {};
  }
}

/**
 * Parse full VariantsData structure from file content
 */
export function parseVariantsData(content: string | null): ParsedFileContent | null {
  if (!content) return null;

  const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\}\s*);/);
  if (!match) return null;

  try {
    return new Function(`return ${match[1]}`)();
  } catch {
    return null;
  }
}
