import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { scopeSvgIds } from '../utils/svgIdScoper';
import { i18n, t, SUPPORTED_LOCALES, SupportedLocale } from '../i18n';
import { FrameworkDetectorService } from '../services/FrameworkDetectorService';
import { FrameworkWrapperService } from '../services/FrameworkWrapperService';
import { FrameworkType } from '../utils/configHelper';

/** Options for generating framework preview code */
interface PreviewOptions {
  badge: string;
  comp: string;
  dir: string;
  file: string;
  tr?: Record<string, string>;
}

/** Options for _getFrameworkPreview method */
interface FrameworkPreviewOptions {
  buildFormat: string;
  framework: string;
  outputDirDisplay: string;
  webComponentDisplay: string;
  tr: Record<string, string>;
}

/** Options for _applyTemplateReplacements method */
interface TemplateReplacementOptions {
  html: string;
  ctx: WebviewContext;
  tr: Record<string, string>;
  languageOptions: string;
  step4Section: string;
  previewCode: string;
  previewGallery: string;
  previewSummary: string;
  finishButton: string;
}

/** Options for preview template replacements */
interface PreviewReplacementOptions {
  html: string;
  ctx: WebviewContext;
  tr: Record<string, string>;
  previewCode: string;
  previewGallery: string;
  previewSummary: string;
  finishButton: string;
}

