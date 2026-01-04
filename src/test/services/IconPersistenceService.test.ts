/**
 * Tests for IconPersistenceService
 *
 * Tests icon persistence functionality including sprite file updates,
 * icons.js updates, and TypeScript definition regeneration.
 */

// Mock fs module - factory function must not reference external variables
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock path module with real implementations
jest.mock('node:path', () => ({
  join: (...paths: string[]) => paths.join('/'),
  dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
}));

// Mock vscode - must be before imports
jest.mock('vscode', () => {
  const mockWorkspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    const mockConfig = {
    get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'outputDirectory') return 'sagebox-icons';
      return defaultValue;
    }),
  };
  return {
    workspace: {
      workspaceFolders: mockWorkspaceFolders,
      getConfiguration: jest.fn().mockReturnValue(mockConfig),
      openTextDocument: jest.fn(),
      applyEdit: jest.fn().mockResolvedValue(true),
      fs: {
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    },
    window: {
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
    },
    Uri: {
      file: jest.fn().mockImplementation((path: string) => ({ fsPath: path })),
      joinPath: jest.fn().mockImplementation((base: { fsPath: string }, ...paths: string[]) => ({
        fsPath: `${base.fsPath}/${paths.join('/')}`,
      })),
    },
    WorkspaceEdit: jest.fn().mockImplementation(() => ({
      replace: jest.fn(),
    })),
    Range: jest.fn().mockImplementation((start: unknown, end: unknown) => ({ start, end })),
    Position: jest.fn().mockImplementation((line: number, character: number) => ({ line, character })),
    EventEmitter: jest.fn().mockImplementation(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn(),
    })),
    env: {
      language: 'en',
    },
  };
});

import * as fs from 'node:fs';
import { IconPersistenceService, getIconPersistenceService } from '../../services/IconPersistenceService';

// Get mocked fs for type-safe access
const mockFs = fs as jest.Mocked<typeof fs>;

