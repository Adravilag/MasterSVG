import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  getConfig,
  getOutputDirectory,
  getFullOutputPath,
  isOutputConfigured,
  ensureOutputDirectory,
  setOutputDirectory,
  getIconSnippet,
  getWorkspaceFolderOrWarn,
  checkConfigOrWarn,
  getOutputPathOrWarn,
  IconManagerConfig
} from '../../utils/configHelper';

// Mock modules
jest.mock('fs');
jest.mock('vscode');

const mockVscode = vscode as jest.Mocked<typeof vscode>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('configHelper', () => {
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          outputDirectory: 'icons',
          componentName: 'Icon',
          nameAttribute: 'name',
          defaultSize: 24,
          defaultColor: 'currentColor'
        };
        return values[key] ?? defaultValue;
      }),
      update: jest.fn().mockResolvedValue(undefined)
    };

    (mockVscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
    (mockVscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: '/workspace' } }
    ];
    (mockVscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getConfig', () => {
    it('should return full configuration object', () => {
      const config = getConfig();

      expect(config.outputDirectory).toBe('icons');
      expect(config.componentName).toBe('Icon');
      expect(config.nameAttribute).toBe('name');
      expect(config.defaultSize).toBe(24);
      expect(config.defaultColor).toBe('currentColor');
    });

    it('should use default values when config is empty', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => defaultValue);

      const config = getConfig();

      expect(config.outputDirectory).toBe('bezier-svg');
      expect(config.componentName).toBe('Icon');
      expect(config.nameAttribute).toBe('name');
      expect(config.defaultSize).toBe(24);
      expect(config.defaultColor).toBe('currentColor');
    });
  });

  describe('getOutputDirectory', () => {
    it('should return configured output directory', () => {
      const result = getOutputDirectory();
      expect(result).toBe('icons');
    });

    it('should return empty string when not configured', () => {
      mockConfig.get.mockReturnValue('');
      const result = getOutputDirectory();
      expect(result).toBe('');
    });
  });

  describe('getFullOutputPath', () => {
    it('should return full path when workspace and output dir exist', () => {
      const result = getFullOutputPath();
      expect(result).toBe(path.join('/workspace', 'icons'));
    });

    it('should return undefined when no workspace folder', () => {
      (mockVscode.workspace as any).workspaceFolders = undefined;
      const result = getFullOutputPath();
      expect(result).toBeUndefined();
    });

    it('should return undefined when output directory not configured', () => {
      mockConfig.get.mockReturnValue('');
      const result = getFullOutputPath();
      expect(result).toBeUndefined();
    });
  });

  describe('isOutputConfigured', () => {
    it('should return true when output directory is set', () => {
      expect(isOutputConfigured()).toBe(true);
    });

    it('should return false when output directory is empty', () => {
      mockConfig.get.mockReturnValue('');
      expect(isOutputConfigured()).toBe(false);
    });
  });

  describe('ensureOutputDirectory', () => {
    it('should create directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);

      const result = ensureOutputDirectory();

      expect(result).toBe(path.join('/workspace', 'icons'));
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join('/workspace', 'icons'),
        { recursive: true }
      );
    });

    it('should not create directory if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = ensureOutputDirectory();

      expect(result).toBe(path.join('/workspace', 'icons'));
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should return undefined when not configured', () => {
      mockConfig.get.mockReturnValue('');

      const result = ensureOutputDirectory();

      expect(result).toBeUndefined();
    });
  });

  describe('setOutputDirectory', () => {
    it('should update configuration', async () => {
      await setOutputDirectory('new-icons');

      expect(mockConfig.update).toHaveBeenCalledWith(
        'outputDirectory',
        'new-icons',
        vscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe('getIconSnippet', () => {
    it('should generate correct icon snippet', () => {
      const snippet = getIconSnippet('home');
      expect(snippet).toBe('<Icon name="home" />');
    });

    it('should use configured component name and attribute', () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'componentName') return 'MyIcon';
        if (key === 'nameAttribute') return 'icon';
        return '';
      });

      const snippet = getIconSnippet('arrow');
      expect(snippet).toBe('<MyIcon icon="arrow" />');
    });
  });

  describe('getWorkspaceFolderOrWarn', () => {
    it('should return workspace folder when available', () => {
      const result = getWorkspaceFolderOrWarn();
      expect(result).toEqual({ uri: { fsPath: '/workspace' } });
    });

    it('should show warning and return undefined when no workspace', () => {
      (mockVscode.workspace as any).workspaceFolders = undefined;

      const result = getWorkspaceFolderOrWarn();

      expect(result).toBeUndefined();
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith('No workspace folder open');
    });
  });

  describe('checkConfigOrWarn', () => {
    it('should return true when configured', () => {
      const result = checkConfigOrWarn();
      expect(result).toBe(true);
    });

    it('should show warning and return false when not configured', () => {
      mockConfig.get.mockReturnValue('');

      const result = checkConfigOrWarn();

      expect(result).toBe(false);
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith('Configure output directory first');
    });
  });

  describe('getOutputPathOrWarn', () => {
    it('should return full path when all configured', () => {
      const result = getOutputPathOrWarn();
      expect(result).toBe(path.join('/workspace', 'icons'));
    });

    it('should show warning and return undefined when not configured', () => {
      mockConfig.get.mockReturnValue('');

      const result = getOutputPathOrWarn();

      expect(result).toBeUndefined();
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should show warning and return undefined when no workspace', () => {
      (mockVscode.workspace as any).workspaceFolders = undefined;

      const result = getOutputPathOrWarn();

      expect(result).toBeUndefined();
    });
  });

  describe('IconManagerConfig interface', () => {
    it('should have correct structure', () => {
      const config: IconManagerConfig = {
        outputDirectory: 'icons',
        componentName: 'Icon',
        nameAttribute: 'name',
        defaultSize: 24,
        defaultColor: 'currentColor',
        webComponentName: 'bezier-icon',
        buildFormat: 'icons.ts'
      };

      expect(config.outputDirectory).toBe('icons');
      expect(config.componentName).toBe('Icon');
      expect(config.nameAttribute).toBe('name');
      expect(config.defaultSize).toBe(24);
      expect(config.defaultColor).toBe('currentColor');
      expect(config.buildFormat).toBe('icons.ts');
    });
  });
});
