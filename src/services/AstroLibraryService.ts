/**
 * AstroLibraryService - Manages the Astro icon library server
 * This service handles launching, stopping, and communicating with the Astro-based icon manager
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';

export interface AstroLibraryConfig {
  /** Path to the Astro project */
  projectPath: string;
  /** Port to run the server on */
  port: number;
  /** Whether to use development mode */
  devMode: boolean;
}

export interface IconSelectionResult {
  name: string;
  content: string;
  category?: string;
}

interface ServerSpawnResult {
  process: ChildProcess;
  startupPromise: Promise<void>;
}

/**
 * Service for managing the Astro icon library
 */
export class AstroLibraryService {
  private static instance: AstroLibraryService;
  private serverProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private port: number = 4568;
  private projectPath: string | null = null;
  private outputChannel: vscode.OutputChannel;
  private startupPromise: Promise<void> | null = null;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('mastersvg Icon Library');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AstroLibraryService {
    if (!AstroLibraryService.instance) {
      AstroLibraryService.instance = new AstroLibraryService();
    }
    return AstroLibraryService.instance;
  }

  /**
   * Get the configured project path or detect it automatically
   */
  public getProjectPath(): string | null {
    const configPath = this.getConfiguredPath();
    if (configPath) {
      return configPath;
    }
    return this.detectProjectInWorkspace();
  }

  private getConfiguredPath(): string | null {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const configPath = config.get<string>('astroLibraryPath');

    if (configPath && fs.existsSync(configPath)) {
      return configPath;
    }
    return null;
  }

  private detectProjectInWorkspace(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    for (const folder of workspaceFolders) {
      const detected = this.checkFolderForIconManager(folder.uri.fsPath);
      if (detected) {
        return detected;
      }
    }
    return null;
  }

  private checkFolderForIconManager(folderPath: string): string | null {
    // Check if current folder is icon-manager
    const currentFolder = this.isIconManagerProject(folderPath);
    if (currentFolder) {
      return currentFolder;
    }

    // Check for icon-manager as sibling folder
    const parentDir = path.dirname(folderPath);
    const siblingPath = path.join(parentDir, 'icon-manager');
    return this.isIconManagerProject(siblingPath);
  }

  private isIconManagerProject(projectPath: string): string | null {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.name === '@sage-box/lab-icon-manager') {
        return projectPath;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  /**
   * Check if the server is running
   */
  public async isServerRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.port}/`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Start the Astro server
   */
  public async startServer(options?: Partial<AstroLibraryConfig>): Promise<boolean> {
    if (this.startupPromise) {
      await this.startupPromise;
      return this.isRunning;
    }

    if (await this.isServerRunning()) {
      this.isRunning = true;
      return true;
    }

    const projectPath = options?.projectPath || this.getProjectPath();
    if (!projectPath) {
      vscode.window.showErrorMessage(
        'Icon library path not configured. Please set masterSVG.astroLibraryPath in settings.'
      );
      return false;
    }

    this.projectPath = projectPath;
    this.port = options?.port || 4568;

    const distPath = path.join(projectPath, 'dist', 'server', 'entry.mjs');
    const useDevMode = options?.devMode || !fs.existsSync(distPath);

    return this.spawnServerProcess(projectPath, useDevMode);
  }

  private async spawnServerProcess(projectPath: string, useDevMode: boolean): Promise<boolean> {
    const { process: serverProc, startupPromise } = this.createServerProcess(projectPath, useDevMode);
    this.serverProcess = serverProc;
    this.startupPromise = startupPromise;

    try {
      await this.startupPromise;
      this.outputChannel.appendLine('Server started successfully!');
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`Failed to start server: ${error}`);
      return false;
    } finally {
      this.startupPromise = null;
    }
  }

  private createServerProcess(projectPath: string, useDevMode: boolean): ServerSpawnResult {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = useDevMode
      ? ['run', 'dev', '--', '--port', String(this.port)]
      : ['run', 'start'];

    this.outputChannel.appendLine(`Starting Astro server in ${useDevMode ? 'dev' : 'production'} mode...`);
    this.outputChannel.appendLine(`Project: ${projectPath}`);
    this.outputChannel.appendLine(`Port: ${this.port}`);

    const serverProcess = spawn(npm, args, {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, PORT: String(this.port), HOST: 'localhost' },
    });

    const startupPromise = this.waitForServerReady(serverProcess);
    return { process: serverProcess, startupPromise };
  }

  private waitForServerReady(serverProcess: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const startupTimeout = setTimeout(async () => {
        if (await this.isServerRunning()) {
          this.isRunning = true;
          resolve();
        } else {
          reject(new Error('Server startup timeout'));
        }
      }, 30000);

      const handleOutput = (output: string): void => {
        if (output.includes('localhost:') || output.includes('Local:') || output.includes('Server running')) {
          this.isRunning = true;
          clearTimeout(startupTimeout);
          resolve();
        }
      };

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        this.outputChannel.append(output);
        handleOutput(output);
      });

      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        this.outputChannel.append(`[stderr] ${output}`);
        handleOutput(output);
      });

      serverProcess.on('error', (error) => {
        this.outputChannel.appendLine(`Error: ${error.message}`);
        this.isRunning = false;
        clearTimeout(startupTimeout);
        reject(error);
      });

      serverProcess.on('exit', (code) => {
        this.outputChannel.appendLine(`Server exited with code ${code}`);
        this.isRunning = false;
        this.serverProcess = null;
      });
    });
  }

  /**
   * Stop the Astro server
   */
  public stopServer(): void {
    if (!this.serverProcess) {
      return;
    }

    this.outputChannel.appendLine('Stopping server...');

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(this.serverProcess.pid), '/f', '/t']);
    } else {
      this.serverProcess.kill('SIGTERM');
    }

    this.serverProcess = null;
    this.isRunning = false;
  }

  /**
   * Get the URL to the icon library
   */
  public getLibraryUrl(query?: string): string {
    let url = `http://localhost:${this.port}/`;
    if (query) {
      url += `?search=${encodeURIComponent(query)}`;
    }
    return url;
  }

  /**
   * Get the URL for the API
   */
  public getApiUrl(endpoint: string): string {
    return `http://localhost:${this.port}/api/${endpoint}`;
  }

  /**
   * Fetch icons from the library
   */
  public async fetchIcons(): Promise<IconSelectionResult[]> {
    return this.httpGetJson<IconSelectionResult[]>(this.getApiUrl('icons'));
  }

  /**
   * Search icons in the library
   */
  public async searchIcons(query: string): Promise<IconSelectionResult[]> {
    const url = `${this.getApiUrl('icons/search')}?q=${encodeURIComponent(query)}`;
    return this.httpGetJson<IconSelectionResult[]>(url);
  }

  private httpGetJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Show the output channel
   */
  public showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopServer();
    this.outputChannel.dispose();
  }

  /**
   * Get running status
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get current port
   */
  public get currentPort(): number {
    return this.port;
  }
}

// Export singleton getter
export function getAstroLibraryService(): AstroLibraryService {
  return AstroLibraryService.getInstance();
}