/** Context data for the webview */
interface WebviewContext {
  sourceDir: string;
  outputDir: string;
  buildFormat: string;
  framework: string;
  webComponentName: string;
  scanOnStartup: boolean;
  defaultIconSize: number;
  previewBackground: string;
  /** Is frontend root configured (step 0) */
  isFrontendConfigured: boolean;
  isSourceConfigured: boolean;
  isOutputConfigured: boolean;
  isBuildFormatConfigured: boolean;
  isWebComponentConfigured: boolean;
  isFullyConfigured: boolean;
  outputDirDisplay: string;
  webComponentDisplay: string;
  /** Detected frontend root directory (e.g., 'frontend/', 'client/') */
  frontendRoot: string;
  /** Available frontend subdirectories for Step 0 */
  suggestedFrontendRoots: string[];
  /** Suggested source directories based on frontend detection */
  suggestedSourceDirs: string[];
  /** Suggested output directories based on frontend detection */
  suggestedOutputDirs: string[];
}

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  public static readonly viewType = 'masterSVG.welcome';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _frameworkAutoDetected: boolean = false;
  private _sessionConfig: {
    svgFolders: string[];
    outputDirectory: string;
    framework: string;
    buildFormat: string;
    webComponentName: string;
    scanOnStartup: boolean;
    defaultIconSize: number;
    previewBackground: string;
    autoGenerateLicenses: boolean;
    frontendRoot: string;
  };

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WelcomePanel.viewType,
      t('welcome.title'),
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }

  public static isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const outputDir = config.get<string>('outputDirectory', '');
    return !!outputDir;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Initialize session config with current values (but don't save until finishSetup)
    const config = vscode.workspace.getConfiguration('masterSVG');
    this._sessionConfig = {
      svgFolders: config.get<string[]>('svgFolders', []),
      outputDirectory: config.get<string>('outputDirectory', ''),
      framework: config.get<string>('framework', 'html'),
      buildFormat: config.get<string>('buildFormat', '') || 'icons.ts',
      webComponentName: config.get<string>('webComponentName', ''),
      scanOnStartup: config.get<boolean>('scanOnStartup', true),
      defaultIconSize: config.get<number>('defaultIconSize', 24),
      previewBackground: config.get<string>('previewBackground', 'transparent'),
      autoGenerateLicenses: config.get<boolean>('autoGenerateLicenses', false),
      frontendRoot: '', // Will be auto-detected
    };

    // Auto-detect framework if not configured
    this._initializeFrameworkDetection();

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._setupMessageHandler();
    this._setupEventListeners();
  }

  private _setupMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(
      async message => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  private async _handleMessage(message: { command: string; directory?: string; format?: string; framework?: string; name?: string; language?: string; value?: boolean | number | string }): Promise<void> {
    switch (message.command) {
      case 'setFrontendRoot': if (message.directory !== undefined) await this._setFrontendRoot(message.directory); break;
      case 'chooseFrontendFolder': await this._chooseFrontendFolder(); break;
      case 'setSourceDirectory': if (message.directory) await this._setSourceDirectory(message.directory); break;
      case 'chooseSourceFolder': await this._chooseSourceFolder(); break;
      case 'setOutputDirectory': if (message.directory) await this._setOutputDirectory(message.directory); break;
      case 'chooseFolder': await this._chooseFolder(); break;
      case 'setBuildFormat': if (message.format) await this._setBuildFormat(message.format); break;
      case 'setFramework': if (message.framework) await this._setFramework(message.framework); break;
      case 'setWebComponentName': if (message.name) await this._setWebComponentName(message.name); break;
      case 'setLanguage': if (message.language) await this._setLanguage(message.language); break;
      case 'setScanOnStartup': await this._setScanOnStartup(message.value as boolean); break;
      case 'setDefaultIconSize': await this._setDefaultIconSize(message.value as number); break;
      case 'setPreviewBackground': await this._setPreviewBackground(message.value as string); break;
      case 'openSettings': vscode.commands.executeCommand('workbench.action.openSettings', 'masterSVG'); break;
      case 'searchIcons': vscode.commands.executeCommand('masterSVG.searchIcons'); this._panel.dispose(); break;
      case 'close': this._panel.dispose(); break;
      case 'finishSetup': await this._finishSetup(); break;
    }
  }

  private _setupEventListeners(): void {
    this._disposables.push(
      i18n.onDidChangeLocale(() => this._update()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('masterSVG')) this._update();
      })
    );
  }

  private async _setFrontendRoot(directory: string): Promise<void> {
    this._sessionConfig.frontendRoot = directory;
    this._update();
  }

  private async _chooseFrontendFolder(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolder.uri,
      openLabel: t('welcome.frontendRoot'),
    });

    if (folderUri && folderUri.length > 0) {
      const fullPath = folderUri[0].fsPath;
      const workspacePath = workspaceFolder.uri.fsPath;
      const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
      await this._setFrontendRoot(relativePath);
    }
  }

  private async _setSourceDirectory(directory: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    const currentFolders = this._sessionConfig.svgFolders;

    // Set the new directory as the first folder (primary source)
    this._sessionConfig.svgFolders = [directory, ...currentFolders.filter(f => f !== directory)];

    this._update();
  }

  private async _chooseSourceFolder(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolder.uri,
      openLabel: t('welcome.sourceDirectory'),
    });

    if (folderUri && folderUri.length > 0) {
      const fullPath = folderUri[0].fsPath;
      const workspacePath = workspaceFolder.uri.fsPath;
      const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
      await this._setSourceDirectory(relativePath);
    }
  }

  private async _setOutputDirectory(directory: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.outputDirectory = directory;

    // Create folder if it doesn't exist (do this immediately for UX)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const fullPath = path.join(workspaceFolder.uri.fsPath, directory);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    this._update();
  }

  private async _chooseFolder(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolder.uri,
      openLabel: t('welcome.selectFolder'),
    });

    if (folderUri && folderUri.length > 0) {
      const fullPath = folderUri[0].fsPath;
      const workspacePath = workspaceFolder.uri.fsPath;
      const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
      await this._setOutputDirectory(relativePath);
    }
  }

  private async _setBuildFormat(format: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.buildFormat = format;
    this._update();
  }

  private async _initializeFrameworkDetection(): Promise<void> {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const detector = FrameworkDetectorService.getInstance();

    // Auto-detect framework if not explicitly configured
    const configuredFramework = config.get<string>('framework');
    if (!configuredFramework || configuredFramework === 'html') {
      const detectedFramework = await detector.detectFramework();

      if (detectedFramework !== 'html') {
        this._sessionConfig.framework = detectedFramework;
        this._frameworkAutoDetected = true;
      }
    }

    // Always ensure webComponentName has a valid default value
    if (!this._sessionConfig.webComponentName) {
      this._sessionConfig.webComponentName = this._getStep4Placeholder(this._sessionConfig.framework);
    }

    // Auto-detect output directory if not configured
    const configuredOutputDir = config.get<string>('outputDirectory');
    if (!configuredOutputDir) {
      const detectedOutputDir = detector.getAutoDetectedOutputDir();
      if (detectedOutputDir) {
        this._sessionConfig.outputDirectory = detectedOutputDir;
      }
    }

    this._update();
  }

  private async _setFramework(framework: string): Promise<void> {
    // User manually selected a framework, clear auto-detected flag
    this._frameworkAutoDetected = false;
    this._sessionConfig.framework = framework;

    // Auto-fill component name based on framework if not already set or if it's a default value
    const currentName = this._sessionConfig.webComponentName;
    const defaultNames = ['svg-icon', 'app-icon', 'Icon', ''];
    if (!currentName || defaultNames.includes(currentName)) {
      this._sessionConfig.webComponentName = this._getStep4Placeholder(framework);
    }

    this._update();
  }

  private async _setWebComponentName(name: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.webComponentName = name;
    this._update();
  }

  private _getStep4Title(framework: string): string {
    switch (framework) {
      case 'html':
        return t('welcome.webComponentName');
      case 'angular':
        return t('welcome.angularSelector');
      default:
        return t('welcome.componentName');
    }
  }

  private _getStep4Description(framework: string): string {
    switch (framework) {
      case 'html':
        return t('welcome.webComponentDesc');
      case 'angular':
        return t('welcome.angularSelectorDesc');
      default:
        return t('welcome.componentNameDesc');
    }
  }

  private _getStep4Placeholder(framework: string): string {
    switch (framework) {
      case 'html':
        return 'svg-icon';
      case 'angular':
        return 'app-icon';
      default:
        return 'Icon';
    }
  }

  private _requiresHyphen(framework: string): boolean {
    return framework === 'html' || framework === 'angular';
  }

  private _validateComponentName(name: string, framework: string): boolean {
    if (!name || name.trim() === '') return false;

    // HTML and Angular require hyphen (Web Component / Angular selector spec)
    if (this._requiresHyphen(framework)) {
      return name.includes('-');
    }

    // Other frameworks just need a non-empty name (preferably PascalCase)
    return name.length > 0;
  }

  private async _setLanguage(language: string): Promise<void> {
    await i18n.setLocale(language as SupportedLocale);
    // Update is triggered by onDidChangeLocale listener
  }

  private async _setScanOnStartup(value: boolean): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.scanOnStartup = value;
  }

  private async _setDefaultIconSize(value: number): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.defaultIconSize = value;
  }

  private async _setPreviewBackground(value: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.previewBackground = value;
  }

  private async _finishSetup(): Promise<void> {
    const outputDir = this._sessionConfig.outputDirectory;
    const buildFormat = this._sessionConfig.buildFormat;
    const webComponentName = this._sessionConfig.webComponentName;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder || !outputDir) {
      vscode.window.showWarningMessage(`⚠️ ${t('welcome.configureOutputFirst')}`);
      return;
    }

    const fullPath = path.join(workspaceFolder.uri.fsPath, outputDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    try {
      await this._persistSessionConfig();
      await this._generateOutputFiles(fullPath, buildFormat, webComponentName, outputDir);
      // Wait for VS Code configuration to be fully applied before refreshing
      await new Promise(resolve => setTimeout(resolve, 100));
      await vscode.commands.executeCommand('masterSVG.refreshIcons');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`❌ ${t('welcome.errorCreatingFiles')}: ${message}`);
    }

    this._panel.dispose();
  }

  private async _persistSessionConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const updates: Array<[string, unknown]> = [
      ['svgFolders', this._sessionConfig.svgFolders],
      ['outputDirectory', this._sessionConfig.outputDirectory],
      ['framework', this._sessionConfig.framework],
      ['buildFormat', this._sessionConfig.buildFormat],
      ['webComponentName', this._sessionConfig.webComponentName],
      ['scanOnStartup', this._sessionConfig.scanOnStartup],
      ['defaultIconSize', this._sessionConfig.defaultIconSize],
      ['previewBackground', this._sessionConfig.previewBackground],
    ];

    // Ensure .vscode folder exists for workspace settings
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
      if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
      }
    }

    for (const [key, value] of updates) {
      try {
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
      } catch (error) {
        console.error(`[MasterSVG] Failed to save ${key}:`, error);
      }
    }
  }

  private async _generateOutputFiles(
    fullPath: string, buildFormat: string, webComponentName: string, outputDir: string
  ): Promise<void> {
    if (buildFormat === 'sprite.svg') {
      await this._generateEmptySprite(fullPath);
      vscode.window.showInformationMessage(
        `${t('welcome.setupComplete')} ${t('welcome.spriteCreated', { path: outputDir })}`
      );
    } else {
      await this._generateEmptyIconsModule(fullPath, webComponentName);
      vscode.window.showInformationMessage(
        `${t('welcome.setupComplete')} ${t('welcome.filesCreated', { path: outputDir })}`
      );
    }
  }

  /**
   * Generate empty sprite.svg file
   */
  private async _generateEmptySprite(outputPath: string): Promise<void> {
    const spritePath = path.join(outputPath, 'sprite.svg');
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Auto-generated by MasterSVG -->
<!-- Add icons using "Add to Icon Collection" or drag SVG files here -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">
  <!-- Icons will be added here as <symbol> elements -->
  <!-- Usage: <svg><use href="sprite.svg#icon-name"></use></svg> -->
</svg>
`;
    fs.writeFileSync(spritePath, content, 'utf-8');
  }

  /**
   * Generate empty icons module files (icons.js, icon.js, icons.d.ts)
   */
  private async _generateEmptyIconsModule(
    outputPath: string,
    webComponentName: string
  ): Promise<void> {
    this._generateEmptyIconsFile(outputPath);
    const framework = this._sessionConfig.framework as FrameworkType;
    const wrapperService = FrameworkWrapperService.getInstance();
    wrapperService.generateWrapper(outputPath, framework, webComponentName);
    this._generateIconsTypeDefinitions(outputPath, webComponentName);
  }

  private _generateEmptyIconsFile(outputPath: string): void {
    const iconsPath = path.join(outputPath, 'icons.js');
    const iconsContent = `// Auto-generated by MasterSVG
// Add icons using "Add to Icon Collection" or drag SVG files here

// Icon exports will be added here
// Example: export const arrowRight = { name: 'arrow-right', body: '...', viewBox: '0 0 24 24' };

// Collection of all icons
export const icons = {
  // Icons will be added here
};
`;
    fs.writeFileSync(iconsPath, iconsContent, 'utf-8');
  }

  private _generateIconsTypeDefinitions(outputPath: string, webComponentName: string): void {
    const typesPath = path.join(outputPath, 'icons.d.ts');
    const typesContent = `// Auto-generated TypeScript definitions by MasterSVG
// This file provides type safety for your icon library

export interface IconData {
  name: string;
  body: string;
  viewBox: string;
  animation?: {
    type: string;
    duration: number;
    timing: string;
    iteration: string;
    delay?: number;
    direction?: string;
  };
}

// Icon names will be added here as you add icons
export type IconName = string;

// Collection of all icons
export declare const icons: Record<IconName, IconData>;

// Web Component
export declare class IconElement extends HTMLElement {
  name: string;
  size: string;
  color: string;
  animation: string;
}

declare global {
  interface HTMLElementTagNameMap {
    '${webComponentName}': IconElement;
  }
}
`;
    fs.writeFileSync(typesPath, typesContent, 'utf-8');
  }

  public dispose(): void {
    WelcomePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _loadTemplates(): { html: string; js: string; css: string } {
    const distPath = path.join(this._extensionUri.fsPath, 'dist', 'templates', 'welcome');
    const srcPath = path.join(this._extensionUri.fsPath, 'src', 'templates', 'welcome');
    let html = '';
    let js = '';
    let css = '';

    try {
      if (fs.existsSync(distPath)) {
        html = fs.readFileSync(path.join(distPath, 'Welcome.html'), 'utf8');
        js = fs.readFileSync(path.join(distPath, 'Welcome.js'), 'utf8');
        css = fs.readFileSync(path.join(distPath, 'Welcome.css'), 'utf8');
      } else if (fs.existsSync(srcPath)) {
        html = fs.readFileSync(path.join(srcPath, 'Welcome.html'), 'utf8');
        js = fs.readFileSync(path.join(srcPath, 'Welcome.js'), 'utf8');
        css = fs.readFileSync(path.join(srcPath, 'Welcome.css'), 'utf8');
      } else {
        // Minimal fallback templates
        html = '<div>Welcome</div>';
        js = '';
        css = '';
      }
    } catch {
      html = '<div>Welcome</div>';
      js = '';
      css = '';
    }

    return { html, js, css };
  }

  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getI18n(): Record<string, string> {
    return {
      ...this._getI18nBasicLabels(),
      ...this._getI18nStepLabels(),
      ...this._getI18nPreviewLabels(),
    };
  }

  private _getI18nBasicLabels(): Record<string, string> {
    return {
      languageLabel: t('welcome.language'),
      languageDescription: t('welcome.languageDescription'),
      appTitle: t('extension.appTitle'),
      headerIcons: '200k+ ' + t('treeView.files'),
      headerColors: t('editor.color') + ' ' + t('features.iconEditor').split(' ')[0],
      headerAnimations: t('animation.title'),
      headerSvgo: 'SVGO',
      advancedTitle: t('welcome.advancedOptions'),
      scanOnStartupLabel: t('welcome.scanOnStartup'),
      defaultIconSizeLabel: t('welcome.defaultIconSize'),
      previewBackgroundLabel: t('welcome.previewBackground'),
      allSettings: t('welcome.allSettings'),
      settings: t('settings.title'),
      skip: t('messages.cancel'),
      getStarted: t('welcome.getStarted'),
      completeStep1: t('welcome.save'),
      frontendDetected: t('welcome.frontendDetected'),
    };
  }

  private _getI18nStepLabels(): Record<string, string> {
    return {
      step0Title: t('welcome.frontendRoot'),
      step0Desc: t('welcome.frontendRootDesc'),
      step1SourceTitle: t('welcome.sourceDirectory'),
      step1SourceDesc: t('welcome.sourceDirectoryDescription'),
      step1SourcePlaceholder: t('welcome.sourceDirectoryPlaceholder'),
      step1Apply: t('editor.apply'),
      browse: t('welcome.browse'),
      step2Title: t('welcome.outputDirectory'),
      step2Desc: t('welcome.outputDirectoryDescription'),
      step2Placeholder: t('welcome.outputDirectoryPlaceholder'),
      step3Title: t('settings.outputFormat'),
      step3Desc: t('features.buildSystemDescription'),
      step3Help: '?',
      frameworkLabel: this._frameworkAutoDetected
        ? `${t('settings.framework')} (${t('settings.frameworkAutoDetected')})` : t('settings.framework') || 'Target Framework',
      selectFormat: t('welcome.selectFormat'),
      jsModuleTitle: t('welcome.jsModule'),
      jsModuleDesc: t('features.codeIntegrationDescription'),
      jsModulePro1: t('editor.variants'),
      jsModulePro2: t('editor.custom'),
      spriteTitle: t('sprite.title'),
      spriteDesc: t('features.buildSystemDescription'),
      spritePro1: t('welcome.noRuntime'),
      spritePro2: t('sprite.title'),
      recommended: '⭐',
      comingSoon: t('welcome.comingSoon'),
      helpJsModule: t('features.codeIntegrationDescription'),
      helpSprite: t('features.buildSystemDescription'),
      helpTip: t('welcome.quickStartDescription'),
      step4Title: '', step4Desc: '', step4Placeholder: '',
    };
  }

  private _getI18nPreviewLabels(): Record<string, string> {
    return {
      previewTitle: t('editor.preview'),
      previewImport: t('welcome.import'),
      previewUse: t('welcome.use'),
      previewRef: t('welcome.reference'),
      previewOutput: t('welcome.outputDirectory'),
      previewFormat: t('settings.outputFormat'),
      previewTag: t('welcome.tag'),
      previewResultLabel: t('welcome.previewResult'),
      buildFirstMessage: t('welcome.buildFirstMessage'),
      selectFormatFirst: t('welcome.selectFormatFirst'),
      workflowSource: t('welcome.workflowSource'),
      workflowBuild: t('welcome.workflowBuild'),
      workflowOutput: t('welcome.workflowOutput'),
    };
  }

  private _getFrameworkPreview(options: FrameworkPreviewOptions): string {
    const { buildFormat, framework, outputDirDisplay, webComponentDisplay, tr } = options;
    if (!buildFormat) {
      return this._getEmptyPreviewPlaceholder(tr);
    }
    if (buildFormat === 'sprite.svg') {
      return this._getSpritePreview(outputDirDisplay, tr);
    }
    return this._getIconsPreview(framework as FrameworkType, outputDirDisplay, webComponentDisplay, tr);
  }

  private _getEmptyPreviewPlaceholder(tr: Record<string, string>): string {
    return `<div class="preview-placeholder">
      <div class="preview-placeholder-icon">
        <svg viewBox="0 0 24 24">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </div>
      <p class="preview-placeholder-text">${tr.selectFormatFirst}</p>
      <p class="preview-placeholder-hint">
        <svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        Paso 3
      </p>
    </div>`;
  }

  private _getSpritePreview(outputDirDisplay: string, tr: Record<string, string>): string {
    return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewRef} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;svg</span> <span class="attr">width</span>=<span class="value">"24"</span> <span class="attr">height</span>=<span class="value">"24"</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">3</span>  <span class="tag">&lt;use</span> <span class="attr">href</span>=<span class="value">"${outputDirDisplay}/sprite.svg#home"</span> <span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">4</span><span class="tag">&lt;/svg&gt;</span></div>
</div>`;
  }

  private _getIconsPreview(
    selectedFramework: FrameworkType, outputDirDisplay: string,
    webComponentDisplay: string, tr: Record<string, string>
  ): string {
    const wrapperService = FrameworkWrapperService.getInstance();
    const frameworkBadge = selectedFramework !== 'html'
      ? `<div class="framework-badge">${selectedFramework.charAt(0).toUpperCase() + selectedFramework.slice(1)}</div>` : '';
    const wrapperFilename = wrapperService.getWrapperFilename(selectedFramework, webComponentDisplay);
    const componentImport = webComponentDisplay || wrapperService.getDefaultComponentName(selectedFramework);

    switch (selectedFramework) {
      case 'react': return this._getReactPreview({ badge: frameworkBadge, comp: componentImport, dir: outputDirDisplay, file: wrapperFilename, tr });
      case 'vue': return this._getVuePreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
      case 'svelte': return this._getSveltePreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
      case 'angular': return this._getAngularPreview(frameworkBadge, webComponentDisplay, outputDirDisplay, wrapperFilename);
      case 'astro': return this._getAstroPreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
      case 'solid': return this._getSolidPreview({ badge: frameworkBadge, comp: componentImport, dir: outputDirDisplay, file: wrapperFilename, tr });
      case 'qwik': return this._getQwikPreview({ badge: frameworkBadge, comp: componentImport, dir: outputDirDisplay, file: wrapperFilename, tr });
      default: return this._getHtmlPreview(webComponentDisplay, outputDirDisplay, tr);
    }
  }

  private _getReactPreview(opts: PreviewOptions): string {
    const { badge, comp, dir, file, tr } = opts;
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
  }

  private _getVuePreview(badge: string, comp: string, dir: string, file: string): string {
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script</span><span class="attr"> setup</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;template&gt;</span></div>
<div class="code-line"><span class="line-num">6</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">9</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> :size</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">10</span><span class="tag">&lt;/template&gt;</span></div>
</div>`;
  }

  private _getSveltePreview(badge: string, comp: string, dir: string, file: string): string {
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script&gt;</span></div>
<div class="code-line"><span class="line-num">2</span>  <span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
  }

  private _getAngularPreview(badge: string, webComp: string, dir: string, file: string): string {
    const sel = webComp || 'app-icon';
    const cls = sel.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Component';
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// app.component.ts</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${cls} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.ts', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="decorator">@Component</span>({<span class="attr"> imports</span>: [${cls}] })</div>
<div class="code-line"><span class="line-num">5</span></div>
<div class="code-line"><span class="line-num">6</span><span class="comment">&lt;!-- template.html --&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">9</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">10</span><span class="tag">&lt;${sel}</span><span class="attr"> [size]</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
</div>`;
  }

  private _getAstroPreview(badge: string, comp: string, dir: string, file: string): string {
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
  }

  private _getSolidPreview(opts: PreviewOptions): string {
    const { badge, comp, dir, file, tr } = opts;
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
  }

  private _getQwikPreview(opts: PreviewOptions): string {
    const { badge, comp, dir, file, tr } = opts;
    return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
  }

  private _getHtmlPreview(webComp: string, dir: string, tr: Record<string, string>): string {
    return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewImport} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;script</span><span class="attr"> src</span>=<span class="value">"${dir}/icons.js"</span><span class="tag">&gt;&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;script</span><span class="attr"> src</span>=<span class="value">"${dir}/web-component.js"</span><span class="tag">&gt;&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="comment">&lt;!-- ${tr.previewUse} --&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">9</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
