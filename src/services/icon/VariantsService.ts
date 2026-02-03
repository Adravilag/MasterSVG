import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSvgConfig } from '../../utils/config';
import {
  readVariantsFile,
  parseVariants,
  parseColorMappings,
  parseVariantsData,
} from '../helpers/VariantsFileReader';
import {
  generateVariantsFileContent,
  formatVariantsData,
  writeFile,
} from '../helpers/VariantsFileWriter';
import type {
  ColorVariant,
  ColorMappingRecord,
  AnimationPresetConfig,
  VariantsDataFile,
} from '../types';

// Re-export for backwards compatibility
export type Variant = ColorVariant;
export type ColorMapping = ColorMappingRecord;
export type AnimationPreset = AnimationPresetConfig;
export type VariantsData = VariantsDataFile;

/**
 * Service for managing icon color variants
 * Handles caching, persistence, and CRUD operations for variants
 */
export class VariantsService {
  private _variantsCache: Record<string, Record<string, string[]>> | null = null;
  private _defaultsCache: Record<string, string> | null = null;
  private _colorMappingsCache: Record<string, ColorMappingRecord> | null = null;
  private _hasUnsavedChanges: boolean = false;

  get hasUnsavedChanges(): boolean {
    return this._hasUnsavedChanges;
  }

  resetCache(): void {
    this._variantsCache = null;
    this._defaultsCache = null;
    this._colorMappingsCache = null;
    this._hasUnsavedChanges = false;
  }

  // =====================
  // File Path
  // =====================

