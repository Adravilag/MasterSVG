import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t } from '../i18n';

export type FrameworkType = 'html' | 'react' | 'vue' | 'angular' | 'svelte' | 'solid' | 'qwik' | 'astro';

export interface IconStudioConfig {
  outputDirectory: string;
  componentName: string;
  nameAttribute: string;
  defaultSize: number;
  defaultColor: string;
  webComponentName: string;
  buildFormat: 'icons.ts' | 'sprite.svg';
  framework: FrameworkType;
}

/**
 * Get icon manager configuration
 */
export function getConfig(): IconStudioConfig {
  const config = vscode.workspace.getConfiguration('masterSVG');
  return {
    outputDirectory: config.get<string>('outputDirectory', 'mastersvg-icons'),
    componentName: config.get<string>('componentName', 'Icon'),
    nameAttribute: config.get<string>('nameAttribute', 'name'),
    defaultSize: config.get<number>('defaultSize', 24),
    defaultColor: config.get<string>('defaultColor', 'currentColor'),
    webComponentName: config.get<string>('webComponentName', 'icon-wrap'),
    buildFormat: config.get<'icons.ts' | 'sprite.svg'>('buildFormat', 'icons.ts'),
    framework: config.get<FrameworkType>('framework', 'html'),
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
  vscode.commands.executeCommand('setContext', 'masterSVG.iconsJsExists', exists);
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
  const config = vscode.workspace.getConfiguration('masterSVG');
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

/**
 * Convert kebab-case to PascalCase for component names
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Get the icon usage code for the configured framework
 */
export function getFrameworkIconUsage(iconName: string, isSprite: boolean): string {
  const config = getConfig();
  const framework = config.framework;
  const outputDir = config.outputDirectory;
  const webComponentName = config.webComponentName || 'svg-icon';
  const componentName = toPascalCase(iconName) + 'Icon';

  // Sprite format is similar across frameworks (uses SVG <use>)
  if (isSprite) {
    switch (framework) {
      case 'react':
        return `<svg className="icon" aria-hidden="true"><use href="${outputDir}/sprite.svg#${iconName}"></use></svg>`;
      case 'vue':
      case 'angular':
      case 'svelte':
      case 'solid':
      case 'qwik':
      case 'astro':
        return `<svg class="icon" aria-hidden="true"><use href="${outputDir}/sprite.svg#${iconName}"></use></svg>`;
      case 'html':
      default:
        return `<svg class="icon" aria-hidden="true"><use href="${outputDir}/sprite.svg#${iconName}"></use></svg>`;
    }
  }

  // Component/icons.js format varies by framework
  switch (framework) {
    case 'react':
      return `<${componentName} />`;
    case 'vue':
      return `<${componentName} />`;
    case 'angular':
      return `<app-${iconName}-icon></app-${iconName}-icon>`;
    case 'svelte':
      return `<${componentName} />`;
    case 'solid':
      return `<${componentName} />`;
    case 'qwik':
      return `<${componentName} />`;
    case 'astro':
      return `<${componentName} />`;
    case 'html':
    default:
      // Web Component format
      return `<${webComponentName} name="${iconName}"></${webComponentName}>`;
  }
}

/**
 * Get the import statement for the configured framework
 */
export function getFrameworkImportStatement(iconName: string): string | null {
  const config = getConfig();
  const framework = config.framework;
  const outputDir = config.outputDirectory;
  const componentName = toPascalCase(iconName) + 'Icon';

  switch (framework) {
    case 'react':
      return `import { ${componentName} } from '${outputDir}/icons';`;
    case 'vue':
      return `import ${componentName} from '${outputDir}/${componentName}.vue';`;
    case 'angular':
      // Angular uses modules, import is done differently
      return null;
    case 'svelte':
      return `import ${componentName} from '${outputDir}/${componentName}.svelte';`;
    case 'solid':
      return `import { ${componentName} } from '${outputDir}/icons';`;
    case 'qwik':
      return `import { ${componentName} } from '${outputDir}/icons';`;
    case 'astro':
      return `import ${componentName} from '${outputDir}/${componentName}.astro';`;
    case 'html':
    default:
      return null; // Web Components don't need imports
  }
}

/**
 * Get framework display name
 */
export function getFrameworkDisplayName(framework?: FrameworkType): string {
  const fw = framework || getConfig().framework;
  const names: Record<FrameworkType, string> = {
    html: 'HTML (Web Components)',
    react: 'React',
    vue: 'Vue',
    angular: 'Angular',
    svelte: 'Svelte',
    solid: 'SolidJS',
    qwik: 'Qwik',
    astro: 'Astro',
  };
  return names[fw] || fw;
}
