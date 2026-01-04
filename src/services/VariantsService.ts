import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSvgConfig } from '../utils/config';

export interface Variant {
  name: string;
  colors: string[];
}

/** Color mapping: original color → new color */
export interface ColorMapping {
  [originalColor: string]: string;
}

/** Animation preset per icon */
export interface AnimationPreset {
  name: string;
  type: string;
  duration?: number;
  timing?: string;
  iteration?: string;
  delay?: number;
  direction?: string;
}

export interface VariantsData {
  variants: Record<string, Record<string, string[]>>;
  defaults: Record<string, string>;
  /** Color mappings per icon: { iconName: { originalColor: newColor } } */
  colorMappings?: Record<string, ColorMapping>;
  /** Animation presets per icon: { iconName: AnimationPreset[] } */
  animations?: Record<string, AnimationPreset[]>;
}

/**
 * Service for managing icon color variants
 * Handles caching, persistence, and CRUD operations for variants
 */
export class VariantsService {
  // Cache for variants - changes are stored here until explicitly saved
  private _variantsCache: Record<string, Record<string, string[]>> | null = null;
  private _defaultsCache: Record<string, string> | null = null;
  private _colorMappingsCache: Record<string, ColorMapping> | null = null;
  private _hasUnsavedChanges: boolean = false;

