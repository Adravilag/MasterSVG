import * as fs from 'fs';
import { WorkspaceIcon, IconAnimation } from '../../types/icons';
import { SvgItem } from '../../providers/tree/SvgItem';
import { getAnimationService } from '../animation/AnimationAssignmentService';
import {
  SvgDataResult as CentralizedSvgDataResult,
  IconStorageMaps as CentralizedIconStorageMaps,
} from '../types/mastersvgTypes';

// Re-export centralized types for backwards compatibility
export type SvgDataResult = CentralizedSvgDataResult;
export type IconStorageMaps = CentralizedIconStorageMaps<WorkspaceIcon>

/**
 * Service for looking up icons from various sources
 */
export class IconLookupService {
  /**
   * Get an icon by name, checking all sources
   * Priority: library (built) > svg files > inline SVGs
   */
  static getIcon(name: string, storage: IconStorageMaps): WorkspaceIcon | undefined {
    // First check library (built icons), then svg files
    const found = storage.libraryIcons.get(name) || storage.svgFiles.get(name);

    // If found but no SVG content, try to load it from file
    if (found && !found.svg && found.path && fs.existsSync(found.path)) {
      try {
        found.svg = fs.readFileSync(found.path, 'utf-8');
      } catch (err) {
        console.error('[MasterSVG] Error reading SVG for hover:', found.path, err);
      }
    }

    if (found) return found;

    // Then check inline SVGs by name
    for (const icon of storage.inlineSvgs.values()) {
      if (icon.name === name || icon.name.toLowerCase() === name.toLowerCase()) {
        return icon;
      }
    }

    return undefined;
  }

  /**
   * Get icon by name from any source (library, SVG files, inline, or references)
   */
  static getIconByName(name: string, storage: IconStorageMaps): WorkspaceIcon | undefined {
    // Check library icons, SVG files, and inline SVGs first
    const found =
      storage.libraryIcons.get(name) || storage.svgFiles.get(name) || storage.inlineSvgs.get(name);
    if (found) return found;

    // Also check IMG references (svgReferences)
    for (const icons of storage.svgReferences.values()) {
      for (const icon of icons) {
        if (icon.name === name) {
          return icon;
        }
      }
    }
    return undefined;
  }

  /**
   * Find icon by file path
   */
  static getIconByPath(filePath: string, storage: IconStorageMaps): WorkspaceIcon | undefined {
    // Check SVG files
    for (const icon of storage.svgFiles.values()) {
      if (icon.path === filePath) {
        return icon;
      }
    }
    // Check inline SVGs by filePath
    for (const icon of storage.inlineSvgs.values()) {
      if (icon.filePath === filePath || icon.path === filePath) {
        return icon;
      }
    }
    // Check IMG references
    for (const icons of storage.svgReferences.values()) {
      for (const icon of icons) {
        if (icon.path === filePath || icon.filePath === filePath) {
          return icon;
        }
      }
    }
    return undefined;
  }

  /**
   * Get SVG data for preview panel
   */
  static getSvgData(item: SvgItem): SvgDataResult | undefined {
    if (!item.icon) return undefined;

    const icon = item.icon;

    // For built icons, check AnimationAssignmentService first for the most up-to-date animation
    let animation: IconAnimation | undefined = icon.animation;
    if (icon.isBuilt) {
      const animService = getAnimationService();
      const assigned = animService.getAnimation(icon.name);
      if (assigned?.type && assigned.type !== 'none') {
        animation = {
          type: assigned.type,
          duration: assigned.duration ?? 1,
          timing: assigned.timing ?? 'ease',
          iteration: assigned.iteration ?? 'infinite',
          delay: assigned.delay,
          direction: assigned.direction,
        };
      }
    }

    if (icon.svg) {
      return {
        name: icon.name,
        svg: icon.svg,
        location: icon.filePath && icon.line ? { file: icon.filePath, line: icon.line } : undefined,
        animation,
      };
    }

    // For file-based SVGs, read the file
    if (icon.path && fs.existsSync(icon.path)) {
      try {
        const svg = fs.readFileSync(icon.path, 'utf-8');
        return {
          name: icon.name,
          svg,
          location: { file: icon.path, line: 1 },
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Get all IMG references from the workspace
   */
  static getImgReferences(svgReferences: Map<string, WorkspaceIcon[]>): WorkspaceIcon[] {
    const refs: WorkspaceIcon[] = [];
    for (const icons of svgReferences.values()) {
      for (const icon of icons) {
        // Load SVG content if not already loaded
        if (!icon.svg && icon.path && icon.exists !== false && fs.existsSync(icon.path)) {
          try {
            icon.svg = fs.readFileSync(icon.path, 'utf-8');
          } catch (err) {
            console.error('[MasterSVG] Error reading SVG:', icon.path, err);
          }
        }
        refs.push(icon);
      }
    }
    return refs;
  }

  /**
   * Get all icons (workspace + library)
   */
  static getAllIcons(storage: Pick<IconStorageMaps, 'svgFiles' | 'libraryIcons'>): WorkspaceIcon[] {
    const all: WorkspaceIcon[] = [];

    // Add workspace icons
    for (const icon of storage.svgFiles.values()) {
      all.push(icon);
    }

    // Add library icons
    for (const icon of storage.libraryIcons.values()) {
      all.push(icon);
    }

    return all;
  }

  /**
   * Get list of built icons only
   */
  static getBuiltIconsList(libraryIcons: Map<string, WorkspaceIcon>): WorkspaceIcon[] {
    const builtIcons: WorkspaceIcon[] = [];
    for (const icon of libraryIcons.values()) {
      if (icon.isBuilt) {
        builtIcons.push(icon);
      }
    }
    return builtIcons;
  }

  /**
   * Get inline SVGs as array
   */
  static getInlineSvgs(inlineSvgs: Map<string, WorkspaceIcon>): WorkspaceIcon[] {
    return Array.from(inlineSvgs.values());
  }

  /**
   * Get inline SVG by key
   */
  static getInlineSvgByKey(
    key: string,
    inlineSvgs: Map<string, WorkspaceIcon>
  ): WorkspaceIcon | undefined {
    return inlineSvgs.get(key);
  }
}