  private _getVariantsFilePath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', 'icons');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !outputDir) return undefined;
    return path.join(workspaceFolders[0].uri.fsPath, outputDir, 'svg-variants.js');
  }

  private _getFileContent(): string | null {
    return readVariantsFile(this._getVariantsFilePath());
  }

  // =====================
  // Variants CRUD
  // =====================

  private _readVariantsFromFile(): Record<string, Record<string, string[]>> {
    if (this._variantsCache !== null) return { ...this._variantsCache };

    this._variantsCache = parseVariants(this._getFileContent());
    return { ...this._variantsCache };
  }

  private _updateVariantsCache(allVariants: Record<string, Record<string, string[]>>): void {
    this._variantsCache = allVariants;
    this._hasUnsavedChanges = true;
  }

  getAllVariants(iconName: string): Variant[] {
    const iconVariants = this._readVariantsFromFile()[iconName] || {};
    return Object.entries(iconVariants).map(([name, colors]) => ({ name, colors }));
  }

  getSavedVariants(iconName: string): Variant[] {
    const iconVariants = this._readVariantsFromFile()[iconName] || {};
    return Object.entries(iconVariants)
      .filter(([name]) => !name.startsWith('_'))
      .map(([name, colors]) => ({ name, colors }));
  }

  saveVariant(iconName: string, variantName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    if (!allVariants[iconName]) allVariants[iconName] = {};
    allVariants[iconName][variantName] = colors;
    this._updateVariantsCache(allVariants);
  }

  deleteVariant(iconName: string, index: number): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (!iconVariants) return;

    const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
    if (!visibleNames[index]) return;

    delete allVariants[iconName][visibleNames[index]];

    const remainingVisible = Object.keys(allVariants[iconName]).filter(n => !n.startsWith('_'));
    if (remainingVisible.length === 0) {
      const hasInternal = Object.keys(allVariants[iconName]).some(n => n.startsWith('_'));
      if (!hasInternal) delete allVariants[iconName];
    }

    this._updateVariantsCache(allVariants);
  }

  updateVariant(iconName: string, index: number, newName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (!iconVariants) return;

    const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
    const oldName = visibleNames[index];
    if (!oldName) return;

    delete allVariants[iconName][oldName];
    allVariants[iconName][newName] = colors;
    this._updateVariantsCache(allVariants);
  }

  updateVariantColors(iconName: string, index: number, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (!iconVariants) return;

    const visibleNames = Object.keys(iconVariants).filter(n => !n.startsWith('_'));
    const variantName = visibleNames[index];
    if (!variantName) return;

    allVariants[iconName][variantName] = colors;
    this._updateVariantsCache(allVariants);
  }

  // =====================
  // Default Variants (deprecated)
  // =====================

  private _readDefaultVariants(): Record<string, string> {
    this._defaultsCache = {};
    return {};
  }

  getDefaultVariant(_iconName: string): string | null {
    return null;
  }

  setDefaultVariant(_iconName: string, _variantName: string | null): void {
    // No-op: default variant feature removed
  }

  // =====================
  // Color Mappings
  // =====================

  private _readColorMappings(): Record<string, ColorMapping> {
    if (this._colorMappingsCache !== null) return { ...this._colorMappingsCache };

    try {
      this._colorMappingsCache = parseColorMappings(this._getFileContent());
    } catch (err) {
      console.error('[VariantsService._readColorMappings] Error:', err);
      this._colorMappingsCache = {};
    }
    return { ...this._colorMappingsCache };
  }

  getColorMappings(iconName: string): ColorMapping {
    return this._readColorMappings()[iconName] || {};
  }

  setColorMapping(iconName: string, originalColor: string, newColor: string): void {
    const allMappings = this._readColorMappings();
    if (!allMappings[iconName]) allMappings[iconName] = {};

    const normOrig = originalColor.toLowerCase();
    const normNew = newColor.toLowerCase();

    if (normOrig === normNew) {
      delete allMappings[iconName][normOrig];
      if (Object.keys(allMappings[iconName]).length === 0) delete allMappings[iconName];
    } else {
      allMappings[iconName][normOrig] = normNew;
    }

    this._colorMappingsCache = allMappings;
    this._hasUnsavedChanges = true;
  }

  clearColorMappings(iconName: string): void {
    const allMappings = this._readColorMappings();
    delete allMappings[iconName];
    this._colorMappingsCache = allMappings;
    this._hasUnsavedChanges = true;
  }

  // =====================
  // Icon Data Management
  // =====================

  removeIconData(iconName: string): void {
    const allVariants = this._readVariantsFromFile();
    delete allVariants[iconName];
    this._variantsCache = allVariants;

    const allMappings = this._readColorMappings();
    delete allMappings[iconName];
    this._colorMappingsCache = allMappings;

    const defaults = this._readDefaultVariants();
    delete defaults[iconName];
    this._defaultsCache = defaults;

    this._hasUnsavedChanges = true;
  }

  ensureCustomVariant(iconName: string, currentColors: string[]): string[] {
    const allVariants = this.getAllVariants(iconName);
    const hasCustom = allVariants.some(v => v.name === 'custom');

    let originalColors = currentColors;

    if (currentColors.length === 0) {
      const savedOriginal = allVariants.find(v => v.name === '_original');
      if (savedOriginal) originalColors = [...savedOriginal.colors];
    } else {
      this.saveVariant(iconName, '_original', [...currentColors]);
    }

    if (!hasCustom && originalColors.length > 0) {
      this.saveVariant(iconName, 'custom', [...originalColors]);
    }

    return originalColors;
  }

  // =====================
  // Persistence
  // =====================

  persistToFile(): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      const allVariants = this._variantsCache || this._readVariantsFromFile();
      const colorMappings = this._colorMappingsCache || this._readColorMappings();
      const content = generateVariantsFileContent(allVariants, colorMappings);

      writeFile(filePath, content);
      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error writing Variants:', error);
    }
  }

  // =====================
  // Animation Presets
  // =====================

  getAnimationPresets(iconName: string): AnimationPreset[] {
    try {
      const data = parseVariantsData(this._getFileContent());
      return (data?.animations?.[iconName] as AnimationPreset[]) ?? [];
    } catch {
      return [];
    }
  }

  getAnimationPreset(iconName: string, presetName: string): AnimationPreset | undefined {
    return this.getAnimationPresets(iconName).find(p => p.name === presetName);
  }

  saveAnimationPreset(iconName: string, preset: AnimationPreset): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      const data: VariantsDataFile = this._loadOrCreateVariantsData();

      if (!data.animations) data.animations = {};
      if (!data.animations[iconName]) data.animations[iconName] = [];

      data.animations[iconName] = (data.animations[iconName] as AnimationPreset[])
        .filter(p => p.name !== preset.name);
      (data.animations[iconName] as AnimationPreset[]).push(preset);

      writeFile(filePath, formatVariantsData(data));
      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error saving animation preset:', error);
    }
  }

  deleteAnimationPreset(iconName: string, presetName: string): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return;

      const parsed = parseVariantsData(this._getFileContent());
      if (!parsed?.animations?.[iconName]) return;

      const animations = (parsed.animations || {}) as Record<string, AnimationPreset[]>;
      const data: VariantsDataFile = {
        variants: parsed.variants || {},
        defaults: parsed.defaults || {},
        colorMappings: parsed.colorMappings || {},
        animations,
      };

      animations[iconName] = animations[iconName].filter(p => p.name !== presetName);

      if (animations[iconName].length === 0) {
        delete animations[iconName];
      }

      writeFile(filePath, formatVariantsData(data));
      this._hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error deleting animation preset:', error);
    }
  }

  private _loadOrCreateVariantsData(): VariantsDataFile {
    const filePath = this._getVariantsFilePath();
    const data: VariantsDataFile = {
      variants: {},
      defaults: {},
      colorMappings: {},
      animations: {},
    };

    if (filePath && fs.existsSync(filePath)) {
      const parsed = parseVariantsData(this._getFileContent());
      if (parsed) Object.assign(data, parsed);
    }

    return data;
  }
}

// Singleton
let variantsServiceInstance: VariantsService | null = null;

export function getVariantsService(): VariantsService {
  if (!variantsServiceInstance) {
    variantsServiceInstance = new VariantsService();
  }
  return variantsServiceInstance;
}
