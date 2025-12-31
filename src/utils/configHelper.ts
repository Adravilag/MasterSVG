import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t } from '../i18n';

export interface IconStudioConfig {
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
export function getConfig(): IconStudioConfig {
  const config = vscode.workspace.getConfiguration('sageboxIconStudio');
  return {
    outputDirectory: config.get<string>('outputDirectory', 'sagebox-icons'),
    componentName: config.get<string>('componentName', 'Icon'),
    nameAttribute: config.get<string>('nameAttribute', 'name'),
    defaultSize: config.get<number>('defaultSize', 24),
    defaultColor: config.get<string>('defaultColor', 'currentColor'),
    webComponentName: config.get<string>('webComponentName', 'icon-wrap'),
    buildFormat: config.get<'icons.ts' | 'sprite.svg'>('buildFormat', 'icons.ts'),
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
 * Check if icons.js file exists in the output directory
 */
export function iconsJsExists(): boolean {
  const fullPath = getFullOutputPath();
  if (!fullPath) return false;
  return fs.existsSync(path.join(fullPath, 'icons.js'));
}

/**
 * Update the VS Code context for icons.js existence
 * Should be called when icons are built or removed
 */
export function updateIconsJsContext(): void {
  const exists = iconsJsExists();
  vscode.commands.executeCommand('setContext', 'sageboxIconStudio.iconsJsExists', exists);
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
  const config = vscode.workspace.getConfiguration('sageboxIconStudio');
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
    vscode.window.showWarningMessage(t('messages.noWorkspace'));
  }
  return folder;
}

/**
 * Check configuration and show warning if not configured
 */
export function checkConfigOrWarn(): boolean {
  if (!isOutputConfigured()) {
    vscode.window.showWarningMessage(t('messages.configureOutputFirst'));
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
    vscode.window.showWarningMessage(t('messages.noWorkspace'));
    return undefined;
  }

  return fullPath;
}
