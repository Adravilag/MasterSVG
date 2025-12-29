import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface IconManagerConfig {
  outputDirectory: string;
  componentName: string;
  nameAttribute: string;
  defaultSize: number;
  defaultColor: string;
  webComponentName: string;
  buildFormat: 'icons.ts' | 'sprite.svg';
}

/**
 * Get icon manager configuration
 */
export function getConfig(): IconManagerConfig {
  const config = vscode.workspace.getConfiguration('iconManager');
  return {
    outputDirectory: config.get<string>('outputDirectory', 'iconwrap-icons'),
    componentName: config.get<string>('componentName', 'Icon'),
    nameAttribute: config.get<string>('nameAttribute', 'name'),
    defaultSize: config.get<number>('defaultSize', 24),
    defaultColor: config.get<string>('defaultColor', 'currentColor'),
    webComponentName: config.get<string>('webComponentName', 'icon-wrap'),
    buildFormat: config.get<'icons.ts' | 'sprite.svg'>('buildFormat', 'icons.ts')
  };
}

/**
 * Get the output directory path
 */
export function getOutputDirectory(): string {
  return getConfig().outputDirectory;
}

/**
 * Get the full output path (workspace folder + output directory)
 */
export function getFullOutputPath(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const outputDir = getOutputDirectory();
  
  if (!workspaceFolder || !outputDir) {
    return undefined;
  }
  
  return path.join(workspaceFolder.uri.fsPath, outputDir);
}

/**
 * Check if output directory is configured
 */
export function isOutputConfigured(): boolean {
  return !!getOutputDirectory();
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDirectory(): string | undefined {
  const fullPath = getFullOutputPath();
  
  if (!fullPath) {
    return undefined;
  }
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  
  return fullPath;
}

/**
 * Update output directory configuration
 */
export async function setOutputDirectory(dir: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('iconManager');
  await config.update('outputDirectory', dir, vscode.ConfigurationTarget.Workspace);
}

/**
 * Get component snippet for inserting icons
 */
export function getIconSnippet(iconName: string): string {
  const config = getConfig();
  return `<${config.componentName} ${config.nameAttribute}="${iconName}" />`;
}

/**
 * Get workspace folder or show warning
 */
export function getWorkspaceFolderOrWarn(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage('No workspace folder open');
  }
  return folder;
}

/**
 * Check configuration and show warning if not configured
 */
export function checkConfigOrWarn(): boolean {
  if (!isOutputConfigured()) {
    vscode.window.showWarningMessage('Configure output directory first');
    return false;
  }
  return true;
}

/**
 * Get full output path or show warning
 */
export function getOutputPathOrWarn(): string | undefined {
  if (!checkConfigOrWarn()) {
    return undefined;
  }
  
  const fullPath = getFullOutputPath();
  if (!fullPath) {
    vscode.window.showWarningMessage('No workspace folder open');
    return undefined;
  }
  
  return fullPath;
}
