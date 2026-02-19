import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FrameworkType } from '../../utils/configHelper';

interface FrameworkSignature {
  framework: FrameworkType;
  configFiles: string[];
  dependencies: string[];
  priority: number;
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  { framework: 'angular', configFiles: ['angular.json'], dependencies: ['@angular/core'], priority: 100 },
  { framework: 'svelte',  configFiles: ['svelte.config.js', 'svelte.config.ts'], dependencies: ['svelte', '@sveltejs/kit'], priority: 90 },
  { framework: 'vue',     configFiles: ['vue.config.js', 'nuxt.config.ts'], dependencies: ['vue', 'nuxt'], priority: 80 },
  { framework: 'astro',   configFiles: ['astro.config.mjs'], dependencies: ['astro'], priority: 70 },
  { framework: 'solid',   configFiles: ['solid.config.js'], dependencies: ['solid-js'], priority: 60 },
  { framework: 'qwik',    configFiles: ['qwik.config.ts'], dependencies: ['@builder.io/qwik'], priority: 50 },
  { framework: 'lit',     configFiles: [], dependencies: ['lit'], priority: 45 },
  { framework: 'react',   configFiles: ['next.config.js', 'gatsby-config.js'], dependencies: ['react', 'next', 'react-dom'], priority: 40 },
];

export class FrameworkDetectorService {
  private static instance: FrameworkDetectorService;
  private cachedFramework: FrameworkType | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 30000;

  private constructor() {}

  public static getInstance(): FrameworkDetectorService {
    if (!FrameworkDetectorService.instance) {
      FrameworkDetectorService.instance = new FrameworkDetectorService();
    }
    return FrameworkDetectorService.instance;
  }

  /**
   * Detecta el framework priorizando la carpeta raíz seleccionada (útil para Monorepos)
   */
  public async detectFramework(target?: string | boolean): Promise<FrameworkType> {
    // backward-compatible signature: accept boolean as force flag
    let force = false;
    let rootPathOverride: string | undefined;
    if (typeof target === 'boolean') {
      force = !!target;
    } else {
      rootPathOverride = target as string | undefined;
    }

    if (!force && !rootPathOverride && this.cachedFramework && Date.now() - this.cacheTimestamp < this.CACHE_DURATION_MS) {
      return this.cachedFramework;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const rootPath = rootPathOverride || workspaceFolder?.uri.fsPath;

    if (!rootPath) return 'html';

    const sortedSignatures = [...FRAMEWORK_SIGNATURES].sort((a, b) => b.priority - a.priority);

    for (const signature of sortedSignatures) {
      if (await this.checkFrameworkSignature(rootPath, signature)) {
        this.cachedFramework = signature.framework;
        this.cacheTimestamp = Date.now();
        return signature.framework;
      }
    }

    return 'html';
  }

  // Borra la caché detectada
  public clearCache(): void {
    this.cachedFramework = null;
    this.cacheTimestamp = 0;
  }

  // Devuelve nombres legibles para UI
  public getFrameworkDisplayName(framework: FrameworkType): string {
    const map: Record<string, string> = {
      html: 'HTML',
      react: 'React',
      vue: 'Vue',
      angular: 'Angular',
      svelte: 'Svelte',
      solid: 'Solid',
      qwik: 'Qwik',
      astro: 'Astro',
      lit: 'Lit',
    };
    return map[framework] || framework;
  }

  // Lista de frameworks detectables (incluye html)
  public getDetectableFrameworks(): FrameworkType[] {
    return ['html', ...FRAMEWORK_SIGNATURES.map(s => s.framework)];
  }

  // Detect frontend root (simple heurística)
  public detectFrontendRoot(): string {
    const roots = this.getSuggestedFrontendRoots();
    return roots.length > 0 ? roots[0] : '';
  }

  public getSuggestedSourceDirs(frontendRoot?: string): string[] {
    return ['src/icons', 'src/assets', 'icons', 'assets'].map(p => (frontendRoot ? path.posix.join(frontendRoot, p) : p));
  }

  public getSuggestedOutputDirs(frontendRoot?: string): string[] {
    return ['public/icons', 'dist/icons', 'src/assets/icons'].map(p => (frontendRoot ? path.posix.join(frontendRoot, p) : p));
  }

  public getAutoDetectedOutputDir(): string | undefined {
    const candidate = this.getSuggestedOutputDirs()[0];
    return candidate;
  }

  private async checkFrameworkSignature(rootPath: string, signature: FrameworkSignature): Promise<boolean> {
    // 1. Verificación rápida por archivos de configuración
    for (const configFile of signature.configFiles) {
      if (fs.existsSync(path.join(rootPath, configFile))) return true;
    }

    // 2. Verificación por package.json
    const pkgPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        return signature.dependencies.some(dep => deps[dep]);
      } catch { return false; }
    }
    return false;
  }

  /**
   * Escanea el workspace buscando proyectos frontend (soporta Monorepos)
   */
  public getSuggestedFrontendRoots(): string[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    const rootPath = workspaceFolder.uri.fsPath;
    const roots: string[] = [];

    if (this.isCompleteFrontendProject(rootPath)) roots.push('.');

    // Escaneo de subdirectorios comunes (apps/, packages/, etc)
    const subdirs = ['apps', 'packages', 'client', 'frontend'];
    subdirs.forEach(dir => {
      const fullPath = path.join(rootPath, dir);
      try {
        const exists = fs.existsSync(fullPath);
        let isDir = false;
        if (exists) {
          if (typeof fs.lstatSync === 'function') {
            isDir = fs.lstatSync(fullPath).isDirectory();
          } else {
            // In test/mocked env lstatSync may be missing; assume true if exists
            isDir = true;
          }
        }

        if (exists && isDir) {
          const entries = typeof fs.readdirSync === 'function' ? fs.readdirSync(fullPath) : [];
          entries.forEach(sub => {
            const finalPath = path.join(fullPath, sub);
            if (this.isCompleteFrontendProject(finalPath)) {
              roots.push(path.join(dir, sub).replace(/\\/g, '/'));
            }
          });
        }
      } catch (e) {
        // ignore FS errors in test environments
      }
    });

    return roots;
  }

  private isCompleteFrontendProject(dirPath: string): boolean {
    const hasPkg = fs.existsSync(path.join(dirPath, 'package.json'));
    const hasSrc = fs.existsSync(path.join(dirPath, 'src')) || fs.existsSync(path.join(dirPath, 'app'));
    return hasPkg && hasSrc;
  }
}