  /**
   * Check if there are unsaved changes
   */
  get hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }

  /**
   * Reset the cache (e.g., when switching icons)
   */
  resetCache(): void {
    this._variantsCache = null;
    this._defaultsCache = null;
    this._colorMappingsCache = null;
    this._hasUnsavedChanges = false;
  }

  /**
   * Get the path to the variants.js file
   */
  private _getVariantsFilePath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', 'sagebox-icons');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !outputDir) return undefined;

    return path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
  }

  /**
   * Read all variants from file (or cache)
   */
  private _readVariantsFromFile(): Record<string, Record<string, string[]>> {
    // Return cached variants if available
    if (this._variantsCache !== null) {
      return { ...this._variantsCache };
    }

    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) {
        this._variantsCache = {};
        return {};
      }

      if (!fs.existsSync(filePath)) {
        this._variantsCache = {};
        return {};
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse: export const Variants = { ... };
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        // Use Function to safely parse the object literal
        this._variantsCache = new Function(`return ${match[1]}`)();
        return { ...this._variantsCache };
      }
      this._variantsCache = {};
      return {};
    } catch {
      this._variantsCache = {};
      return {};
    }
  }

  /**
   * Update cache without writing to file
   */
  private _updateVariantsCache(allVariants: Record<string, Record<string, string[]>>): void {
    this._variantsCache = allVariants;
    this._hasUnsavedChanges = true;
  }

  /**
   * Read default variants from file (or cache)
   */
  private _readDefaultVariants(): Record<string, string> {
    // defaultVariants support removed — always return empty
    this._defaultsCache = {};
    return {};
  }

  /**
   * Read color mappings from file (or cache)
   */
  private _readColorMappings(): Record<string, ColorMapping> {
    if (this._colorMappingsCache !== null) {
      console.log('[VariantsService._readColorMappings] Returning cached colorMappings:', Object.keys(this._colorMappingsCache));
      return { ...this._colorMappingsCache };
    }

    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) {
        this._colorMappingsCache = {};
        console.log('[VariantsService._readColorMappings] No file found, returning empty');
        return {};
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+colorMappings\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        this._colorMappingsCache = new Function(`return ${match[1]}`)();
        console.log('[VariantsService._readColorMappings] Read from file, icons found:', Object.keys(this._colorMappingsCache || {}));
        return { ...this._colorMappingsCache };
      }
      this._colorMappingsCache = {};
      console.log('[VariantsService._readColorMappings] No match found in file content');
      return {};
    } catch (err) {
      console.error('[VariantsService._readColorMappings] Error reading colorMappings:', err);
      this._colorMappingsCache = {};
      return {};
    }
  }

  /**
   * Get color mappings for an icon
   */
  getColorMappings(iconName: string): ColorMapping {
    const allMappings = this._readColorMappings();
    return allMappings[iconName] || {};
  }

  /**
   * Set a color mapping for an icon
   */
  setColorMapping(iconName: string, originalColor: string, newColor: string): void {
    const allMappings = this._readColorMappings();
    if (!allMappings[iconName]) {
      allMappings[iconName] = {};
    }
    // Normalize colors to lowercase
    const normOrig = originalColor.toLowerCase();
    const normNew = newColor.toLowerCase();

    console.log(`[VariantsService.setColorMapping] Icon: ${iconName}, Original: ${normOrig} → New: ${normNew}`);

    if (normOrig === normNew) {
      // Remove mapping if same color
      delete allMappings[iconName][normOrig];
      if (Object.keys(allMappings[iconName]).length === 0) {
        delete allMappings[iconName];
      }
    } else {
      allMappings[iconName][normOrig] = normNew;
    }
    this._colorMappingsCache = allMappings;
    this._hasUnsavedChanges = true;
    console.log(`[VariantsService.setColorMapping] Mappings now for ${iconName}:`, allMappings[iconName]);
  }

  /**
   * Clear all color mappings for an icon
   */
  clearColorMappings(iconName: string): void {
    const allMappings = this._readColorMappings();
    delete allMappings[iconName];
    this._colorMappingsCache = allMappings;
    this._hasUnsavedChanges = true;
  }

  /**
   * Remove all data for an icon (variants, colorMappings, defaults)
   * Used when removing an icon from the built icons library
   */
  removeIconData(iconName: string): void {
    // Remove variants
    const allVariants = this._readVariantsFromFile();
    delete allVariants[iconName];
    this._variantsCache = allVariants;

    // Remove color mappings
    const allMappings = this._readColorMappings();
    delete allMappings[iconName];
    this._colorMappingsCache = allMappings;

    // Remove defaults
    const defaults = this._readDefaultVariants();
    delete defaults[iconName];
    this._defaultsCache = defaults;

    this._hasUnsavedChanges = true;
  }

  /**
   * Persist cached variants to disk
   */
  persistToFile(): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      // Ensure output directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Read existing data (from cache or file)
      const allVariants = this._variantsCache || this._readVariantsFromFile();
      const colorMappings = this._colorMappingsCache || this._readColorMappings();

      // Generate variants.js content (note: defaultVariants support removed)
      let content = '// Auto-generated by Icon Studio\n';
      content += '// Variants for icons - edit freely or use the Icon Editor\n\n';

      // Export color mappings (original → new color transformations)
      content += '// Color mappings per icon: { originalColor: newColor }\n';
      content += 'export const colorMappings = {\n';
      const mappingEntries = Object.entries(colorMappings);
      mappingEntries.forEach(([iconName, mappings], iconIdx) => {
        content += `  '${iconName}': {\n`;
        const colorEntries = Object.entries(mappings);
        colorEntries.forEach(([origColor, newColor], colorIdx) => {
          content += `    '${origColor}': '${newColor}'`;
          content += colorIdx < colorEntries.length - 1 ? ',\n' : '\n';
        });
        content += `  }`;
        content += iconIdx < mappingEntries.length - 1 ? ',\n' : '\n';
      });
      content += '};\n\n';

      content += 'export const Variants = {\n';
      const iconEntries = Object.entries(allVariants);
      iconEntries.forEach(([iconName, iconVariants], iconIdx) => {
        content += `  '${iconName}': {\n`;
        const variantEntries = Object.entries(iconVariants);
        variantEntries.forEach(([variantName, colors], variantIdx) => {
          const colorsStr = colors.map(c => `'${c}'`).join(', ');
          content += `    '${variantName}': [${colorsStr}]`;
          content += variantIdx < variantEntries.length - 1 ? ',\n' : '\n';
        });
        content += `  }`;
        content += iconIdx < iconEntries.length - 1 ? ',\n' : '\n';
      });

      content += '};\n';

      fs.writeFileSync(filePath, content);
      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error writing Variants:', error);
    }
  }

  /**
   * Get all variants including internal ones (for _original lookup)
   */
  getAllVariants(iconName: string): Variant[] {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName] || {};
    return Object.entries(iconVariants).map(([name, colors]) => ({ name, colors }));
  }

  /**
   * Get visible variants (excluding internal ones starting with _)
   */
  getSavedVariants(iconName: string): Variant[] {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName] || {};
    // Filter out internal variants (starting with _)
    return Object.entries(iconVariants)
      .filter(([name]) => !name.startsWith('_'))
      .map(([name, colors]) => ({ name, colors }));
  }

  /**
   * Get the default variant for an icon
   */
  getDefaultVariant(iconName: string): string | null {
    // Default variants feature removed — require explicit variant in code
    return null;
  }

  /**
   * Set the default variant for an icon
   */
  setDefaultVariant(iconName: string, variantName: string | null): void {
    // Default variant assignment removed - no-op
    return;
  }

  /**
   * Save a new variant or update existing one
   */
  saveVariant(iconName: string, variantName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    if (!allVariants[iconName]) {
      allVariants[iconName] = {};
    }
    allVariants[iconName][variantName] = colors;
    this._updateVariantsCache(allVariants);
  }

  /**
   * Delete a variant by index
   */
  deleteVariant(iconName: string, index: number): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      // Get only visible variant names for index lookup
      const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
      if (visibleNames[index]) {
        delete allVariants[iconName][visibleNames[index]];
        // Check if only internal variants remain
        const remainingVisible = Object.keys(allVariants[iconName]).filter(n => !n.startsWith('_'));
        if (remainingVisible.length === 0) {
          // Keep internal variants like _original
          const internalVariants = Object.entries(allVariants[iconName]).filter(([n]) =>
            n.startsWith('_')
          );
          if (internalVariants.length === 0) {
            delete allVariants[iconName];
          }
        }
        this._updateVariantsCache(allVariants);
      }
    }
  }

  /**
   * Update a variant's name and colors by index
   */
  updateVariant(iconName: string, index: number, newName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      // Get only visible variant names for index lookup
      const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
      const oldName = visibleNames[index];
      if (oldName) {
        // Remove old, add new
        delete allVariants[iconName][oldName];
        allVariants[iconName][newName] = colors;
        this._updateVariantsCache(allVariants);
      }
    }
  }

  /**
   * Update only the colors of a variant by index
   */
  updateVariantColors(iconName: string, index: number, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      // Get only visible variant names for index lookup
      const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
      const variantName = visibleNames[index];
      if (variantName) {
        // Update colors keeping the same name
        allVariants[iconName][variantName] = colors;
        this._updateVariantsCache(allVariants);
      }
    }
  }

  /**
   * Ensure an icon has stored original colors and a "custom" variant
   * @returns The original colors (from provided currentColors, always fresh from SVG)
   */
  ensureCustomVariant(iconName: string, currentColors: string[]): string[] {
    const allVariants = this.getAllVariants(iconName);
    const hasCustom = allVariants.some(v => v.name === 'custom');

    console.log(`[VariantsService.ensureCustomVariant] Icon: ${iconName}`);
    console.log(`  Detected colors from SVG:`, currentColors);
    console.log(`  All variants:`, allVariants.map(v => v.name));

    // IMPORTANT: Always use colors extracted from current SVG, not saved variant
    // This ensures we're working with the actual file state, not outdated saved data
    let originalColors = currentColors;

    // If no colors detected from SVG, try to use saved _original as fallback
    if (currentColors.length === 0) {
      const savedOriginal = allVariants.find(v => v.name === '_original');
      if (savedOriginal) {
        originalColors = [...savedOriginal.colors];
        console.log(`  No colors detected from SVG, using saved _original:`, originalColors);
      }
    } else {
      // Update the saved _original with current SVG colors
      // This ensures the variant file stays in sync with actual SVG
      this.saveVariant(iconName, '_original', [...currentColors]);
      console.log(`  Updated _original variant with current SVG colors`);
    }

    if (!hasCustom && originalColors.length > 0) {
      // Create "custom" variant with the original colors
      console.log(`  Creating custom variant with colors:`, originalColors);
      this.saveVariant(iconName, 'custom', [...originalColors]);
    }

    console.log(`  Final originalColors returned:`, originalColors);
    return originalColors;
  }

  /**
   * Get all animation presets for an icon
   */
  getAnimationPresets(iconName: string): AnimationPreset[] {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return [];

      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\}\s*);/);
      if (!match) return [];

      const data = new Function(`return ${match[1]}`)() as VariantsData;
      return data.animations?.[iconName] ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get a specific animation preset by name
   */
  getAnimationPreset(iconName: string, presetName: string): AnimationPreset | undefined {
    const presets = this.getAnimationPresets(iconName);
    return presets.find(p => p.name === presetName);
  }

  /**
   * Save an animation preset for an icon
   */
  saveAnimationPreset(iconName: string, preset: AnimationPreset): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let content = '';
      const data: VariantsData = {
        variants: {},
        defaults: {},
        colorMappings: {},
        animations: {}
      };

      // Read existing data if file exists
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\}\s*);/);
        if (match) {
          Object.assign(data, new Function(`return ${match[1]}`)() as VariantsData);
        }
      }

      // Initialize animations object if needed
      if (!data.animations) {
        data.animations = {};
      }

      // Initialize icon animations array if needed
      if (!data.animations[iconName]) {
        data.animations[iconName] = [];
      }

      // Remove existing preset with same name
      data.animations[iconName] = data.animations[iconName].filter(p => p.name !== preset.name);

      // Add new preset
      data.animations[iconName].push(preset);

      // Write back to file
      const output = this._formatVariantsData(data);
      fs.writeFileSync(filePath, output, 'utf-8');

      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error saving animation preset:', error);
    }
  }

  /**
   * Delete an animation preset for an icon
   */
  deleteAnimationPreset(iconName: string, presetName: string): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\}\s*);/);
      if (!match) return;

      const data = new Function(`return ${match[1]}`)() as VariantsData;

      if (data.animations?.[iconName]) {
        data.animations[iconName] = data.animations[iconName].filter(
          p => p.name !== presetName
        );

        // Clean up empty arrays
        if (data.animations[iconName].length === 0) {
          delete data.animations[iconName];
        }
      }

      // Write back to file
      const output = this._formatVariantsData(data);
      fs.writeFileSync(filePath, output, 'utf-8');

      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error deleting animation preset:', error);
    }
  }

  /**
   * Format variants data for file output
   */
  private _formatVariantsData(data: VariantsData): string {
    const lines: string[] = [];
    lines.push('export const Variants = {');

    // Variants
    if (Object.keys(data.variants).length > 0) {
      lines.push('  variants: {');
      for (const [iconName, variants] of Object.entries(data.variants)) {
        lines.push(`    "${iconName}": {`);
        for (const [variantName, colors] of Object.entries(variants)) {
          const colorStr = colors.map(c => `"${c}"`).join(', ');
          lines.push(`      "${variantName}": [${colorStr}],`);
        }
        lines.push('    },');
      }
      lines.push('  },');
    }

    // Defaults
    if (Object.keys(data.defaults ?? {}).length > 0) {
      lines.push('  defaults: {');
      for (const [iconName, defaultVariant] of Object.entries(data.defaults ?? {})) {
        lines.push(`    "${iconName}": "${defaultVariant}",`);
      }
      lines.push('  },');
    }

    // Color mappings
    if (data.colorMappings && Object.keys(data.colorMappings).length > 0) {
      lines.push('  colorMappings: {');
      for (const [iconName, mapping] of Object.entries(data.colorMappings)) {
        lines.push(`    "${iconName}": {`);
        for (const [original, replacement] of Object.entries(mapping)) {
          lines.push(`      "${original}": "${replacement}",`);
        }
        lines.push('    },');
      }
      lines.push('  },');
    }

    // Animations
    if (data.animations && Object.keys(data.animations).length > 0) {
      lines.push('  animations: {');
      for (const [iconName, presets] of Object.entries(data.animations)) {
        lines.push(`    "${iconName}": [`);
        for (const preset of presets) {
          lines.push('      {');
          lines.push(`        name: "${preset.name}",`);
          lines.push(`        type: "${preset.type}",`);
          if (preset.duration !== undefined) lines.push(`        duration: ${preset.duration},`);
          if (preset.timing) lines.push(`        timing: "${preset.timing}",`);
          if (preset.iteration) lines.push(`        iteration: "${preset.iteration}",`);
          if (preset.delay !== undefined) lines.push(`        delay: ${preset.delay},`);
          if (preset.direction) lines.push(`        direction: "${preset.direction}",`);
          lines.push('      },');
        }
        lines.push('    ],');
      }
      lines.push('  },');
    }

    lines.push('};');
    return lines.join('\n');
  }
}

// Singleton instance for shared state across panels
let variantsServiceInstance: VariantsService | null = null;

export function getVariantsService(): VariantsService {
  if (!variantsServiceInstance) {
    variantsServiceInstance = new VariantsService();
  }
  return variantsServiceInstance;
}