</div>`;
  }

  private _getHtmlForWebview(): string {
    const ctx = this._buildWebviewContext();
    const tr = this._getI18n();
    tr.step4Title = this._getStep4Title(ctx.framework);
    tr.step4Desc = this._getStep4Description(ctx.framework);
    tr.step4Placeholder = this._getStep4Placeholder(ctx.framework);

    const templates = this._loadTemplates();
    const languageOptions = this._buildLanguageOptions();
    const step4Section = this._buildStep4Section(ctx, tr);
    const previewCode = this._getFrameworkPreview({
      buildFormat: ctx.buildFormat,
      framework: ctx.framework,
      outputDirDisplay: ctx.outputDirDisplay,
      webComponentDisplay: ctx.webComponentDisplay,
      tr
    });
    const previewGallery = this._buildPreviewGallery();
    const previewSummary = this._buildPreviewSummary(ctx, tr);
    const finishButton = this._buildFinishButton(ctx.isFullyConfigured, tr);

    const htmlContent = this._applyTemplateReplacements({
      html: templates.html, ctx, tr, languageOptions, step4Section, previewCode, previewGallery, previewSummary, finishButton
    });
    const jsContent = templates.js.replace(/\$\{helpOpenText\}/g, `${tr.step3Help} ▴`).replace(/\$\{helpClosedText\}/g, `${tr.step3Help} ▾`);

    return `<!DOCTYPE html>
