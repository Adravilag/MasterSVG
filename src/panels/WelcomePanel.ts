/**
 * WelcomePanel - Setup wizard panel for MasterSVG
 *
 * Provides a step-by-step wizard for initial extension configuration.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t, i18n, SupportedLocale } from '../i18n';
import { FrameworkDetectorService } from '../services/framework';
import { FrameworkType } from '../services/types';
import {
  SessionConfig,
  WebviewContext,
  WebviewMessage,
  createDefaultSessionConfig,
  getWelcomeI18n,
  buildLanguageOptions,
  getStep4Title,
  getStep4Description,
  getStep4Placeholder,
  getFrameworkPreview,
  applyTemplateReplacements,
  buildStep4Section,
  buildPreviewGallery,
  buildPreviewSummary,
  buildFinishButton,
  generateEmptySprite,
  generateEmptyIconsModule,
  createMsignoreFile,
  ensureOutputDirectory,
  ensureVscodeDirectory,
} from './helpers';

/**
 * WelcomePanel - Manages the welcome wizard webview
 */
export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  public static readonly viewType = 'masterSVG.welcomePanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  // Session state (not persisted until finishSetup)
  private _sessionConfig: SessionConfig;
  private _frameworkAutoDetected = false;
  private _sourceDirUserSelected = false;
  private _outputDirUserSelected = false;
  private _buildFormatUserSelected = false;

  /**
   * Creates or shows the WelcomePanel
   */
  public static createOrShow(extensionUri: vscode.Uri): WelcomePanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal(column);
      return WelcomePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      WelcomePanel.viewType,
      t('welcome.title'),
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'resources'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'src'),
        ],
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
    return WelcomePanel.currentPanel;
  }

  /**
   * Checks if extension is configured
   */
  public static isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('masterSVG');
    return !!(
      config.get<string[]>('svgFolders')?.length ||
      config.get<string>('outputDirectory')
    );
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._sessionConfig = this._initializeSessionConfig();
    this._initializeFrameworkDetection();
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._setupMessageHandler();
    this._setupEventListeners();
  }

  /**
   * Initializes session config from workspace settings
   */
  private _initializeSessionConfig(): SessionConfig {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const defaultConfig = createDefaultSessionConfig();

    return {
      ...defaultConfig,
      svgFolders: config.get<string[]>('svgFolders', []),
      outputDirectory: config.get<string>('outputDirectory', ''),
      framework: config.get<string>('framework', 'html'),
      buildFormat: config.get<string>('buildFormat', ''),
      webComponentName: config.get<string>('webComponentName', ''),
      scanOnStartup: config.get<boolean>('scanOnStartup', true),
      defaultIconSize: config.get<number>('defaultIconSize', 24),
      previewBackground: config.get<string>('previewBackground', 'transparent'),
      autoGenerateLicenses: config.get<boolean>('autoGenerateLicenses', false),
      separateOutputStructure: config.get<boolean>('separateOutputStructure', false),
    };
  }

  /**
   * Sets up message handler for webview communication
   */
  private _setupMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(
      async message => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  /**
   * Handles messages from webview
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    const handlers: Record<string, () => Promise<void>> = {
      setFrontendRoot: async () => { if (message.directory !== undefined) await this._setFrontendRoot(message.directory); },
      chooseFrontendFolder: async () => this._chooseFrontendFolder(),
      setSourceDirectory: async () => { if (message.directory) await this._setSourceDirectory(message.directory); },
      chooseSourceFolder: async () => this._chooseSourceFolder(),
      setOutputDirectory: async () => { if (message.directory) await this._setOutputDirectory(message.directory); },
      chooseFolder: async () => this._chooseFolder(),
      setBuildFormat: async () => { if (message.format) await this._setBuildFormat(message.format); },
      setFramework: async () => { if (message.framework) await this._setFramework(message.framework); },
      setWebComponentName: async () => { if (message.name) await this._setWebComponentName(message.name); },
      setLanguage: async () => { if (message.language) await this._setLanguage(message.language); },
      setScanOnStartup: async () => this._setScanOnStartup(message.value as boolean),
      setDefaultIconSize: async () => this._setDefaultIconSize(message.value as number),
      setPreviewBackground: async () => this._setPreviewBackground(message.value as string),
      setCreateMsignore: async () => this._setCreateMsignore(message.value as boolean),
      setSeparateOutputStructure: async () => this._setSeparateOutputStructure(message.value as boolean),
      openSettings: async () => { await vscode.commands.executeCommand('workbench.action.openSettings', 'masterSVG'); },
      searchIcons: async () => { await vscode.commands.executeCommand('masterSVG.searchIcons'); this._panel.dispose(); },
      close: async () => { this._panel.dispose(); },
      finishSetup: async () => this._finishSetup(),
    };
    const handler = handlers[message.command];
    if (handler) await handler();
  }

  /**
   * Sets up event listeners for locale and config changes
   */
  private _setupEventListeners(): void {
    this._disposables.push(
      i18n.onDidChangeLocale(() => this._update()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('masterSVG')) this._update();
      })
    );
  }

  // #region Directory setters

  private async _setFrontendRoot(directory: string): Promise<void> {
    this._sessionConfig.frontendRoot = directory;
    this._update();
  }

  private async _chooseFrontendFolder(): Promise<void> {
    const relativePath = await this._chooseFolderDialog(t('welcome.frontendRoot'));
    if (relativePath) await this._setFrontendRoot(relativePath);
  }

  private async _setSourceDirectory(directory: string): Promise<void> {
    const currentFolders = this._sessionConfig.svgFolders;
    this._sessionConfig.svgFolders = [directory, ...currentFolders.filter(f => f !== directory)];
    this._sourceDirUserSelected = true;
    this._update();
  }

  private async _chooseSourceFolder(): Promise<void> {
    const relativePath = await this._chooseFolderDialog(t('welcome.sourceDirectory'));
    if (relativePath) await this._setSourceDirectory(relativePath);
  }

  private async _setOutputDirectory(directory: string): Promise<void> {
    this._sessionConfig.outputDirectory = directory;
    this._outputDirUserSelected = true;

    // Create folder if it doesn't exist (immediate for UX)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const fullPath = path.join(workspaceFolder.uri.fsPath, directory);
      ensureOutputDirectory(fullPath);
    }

    this._update();
  }

  private async _chooseFolder(): Promise<void> {
    const relativePath = await this._chooseFolderDialog(t('welcome.selectFolder'));
    if (relativePath) await this._setOutputDirectory(relativePath);
  }

  /**
   * Shows folder picker dialog and returns relative path
   */
  private async _chooseFolderDialog(openLabel: string): Promise<string | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolder.uri,
      openLabel,
    });

    if (folderUri && folderUri.length > 0) {
      const fullPath = folderUri[0].fsPath;
      const workspacePath = workspaceFolder.uri.fsPath;
      return path.relative(workspacePath, fullPath).replace(/\\/g, '/');
    }

    return undefined;
  }

  // #endregion

  // #region Configuration setters

  private async _setBuildFormat(format: string): Promise<void> {
    this._sessionConfig.buildFormat = format;
    this._buildFormatUserSelected = true;
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

    // Ensure webComponentName has a valid default
    if (!this._sessionConfig.webComponentName) {
      this._sessionConfig.webComponentName = getStep4Placeholder(this._sessionConfig.framework);
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
    this._frameworkAutoDetected = false;
    this._sessionConfig.framework = framework;

    // Auto-fill component name based on framework
    const currentName = this._sessionConfig.webComponentName;
    const defaultNames = ['svg-icon', 'app-icon', 'Icon', ''];
    if (!currentName || defaultNames.includes(currentName)) {
      this._sessionConfig.webComponentName = getStep4Placeholder(framework);
    }

    this._update();
  }

  private async _setWebComponentName(name: string): Promise<void> {
    this._sessionConfig.webComponentName = name;
    this._update();
  }

  private async _setLanguage(language: string): Promise<void> {
    await i18n.setLocale(language as SupportedLocale);
  }

  private async _setScanOnStartup(value: boolean): Promise<void> {
    this._sessionConfig.scanOnStartup = value;
  }

  private async _setDefaultIconSize(value: number): Promise<void> {
    this._sessionConfig.defaultIconSize = value;
  }

  private async _setPreviewBackground(value: string): Promise<void> {
    this._sessionConfig.previewBackground = value;
  }

  private async _setCreateMsignore(value: boolean): Promise<void> {
    this._sessionConfig.createMsignore = value;
  }

  private async _setSeparateOutputStructure(value: boolean): Promise<void> {
    this._sessionConfig.separateOutputStructure = value;
    await this._update();
  }

  // #endregion

  // #region Validation helpers

  private _requiresHyphen(framework: string): boolean {
    return framework === 'html' || framework === 'angular';
  }

  private _validateComponentName(name: string, framework: string): boolean {
    if (!name || name.trim() === '') return false;

    if (this._requiresHyphen(framework)) {
      return name.includes('-');
    }

    return name.length > 0;
  }

  // #endregion

  // #region Finish setup

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
    ensureOutputDirectory(fullPath);

    try {
      await this._persistSessionConfig();
      await this._generateOutputFiles(fullPath, buildFormat, webComponentName, outputDir);

      if (this._sessionConfig.createMsignore) {
        createMsignoreFile(workspaceFolder.uri.fsPath);
      }

      // Wait for VS Code configuration to apply
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
      ['separateOutputStructure', this._sessionConfig.separateOutputStructure],
    ];

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      ensureVscodeDirectory(workspaceFolder.uri.fsPath);
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
    fullPath: string,
    buildFormat: string,
    webComponentName: string,
    outputDir: string
  ): Promise<void> {
    if (buildFormat === 'sprite.svg') {
      generateEmptySprite(fullPath);
      vscode.window.showInformationMessage(
        `${t('welcome.setupComplete')} ${t('welcome.spriteCreated', { path: outputDir })}`
      );
    } else {
      const framework = this._sessionConfig.framework as FrameworkType;
      const separateStructure = this._sessionConfig.separateOutputStructure;
      generateEmptyIconsModule(fullPath, webComponentName, framework, separateStructure);
      vscode.window.showInformationMessage(
        `${t('welcome.setupComplete')} ${t('welcome.filesCreated', { path: outputDir })}`
      );
    }
  }

  // #endregion

  // #region Webview HTML generation

  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const ctx = this._buildWebviewContext();
    const tr = getWelcomeI18n(this._frameworkAutoDetected);

    // Update step 4 labels based on framework
    tr.step4Title = getStep4Title(ctx.framework);
    tr.step4Desc = getStep4Description(ctx.framework);
    tr.step4Placeholder = getStep4Placeholder(ctx.framework);

    const templates = this._loadTemplates();
    const languageOptions = buildLanguageOptions();
    const step4Section = buildStep4Section(ctx, tr);
    const previewCode = getFrameworkPreview({
      buildFormat: ctx.buildFormat,
      framework: ctx.framework,
      outputDirDisplay: ctx.outputDirDisplay,
      webComponentDisplay: ctx.webComponentDisplay,
      tr,
    });
    const previewGallery = buildPreviewGallery();
    const previewSummary = buildPreviewSummary(ctx, tr);
    const finishButton = buildFinishButton(ctx.isFullyConfigured, tr);

    const htmlContent = applyTemplateReplacements({
      html: templates.html,
      ctx,
      tr,
      languageOptions,
      step4Section,
      previewCode,
      previewGallery,
      previewSummary,
      finishButton,
    });

    const jsContent = templates.js
      .replace(/\$\{helpOpenText\}/g, `${tr.step3Help} ▴`)
      .replace(/\$\{helpClosedText\}/g, `${tr.step3Help} ▾`);

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

    const frameworkDetector = FrameworkDetectorService.getInstance();
    const frontendRoot = this._sessionConfig.frontendRoot || frameworkDetector.detectFrontendRoot();
    const suggestedFrontendRoots = frameworkDetector.getSuggestedFrontendRoots();
    const suggestedSourceDirs = frameworkDetector.getSuggestedSourceDirs(frontendRoot);
    const suggestedOutputDirs = frameworkDetector.getSuggestedOutputDirs(frontendRoot);

    const isFrontendConfigured = !!frontendRoot || suggestedFrontendRoots.length === 0;
    const isSourceConfigured = this._sourceDirUserSelected && !!sourceDir;
    const isOutputConfigured = this._outputDirUserSelected && !!outputDir;
    const isBuildFormatConfigured = this._buildFormatUserSelected;
    const isWebComponentConfigured = this._validateComponentName(webComponentName, framework);
    const isFullyConfigured =
      isSourceConfigured && isOutputConfigured && isBuildFormatConfigured && isWebComponentConfigured;

    return {
      sourceDir,
      outputDir,
      buildFormat,
      framework,
      webComponentName,
      scanOnStartup: this._sessionConfig.scanOnStartup,
      defaultIconSize: this._sessionConfig.defaultIconSize,
      previewBackground: this._sessionConfig.previewBackground,
      isFrontendConfigured,
      isSourceConfigured,
      isOutputConfigured,
      isBuildFormatConfigured,
      isWebComponentConfigured,
      isFullyConfigured,
      outputDirDisplay: outputDir || suggestedOutputDirs[2] || 'public/icons',
      webComponentDisplay: webComponentName || 'svg-icon',
      frontendRoot,
      suggestedFrontendRoots,
      suggestedSourceDirs,
      suggestedOutputDirs,
      separateOutputStructure: this._sessionConfig.separateOutputStructure,
    };
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

  // #endregion

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
}
