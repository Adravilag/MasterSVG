/**
 * ConfigService - Manages mastersvg.config.json
 *
 * Singleton service that reads, validates, and provides access to
 * the MasterSVG configuration file.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MasterSvgConfig, PartialMasterSvgConfig, FrameworkType, OutputStructure } from './ConfigSchema';
import { DEFAULT_CONFIG, mergeWithDefaults, createMinimalConfig } from './ConfigDefaults';

/** Config file name */
export const CONFIG_FILE_NAME = 'mastersvg.config.json';

/** Event fired when config changes */
export type ConfigChangeListener = (config: MasterSvgConfig) => void;

/**
 * ConfigService - Singleton for managing MasterSVG configuration
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: MasterSvgConfig = DEFAULT_CONFIG;
  private configPath: string | null = null;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private listeners: ConfigChangeListener[] = [];
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    // Initialize on first load
    this.loadConfig();
    this.setupFileWatcher();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Resets the singleton (for testing)
   */
  public static resetInstance(): void {
    if (ConfigService.instance) {
      ConfigService.instance.dispose();
      ConfigService.instance = undefined as unknown as ConfigService;
    }
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): MasterSvgConfig {
    return this.config;
  }

  /**
   * Gets a specific section of the config
   */
  public getSection<K extends keyof MasterSvgConfig>(section: K): MasterSvgConfig[K] {
    return this.config[section];
  }

  /**
   * Checks if a config file exists in the workspace
   */
  public hasConfigFile(): boolean {
    return this.configPath !== null && fs.existsSync(this.configPath);
  }

  /**
   * Gets the config file path
   */
  public getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Loads configuration from file or falls back to VS Code settings
   */
  public loadConfig(): MasterSvgConfig {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
      this.config = DEFAULT_CONFIG;
      return this.config;
    }

    this.configPath = path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);

    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(content) as PartialMasterSvgConfig;
        this.config = mergeWithDefaults(userConfig);
        console.log('[MasterSVG] Loaded config from mastersvg.config.json');
      } catch (error) {
        console.error('[MasterSVG] Error parsing config file:', error);
        vscode.window.showErrorMessage(
          `MasterSVG: Error parsing ${CONFIG_FILE_NAME}. Using defaults.`
        );
        this.config = DEFAULT_CONFIG;
      }
    } else {
      // Fall back to VS Code settings for backward compatibility
      this.config = this.loadFromVsCodeSettings();
    }

    return this.config;
  }

  /**
   * Creates a new config file in the workspace
   */
  public async createConfigFile(initialConfig?: Partial<MasterSvgConfig>): Promise<string | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return null;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);
    
    if (fs.existsSync(configPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `${CONFIG_FILE_NAME} already exists. Overwrite?`,
        'Yes',
        'No'
      );
      if (overwrite !== 'Yes') return null;
    }

    const config = initialConfig ? mergeWithDefaults(initialConfig) : DEFAULT_CONFIG;
    const content = JSON.stringify(config, null, 2);

    try {
      fs.writeFileSync(configPath, content, 'utf-8');
      this.configPath = configPath;
      this.config = config;
      this.notifyListeners();
      
      // Open the file in editor
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
      
      return configPath;
    } catch (error) {
      console.error('[MasterSVG] Error creating config file:', error);
      vscode.window.showErrorMessage(`Failed to create ${CONFIG_FILE_NAME}`);
      return null;
    }
  }

  /**
   * Updates the config file with new values
   */
  public async updateConfig(updates: Partial<MasterSvgConfig>): Promise<boolean> {
    if (!this.configPath) {
      return false;
    }

    const newConfig = mergeWithDefaults({ ...this.config, ...updates });

    try {
      const content = JSON.stringify(newConfig, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf-8');
      this.config = newConfig;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[MasterSVG] Error updating config:', error);
      return false;
    }
  }

  /**
   * Registers a listener for config changes
   */
  public onConfigChange(listener: ConfigChangeListener): vscode.Disposable {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  /**
   * Disposes of resources
   */
  public dispose(): void {
    this.fileWatcher?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.listeners = [];
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Gets resolved output paths based on structure type
   */
  public getOutputPaths(): { components: string; assets: string; types: string } {
    const output = this.config.output;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    if (output.structure === 'separated' && output.paths) {
      return {
        components: path.join(workspaceFolder, output.paths.components),
        assets: path.join(workspaceFolder, output.paths.assets),
        types: path.join(workspaceFolder, output.paths.types ?? output.paths.components),
      };
    }

    // Flat structure - all in same directory
    const dir = path.join(workspaceFolder, output.directory ?? 'src/icons');
    return {
      components: dir,
      assets: dir,
      types: dir,
    };
  }

  /**
   * Gets the component file name based on framework
   */
  public getComponentFileName(): string {
    const framework = this.config.framework.type;
    const componentName = this.config.framework.component?.name ?? 'Icon';

    switch (framework) {
      case 'react':
      case 'solid':
      case 'qwik':
        return `${componentName}.tsx`;
      case 'vue':
        return `${componentName}.vue`;
      case 'svelte':
        return `${componentName}.svelte`;
      case 'angular':
        return `${componentName.toLowerCase()}.component.ts`;
      case 'astro':
        return `${componentName}.astro`;
      default:
        return `${componentName}.js`;
    }
  }

  /**
   * Gets the data file name based on format
   */
  public getDataFileName(): string {
    const format = this.config.output.format;
    if (format === 'sprite.svg') return 'sprite.svg';
    return format === 'icons.ts' ? 'svg-data.ts' : 'svg-data.js';
  }

  /**
   * Checks if TypeScript should be used
   */
  public useTypeScript(): boolean {
    return this.config.framework.typescript ?? 
           this.config.output.format === 'icons.ts';
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════

  private setupFileWatcher(): void {
    if (!vscode.workspace.workspaceFolders?.[0]) return;

    const pattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders[0],
      CONFIG_FILE_NAME
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.disposables.push(
      this.fileWatcher.onDidChange(() => {
        console.log('[MasterSVG] Config file changed, reloading...');
        this.loadConfig();
        this.notifyListeners();
      }),
      this.fileWatcher.onDidCreate(() => {
        console.log('[MasterSVG] Config file created, loading...');
        this.loadConfig();
        this.notifyListeners();
      }),
      this.fileWatcher.onDidDelete(() => {
        console.log('[MasterSVG] Config file deleted, using defaults...');
        this.configPath = null;
        this.config = this.loadFromVsCodeSettings();
        this.notifyListeners();
      })
    );
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('[MasterSVG] Error in config change listener:', error);
      }
    }
  }

  /**
   * Loads config from VS Code settings (backward compatibility)
   */
  private loadFromVsCodeSettings(): MasterSvgConfig {
    const vsConfig = vscode.workspace.getConfiguration('masterSVG');

    const framework = vsConfig.get<string>('framework', 'html') as FrameworkType;
    const buildFormat = vsConfig.get<string>('buildFormat', 'icons.js');

    return mergeWithDefaults({
      source: {
        directories: vsConfig.get<string[]>('svgFolders', []),
      },
      output: {
        format: buildFormat.includes('.ts') ? 'icons.ts' : 
                buildFormat === 'sprite.svg' ? 'sprite.svg' : 'icons.js',
        structure: 'flat' as OutputStructure,
        directory: vsConfig.get<string>('outputDirectory', 'src/icons'),
      },
      framework: {
        type: framework,
        typescript: buildFormat.includes('.ts'),
        component: {
          webComponentTag: vsConfig.get<string>('webComponentName', 'svg-icon'),
        },
      },
      icons: {
        defaultSize: vsConfig.get<number>('defaultIconSize', 24),
        naming: vsConfig.get<string>('namingConvention', 'kebab-case') as 'kebab-case',
      },
      licenses: {
        autoGenerate: vsConfig.get<boolean>('autoGenerateLicenses', false),
      },
      editor: {
        scanOnStartup: vsConfig.get<boolean>('scanOnStartup', true),
        previewBackground: vsConfig.get<string>('previewBackground', 'checkered') as 'checkered',
        deleteAfterBuild: vsConfig.get<boolean>('deleteAfterBuild', false),
      },
    });
  }
}

/**
 * Helper function to get config instance
 */
export function getConfig(): MasterSvgConfig {
  return ConfigService.getInstance().getConfig();
}

/**
 * Helper function to create a minimal config
 */
export function createConfig(framework: FrameworkType): Partial<MasterSvgConfig> {
  return createMinimalConfig(framework);
}