<html lang="${i18n.getLocale()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('welcome.title')}</title>
  <style>${templates.css}</style>
</head>
<body>
  ${htmlContent}
  <script>${jsContent}</script>
</body>
</html>`;
  }

  private _buildWebviewContext(): WebviewContext {
    const svgFolders = this._sessionConfig.svgFolders;
    const sourceDir = svgFolders.length > 0 ? svgFolders[0] : '';
    const outputDir = this._sessionConfig.outputDirectory;
    const buildFormat = this._sessionConfig.buildFormat;
    const framework = this._sessionConfig.framework;
    const webComponentName = this._sessionConfig.webComponentName;

    // Use session config frontendRoot, or auto-detect if not set
    const frameworkDetector = FrameworkDetectorService.getInstance();
    const frontendRoot = this._sessionConfig.frontendRoot || frameworkDetector.detectFrontendRoot();
    const suggestedFrontendRoots = frameworkDetector.getSuggestedFrontendRoots();
    const suggestedSourceDirs = frameworkDetector.getSuggestedSourceDirs(frontendRoot);
    const suggestedOutputDirs = frameworkDetector.getSuggestedOutputDirs(frontendRoot);

    const isFrontendConfigured = !!frontendRoot || suggestedFrontendRoots.length === 0;
    const isSourceConfigured = !!sourceDir;
    const isOutputConfigured = !!outputDir;
    const isBuildFormatConfigured = !!buildFormat;
    const isWebComponentConfigured = this._validateComponentName(webComponentName, framework);
    const isFullyConfigured = isSourceConfigured && isOutputConfigured && isBuildFormatConfigured && isWebComponentConfigured;

    return {
      sourceDir, outputDir, buildFormat, framework, webComponentName,
      scanOnStartup: this._sessionConfig.scanOnStartup,
      defaultIconSize: this._sessionConfig.defaultIconSize,
      previewBackground: this._sessionConfig.previewBackground,
      isFrontendConfigured, isSourceConfigured, isOutputConfigured, isBuildFormatConfigured, isWebComponentConfigured, isFullyConfigured,
      outputDirDisplay: outputDir || suggestedOutputDirs[2] || 'public/icons',
      webComponentDisplay: webComponentName || 'svg-icon',
      frontendRoot,
      suggestedFrontendRoots,
      suggestedSourceDirs,
      suggestedOutputDirs,
    };
  }

  private _buildLanguageOptions(): string {
    const currentLocale = i18n.getConfiguredLocale();
    return SUPPORTED_LOCALES.map(locale => {
      const selected = locale.code === currentLocale ? 'selected' : '';
      const label = locale.code === 'auto' ? `${locale.flag} ${t('settings.languageAuto')}` : `${locale.flag} ${locale.nativeName}`;
      return `<option value="${locale.code}" ${selected}>${label}</option>`;
    }).join('\n          ');
  }

  private _buildStep4Section(ctx: ReturnType<typeof this._buildWebviewContext>, tr: Record<string, string>): string {
    if (ctx.buildFormat !== 'icons.ts') return '';
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-number${ctx.isWebComponentConfigured ? ' completed' : ''}"><span>4</span></div>
          <div class="step-title">${tr.step4Title}</div>
          ${ctx.isWebComponentConfigured ? `<span class="step-summary">&lt;${ctx.webComponentName}&gt;</span>` : ''}
        </div>
        <div class="step-content">
          <p class="step-description">${tr.step4Desc}</p>
          <div class="input-group">
            <input type="text" id="webComponentName" value="${ctx.webComponentName}" placeholder="${tr.step4Placeholder}" onkeypress="handleTagKeypress(event)" />
            <button class="btn-secondary" onclick="applyWebComponentName()">${tr.step1Apply}</button>
          </div>
        </div>
      </div>`;
  }

  private _buildPreviewGallery(): string {
    const suffix = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const svgHome = scopeSvgIds(`<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`, suffix + '_home');
    const svgHeart = scopeSvgIds(`<svg viewBox="0 0 24 24" style="fill: #e25555;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`, suffix + '_heart');
    const svgSettings = scopeSvgIds(`<svg viewBox="0 0 24 24"><g><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/><animateTransform attributeType="XML" attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></g></svg>`, suffix + '_settings');
    const svgCheck = scopeSvgIds(`<svg viewBox="0 0 24 24" style="fill: #2b8a3e;"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><animateTransform attributeType="XML" attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></g></svg>`, suffix + '_check');
    return `<div class="preview-icons-gallery">
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgHome}</div><span>home</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgHeart}</div><span>heart</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgSettings}</div><span>settings</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgCheck}</div><span>check</span></div>
    </div>`;
  }

  private _buildPreviewSummary(ctx: ReturnType<typeof this._buildWebviewContext>, tr: Record<string, string>): string {
    if (!ctx.isFullyConfigured) return '';
    return `<div class="preview-summary">
      <div class="preview-summary-item"><span class="preview-summary-label">${tr.previewOutput}</span><span class="preview-summary-value">${ctx.outputDir}</span></div>
      <div class="preview-summary-item"><span class="preview-summary-label">${tr.previewFormat}</span><span class="preview-summary-value">${ctx.buildFormat === 'icons.ts' ? tr.jsModuleTitle : tr.spriteTitle}</span></div>
      <div class="preview-summary-item" style="${ctx.buildFormat === 'icons.ts' ? '' : 'display:none'}"><span class="preview-summary-label">${tr.previewTag}</span><span class="preview-summary-value">&lt;${ctx.webComponentName}&gt;</span></div>
    </div>`;
  }

  private _buildFinishButton(isFullyConfigured: boolean, tr: Record<string, string>): string {
    return isFullyConfigured
      ? `<button class="btn-primary btn-finish" onclick="finishSetup()"><svg class="svg-icon" viewBox="0 0 24 24" style="fill: white; width: 20px; height: 20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>${tr.getStarted}</button>`
      : `<button class="btn-secondary" disabled>${tr.completeStep1}</button>`;
  }

  private _applyTemplateReplacements(opts: TemplateReplacementOptions): string {
    const { html, ctx, tr, languageOptions, step4Section, previewCode, previewGallery, previewSummary, finishButton } = opts;
    let result = this._applyHeaderReplacements(html, tr, languageOptions);
    result = this._applyStep0Replacements(result, ctx, tr);
    result = this._applyStep1Replacements(result, ctx, tr);
    result = this._applyStep2Replacements(result, ctx, tr);
    result = this._applyStep3Replacements(result, ctx, tr);
    result = this._applyFrameworkReplacements(result);
    result = this._applyAdvancedReplacements(result, ctx, tr, step4Section);
    result = this._applyPreviewReplacements({ html: result, ctx, tr, previewCode, previewGallery, previewSummary, finishButton });
    return result;
  }

  private _applyHeaderReplacements(html: string, tr: Record<string, string>, languageOptions: string): string {
    return html
      .replace(/\$\{headerIcons\}/g, tr.headerIcons).replace(/\$\{headerColors\}/g, tr.headerColors)
      .replace(/\$\{headerAnimations\}/g, tr.headerAnimations).replace(/\$\{headerSvgo\}/g, tr.headerSvgo)
      .replace(/\$\{languageOptions\}/g, languageOptions).replace(/\$\{languageLabel\}/g, tr.languageLabel)
      .replace(/\$\{appTitle\}/g, tr.appTitle);
  }

  private _applyStep0Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
    const frontendRootOptions = this._buildFrontendRootOptions(ctx);
    const showStep0 = ctx.suggestedFrontendRoots.length > 1;
    const step0Classes = [ctx.isFrontendConfigured ? 'completed-step' : '', !showStep0 ? 'hidden' : ''].filter(Boolean).join(' ');
    return html
      .replace(/\$\{step0Class\}/g, step0Classes)
      .replace(/\$\{step0NumberClass\}/g, ctx.isFrontendConfigured ? 'completed' : '')
      .replace(/\$\{step0Title\}/g, tr.step0Title || 'Directorio Frontend')
      .replace(/\$\{step0Summary\}/g, ctx.frontendRoot ? `<span class="step-summary">${ctx.frontendRoot || '.'}/</span>` : '')
      .replace(/\$\{step0Desc\}/g, tr.step0Desc || 'Selecciona el directorio del frontend si tu workspace tiene múltiples proyectos.')
      .replace(/\$\{frontendRootOptions\}/g, frontendRootOptions);
  }

  private _buildFrontendRootOptions(ctx: WebviewContext): string {
    const folderIcon = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    const rootLabel = t('welcome.rootFolder') || '. (root)';
    return ctx.suggestedFrontendRoots.map(dir => {
      const displayName = dir === '.' ? rootLabel : dir;
      const selected = ctx.frontendRoot === dir ? 'selected' : '';
      return `<div class="option ${selected}" onclick="setFrontendRoot('${dir}')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${displayName}</span>
            </div>`;
    }).join('\n            ');
  }

  private _applyStep1Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
    const sourceDirectoryOptions = this._buildSourceDirectoryOptions(ctx);
    return html
      .replace(/\$\{step1SourceClass\}/g, ctx.isSourceConfigured ? 'completed-step' : '')
      .replace(/\$\{step1SourceNumberClass\}/g, ctx.isSourceConfigured ? 'completed' : '')
      .replace(/\$\{step1SourceTitle\}/g, tr.step1SourceTitle)
      .replace(/\$\{step1SourceSummary\}/g, ctx.isSourceConfigured ? `<span class="step-summary">${ctx.sourceDir}</span>` : '')
      .replace(/\$\{step1SourceDesc\}/g, tr.step1SourceDesc).replace(/\$\{step1SourcePlaceholder\}/g, tr.step1SourcePlaceholder)
      .replace(/\$\{sourceDir\}/g, ctx.sourceDir)
      .replace(/\$\{sourceDirectoryOptions\}/g, sourceDirectoryOptions)
      .replace(/\$\{browse\}/g, tr.browse).replace(/\$\{step1Apply\}/g, tr.step1Apply);
  }

  private _applyStep2Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
    const outputDirectoryOptions = this._buildOutputDirectoryOptions(ctx);
    return html
      .replace(/\$\{step2Class\}/g, `${ctx.isOutputConfigured ? 'completed-step' : ''}`)
      .replace(/\$\{step2NumberClass\}/g, ctx.isOutputConfigured ? 'completed' : '')
      .replace(/\$\{step2Disabled\}/g, '').replace(/\$\{step2Title\}/g, tr.step2Title)
      .replace(/\$\{step2Summary\}/g, ctx.isOutputConfigured ? `<span class="step-summary">${ctx.outputDir}</span>` : '')
      .replace(/\$\{step2Desc\}/g, tr.step2Desc).replace(/\$\{step2Placeholder\}/g, tr.step2Placeholder)
      .replace(/\$\{outputDir\}/g, ctx.outputDir)
      .replace(/\$\{outputDirectoryOptions\}/g, outputDirectoryOptions);
  }

  private _buildSourceDirectoryOptions(ctx: WebviewContext): string {
    const folderIcon = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    return ctx.suggestedSourceDirs.map(dir => {
      const selected = ctx.sourceDir === dir ? 'selected' : '';
      return `<div class="option ${selected}" onclick="setSourceDirectory('${dir}')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${dir}</span>
            </div>`;
    }).join('\n            ');
  }

  private _buildOutputDirectoryOptions(ctx: WebviewContext): string {
    const folderIcon = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    return ctx.suggestedOutputDirs.map(dir => {
      const selected = ctx.outputDir === dir ? 'selected' : '';
      return `<div class="option ${selected}" onclick="setDirectory('${dir}')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${dir}</span>
            </div>`;
    }).join('\n            ');
  }

  private _applyStep3Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
    return html
      .replace(/\$\{step3Class\}/g, `${ctx.isBuildFormatConfigured ? 'completed-step' : ''}`)
      .replace(/\$\{step3NumberClass\}/g, ctx.isBuildFormatConfigured ? 'completed' : '')
      .replace(/\$\{step3Title\}/g, tr.step3Title)
      .replace(/\$\{formatSummary\}/g, ctx.buildFormat === 'icons.ts' ? tr.jsModuleTitle : ctx.buildFormat === 'sprite.svg' ? tr.spriteTitle : tr.selectFormat || 'Seleccionar...')
      .replace(/\$\{step3Desc\}/g, tr.step3Desc).replace(/\$\{step3Help\}/g, tr.step3Help)
      .replace(/\$\{jsModuleTitle\}/g, tr.jsModuleTitle).replace(/\$\{helpJsModule\}/g, tr.helpJsModule)
      .replace(/\$\{spriteTitle\}/g, tr.spriteTitle).replace(/\$\{helpSprite\}/g, tr.helpSprite)
      .replace(/\$\{helpTip\}/g, tr.helpTip)
      .replace(/\$\{jsModuleSelected\}/g, ctx.buildFormat === 'icons.ts' ? 'selected' : '')
      .replace(/\$\{recommended\}/g, tr.recommended).replace(/\$\{jsModuleDesc\}/g, tr.jsModuleDesc)
      .replace(/\$\{jsModulePro1\}/g, tr.jsModulePro1).replace(/\$\{jsModulePro2\}/g, tr.jsModulePro2)
      .replace(/\$\{spriteSelected\}/g, ctx.buildFormat === 'sprite.svg' ? 'selected' : '')
      .replace(/\$\{spriteDesc\}/g, tr.spriteDesc).replace(/\$\{spritePro1\}/g, tr.spritePro1).replace(/\$\{spritePro2\}/g, tr.spritePro2)
      .replace(/\$\{frameworkLabel\}/g, tr.frameworkLabel);
  }

  private _applyFrameworkReplacements(html: string): string {
    return html
      .replace(/\$\{frameworkHtmlSelected\}/g, this._sessionConfig.framework === 'html' ? 'selected' : '')
      .replace(/\$\{frameworkReactSelected\}/g, this._sessionConfig.framework === 'react' ? 'selected' : '')
      .replace(/\$\{frameworkVueSelected\}/g, this._sessionConfig.framework === 'vue' ? 'selected' : '')
      .replace(/\$\{frameworkAngularSelected\}/g, this._sessionConfig.framework === 'angular' ? 'selected' : '')
      .replace(/\$\{frameworkSvelteSelected\}/g, this._sessionConfig.framework === 'svelte' ? 'selected' : '')
      .replace(/\$\{frameworkAstroSelected\}/g, this._sessionConfig.framework === 'astro' ? 'selected' : '');
  }

  private _applyAdvancedReplacements(html: string, ctx: WebviewContext, tr: Record<string, string>, step4Section: string): string {
    return html
      .replace(/\$\{step4Section\}/g, step4Section)
      .replace(/\$\{advancedTitle\}/g, tr.advancedTitle).replace(/\$\{scanOnStartupLabel\}/g, tr.scanOnStartupLabel)
      .replace(/\$\{defaultIconSizeLabel\}/g, tr.defaultIconSizeLabel).replace(/\$\{previewBackgroundLabel\}/g, tr.previewBackgroundLabel)
      .replace(/\$\{scanOnStartupChecked\}/g, ctx.scanOnStartup ? 'checked' : '')
      .replace(/\$\{defaultIconSize\}/g, String(ctx.defaultIconSize))
      .replace(/\$\{bgTransparent\}/g, ctx.previewBackground === 'transparent' ? 'selected' : '')
      .replace(/\$\{bgLight\}/g, ctx.previewBackground === 'light' ? 'selected' : '')
      .replace(/\$\{bgDark\}/g, ctx.previewBackground === 'dark' ? 'selected' : '')
      .replace(/\$\{bgCheckered\}/g, ctx.previewBackground === 'checkered' ? 'selected' : '')
      .replace(/\$\{allSettings\}/g, tr.allSettings);
  }

  private _applyPreviewReplacements(opts: PreviewReplacementOptions): string {
    const { html, ctx, tr, previewCode, previewGallery, previewSummary, finishButton } = opts;
    return html
      .replace(/\$\{previewTitle\}/g, tr.previewTitle)
      .replace(/\$\{previewFileName\}/g, ctx.buildFormat === 'icons.ts' ? 'icons.js' : ctx.buildFormat === 'sprite.svg' ? 'sprite.svg' : '...')
      .replace(/\$\{previewCode\}/g, previewCode).replace(/\$\{previewSummary\}/g, previewSummary)
      .replace(/\$\{previewResultLabel\}/g, tr.previewResultLabel).replace(/\$\{previewGallery\}/g, previewGallery)
      .replace(/\$\{workflowSource\}/g, tr.workflowSource).replace(/\$\{workflowBuild\}/g, tr.workflowBuild)
      .replace(/\$\{workflowOutput\}/g, tr.workflowOutput).replace(/\$\{sourceDirDisplay\}/g, ctx.sourceDir || 'src/icons/')
      .replace(/\$\{comingSoon\}/g, tr.comingSoon).replace(/\$\{settings\}/g, tr.settings)
      .replace(/\$\{skip\}/g, tr.skip).replace(/\$\{finishButton\}/g, finishButton);
  }
}
