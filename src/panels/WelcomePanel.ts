import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateWebComponent } from '../utils/iconsFileManager';

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
    const config = vscode.workspace.getConfiguration('iconManager');
    const outputDir = config.get<string>('outputDirectory', '');
    const buildFormat = config.get<string>('buildFormat', 'icons.ts');
    const webComponentName = config.get<string>('webComponentName', 'bz-icon');
    const isConfigured = !!outputDir;
    const t = this._getI18n();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Bezier SVG</title>
  <style>
    :root {
      --accent: #0078d4;
      --accent-hover: #106ebe;
      --success: #4caf50;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(255, 255, 255, 0.06);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      min-height: 100vh;
      padding: 0;
      line-height: 1.5;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px 24px;
    }
    
    /* Compact Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-mini {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent), #00bcf2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-mini svg {
      width: 20px;
      height: 20px;
      fill: white;
    }
    
    .header-title {
      font-size: 18px;
      font-weight: 600;
    }
    
    .header-features {
      display: flex;
      gap: 16px;
    }
    
    .header-feature {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 4px 10px;
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
    }
    
    .header-feature svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
      opacity: 0.8;
    }
    
    /* SVG Icons */
    .svg-icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
      flex-shrink: 0;
    }
    
    .svg-icon-sm {
      width: 14px;
      height: 14px;
    }
    
    .svg-icon-lg {
      width: 20px;
      height: 20px;
    }
    
    .option-icon svg {
      width: 18px;
      height: 18px;
      fill: var(--accent);
      opacity: 0.9;
    }
    
    .help-icon svg {
      width: 18px;
      height: 18px;
      fill: var(--accent);
    }

    /* Main Layout - Two Columns */
    .main-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    /* Left Column - Configuration */
    .config-column {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    /* Right Column - Preview */
    .preview-column {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      position: sticky;
      top: 20px;
      height: fit-content;
    }
    
    .preview-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .preview-window {
      background: var(--vscode-editor-background);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .preview-window-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid var(--card-border);
    }
    
    .preview-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .preview-dot.red { background: #ff5f56; }
    .preview-dot.yellow { background: #ffbd2e; }
    .preview-dot.green { background: #27ca40; }
    
    .preview-window-title {
      flex: 1;
      text-align: center;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .preview-code {
      padding: 16px;
      font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.6;
      color: var(--vscode-textPreformat-foreground);
    }
    
    .preview-code .tag { color: #569cd6; }
    .preview-code .attr { color: #9cdcfe; }
    .preview-code .value { color: #ce9178; }
    .preview-code .comment { color: #6a9955; }
    
    .preview-icon-display {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border-top: 1px solid var(--card-border);
      background: rgba(255,255,255,0.02);
    }
    
    .preview-icon-box {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--accent), #00bcf2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .preview-icon-box svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    
    .preview-summary {
      margin-top: 16px;
      padding: 12px;
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.2);
      border-radius: 8px;
      font-size: 11px;
    }
    
    .preview-summary-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    
    .preview-summary-label {
      color: var(--vscode-descriptionForeground);
    }
    
    .preview-summary-value {
      font-weight: 500;
      color: var(--success);
    }

    /* Hero Section - Now Compact */
    .hero {
      display: none; /* Hidden - replaced by compact header */
    }
    
    /* Steps - More Compact */
    .step {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px 20px;
      transition: all 0.2s ease;
    }
    
    .step:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }
    
    .step.collapsed {
      padding: 12px 20px;
    }
    
    .step.collapsed .step-content {
      display: none;
    }
    
    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .step.collapsed .step-header {
      margin-bottom: 0;
    }
    
    .step-number {
      width: 28px;
      height: 28px;
      background: var(--accent);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      flex-shrink: 0;
    }
    
    .step-number.completed {
      background: var(--success);
    }
    
    .step-number.completed span {
      display: none;
    }
    
    .step-number.completed::after {
      content: '';
      display: block;
      width: 14px;
      height: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
      background-size: contain;
      background-repeat: no-repeat;
    }
    
    .step-title {
      font-size: 14px;
      font-weight: 600;
      flex: 1;
    }
    
    .step-summary {
      font-size: 12px;
      color: var(--success);
      font-weight: 500;
    }
    
    .step-edit-btn {
      font-size: 11px;
      color: var(--accent);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      background: transparent;
      border: none;
    }
    
    .step-edit-btn:hover {
      background: rgba(0, 120, 212, 0.1);
    }
    
    .step-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 14px;
    }
    
    /* Options Grid - Horizontal */
    .options-grid {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--vscode-input-background);
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-size: 12px;
    }
    
    .option:hover {
      background: var(--vscode-list-hoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .option.selected {
      border-color: var(--accent);
      background: rgba(0, 120, 212, 0.1);
    }
    
    .option-icon {
      font-size: 16px;
    }
    
    .option-label {
      font-weight: 500;
      color: var(--vscode-foreground);
    }
    
    /* Browse button - Differentiated */
    .option.browse {
      border: 2px dashed var(--card-border);
      background: transparent;
    }
    
    .option.browse:hover {
      border-color: var(--accent);
      background: rgba(0, 120, 212, 0.05);
    }
    
    /* Format Options - Horizontal */
    .format-grid {
      display: flex;
      gap: 12px;
    }
    
    .format-card {
      flex: 1;
      padding: 14px 16px;
      background: var(--vscode-input-background);
      border: 2px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .format-card:hover {
      background: var(--vscode-list-hoverBackground);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .format-card.selected {
      border-color: var(--accent);
      background: rgba(0, 120, 212, 0.1);
    }
    
    .format-card h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .format-card p {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      margin-bottom: 8px;
    }
    
    .format-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .tag-pro {
      font-size: 9px;
      padding: 2px 6px;
      background: rgba(76, 175, 80, 0.15);
      color: #81c784;
      border-radius: 4px;
    }
    
    .tag-neutral {
      font-size: 9px;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--vscode-descriptionForeground);
      border-radius: 4px;
    }
    
    /* Help Panel */
    .help-link {
      color: var(--accent);
      cursor: pointer;
      font-size: 11px;
      margin-left: 4px;
    }
    
    .help-link:hover {
      text-decoration: underline;
    }
    
    .help-panel {
      display: none;
      margin-bottom: 14px;
      padding: 14px;
      background: rgba(0, 120, 212, 0.08);
      border: 1px solid rgba(0, 120, 212, 0.2);
      border-radius: 8px;
      animation: slideDown 0.2s ease;
    }
    
    .help-panel.show {
      display: block;
    }
    
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .help-row {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 11px;
      line-height: 1.5;
    }
    
    .help-row:last-of-type {
      margin-bottom: 0;
    }
    
    .help-icon {
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .help-row strong {
      color: var(--vscode-foreground);
    }
    
    .help-row code {
      background: rgba(255, 255, 255, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'Fira Code', monospace;
      font-size: 10px;
    }
    
    .help-tip {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 120, 212, 0.15);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .badge {
      font-size: 9px;
      padding: 2px 6px;
      background: var(--accent);
      color: white;
      border-radius: 8px;
      font-weight: 500;
    }
    
    /* Input Group - Compact */
    .input-group {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    input[type="text"] {
      flex: 1;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      font-size: 12px;
      transition: border-color 0.15s;
    }
    
    input[type="text"]:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    input[type="text"]::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    
    /* Buttons - Compact */
    button {
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }
    
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .btn-ghost {
      background: transparent;
      color: var(--vscode-descriptionForeground);
      padding: 8px 12px;
    }
    
    .btn-ghost:hover {
      background: var(--card-bg);
      color: var(--vscode-foreground);
    }

    /* Actions - Bottom Bar */
    .actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
    }
    
    .actions-left {
      display: flex;
      gap: 8px;
    }
    
    .actions-right {
      display: flex;
      gap: 12px;
    }
    
    .btn-finish {
      padding: 10px 24px;
      font-size: 13px;
      background: linear-gradient(135deg, var(--accent), #00bcf2);
      box-shadow: 0 4px 12px rgba(0, 120, 212, 0.3);
    }
    
    .btn-finish:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 120, 212, 0.4);
    }

    /* Responsive */
    @media (max-width: 800px) {
      .main-layout {
        grid-template-columns: 1fr;
      }
      
      .preview-column {
        position: static;
      }
      
      .format-grid {
        flex-direction: column;
      }
      
      .header-features {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Compact Header -->
    <div class="header">
      <div class="header-left">
        <div class="logo-mini">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <span class="header-title">Bezier SVG</span>
      </div>
      <div class="header-features">
        <div class="header-feature"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> ${t.headerIcons}</div>
        <div class="header-feature"><svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg> ${t.headerColors}</div>
        <div class="header-feature"><svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg> ${t.headerAnimations}</div>
        <div class="header-feature"><svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg> ${t.headerSvgo}</div>
      </div>
    </div>

    <div class="main-layout">
      <!-- Left Column: Configuration -->
      <div class="config-column">
        <!-- Step 1: Output Directory -->
        <div class="step ${isConfigured ? 'completed-step' : ''}">
          <div class="step-header">
            <div class="step-number ${isConfigured ? 'completed' : ''}"><span>1</span></div>
            <div class="step-title">${t.step1Title}</div>
            ${isConfigured ? `<span class="step-summary">${outputDir}</span>` : ''}
          </div>
          <div class="step-content">
            <p class="step-description">${t.step1Desc}</p>
            
            <div class="options-grid">
              <div class="option ${outputDir === 'src/icons' ? 'selected' : ''}" onclick="setDirectory('src/icons')">
                <span class="option-icon"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>
                <span class="option-label">src/icons</span>
              </div>
              <div class="option ${outputDir === 'src/assets/icons' ? 'selected' : ''}" onclick="setDirectory('src/assets/icons')">
                <span class="option-icon"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>
                <span class="option-label">src/assets/icons</span>
              </div>
              <div class="option ${outputDir === 'public/icons' ? 'selected' : ''}" onclick="setDirectory('public/icons')">
                <span class="option-icon"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></span>
                <span class="option-label">public/icons</span>
              </div>
              <div class="option browse" onclick="chooseFolder()">
                <span class="option-icon"><svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg></span>
                <span class="option-label">${t.browse}</span>
              </div>
            </div>
            
            <div class="input-group">
              <input type="text" id="outputDir" placeholder="${t.step1Placeholder}" value="${outputDir}" onkeypress="handlePathKeypress(event)" />
              <button class="btn-secondary" onclick="applyCustomPath()">${t.step1Apply}</button>
            </div>
          </div>
        </div>

        <!-- Step 2: Build Format -->
        <div class="step">
          <div class="step-header">
            <div class="step-number"><span>2</span></div>
            <div class="step-title">${t.step2Title}</div>
            <span class="step-summary" style="color: var(--vscode-descriptionForeground);">${buildFormat === 'icons.ts' ? t.jsModuleTitle : t.spriteTitle}</span>
          </div>
          <div class="step-content">
            <p class="step-description">
              ${t.step2Desc} 
              <span class="help-link" onclick="toggleHelp()">${t.step2Help} ▾</span>
            </p>
            
            <div class="help-panel" id="helpPanel">
              <div class="help-content">
                <div class="help-row">
                  <span class="help-icon"><svg viewBox="0 0 24 24"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm14 0v-6.7l-6 3.37v6.71l6-3.38z"/></svg></span>
                  <div>
                    <strong>${t.jsModuleTitle}</strong> — ${t.helpJsModule} <code>&lt;bz-icon name="home"&gt;</code>
                  </div>
                </div>
                <div class="help-row">
                  <span class="help-icon"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></span>
                  <div>
                    <strong>${t.spriteTitle}</strong> — ${t.helpSprite}
                  </div>
                </div>
                <div class="help-tip">
                  <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="color: #ffc107;"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>
                  <em>${t.helpTip}</em>
                </div>
              </div>
            </div>
            
            <div class="format-grid">
              <div class="format-card ${buildFormat === 'icons.ts' ? 'selected' : ''}" onclick="setBuildFormat('icons.ts')">
                <h3>
                  <svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm14 0v-6.7l-6 3.37v6.71l6-3.38z"/></svg>
                  ${t.jsModuleTitle}
                  <span class="badge">${t.recommended}</span>
                </h3>
                <p>${t.jsModuleDesc}</p>
                <div class="format-tags">
                  <span class="tag-pro">${t.jsModulePro1}</span>
                  <span class="tag-pro">${t.jsModulePro2}</span>
                </div>
              </div>
              <div class="format-card ${buildFormat === 'sprite.svg' ? 'selected' : ''}" onclick="setBuildFormat('sprite.svg')">
                <h3>
                  <svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                  ${t.spriteTitle}
                </h3>
                <p>${t.spriteDesc}</p>
                <div class="format-tags">
                  <span class="tag-neutral">${t.spritePro1}</span>
                  <span class="tag-neutral">${t.spritePro2}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Web Component Name (only for JS Module) -->
        ${buildFormat === 'icons.ts' ? `
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
        ` : ''}
      </div>

      <!-- Right Column: Live Preview -->
      <div class="preview-column">
        <div class="preview-title">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          ${t.previewTitle}
        </div>
        
        <div class="preview-window">
          <div class="preview-window-header">
            <div class="preview-dot red"></div>
            <div class="preview-dot yellow"></div>
            <div class="preview-dot green"></div>
            <span class="preview-window-title">${buildFormat === 'icons.ts' ? 'component.html' : 'index.html'}</span>
          </div>
          <div class="preview-code">
            ${buildFormat === 'icons.ts' ? `
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
            `}
          </div>
          <div class="preview-icon-display">
            <div class="preview-icon-box">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
          </div>
        </div>
        
        ${isConfigured ? `
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
        ` : ''}
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="actions">
      <div class="actions-left">
        <button class="btn-ghost" onclick="openSettings()"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg> ${t.settings}</button>
      </div>
      <div class="actions-right">
        <button class="btn-ghost" onclick="close()">${t.skip}</button>
        ${isConfigured ? `
          <button class="btn-primary btn-finish" onclick="finishSetup()"><svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" style="fill: white;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> ${t.getStarted}</button>
        ` : `
          <button class="btn-secondary" disabled style="opacity: 0.5;">${t.completeStep1}</button>
        `}
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const helpOpenText = '${t.step2Help} ▴';
    const helpClosedText = '${t.step2Help} ▾';

    function setDirectory(dir) {
      document.getElementById('outputDir').value = dir;
      vscode.postMessage({ command: 'setOutputDirectory', directory: dir });
    }

    function chooseFolder() {
      vscode.postMessage({ command: 'chooseFolder' });
    }

    function applyCustomPath() {
      const dir = document.getElementById('outputDir').value.trim();
      if (dir) {
        vscode.postMessage({ command: 'setOutputDirectory', directory: dir });
      }
    }
    
    function handlePathKeypress(e) {
      if (e.key === 'Enter') {
        applyCustomPath();
      }
    }

    function setBuildFormat(format) {
      vscode.postMessage({ command: 'setBuildFormat', format: format });
    }

    function applyWebComponentName() {
      const name = document.getElementById('webComponentName').value.trim();
      if (name) {
        vscode.postMessage({ command: 'setWebComponentName', name: name });
      }
    }
    
    function handleTagKeypress(e) {
      if (e.key === 'Enter') {
        applyWebComponentName();
      }
    }
    
    function toggleHelp() {
      const panel = document.getElementById('helpPanel');
      panel.classList.toggle('show');
      const link = document.querySelector('.help-link');
      link.textContent = panel.classList.contains('show') 
        ? helpOpenText 
        : helpClosedText;
    }

    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function searchIcons() {
      vscode.postMessage({ command: 'searchIcons' });
    }

    function finishSetup() {
      vscode.postMessage({ command: 'finishSetup' });
    }

    function close() {
      vscode.postMessage({ command: 'close' });
    }
  </script>
</body>
</html>`;
  }
}


