import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FrameworkType } from '../../utils/configHelper';

interface FrameworkSignature {
  framework: FrameworkType;
  /** Files that indicate this framework */
  configFiles: string[];
  /** Package.json dependencies that indicate this framework */
  dependencies: string[];
  /** Priority (higher = checked first) */
  priority: number;
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  {
    framework: 'angular',
    configFiles: ['angular.json', '.angular.json', 'angular-cli.json'],
    dependencies: ['@angular/core'],
    priority: 100,
  },
  {
    framework: 'svelte',
    configFiles: ['svelte.config.js', 'svelte.config.ts', 'svelte.config.mjs'],
    dependencies: ['svelte', '@sveltejs/kit'],
    priority: 90,
  },
  {
    framework: 'vue',
    configFiles: ['vue.config.js', 'vue.config.ts', 'nuxt.config.js', 'nuxt.config.ts'],
    dependencies: ['vue', 'nuxt', '@nuxt/kit'],
    priority: 80,
  },
  {
    framework: 'astro',
    configFiles: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'],
    dependencies: ['astro'],
    priority: 70,
  },
  {
    framework: 'solid',
    configFiles: ['solid.config.js', 'solid.config.ts'],
    dependencies: ['solid-js'],
    priority: 60,
  },
  {
    framework: 'qwik',
    configFiles: ['qwik.config.ts', 'qwik.config.js'],
    dependencies: ['@builder.io/qwik'],
    priority: 50,
  },
  {
    framework: 'react',
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts', 'gatsby-config.js'],
    dependencies: ['react', 'next', 'gatsby', 'react-dom'],
    priority: 40,
  },
];

/**
 * Service for detecting the framework used in the current workspace
 */
