import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateWebComponent } from '../utils/iconsFileManager';
import { i18n, t, SUPPORTED_LOCALES, SupportedLocale } from '../i18n';

// Template cache
let welcomeCss: string | null = null;
let welcomeJs: string | null = null;
let welcomeHtml: string | null = null;

function loadTemplates(): { css: string; js: string; html: string } {
  if (!welcomeCss || !welcomeJs || !welcomeHtml) {
    const templatesDir = path.join(__dirname, '..', 'templates', 'welcome');
    welcomeCss = fs.readFileSync(path.join(templatesDir, 'Welcome.css'), 'utf-8');
    welcomeJs = fs.readFileSync(path.join(templatesDir, 'Welcome.js'), 'utf-8');
    welcomeHtml = fs.readFileSync(path.join(templatesDir, 'Welcome.html'), 'utf-8');
  }
  return { css: welcomeCss, js: welcomeJs, html: welcomeHtml };
}

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  public static readonly viewType = 'iconManager.welcome';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  
  // Temporary session state - only persisted on finishSetup
  private _sessionConfig: {
    svgFolders: string[];
    outputDirectory: string;
    buildFormat: string;
    webComponentName: string;
    svgoOptimize: boolean;
    scanOnStartup: boolean;
    defaultIconSize: number;
    previewBackground: string;
  };

  public static createOrShow(extensionUri: vscode.Uri): void {
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
        localResourceRoots: [extensionUri]
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }

  public static isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('iconManager');
    const outputDir = config.get<string>('outputDirectory', '');
    return !!outputDir;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Initialize session config with current values (but don't save until finishSetup)
    const config = vscode.workspace.getConfiguration('iconManager');
    this._sessionConfig = {
      svgFolders: config.get<string[]>('svgFolders', []),
      outputDirectory: config.get<string>('outputDirectory', ''),
      buildFormat: config.get<string>('buildFormat', ''),
      webComponentName: config.get<string>('webComponentName', ''),
      svgoOptimize: config.get<boolean>('svgoOptimize', true),
      scanOnStartup: config.get<boolean>('scanOnStartup', true),
      defaultIconSize: config.get<number>('defaultIconSize', 24),
      previewBackground: config.get<string>('previewBackground', 'transparent')
    };

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'setSourceDirectory':
            await this._setSourceDirectory(message.directory);
            break;
          case 'chooseSourceFolder':
            await this._chooseSourceFolder();
            break;
          case 'setOutputDirectory':
            await this._setOutputDirectory(message.directory);
            break;
          case 'chooseFolder':
            await this._chooseFolder();
            break;
          case 'setBuildFormat':
            await this._setBuildFormat(message.format);
            break;
          case 'setWebComponentName':
            await this._setWebComponentName(message.name);
            break;
          case 'setLanguage':
            await this._setLanguage(message.language);
            break;
          case 'setSvgoOptimize':
            await this._setSvgoOptimize(message.value);
            break;
          case 'setScanOnStartup':
            await this._setScanOnStartup(message.value);
            break;
          case 'setDefaultIconSize':
            await this._setDefaultIconSize(message.value);
            break;
          case 'setPreviewBackground':
            await this._setPreviewBackground(message.value);
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'iconManager');
            break;
          case 'searchIcons':
            vscode.commands.executeCommand('iconManager.searchIcons');
            this._panel.dispose();
            break;
          case 'close':
            this._panel.dispose();
            break;
          case 'finishSetup':
            await this._finishSetup();
            break;
        }
      },
      null,
      this._disposables
    );

    // Listen for locale changes
    this._disposables.push(
      i18n.onDidChangeLocale(() => {
        this._update();
      })
    );

    // Listen for configuration changes to ensure UI stays in sync
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('iconManager')) {
          this._update();
        }
      })
    );
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
      openLabel: t('welcome.sourceDirectory')
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
      openLabel: t('welcome.selectFolder')
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

  private async _setWebComponentName(name: string): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.webComponentName = name;
    this._update();
  }

  private async _setLanguage(language: SupportedLocale): Promise<void> {
    await i18n.setLocale(language);
    // Update is triggered by onDidChangeLocale listener
  }

  private async _setSvgoOptimize(value: boolean): Promise<void> {
    // Update session config only - will be persisted on finishSetup
    this._sessionConfig.svgoOptimize = value;
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
    // Use session config values (not yet persisted)
    const outputDir = this._sessionConfig.outputDirectory;
    const buildFormat = this._sessionConfig.buildFormat;
    const webComponentName = this._sessionConfig.webComponentName;
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || !outputDir) {
      vscode.window.showWarningMessage(`⚠️ ${t('welcome.configureOutputFirst')}`);
      return;
    }

    const fullPath = path.join(workspaceFolder.uri.fsPath, outputDir);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    try {
      // NOW persist all session config to workspace settings
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', this._sessionConfig.svgFolders, vscode.ConfigurationTarget.Workspace);
      await config.update('outputDirectory', this._sessionConfig.outputDirectory, vscode.ConfigurationTarget.Workspace);
      await config.update('buildFormat', this._sessionConfig.buildFormat, vscode.ConfigurationTarget.Workspace);
      await config.update('webComponentName', this._sessionConfig.webComponentName, vscode.ConfigurationTarget.Workspace);
      await config.update('svgoOptimize', this._sessionConfig.svgoOptimize, vscode.ConfigurationTarget.Workspace);
      await config.update('scanOnStartup', this._sessionConfig.scanOnStartup, vscode.ConfigurationTarget.Workspace);
      await config.update('defaultIconSize', this._sessionConfig.defaultIconSize, vscode.ConfigurationTarget.Workspace);
      await config.update('previewBackground', this._sessionConfig.previewBackground, vscode.ConfigurationTarget.Workspace);

      if (buildFormat === 'sprite.svg') {
        // Generate empty sprite.svg
        await this._generateEmptySprite(fullPath);
        vscode.window.showInformationMessage(
          `${t('welcome.setupComplete')} ${t('welcome.spriteCreated', { path: outputDir })}`
        );
      } else {
        // Generate icons.js, icon.js, icons.d.ts
        await this._generateEmptyIconsModule(fullPath, webComponentName);
        vscode.window.showInformationMessage(
          `${t('welcome.setupComplete')} ${t('welcome.filesCreated', { path: outputDir })}`
        );
      }
      
      // Refresh views to show the new files
      vscode.commands.executeCommand('iconManager.refreshIcons');
      
    } catch (error: any) {
      vscode.window.showErrorMessage(`❌ ${t('welcome.errorCreatingFiles')}: ${error.message}`);
    }
    
    this._panel.dispose();
  }

  /**
   * Generate empty sprite.svg file
   */
  private async _generateEmptySprite(outputPath: string): Promise<void> {
    const spritePath = path.join(outputPath, 'sprite.svg');
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Auto-generated by Icon Studio -->
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
  private async _generateEmptyIconsModule(outputPath: string, webComponentName: string): Promise<void> {
    // 1. Generate empty icons.js
    const iconsPath = path.join(outputPath, 'icons.js');
    const iconsContent = `// Auto-generated by Icon Studio
// Add icons using "Add to Icon Collection" or drag SVG files here

// Icon exports will be added here
// Example: export const arrowRight = { name: 'arrow-right', body: '...', viewBox: '0 0 24 24' };

// Collection of all icons
export const icons = {
  // Icons will be added here
};
`;
    fs.writeFileSync(iconsPath, iconsContent, 'utf-8');

    // 2. Generate icon.js (web component)
    const webComponent = await generateWebComponent(outputPath);
    fs.writeFileSync(webComponent.path, webComponent.content, 'utf-8');

    // 3. Generate icons.d.ts (type definitions)
    const typesPath = path.join(outputPath, 'icons.d.ts');
    const typesContent = `// Auto-generated TypeScript definitions by Icon Studio
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

  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getI18n(): Record<string, string> {
    // Use the new i18n service for translations
    return {
      // Language selector
      languageLabel: t('welcome.language'),
      languageDescription: t('welcome.languageDescription'),
      
      // Header
      appTitle: t('extension.appTitle'),
      headerIcons: '200k+ ' + t('treeView.files'),
      headerColors: t('editor.color') + ' ' + t('features.iconEditor').split(' ')[0],
      headerAnimations: t('animation.title'),
      headerSvgo: 'SVGO',
      
      // Step 1 - Source Directory
      step1SourceTitle: t('welcome.sourceDirectory'),
      step1SourceDesc: t('welcome.sourceDirectoryDescription'),
      step1SourcePlaceholder: t('welcome.sourceDirectoryPlaceholder'),
      step1Apply: t('editor.apply'),
      browse: t('welcome.browse'),
      
      // Step 2 - Output Directory
      step2Title: t('welcome.outputDirectory'),
      step2Desc: t('welcome.outputDirectoryDescription'),
      step2Placeholder: t('welcome.outputDirectoryPlaceholder'),
      
      // Step 3 - Build Format
      step3Title: t('settings.outputFormat'),
      step3Desc: t('features.buildSystemDescription'),
      step3Help: '?',
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
      
      // Help panel
      helpJsModule: t('features.codeIntegrationDescription'),
      helpSprite: t('features.buildSystemDescription'),
      helpTip: t('welcome.quickStartDescription'),
      
      // Step 4 - Web Component Name
      step4Title: t('welcome.webComponentName'),
      step4Desc: t('welcome.webComponentDesc'),
      
      // Advanced Options
      advancedTitle: t('welcome.advancedOptions'),
      svgoOptimizeLabel: t('welcome.svgoOptimize'),
      scanOnStartupLabel: t('welcome.scanOnStartup'),
      defaultIconSizeLabel: t('welcome.defaultIconSize'),
      previewBackgroundLabel: t('welcome.previewBackground'),
      allSettings: t('welcome.allSettings'),
      
      // Preview
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
      
      // Workflow
      workflowSource: t('welcome.workflowSource'),
      workflowBuild: t('welcome.workflowBuild'),
      workflowOutput: t('welcome.workflowOutput'),
      
      // Actions
      settings: t('settings.title'),
      skip: t('messages.cancel'),
      getStarted: t('welcome.getStarted'),
      completeStep1: t('welcome.save')
    };
  }

  private _getHtmlForWebview(): string {
    const templates = loadTemplates();
    // Use session config (in-memory) instead of persisted config
    const svgFolders = this._sessionConfig.svgFolders;
    const sourceDir = svgFolders.length > 0 ? svgFolders[0] : '';
    const outputDir = this._sessionConfig.outputDirectory;
    const buildFormat = this._sessionConfig.buildFormat;
    const webComponentName = this._sessionConfig.webComponentName;
    const svgoOptimize = this._sessionConfig.svgoOptimize;
    const scanOnStartup = this._sessionConfig.scanOnStartup;
    const defaultIconSize = this._sessionConfig.defaultIconSize;
    const previewBackground = this._sessionConfig.previewBackground;
    const isSourceConfigured = !!sourceDir;
    const isOutputConfigured = !!outputDir;
    const isBuildFormatConfigured = !!buildFormat;
    const isWebComponentConfigured = webComponentName && webComponentName.includes('-');
    
    // Progressive unlock logic: each step unlocks when the previous is completed
    const isStep1Complete = isSourceConfigured;
    const isStep2Unlocked = isStep1Complete;
    const isStep2Complete = isStep2Unlocked && isOutputConfigured;
    const isStep3Unlocked = isStep2Complete;
    const isStep3Complete = isStep3Unlocked && isBuildFormatConfigured;
    const isStep4Unlocked = isStep3Complete;
    const isStep4Complete = isStep4Unlocked && isWebComponentConfigured;
    
    // All 4 steps must be complete for the button to be enabled
    const isFullyConfigured = isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
    
    // Detect framework from package.json
    let detectedFramework: 'react' | 'vue' | 'svelte' | 'angular' | 'astro' | 'html' = 'html';
    if (vscode.workspace.workspaceFolders) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const packageJsonPath = path.join(workspaceRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          if (deps['react'] || deps['next'] || deps['gatsby']) {
            detectedFramework = 'react';
          } else if (deps['vue'] || deps['nuxt']) {
            detectedFramework = 'vue';
          } else if (deps['svelte'] || deps['@sveltejs/kit']) {
            detectedFramework = 'svelte';
          } else if (deps['@angular/core']) {
            detectedFramework = 'angular';
          } else if (deps['astro']) {
            detectedFramework = 'astro';
          }
        } catch { /* ignore */ }
      }
    }

    // Check if icons have been built (for visual feedback, not for unlock logic)
    let hasBuiltIcons = false;
    if (isStep2Complete && vscode.workspace.workspaceFolders) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const outputFile = buildFormat === 'icons.ts' 
        ? path.join(workspaceRoot, outputDir, 'icons.js')
        : path.join(workspaceRoot, outputDir, 'sprite.svg');
      hasBuiltIcons = fs.existsSync(outputFile);
    }
    
    const tr = this._getI18n();
    
    // Build language selector options
    const currentLocale = i18n.getConfiguredLocale();
    const languageOptions = SUPPORTED_LOCALES.map(locale => {
      const selected = locale.code === currentLocale ? 'selected' : '';
      const label = locale.code === 'auto' 
        ? `${locale.flag} ${t('settings.languageAuto')}`
        : `${locale.flag} ${locale.nativeName}`;
      return `<option value="${locale.code}" ${selected}>${label}</option>`;
    }).join('\n          ');

    // Build dynamic sections
    const step4DisabledClass = isStep4Unlocked ? '' : 'step-disabled';
    const step4Section = buildFormat === 'icons.ts' ? `
      <div class="step ${step4DisabledClass}">
        <div class="step-header">
          <div class="step-number${isStep4Complete ? ' completed' : ''}"><span>4</span></div>
          <div class="step-title">${tr.step4Title}</div>
          ${isStep4Complete ? `<span class="step-summary">&lt;${webComponentName}&gt;</span>` : ''}
        </div>
        <div class="step-content">
          <p class="step-description">${tr.step4Desc}</p>
          <div class="input-group">
            <input type="text" id="webComponentName" value="${webComponentName}" placeholder="sg-icon" onkeypress="handleTagKeypress(event)" ${isStep4Unlocked ? '' : 'disabled'} />
            <button class="btn-secondary" onclick="applyWebComponentName()" ${isStep4Unlocked ? '' : 'disabled'}>${tr.step1Apply}</button>
          </div>
        </div>
      </div>
    ` : '';

    const outputDirDisplay = outputDir || 'public/icons';
    const webComponentDisplay = webComponentName || 'sg-icon';
    
    // Generate framework-specific preview code
    const getFrameworkPreview = (): string => {
      if (!buildFormat) {
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
      
      if (buildFormat === 'sprite.svg') {
        return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewRef} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;svg</span> <span class="attr">width</span>=<span class="value">"24"</span> <span class="attr">height</span>=<span class="value">"24"</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">3</span>  <span class="tag">&lt;use</span> <span class="attr">href</span>=<span class="value">"${outputDirDisplay}/sprite.svg#home"</span> <span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">4</span><span class="tag">&lt;/svg&gt;</span></div>
</div>`;
      }
      
      // icons.ts format - show framework-specific code
      const frameworkBadge = detectedFramework !== 'html' 
        ? `<div class="framework-badge">${detectedFramework.charAt(0).toUpperCase() + detectedFramework.slice(1)}</div>` 
        : '';
      
      switch (detectedFramework) {
        case 'react':
          return `${frameworkBadge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> <span class="value">'${outputDirDisplay}/icons.js'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="keyword">function</span> <span class="func">App</span>() {</div>
<div class="code-line"><span class="line-num">6</span>  <span class="keyword">return</span> <span class="tag">&lt;${webComponentDisplay}</span> <span class="attr">name</span>=<span class="value">"home"</span> <span class="tag">/&gt;</span>;</div>
<div class="code-line"><span class="line-num">7</span>}</div>
</div>`;
        
        case 'vue':
          return `${frameworkBadge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script</span> <span class="attr">setup</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> <span class="value">'${outputDirDisplay}/icons.js'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;template&gt;</span></div>
<div class="code-line"><span class="line-num">6</span>  <span class="tag">&lt;${webComponentDisplay}</span> <span class="attr">name</span>=<span class="value">"home"</span> <span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;/template&gt;</span></div>
</div>`;
        
        case 'svelte':
          return `${frameworkBadge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script&gt;</span></div>
<div class="code-line"><span class="line-num">2</span>  <span class="keyword">import</span> <span class="value">'${outputDirDisplay}/icons.js'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${webComponentDisplay}</span> <span class="attr">name</span>=<span class="value">"home"</span> <span class="tag">/&gt;</span></div>
</div>`;
        
        case 'angular':
          return `${frameworkBadge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// main.ts</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> <span class="value">'${outputDirDisplay}/icons.js'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">&lt;!-- template.html --&gt;</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${webComponentDisplay}</span> <span class="attr">name</span>=<span class="value">"home"</span> <span class="tag">/&gt;</span></div>
</div>`;
        
        case 'astro':
          return `${frameworkBadge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> <span class="value">'${outputDirDisplay}/icons.js'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${webComponentDisplay}</span> <span class="attr">name</span>=<span class="value">"home"</span> <span class="tag">/&gt;</span></div>
</div>`;
        
        default: // html
          return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewImport} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;script </span><span class="attr">src</span>=<span class="value">"${outputDirDisplay}/icons.js"</span><span class="tag">&gt;&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">&lt;!-- ${tr.previewUse} --&gt;</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${webComponentDisplay} </span><span class="attr">name</span>=<span class="value">"home"</span><span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${webComponentDisplay} </span><span class="attr">name</span>=<span class="value">"heart"</span><span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${webComponentDisplay} </span><span class="attr">name</span>=<span class="value">"settings"</span><span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${webComponentDisplay} </span><span class="attr">name</span>=<span class="value">"check"</span><span class="tag">/&gt;</span></div>
</div>`;
      }
    };
    
    const previewCode = getFrameworkPreview();

    // Gallery: always show icons as visual example
    const previewGallery = `
          <div class="preview-icons-gallery">
            <div class="preview-icon-item">
              <div class="preview-icon-box small">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <span>home</span>
            </div>
            <div class="preview-icon-item">
              <div class="preview-icon-box small">
                <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </div>
              <span>heart</span>
            </div>
            <div class="preview-icon-item">
              <div class="preview-icon-box small">
                <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              </div>
              <span>settings</span>
            </div>
            <div class="preview-icon-item">
              <div class="preview-icon-box small">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <span>check</span>
            </div>
          </div>
    `;

    const previewSummary = isFullyConfigured ? `
      <div class="preview-summary">
        <div class="preview-summary-item">
          <span class="preview-summary-label">${tr.previewOutput}</span>
          <span class="preview-summary-value">${outputDir}</span>
        </div>
        <div class="preview-summary-item">
          <span class="preview-summary-label">${tr.previewFormat}</span>
          <span class="preview-summary-value">${buildFormat === 'icons.ts' ? tr.jsModuleTitle : tr.spriteTitle}</span>
        </div>
        <div class="preview-summary-item" style="${buildFormat === 'icons.ts' ? '' : 'display:none'}">
          <span class="preview-summary-label">${tr.previewTag}</span>
          <span class="preview-summary-value">&lt;${webComponentName}&gt;</span>
        </div>
      </div>
    ` : '';

    const finishButton = isFullyConfigured 
      ? `<button class="btn-primary btn-finish" onclick="finishSetup()">
          <svg class="svg-icon" viewBox="0 0 24 24" style="fill: white; width: 20px; height: 20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          ${tr.getStarted}
        </button>`
      : `<button class="btn-secondary" disabled>${tr.completeStep1}</button>`;

    // Replace placeholders in HTML template
    const htmlContent = templates.html
      // Header
      .replace(/\$\{headerIcons\}/g, tr.headerIcons)
      .replace(/\$\{headerColors\}/g, tr.headerColors)
      .replace(/\$\{headerAnimations\}/g, tr.headerAnimations)
      .replace(/\$\{headerSvgo\}/g, tr.headerSvgo)
      .replace(/\$\{languageOptions\}/g, languageOptions)
      .replace(/\$\{languageLabel\}/g, tr.languageLabel)
      .replace(/\$\{appTitle\}/g, tr.appTitle)
      // Step 1 - Source Directory
      .replace(/\$\{step1SourceClass\}/g, isSourceConfigured ? 'completed-step' : '')
      .replace(/\$\{step1SourceNumberClass\}/g, isSourceConfigured ? 'completed' : '')
      .replace(/\$\{step1SourceTitle\}/g, tr.step1SourceTitle)
      .replace(/\$\{step1SourceSummary\}/g, isSourceConfigured ? `<span class="step-summary">${sourceDir}</span>` : '')
      .replace(/\$\{step1SourceDesc\}/g, tr.step1SourceDesc)
      .replace(/\$\{step1SourcePlaceholder\}/g, tr.step1SourcePlaceholder)
      .replace(/\$\{sourceDir\}/g, sourceDir)
      .replace(/\$\{srcAssetsSvgSelected\}/g, sourceDir === 'src/assets/svg' ? 'selected' : '')
      .replace(/\$\{srcIconsSvgSelected\}/g, sourceDir === 'src/icons' ? 'selected' : '')
      .replace(/\$\{iconsFolderSelected\}/g, sourceDir === 'icons' ? 'selected' : '')
      .replace(/\$\{browse\}/g, tr.browse)
      .replace(/\$\{step1Apply\}/g, tr.step1Apply)
      // Step 2 - Output Directory
      .replace(/\$\{step2Class\}/g, `${isStep2Complete ? 'completed-step' : ''} ${isStep2Unlocked ? '' : 'step-disabled'}`)
      .replace(/\$\{step2NumberClass\}/g, isStep2Complete ? 'completed' : '')
      .replace(/\$\{step2Disabled\}/g, isStep2Unlocked ? '' : 'disabled')
      .replace(/\$\{step2Title\}/g, tr.step2Title)
      .replace(/\$\{step2Summary\}/g, isOutputConfigured ? `<span class="step-summary">${outputDir}</span>` : '')
      .replace(/\$\{step2Desc\}/g, tr.step2Desc)
      .replace(/\$\{step2Placeholder\}/g, tr.step2Placeholder)
      .replace(/\$\{outputDir\}/g, outputDir)
      .replace(/\$\{srcIconsSelected\}/g, outputDir === 'src/icons' ? 'selected' : '')
      .replace(/\$\{srcAssetsSelected\}/g, outputDir === 'src/assets/icons' ? 'selected' : '')
      .replace(/\$\{publicIconsSelected\}/g, outputDir === 'public/icons' ? 'selected' : '')
      // Step 3 - Build Format
      .replace(/\$\{step3Class\}/g, `${isStep3Complete ? 'completed-step' : ''} ${isStep3Unlocked ? '' : 'step-disabled'}`)
      .replace(/\$\{step3NumberClass\}/g, isStep3Complete ? 'completed' : '')
      .replace(/\$\{step3Title\}/g, tr.step3Title)
      .replace(/\$\{formatSummary\}/g, buildFormat === 'icons.ts' ? tr.jsModuleTitle : (buildFormat === 'sprite.svg' ? tr.spriteTitle : tr.selectFormat || 'Seleccionar...'))
      .replace(/\$\{step3Desc\}/g, tr.step3Desc)
      .replace(/\$\{step3Help\}/g, tr.step3Help)
      .replace(/\$\{jsModuleTitle\}/g, tr.jsModuleTitle)
      .replace(/\$\{helpJsModule\}/g, tr.helpJsModule)
      .replace(/\$\{spriteTitle\}/g, tr.spriteTitle)
      .replace(/\$\{helpSprite\}/g, tr.helpSprite)
      .replace(/\$\{helpTip\}/g, tr.helpTip)
      .replace(/\$\{jsModuleSelected\}/g, buildFormat === 'icons.ts' ? 'selected' : '')
      .replace(/\$\{recommended\}/g, tr.recommended)
      .replace(/\$\{jsModuleDesc\}/g, tr.jsModuleDesc)
      .replace(/\$\{jsModulePro1\}/g, tr.jsModulePro1)
      .replace(/\$\{jsModulePro2\}/g, tr.jsModulePro2)
      .replace(/\$\{spriteSelected\}/g, buildFormat === 'sprite.svg' ? 'selected' : '')
      .replace(/\$\{spriteDesc\}/g, tr.spriteDesc)
      .replace(/\$\{spritePro1\}/g, tr.spritePro1)
      .replace(/\$\{spritePro2\}/g, tr.spritePro2)
      // Step 4 - Web Component Name
      .replace(/\$\{step4Section\}/g, step4Section)
      // Advanced Options
      .replace(/\$\{advancedTitle\}/g, tr.advancedTitle)
      .replace(/\$\{svgoOptimizeLabel\}/g, tr.svgoOptimizeLabel)
      .replace(/\$\{scanOnStartupLabel\}/g, tr.scanOnStartupLabel)
      .replace(/\$\{defaultIconSizeLabel\}/g, tr.defaultIconSizeLabel)
      .replace(/\$\{previewBackgroundLabel\}/g, tr.previewBackgroundLabel)
      .replace(/\$\{svgoOptimizeChecked\}/g, svgoOptimize ? 'checked' : '')
      .replace(/\$\{scanOnStartupChecked\}/g, scanOnStartup ? 'checked' : '')
      .replace(/\$\{defaultIconSize\}/g, String(defaultIconSize))
      .replace(/\$\{bgTransparent\}/g, previewBackground === 'transparent' ? 'selected' : '')
      .replace(/\$\{bgLight\}/g, previewBackground === 'light' ? 'selected' : '')
      .replace(/\$\{bgDark\}/g, previewBackground === 'dark' ? 'selected' : '')
      .replace(/\$\{bgCheckered\}/g, previewBackground === 'checkered' ? 'selected' : '')
      .replace(/\$\{allSettings\}/g, tr.allSettings)
      // Preview
      .replace(/\$\{previewTitle\}/g, tr.previewTitle)
      .replace(/\$\{previewFileName\}/g, buildFormat === 'icons.ts' ? 'icons.js' : (buildFormat === 'sprite.svg' ? 'sprite.svg' : '...'))
      .replace(/\$\{previewCode\}/g, previewCode)
      .replace(/\$\{previewSummary\}/g, previewSummary)
      .replace(/\$\{previewResultLabel\}/g, tr.previewResultLabel)
      .replace(/\$\{previewGallery\}/g, previewGallery)
      // Workflow
      .replace(/\$\{workflowSource\}/g, tr.workflowSource)
      .replace(/\$\{workflowBuild\}/g, tr.workflowBuild)
      .replace(/\$\{workflowOutput\}/g, tr.workflowOutput)
      .replace(/\$\{sourceDirDisplay\}/g, sourceDir || 'svgs/')
      .replace(/\$\{comingSoon\}/g, tr.comingSoon)
      // Actions
      .replace(/\$\{settings\}/g, tr.settings)
      .replace(/\$\{skip\}/g, tr.skip)
      .replace(/\$\{finishButton\}/g, finishButton);

    // Build JS with translations
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
}

