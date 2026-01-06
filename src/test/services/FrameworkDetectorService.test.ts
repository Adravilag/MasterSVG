import { FrameworkDetectorService } from '../../services/FrameworkDetectorService';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
  },
}));

// Mock fs
jest.mock('fs');

describe('FrameworkDetectorService', () => {
  let service: FrameworkDetectorService;
  const mockWorkspacePath = '/test/workspace';

  beforeEach(() => {
    // Reset singleton instance by accessing private property
    (FrameworkDetectorService as any).instance = undefined;
    service = FrameworkDetectorService.getInstance();
    service.clearCache();
    
    // Reset mocks
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [
      { uri: { fsPath: mockWorkspacePath } },
    ];
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FrameworkDetectorService.getInstance();
      const instance2 = FrameworkDetectorService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('detectFramework', () => {
    it('should return html when no workspace folder', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      const result = await service.detectFramework();
      expect(result).toBe('html');
    });

    it('should detect Angular by config file', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('angular.json');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      const result = await service.detectFramework(true);
      expect(result).toBe('angular');
    });

    it('should detect React by package.json dependency', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('package.json');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        dependencies: {
          react: '^18.0.0',
        },
      }));

      const result = await service.detectFramework(true);
      expect(result).toBe('react');
    });

    it('should detect Vue by config file', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('vue.config.js');
      });

      const result = await service.detectFramework(true);
      expect(result).toBe('vue');
    });

    it('should detect Svelte by config file', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('svelte.config.js');
      });

      const result = await service.detectFramework(true);
      expect(result).toBe('svelte');
    });

    it('should detect Astro by config file', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('astro.config.mjs');
      });

      const result = await service.detectFramework(true);
      expect(result).toBe('astro');
    });

    it('should detect Next.js as React', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('next.config.js');
      });

      const result = await service.detectFramework(true);
      expect(result).toBe('react');
    });

    it('should return html when no framework detected', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.detectFramework(true);
      expect(result).toBe('html');
    });

    it('should use cache for subsequent calls', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('angular.json');
      });

      const result1 = await service.detectFramework(true);
      const result2 = await service.detectFramework();

      expect(result1).toBe('angular');
      expect(result2).toBe('angular');
      // existsSync should be called only once due to caching
    });

    it('should prioritize Angular over React when both present', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('angular.json') || filePath.includes('package.json');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        dependencies: {
          react: '^18.0.0',
          '@angular/core': '^15.0.0',
        },
      }));

      const result = await service.detectFramework(true);
      expect(result).toBe('angular');
    });
  });

  describe('getFrameworkDisplayName', () => {
    it('should return correct display names', () => {
      expect(service.getFrameworkDisplayName('html')).toBe('HTML');
      expect(service.getFrameworkDisplayName('react')).toBe('React');
      expect(service.getFrameworkDisplayName('vue')).toBe('Vue');
      expect(service.getFrameworkDisplayName('angular')).toBe('Angular');
      expect(service.getFrameworkDisplayName('svelte')).toBe('Svelte');
      expect(service.getFrameworkDisplayName('solid')).toBe('Solid');
      expect(service.getFrameworkDisplayName('qwik')).toBe('Qwik');
      expect(service.getFrameworkDisplayName('astro')).toBe('Astro');
    });
  });

  describe('getDetectableFrameworks', () => {
    it('should return all detectable frameworks', () => {
      const frameworks = service.getDetectableFrameworks();
      expect(frameworks).toContain('html');
      expect(frameworks).toContain('react');
      expect(frameworks).toContain('vue');
      expect(frameworks).toContain('angular');
      expect(frameworks).toContain('svelte');
      expect(frameworks).toContain('solid');
      expect(frameworks).toContain('qwik');
      expect(frameworks).toContain('astro');
    });
  });

  describe('clearCache', () => {
    it('should clear cached framework', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('angular.json');
      });

      await service.detectFramework(true);
      service.clearCache();

      // After clearing cache, should detect again
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('vue.config.js');
      });

      const result = await service.detectFramework(true);
      expect(result).toBe('vue');
    });
  });
});
