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
  }

  private async _setSourceDirectory(directory: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('iconManager');
    const currentFolders = config.get<string[]>('svgFolders', []);
    
    // Set the new directory as the first folder (primary source)
    const updatedFolders = [directory, ...currentFolders.filter(f => f !== directory)];
    await config.update('svgFolders', updatedFolders, vscode.ConfigurationTarget.Workspace);
    
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
    const config = vscode.workspace.getConfiguration('iconManager');
    await config.update('outputDirectory', directory, vscode.ConfigurationTarget.Workspace);
    
    // Create folder if it doesn't exist
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
    const config = vscode.workspace.getConfiguration('iconManager');
    await config.update('buildFormat', format, vscode.ConfigurationTarget.Workspace);
    this._update();
  }

  private async _setWebComponentName(name: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('iconManager');
    await config.update('webComponentName', name, vscode.ConfigurationTarget.Workspace);
    this._update();
  }

  private async _setLanguage(language: SupportedLocale): Promise<void> {
    await i18n.setLocale(language);
    // Update is triggered by onDidChangeLocale listener
  }

  private async _finishSetup(): Promise<void> {
    const config = vscode.workspace.getConfiguration('iconManager');
    const outputDir = config.get<string>('outputDirectory', '');
    const buildFormat = config.get<string>('buildFormat', 'icons.ts');
    const webComponentName = config.get<string>('webComponentName', 'bz-icon');
    
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
      if (buildFormat === 'sprite.svg') {
        // Generate empty sprite.svg
        await this._generateEmptySprite(fullPath);
        vscode.window.showInformationMessage(
          `✅ ${t('welcome.setupComplete')} ${t('welcome.spriteCreated', { path: outputDir })}`
        );
      } else {
        // Generate icons.js, icon.js, icons.d.ts
        await this._generateEmptyIconsModule(fullPath, webComponentName);
        vscode.window.showInformationMessage(
          `✅ ${t('welcome.setupComplete')} ${t('welcome.filesCreated', { path: outputDir })}`
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
<!-- Auto-generated by Bezier SVG - Icon Manager -->
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
    const iconsContent = `// Auto-generated by Bezier SVG - Icon Manager
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
    const typesContent = `// Auto-generated TypeScript definitions by Bezier SVG
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
      jsModuleTitle: t('welcome.jsModule'),
      jsModuleDesc: t('features.codeIntegrationDescription'),
      jsModulePro1: t('editor.variants'),
      jsModulePro2: t('editor.custom'),
      spriteTitle: t('sprite.title'),
      spriteDesc: t('features.buildSystemDescription'),
      spritePro1: t('welcome.noRuntime'),
      spritePro2: t('sprite.title'),
      recommended: '⭐',
      
      // Help panel
      helpJsModule: t('features.codeIntegrationDescription'),
      helpSprite: t('features.buildSystemDescription'),
      helpTip: t('welcome.quickStartDescription'),
      
      // Step 4 - Web Component Name
      step4Title: t('welcome.webComponentName'),
      step4Desc: t('welcome.webComponentDesc'),
      
      // Preview
      previewTitle: t('editor.preview'),
      previewImport: t('welcome.import'),
      previewUse: t('welcome.use'),
      previewRef: t('welcome.reference'),
      previewOutput: t('welcome.outputDirectory'),
      previewFormat: t('settings.outputFormat'),
      previewTag: t('welcome.tag'),
      
      // Actions
      settings: t('settings.title'),
      skip: t('messages.cancel'),
      getStarted: t('welcome.getStarted'),
      completeStep1: t('welcome.save')
    };
  }

  private _getHtmlForWebview(): string {
    const templates = loadTemplates();
    const config = vscode.workspace.getConfiguration('iconManager');
    const svgFolders = config.get<string[]>('svgFolders', []);
    const sourceDir = svgFolders.length > 0 ? svgFolders[0] : '';
    const outputDir = config.get<string>('outputDirectory', '');
    const buildFormat = config.get<string>('buildFormat', 'icons.ts');
    const webComponentName = config.get<string>('webComponentName', 'bz-icon');
    const isSourceConfigured = !!sourceDir;
    const isOutputConfigured = !!outputDir;
    const isConfigured = isSourceConfigured && isOutputConfigured;
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
    const step4Section = buildFormat === 'icons.ts' ? `
      <div class="step">
        <div class="step-header">
          <div class="step-number"><span>4</span></div>
          <div class="step-title">${tr.step4Title}</div>
          <span class="step-summary" style="color: var(--vscode-descriptionForeground);">&lt;${webComponentName}&gt;</span>
        </div>
        <div class="step-content">
          <p class="step-description">${tr.step4Desc}</p>
          <div class="input-group">
            <input type="text" id="webComponentName" value="${webComponentName}" placeholder="bz-icon" onkeypress="handleTagKeypress(event)" />
            <button class="btn-secondary" onclick="applyWebComponentName()">${tr.step1Apply}</button>
          </div>
        </div>
      </div>
    ` : '';

    const previewCode = buildFormat === 'icons.ts' ? `
<span class="comment">&lt;!-- ${tr.previewImport} --&gt;</span>
<span class="tag">&lt;script</span> <span class="attr">src</span>=<span class="value">"${outputDir}/icons.js"</span><span class="tag">&gt;&lt;/script&gt;</span>

<span class="comment">&lt;!-- ${tr.previewUse} --&gt;</span>
<span class="tag">&lt;${webComponentName}</span>
  <span class="attr">name</span>=<span class="value">"home"</span>
  <span class="attr">size</span>=<span class="value">"24"</span>
  <span class="attr">color</span>=<span class="value">"#333"</span>
<span class="tag">&gt;&lt;/${webComponentName}&gt;</span>
    ` : `
<span class="comment">&lt;!-- ${tr.previewRef} --&gt;</span>
<span class="tag">&lt;svg</span> <span class="attr">width</span>=<span class="value">"24"</span> <span class="attr">height</span>=<span class="value">"24"</span><span class="tag">&gt;</span>
  <span class="tag">&lt;use</span> <span class="attr">href</span>=<span class="value">"${outputDir}/sprite.svg#home"</span><span class="tag">/&gt;</span>
<span class="tag">&lt;/svg&gt;</span>
    `;

    const previewSummary = isConfigured ? `
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

    const finishButton = isConfigured 
      ? `<button class="btn-primary btn-finish" onclick="finishSetup()"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> ${tr.getStarted}</button>`
      : `<button class="btn-secondary" disabled style="opacity: 0.5;">${tr.completeStep1}</button>`;

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
      .replace(/\$\{step2Class\}/g, isOutputConfigured ? 'completed-step' : '')
      .replace(/\$\{step2NumberClass\}/g, isOutputConfigured ? 'completed' : '')
      .replace(/\$\{step2Title\}/g, tr.step2Title)
      .replace(/\$\{step2Summary\}/g, isOutputConfigured ? `<span class="step-summary">${outputDir}</span>` : '')
      .replace(/\$\{step2Desc\}/g, tr.step2Desc)
      .replace(/\$\{step2Placeholder\}/g, tr.step2Placeholder)
      .replace(/\$\{outputDir\}/g, outputDir)
      .replace(/\$\{srcIconsSelected\}/g, outputDir === 'src/icons' ? 'selected' : '')
      .replace(/\$\{srcAssetsSelected\}/g, outputDir === 'src/assets/icons' ? 'selected' : '')
      .replace(/\$\{publicIconsSelected\}/g, outputDir === 'public/icons' ? 'selected' : '')
      // Step 3 - Build Format
      .replace(/\$\{step3Title\}/g, tr.step3Title)
      .replace(/\$\{formatSummary\}/g, buildFormat === 'icons.ts' ? tr.jsModuleTitle : tr.spriteTitle)
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
      // Preview
      .replace(/\$\{previewTitle\}/g, tr.previewTitle)
      .replace(/\$\{previewFileName\}/g, buildFormat === 'icons.ts' ? 'component.html' : 'index.html')
      .replace(/\$\{previewCode\}/g, previewCode)
      .replace(/\$\{previewSummary\}/g, previewSummary)
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