describe('IconPersistenceService', () => {
  let service: IconPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton for each test
    (IconPersistenceService as any)._instance = undefined;
    service = getIconPersistenceService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = IconPersistenceService.getInstance();
      const instance2 = IconPersistenceService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getIconPersistenceService', () => {
    it('should return the singleton instance', () => {
      const instance = getIconPersistenceService();
      expect(instance).toBe(service);
    });
  });

  describe('getOutputPath', () => {
    it('should return output path when workspace and config exist', () => {
      const result = service.getOutputPath();
      expect(result).toBe('/workspace/sagebox-icons');
    });

    it('should return undefined when no workspace folders', () => {
      const vscode = require('vscode');
      const originalFolders = vscode.workspace.workspaceFolders;
      vscode.workspace.workspaceFolders = undefined;
      const result = service.getOutputPath();
      expect(result).toBeUndefined();
      vscode.workspace.workspaceFolders = originalFolders;
    });
  });

  describe('getIconsFilePath', () => {
    it('should return icons.js path when output path exists', () => {
      const result = service.getIconsFilePath();
      expect(result).toBe('/workspace/sagebox-icons/icons.js');
    });
  });

  describe('updateSpriteFile', () => {
    const spriteContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="arrow" viewBox="0 0 24 24">
    <path d="M10 20l-5-5"/>
  </symbol>
</svg>`;

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(spriteContent);
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it('should return false when iconName is empty', async () => {
      const result = await service.updateSpriteFile('', '<svg/>', '/path/sprite.svg');
      expect(result).toBe(false);
    });

    it('should return false when spriteFile is empty', async () => {
      const result = await service.updateSpriteFile('icon', '<svg/>', '');
      expect(result).toBe(false);
    });

    it('should return false when sprite file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await service.updateSpriteFile('arrow', '<svg/>', '/path/sprite.svg');
      expect(result).toBe(false);
    });

    it('should update existing symbol in sprite', async () => {
      const newSvg = '<svg viewBox="0 0 24 24"><path d="M12 12"/></svg>';
      const result = await service.updateSpriteFile('arrow', newSvg, '/path/sprite.svg');

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = mockFs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('<symbol');
      expect(writtenContent).toContain('id="arrow"');
    });

    it('should return false when symbol not found', async () => {
      const result = await service.updateSpriteFile('nonexistent', '<svg/>', '/path/sprite.svg');
      expect(result).toBe(false);
    });

    it('should extract viewBox from new SVG', async () => {
      const newSvg = '<svg viewBox="0 0 32 32"><circle r="10"/></svg>';
      await service.updateSpriteFile('arrow', newSvg, '/path/sprite.svg');

      const writtenContent = mockFs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('viewBox="0 0 32 32"');
    });
  });

  describe('ensureSvgId', () => {
    it('should return unchanged SVG if already has id', () => {
      const svg = '<svg id="existing-id"><path/></svg>';
      const result = service.ensureSvgId(svg, 'new-icon');
      expect(result).toBe(svg);
    });

    it('should add id to SVG if missing', () => {
      const svg = '<svg viewBox="0 0 24 24"><path/></svg>';
      const result = service.ensureSvgId(svg, 'my-icon');
      expect(result).toContain('id="bz-my-icon"');
    });

    it('should sanitize icon name for id', () => {
      const svg = '<svg><path/></svg>';
      const result = service.ensureSvgId(svg, 'icon@special#name');
      expect(result).toContain('id="bz-icon-special-name"');
    });
  });

  describe('regenerateTypesFromSprite', () => {
    it('should extract icon names from sprite symbols', async () => {
      const spriteContent = `
        <svg>
          <symbol id="home"></symbol>
          <symbol id="arrow-left"></symbol>
          <symbol id="close"></symbol>
        </svg>
      `;

      const vscode = require('vscode');
      await service.regenerateTypesFromSprite('/output/sprite.svg', spriteContent);

      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should not write types file if no symbols found', async () => {
      const spriteContent = '<svg></svg>';
      const vscode = require('vscode');

      await service.regenerateTypesFromSprite('/output/sprite.svg', spriteContent);

      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('regenerateTypesFromIconsFile', () => {
    it('should extract icon names from exports', async () => {
      const iconsContent = `
        export const homeIcon = { name: 'home-icon' };
        export const arrowLeft = { name: 'arrow-left' };
        export const closeBtn = { name: 'close-btn' };
      `;

      const vscode = require('vscode');
      await service.regenerateTypesFromIconsFile('/output/icons.js', iconsContent);

      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should convert camelCase to kebab-case for type names', async () => {
      const iconsContent = 'export const myIconName = {};';

      const vscode = require('vscode');
      const encoder = new TextEncoder();
      await service.regenerateTypesFromIconsFile('/output/icons.js', iconsContent);

      const writeCall = vscode.workspace.fs.writeFile.mock.calls[0];
      const writtenContent = new TextDecoder().decode(writeCall[1]);
      expect(writtenContent).toContain("'my-icon-name'");
    });

    it('should not write types file if no exports found', async () => {
      const iconsContent = '// Empty file';
      const vscode = require('vscode');

      await service.regenerateTypesFromIconsFile('/output/icons.js', iconsContent);

      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('writeTypesFile', () => {
    it('should write sorted icon names', async () => {
      const vscode = require('vscode');
      await service.writeTypesFile('/output', ['zebra', 'apple', 'mango']);

      const writeCall = vscode.workspace.fs.writeFile.mock.calls[0];
      const writtenContent = new TextDecoder().decode(writeCall[1]);

      // Should be sorted alphabetically
      expect(writtenContent.indexOf("'apple'")).toBeLessThan(writtenContent.indexOf("'mango'"));
      expect(writtenContent.indexOf("'mango'")).toBeLessThan(writtenContent.indexOf("'zebra'"));
    });

    it('should include type definition exports', async () => {
      const vscode = require('vscode');
      await service.writeTypesFile('/output', ['icon1', 'icon2']);

      const writeCall = vscode.workspace.fs.writeFile.mock.calls[0];
      const writtenContent = new TextDecoder().decode(writeCall[1]);

      expect(writtenContent).toContain('export type IconName =');
      expect(writtenContent).toContain('export const iconNames =');
      expect(writtenContent).toContain('export function isValidIconName');
    });

    it('should write to icons.d.ts in specified directory', async () => {
      const vscode = require('vscode');
      await service.writeTypesFile('/custom/path', ['icon']);

      const writeCall = vscode.workspace.fs.writeFile.mock.calls[0];
      expect(writeCall[0].fsPath).toBe('/custom/path/icons.d.ts');
    });
  });
});