export class FrameworkDetectorService {
  private static instance: FrameworkDetectorService;
  private cachedFramework: FrameworkType | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 30000; // 30 seconds

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): FrameworkDetectorService {
    if (!FrameworkDetectorService.instance) {
      FrameworkDetectorService.instance = new FrameworkDetectorService();
    }
    return FrameworkDetectorService.instance;
  }

  /**
   * Detect the framework used in the current workspace
   * @param forceRefresh Force a new detection, ignoring cache
   * @returns The detected framework or 'html' as default
   */
  public async detectFramework(forceRefresh: boolean = false): Promise<FrameworkType> {
    // Check cache first
    if (!forceRefresh && this.cachedFramework && Date.now() - this.cacheTimestamp < this.CACHE_DURATION_MS) {
      return this.cachedFramework;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 'html';
    }

    const rootPath = workspaceFolder.uri.fsPath;

    // Sort by priority (higher first)
    const sortedSignatures = [...FRAMEWORK_SIGNATURES].sort((a, b) => b.priority - a.priority);

    for (const signature of sortedSignatures) {
      const detected = await this.checkFrameworkSignature(rootPath, signature);
      if (detected) {
        this.cachedFramework = signature.framework;
        this.cacheTimestamp = Date.now();
        return signature.framework;
      }
    }

    // Default to HTML
    this.cachedFramework = 'html';
    this.cacheTimestamp = Date.now();
    return 'html';
  }

  /**
   * Check if a framework signature matches the workspace
   */
  private async checkFrameworkSignature(rootPath: string, signature: FrameworkSignature): Promise<boolean> {
    // Check config files first (most reliable)
    for (const configFile of signature.configFiles) {
      const configPath = path.join(rootPath, configFile);
      if (fs.existsSync(configPath)) {
        return true;
      }
    }

    // Check package.json dependencies
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
        };

        for (const dep of signature.dependencies) {
          if (allDeps[dep]) {
            return true;
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    return false;
  }

  /**
   * Clear the cached framework detection
   */
  public clearCache(): void {
    this.cachedFramework = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get framework display name
   */
  public getFrameworkDisplayName(framework: FrameworkType): string {
    const names: Record<FrameworkType, string> = {
      html: 'HTML',
      react: 'React',
      vue: 'Vue',
      angular: 'Angular',
      svelte: 'Svelte',
      solid: 'Solid',
      qwik: 'Qwik',
      astro: 'Astro',
    };
    return names[framework] || 'HTML';
  }

  /**
   * Get all detectable frameworks
   */
  public getDetectableFrameworks(): FrameworkType[] {
    return ['html', 'react', 'vue', 'angular', 'svelte', 'solid', 'qwik', 'astro'];
  }

  /**
   * Common frontend subdirectory names to check
   */
  private static readonly FRONTEND_DIRS = [
    'frontend',
    'client',
    'web',
    'app',
    'ui',
    'packages/frontend',
    'packages/client',
    'packages/web',
    'apps/frontend',
    'apps/client',
    'apps/web',
  ];

  /**
   * Detect the frontend root directory within the workspace.
   * Checks for common frontend subdirectory patterns that contain package.json
   * with frontend framework dependencies.
   * @returns The relative path to frontend root, or empty string if at workspace root
   */
  public detectFrontendRoot(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.log('[MasterSVG] detectFrontendRoot: No workspace folder');
      return '';
    }

    const rootPath = workspaceFolder.uri.fsPath;
    console.log('[MasterSVG] detectFrontendRoot: rootPath =', rootPath);

    // Check if the root itself is a complete frontend project
    // (has package.json with frontend deps AND has src/ or common entry files)
    const isRootComplete = this.isCompleteFrontendProject(rootPath);
    console.log('[MasterSVG] detectFrontendRoot: isCompleteFrontendProject(root) =', isRootComplete);
    if (isRootComplete) {
      return '';
    }

    // Check common frontend subdirectories first
    for (const dir of FrameworkDetectorService.FRONTEND_DIRS) {
      const fullPath = path.join(rootPath, dir);
      if (fs.existsSync(fullPath) && this.hasFrontendPackageJson(fullPath)) {
        console.log('[MasterSVG] detectFrontendRoot: Found common frontend dir =', dir);
        return dir;
      }
    }

    // Scan first-level subdirectories for any frontend project
    const frontendSubdir = this.scanForFrontendSubdirectory(rootPath);
    console.log('[MasterSVG] detectFrontendRoot: scanForFrontendSubdirectory =', frontendSubdir);
    if (frontendSubdir) {
      return frontendSubdir;
    }

    console.log('[MasterSVG] detectFrontendRoot: No frontend root detected');
    return '';
  }

  /**
   * Check if a directory is a complete frontend project
   * (has package.json with frontend deps AND has src/ or common entry files)
   */
  private isCompleteFrontendProject(dirPath: string): boolean {
    if (!this.hasFrontendPackageJson(dirPath)) {
      return false;
    }

    // Check for common project structure indicators
    const projectIndicators = [
      'src',
      'app',
      'pages',
      'components',
      'index.html',
      'index.tsx',
      'index.jsx',
      'main.tsx',
      'main.jsx',
      'App.tsx',
      'App.jsx',
      'App.vue',
      'App.svelte',
    ];

    return projectIndicators.some(indicator => {
      const fullPath = path.join(dirPath, indicator);
      return fs.existsSync(fullPath);
    });
  }

  /**
   * Scan first-level subdirectories for any that contain a complete frontend project
   */
  private scanForFrontendSubdirectory(rootPath: string): string | null {
    const frontendSubdirs = this.getAllFrontendSubdirectories(rootPath);
    return frontendSubdirs.length > 0 ? frontendSubdirs[0] : null;
  }

  /**
   * Get all first-level subdirectories that contain complete frontend projects
   * Used for Step 0 to show available frontend roots
   */
  private getAllFrontendSubdirectories(rootPath: string): string[] {
    const frontendDirs: string[] = [];
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', 'coverage'];

      for (const entry of entries) {
        if (!entry.isDirectory() || ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) {
          continue;
        }

        const subdirPath = path.join(rootPath, entry.name);
        // Use isCompleteFrontendProject to ensure it's a real project, not just deps
        if (this.isCompleteFrontendProject(subdirPath)) {
          frontendDirs.push(entry.name);
        }
      }
    } catch {
      // Ignore errors
    }
    return frontendDirs;
  }

  /**
   * Get suggested frontend root directories (Step 0 options)
   * Returns available subdirectories that are complete frontend projects
   * Plus a "root (.)" option if the root itself is a frontend project
   */
  public getSuggestedFrontendRoots(): string[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    const rootPath = workspaceFolder.uri.fsPath;
    const options: string[] = [];

    // Check if root is a frontend project
    if (this.isCompleteFrontendProject(rootPath)) {
      options.push('.');
    }

    // Get frontend subdirectories
    const subdirs = this.getAllFrontendSubdirectories(rootPath);
    options.push(...subdirs);

    return options;
  }

  /**
   * Check if a directory has a package.json with frontend framework dependencies
   */
  private hasFrontendPackageJson(dirPath: string): boolean {
    const pkgPath = path.join(dirPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for any frontend framework dependency
      const frontendDeps = [
        'react', 'react-dom', 'vue', '@angular/core', 'svelte',
        'solid-js', '@builder.io/qwik', 'astro', 'next', 'nuxt',
        'gatsby', '@sveltejs/kit'
      ];

      return frontendDeps.some(dep => allDeps[dep]);
    } catch {
      return false;
    }
  }

  /**
   * Get suggested source directories based on frontend root detection
   * @param frontendRoot Optional explicit frontend root to use instead of auto-detection
   */
  public getSuggestedSourceDirs(frontendRoot?: string): string[] {
    const root = frontendRoot ?? this.detectFrontendRoot();
    const prefix = root ? `${root}/` : '';

    return [
      `${prefix}src/assets/svg`,
      `${prefix}src/icons`,
      `${prefix}icons`,
    ];
  }

  /**
   * Files that indicate an existing MasterSVG output directory
   */
  private static readonly OUTPUT_INDICATOR_FILES = [
    'icons.ts',
    'icons.js',
    'icons.mjs',
    'sprite.svg',
    'Icon.tsx',
    'Icon.vue',
    'Icon.svelte',
    'Icon.astro',
    'icon.component.ts',
    'web-component.js',
  ];

  /**
   * Detect existing output directory by searching for MasterSVG generated files
   * @returns The relative path to the detected output directory, or null if not found
   */
  public detectExistingOutputDir(): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const frontendRoot = this.detectFrontendRoot();
    const searchRoot = frontendRoot ? path.join(rootPath, frontendRoot) : rootPath;

    // Common directories where icons might be placed
    const searchDirs = [
      'src/icons',
      'src/assets/icons',
      'public/icons',
      'src/components/icons',
      'lib/icons',
      'assets/icons',
      'icons',
    ];

    for (const dir of searchDirs) {
      const fullPath = path.join(searchRoot, dir);
      if (this.hasOutputIndicatorFiles(fullPath)) {
        return frontendRoot ? `${frontendRoot}/${dir}` : dir;
      }
    }

    // If not found in common dirs, do a broader search
    const foundDir = this.searchForOutputDir(searchRoot, 3);
    if (foundDir) {
      const relativePath = path.relative(rootPath, foundDir).replace(/\\/g, '/');
      return relativePath;
    }

    return null;
  }

  /**
   * Check if a directory contains MasterSVG output indicator files
   */
  private hasOutputIndicatorFiles(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    try {
      const files = fs.readdirSync(dirPath);
      return FrameworkDetectorService.OUTPUT_INDICATOR_FILES.some(indicator =>
        files.includes(indicator)
      );
    } catch {
      return false;
    }
  }

  /**
   * Recursively search for a directory containing output indicator files
   * @param startPath Directory to start searching from
   * @param maxDepth Maximum depth to search
   */
  private searchForOutputDir(startPath: string, maxDepth: number): string | null {
    if (maxDepth <= 0 || !fs.existsSync(startPath)) {
      return null;
    }

    try {
      const entries = fs.readdirSync(startPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip common non-source directories
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(startPath, entry.name);

        // Check if this directory has indicator files
        if (this.hasOutputIndicatorFiles(fullPath)) {
          return fullPath;
        }

        // Recurse into subdirectory
        const found = this.searchForOutputDir(fullPath, maxDepth - 1);
        if (found) {
          return found;
        }
      }
    } catch {
      // Ignore permission errors
    }

    return null;
  }

  /**
   * Get suggested output directories based on frontend root detection
   * Prioritizes detected existing output directory
   * @param frontendRoot Optional explicit frontend root to use instead of auto-detection
   */
  public getSuggestedOutputDirs(frontendRoot?: string): string[] {
    const root = frontendRoot ?? this.detectFrontendRoot();
    const prefix = root ? `${root}/` : '';

    // Check for existing output directory first
    const existingOutputDir = this.detectExistingOutputDir();

    const defaultDirs = [
      `${prefix}src/icons`,
      `${prefix}src/assets/icons`,
      `${prefix}public/icons`,
    ];

    // If we found an existing dir, put it first and remove duplicates
    if (existingOutputDir) {
      const filtered = defaultDirs.filter(d => d !== existingOutputDir);
      return [existingOutputDir, ...filtered];
    }

    return defaultDirs;
  }

  /**
   * Get the auto-detected output directory (if any)
   * This is separate from suggestions - it's specifically for auto-configuration
   */
  public getAutoDetectedOutputDir(): string | null {
    return this.detectExistingOutputDir();
  }
}
