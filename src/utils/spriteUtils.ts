/**
 * Utility functions for SVG sprite manipulation
 */

/**
 * Creates a symbol entry for an SVG sprite
 */
export function createSymbolEntry(iconName: string, body: string, viewBox: string = '0 0 24 24'): string {
  return `  <symbol id="${iconName}" viewBox="${viewBox}">\n    ${body}\n  </symbol>`;
}

/**
 * Creates a new sprite SVG file content
 */
export function createNewSpriteContent(symbolEntry: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
${symbolEntry}
</svg>
`;
}

/**
 * Creates a regex pattern to match an existing symbol by ID
 */
export function createSymbolPattern(iconName: string): RegExp {
  return new RegExp(`<symbol[^>]*id=["']${escapeRegExp(iconName)}["'][\\s\\S]*?<\\/symbol>`, 'g');
}

/**
 * Escapes special regex characters in a string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a symbol with the given ID exists in sprite content
 */
export function symbolExistsInSprite(spriteContent: string, iconName: string): boolean {
  const pattern = createSymbolPattern(iconName);
  return pattern.test(spriteContent);
}

/**
 * Replaces an existing symbol in sprite content
 */
export function replaceSymbolInSprite(spriteContent: string, iconName: string, newSymbolEntry: string): string {
  const pattern = createSymbolPattern(iconName);
  return spriteContent.replace(pattern, newSymbolEntry);
}

/**
 * Adds a new symbol to sprite content (before closing </svg> tag)
 */
export function addSymbolToSprite(spriteContent: string, symbolEntry: string): string {
  return spriteContent.replace('</svg>', `${symbolEntry}\n</svg>`);
}

/**
 * Updates sprite content by either replacing existing symbol or adding new one
 */
export function updateSpriteContent(spriteContent: string, iconName: string, symbolEntry: string): string {
  if (symbolExistsInSprite(spriteContent, iconName)) {
    return replaceSymbolInSprite(spriteContent, iconName, symbolEntry);
  }
  return addSymbolToSprite(spriteContent, symbolEntry);
}

/**
 * Extracts all symbol IDs from sprite content
 */
export function extractSymbolIds(spriteContent: string): string[] {
  const pattern = /<symbol[^>]*id=["']([^"']+)["']/g;
  const ids: string[] = [];
  let match;
  while ((match = pattern.exec(spriteContent)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

/**
 * Removes a symbol from sprite content by ID
 */
export function removeSymbolFromSprite(spriteContent: string, iconName: string): string {
  const pattern = createSymbolPattern(iconName);
  // Remove the symbol and any trailing newline
  return spriteContent.replace(new RegExp(pattern.source + '\\n?', 'g'), '');
}

/**
 * Validates if content is a valid SVG sprite
 */
export function isValidSpriteContent(content: string): boolean {
  return content.includes('<svg') && content.includes('</svg>');
}

/**
 * Gets the count of symbols in a sprite
 */
export function getSymbolCount(spriteContent: string): number {
  return extractSymbolIds(spriteContent).length;
}

/**
 * Creates SVG use reference for a sprite symbol
 */
export function createUseReference(spriteUrl: string, symbolId: string, size: string = '24', className?: string): string {
  const classAttr = className ? ` class="${className}"` : '';
  return `<svg width="${size}" height="${size}"${classAttr}><use href="${spriteUrl}#${symbolId}"></use></svg>`;
}

/**
 * Creates inline use reference (for same-document sprites)
 */
export function createInlineUseReference(symbolId: string, size: string = '24', className?: string): string {
  const classAttr = className ? ` class="${className}"` : '';
  return `<svg width="${size}" height="${size}"${classAttr}><use href="#${symbolId}"></use></svg>`;
}

/**
 * Animation keyframes for icon animations
 */
export const ANIMATION_KEYFRAMES = {
  spin: '@keyframes icon-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
  pulse: '@keyframes icon-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }',
  bounce: '@keyframes icon-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }',
  shake: '@keyframes icon-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }',
  fade: '@keyframes icon-fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }'
};

/**
 * Gets all animation keyframes as a CSS string
 */
export function getAnimationStyles(): string {
  return Object.values(ANIMATION_KEYFRAMES).join('\n  ');
}

/**
 * Builds animation style string
 */
export function buildAnimationStyle(
  animName: string | null,
  duration: number = 1,
  timing: string = 'ease',
  iteration: string = 'infinite'
): string {
  if (!animName || animName === 'none') {
    return '';
  }
  return `animation: icon-${animName} ${duration}s ${timing} ${iteration};`;
}
