import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateWebComponent } from '../utils/iconsFileManager';

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
      'Welcome to Bezier SVG',
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
      openLabel: 'Select Icons Folder'
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

  private async _finishSetup(): Promise<void> {
    const config = vscode.workspace.getConfiguration('iconManager');
    const outputDir = config.get<string>('outputDirectory', '');
    const buildFormat = config.get<string>('buildFormat', 'icons.ts');
    const webComponentName = config.get<string>('webComponentName', 'bz-icon');
    const lang = vscode.env.language.startsWith('es') ? 'es' : 'en';
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || !outputDir) {
      const msg = lang === 'es' 
        ? '⚠️ Configura el directorio de salida primero'
        : '⚠️ Configure output directory first';
      vscode.window.showWarningMessage(msg);
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
        const msg = lang === 'es' 
          ? `✅ ¡Bezier SVG está listo! Se ha creado sprite.svg en ${outputDir}`
          : `✅ Bezier SVG is ready! Created sprite.svg in ${outputDir}`;
        vscode.window.showInformationMessage(msg);
      } else {
        // Generate icons.js, icon.js, icons.d.ts
        await this._generateEmptyIconsModule(fullPath, webComponentName);
        const msg = lang === 'es' 
          ? `✅ ¡Bezier SVG está listo! Archivos creados en ${outputDir}: icons.js, icon.js, icons.d.ts`
          : `✅ Bezier SVG is ready! Files created in ${outputDir}: icons.js, icon.js, icons.d.ts`;
        vscode.window.showInformationMessage(msg);
      }
      
      // Refresh views to show the new files
      vscode.commands.executeCommand('iconManager.refreshIcons');
      
    } catch (error: any) {
      const msg = lang === 'es' 
        ? `❌ Error al crear archivos: ${error.message}`
        : `❌ Error creating files: ${error.message}`;
      vscode.window.showErrorMessage(msg);
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
    const lang = vscode.env.language.startsWith('es') ? 'es' : 'en';
    
    const translations: Record<string, Record<string, string>> = {
      en: {
        // Header
        headerIcons: '200k+ Icons',
        headerColors: 'Color Editor',
        headerAnimations: 'Animations',
        headerSvgo: 'SVGO',
        
        // Step 1
        step1Title: 'Output Directory',
        step1Desc: 'Where should your built icons be saved?',
        step1Placeholder: 'Or type a custom path...',
        step1Apply: 'Apply',
        browse: 'Browse...',
        
        // Step 2
        step2Title: 'Build Format',
        step2Desc: 'How will icons be generated for your project?',
        step2Help: 'Which should I choose?',
        jsModuleTitle: 'JS Module',
        jsModuleDesc: 'Web component for React, Vue, Angular, Svelte',
        jsModulePro1: 'Dynamic props',
        jsModulePro2: 'Easy syntax',
        spriteTitle: 'SVG Sprite',
        spriteDesc: 'Zero JS for static sites & emails',
        spritePro1: 'No runtime',
        spritePro2: 'Max performance',
        recommended: 'Recommended',
        
        // Help panel
        helpJsModule: 'Best for React, Vue, Angular, Svelte, or any JS framework. Easier syntax:',
        helpSprite: 'Best for static HTML, WordPress, emails, or when you need zero JavaScript. Maximum performance but verbose syntax.',
        helpTip: 'Not sure? Start with JS Module — you can always switch later.',
        
        // Step 3
        step3Title: 'Component Tag',
        step3Desc: 'Customize the HTML tag for your web component.',
        
        // Preview
        previewTitle: 'Live Preview',
        previewImport: 'Import once',
        previewUse: 'Use anywhere',
        previewRef: 'Reference sprite',
        previewOutput: 'Output',
        previewFormat: 'Format',
        previewTag: 'Tag',
        
        // Actions
        settings: 'Settings',
        skip: 'Skip for now',
        getStarted: 'Get Started',
        completeStep1: 'Complete Step 1 first'
      },
      es: {
        // Header
        headerIcons: '200k+ Iconos',
        headerColors: 'Editor de Color',
        headerAnimations: 'Animaciones',
        headerSvgo: 'SVGO',
        
        // Step 1
        step1Title: 'Directorio de Salida',
        step1Desc: '¿Dónde se guardarán tus iconos compilados?',
        step1Placeholder: 'O escribe una ruta personalizada...',
        step1Apply: 'Aplicar',
        browse: 'Explorar...',
        
        // Step 2
        step2Title: 'Formato de Build',
        step2Desc: '¿Cómo se generarán los iconos en tu proyecto?',
        step2Help: '¿Cuál debo elegir?',
        jsModuleTitle: 'Módulo JS',
        jsModuleDesc: 'Web component para React, Vue, Angular, Svelte',
        jsModulePro1: 'Props dinámicas',
        jsModulePro2: 'Sintaxis fácil',
        spriteTitle: 'SVG Sprite',
        spriteDesc: 'Sin JS para sitios estáticos y emails',
        spritePro1: 'Sin runtime',
        spritePro2: 'Máximo rendimiento',
        recommended: 'Recomendado',
        
        // Help panel
        helpJsModule: 'Ideal para React, Vue, Angular, Svelte, o cualquier framework JS. Sintaxis más sencilla:',
        helpSprite: 'Ideal para HTML estático, WordPress, emails, o cuando necesitas cero JavaScript. Máximo rendimiento pero sintaxis verbosa.',
        helpTip: '¿No estás seguro? Empieza con Módulo JS — siempre puedes cambiar después.',
        
        // Step 3
        step3Title: 'Tag del Componente',
        step3Desc: 'Personaliza la etiqueta HTML de tu web component.',
        
        // Preview
        previewTitle: 'Vista Previa',
        previewImport: 'Importar una vez',
        previewUse: 'Usar en cualquier lugar',
        previewRef: 'Referencia al sprite',
        previewOutput: 'Salida',
        previewFormat: 'Formato',
        previewTag: 'Tag',
        
        // Actions
        settings: 'Ajustes',
        skip: 'Saltar por ahora',
        getStarted: 'Comenzar',
        completeStep1: 'Completa el Paso 1 primero'
      }
    };
    
    return translations[lang];
  }

  private _getHtmlForWebview(): string {
    const templates = loadTemplates();
    const config = vscode.workspace.getConfiguration('iconManager');
    const outputDir = config.get<string>('outputDirectory', '');
    const buildFormat = config.get<string>('buildFormat', 'icons.ts');
    const webComponentName = config.get<string>('webComponentName', 'bz-icon');
    const isConfigured = !!outputDir;
    const t = this._getI18n();

    // Build dynamic sections
    const step3Section = buildFormat === 'icons.ts' ? `
      <div class="step">
        <div class="step-header">
          <div class="step-number"><span>3</span></div>
          <div class="step-title">${t.step3Title}</div>
          <span class="step-summary" style="color: var(--vscode-descriptionForeground);">&lt;${webComponentName}&gt;</span>
        </div>
        <div class="step-content">
          <p class="step-description">${t.step3Desc}</p>
          <div class="input-group">
            <input type="text" id="webComponentName" value="${webComponentName}" placeholder="bz-icon" onkeypress="handleTagKeypress(event)" />
            <button class="btn-secondary" onclick="applyWebComponentName()">${t.step1Apply}</button>
          </div>
        </div>
      </div>
    ` : '';

    const previewCode = buildFormat === 'icons.ts' ? `
<span class="comment">&lt;!-- ${t.previewImport} --&gt;</span>
<span class="tag">&lt;script</span> <span class="attr">src</span>=<span class="value">"${outputDir}/icons.js"</span><span class="tag">&gt;&lt;/script&gt;</span>

<span class="comment">&lt;!-- ${t.previewUse} --&gt;</span>
<span class="tag">&lt;${webComponentName}</span>
  <span class="attr">name</span>=<span class="value">"home"</span>
  <span class="attr">size</span>=<span class="value">"24"</span>
  <span class="attr">color</span>=<span class="value">"#333"</span>
<span class="tag">&gt;&lt;/${webComponentName}&gt;</span>
    ` : `
<span class="comment">&lt;!-- ${t.previewRef} --&gt;</span>
<span class="tag">&lt;svg</span> <span class="attr">width</span>=<span class="value">"24"</span> <span class="attr">height</span>=<span class="value">"24"</span><span class="tag">&gt;</span>
  <span class="tag">&lt;use</span> <span class="attr">href</span>=<span class="value">"${outputDir}/sprite.svg#home"</span><span class="tag">/&gt;</span>
<span class="tag">&lt;/svg&gt;</span>
    `;

    const previewSummary = isConfigured ? `
      <div class="preview-summary">
        <div class="preview-summary-item">
          <span class="preview-summary-label">${t.previewOutput}</span>
          <span class="preview-summary-value">${outputDir}</span>
        </div>
        <div class="preview-summary-item">
          <span class="preview-summary-label">${t.previewFormat}</span>
          <span class="preview-summary-value">${buildFormat === 'icons.ts' ? t.jsModuleTitle : t.spriteTitle}</span>
        </div>
        <div class="preview-summary-item" style="${buildFormat === 'icons.ts' ? '' : 'display:none'}">
          <span class="preview-summary-label">${t.previewTag}</span>
          <span class="preview-summary-value">&lt;${webComponentName}&gt;</span>
        </div>
      </div>
    ` : '';

    const finishButton = isConfigured 
      ? `<button class="btn-primary btn-finish" onclick="finishSetup()"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> ${t.getStarted}</button>`
      : `<button class="btn-secondary" disabled style="opacity: 0.5;">${t.completeStep1}</button>`;

    // Replace placeholders in HTML template
    const htmlContent = templates.html
      // Header
      .replace(/\$\{headerIcons\}/g, t.headerIcons)
      .replace(/\$\{headerColors\}/g, t.headerColors)
      .replace(/\$\{headerAnimations\}/g, t.headerAnimations)
      .replace(/\$\{headerSvgo\}/g, t.headerSvgo)
      // Step 1
      .replace(/\$\{step1Class\}/g, isConfigured ? 'completed-step' : '')
      .replace(/\$\{step1NumberClass\}/g, isConfigured ? 'completed' : '')
      .replace(/\$\{step1Title\}/g, t.step1Title)
      .replace(/\$\{step1Summary\}/g, isConfigured ? `<span class="step-summary">${outputDir}</span>` : '')
      .replace(/\$\{step1Desc\}/g, t.step1Desc)
      .replace(/\$\{srcIconsSelected\}/g, outputDir === 'src/icons' ? 'selected' : '')
      .replace(/\$\{srcAssetsSelected\}/g, outputDir === 'src/assets/icons' ? 'selected' : '')
      .replace(/\$\{publicIconsSelected\}/g, outputDir === 'public/icons' ? 'selected' : '')
      .replace(/\$\{browse\}/g, t.browse)
      .replace(/\$\{step1Placeholder\}/g, t.step1Placeholder)
      .replace(/\$\{outputDir\}/g, outputDir)
      .replace(/\$\{step1Apply\}/g, t.step1Apply)
      // Step 2
      .replace(/\$\{step2Title\}/g, t.step2Title)
      .replace(/\$\{formatSummary\}/g, buildFormat === 'icons.ts' ? t.jsModuleTitle : t.spriteTitle)
      .replace(/\$\{step2Desc\}/g, t.step2Desc)
      .replace(/\$\{step2Help\}/g, t.step2Help)
      .replace(/\$\{jsModuleTitle\}/g, t.jsModuleTitle)
      .replace(/\$\{helpJsModule\}/g, t.helpJsModule)
      .replace(/\$\{spriteTitle\}/g, t.spriteTitle)
      .replace(/\$\{helpSprite\}/g, t.helpSprite)
      .replace(/\$\{helpTip\}/g, t.helpTip)
      .replace(/\$\{jsModuleSelected\}/g, buildFormat === 'icons.ts' ? 'selected' : '')
      .replace(/\$\{recommended\}/g, t.recommended)
      .replace(/\$\{jsModuleDesc\}/g, t.jsModuleDesc)
      .replace(/\$\{jsModulePro1\}/g, t.jsModulePro1)
      .replace(/\$\{jsModulePro2\}/g, t.jsModulePro2)
      .replace(/\$\{spriteSelected\}/g, buildFormat === 'sprite.svg' ? 'selected' : '')
      .replace(/\$\{spriteDesc\}/g, t.spriteDesc)
      .replace(/\$\{spritePro1\}/g, t.spritePro1)
      .replace(/\$\{spritePro2\}/g, t.spritePro2)
      // Step 3
      .replace(/\$\{step3Section\}/g, step3Section)
      // Preview
      .replace(/\$\{previewTitle\}/g, t.previewTitle)
      .replace(/\$\{previewFileName\}/g, buildFormat === 'icons.ts' ? 'component.html' : 'index.html')
      .replace(/\$\{previewCode\}/g, previewCode)
      .replace(/\$\{previewSummary\}/g, previewSummary)
      // Actions
      .replace(/\$\{settings\}/g, t.settings)
      .replace(/\$\{skip\}/g, t.skip)
      .replace(/\$\{finishButton\}/g, finishButton);

    // Build JS with translations
    const jsContent = templates.js
      .replace(/\$\{helpOpenText\}/g, `${t.step2Help} ▴`)
      .replace(/\$\{helpClosedText\}/g, `${t.step2Help} ▾`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Bezier SVG</title>
  <style>${templates.css}</style>
</head>
<body>
  ${htmlContent}
  <script>${jsContent}</script>
</body>
</html>`;
  }
}
