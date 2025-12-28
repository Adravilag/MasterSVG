import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSvgConfig } from '../utils/config';

export interface PreviewAnimation {
  type: string;
  duration: number;
  timing: string;
  iteration: string;
  delay?: number;
  direction?: string;
}

export class IconPreviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'iconManager.preview';
  
  private _view?: vscode.WebviewView;
  private _currentSvg?: string;
  private _currentName?: string;
  private _currentLocation?: { file: string; line: number };
  private _isBuilt?: boolean;
  private _currentAnimation?: PreviewAnimation;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // Read variants from variants.js file
  private _getVariantsFilePath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !outputDir) return undefined;
    return path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
  }

  private _readVariantsFromFile(): Record<string, Record<string, string[]>> {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return {};
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private _getSavedVariants(iconName: string): Array<{ name: string; colors: string[] }> {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName] || {};
    return Object.entries(iconVariants).map(([name, colors]) => ({ name, colors }));
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview('', '');

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'goToLocation':
          if (this._currentLocation) {
            const uri = vscode.Uri.file(this._currentLocation.file);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(this._currentLocation.line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
          }
          break;
        case 'copyName':
          if (this._currentName) {
            vscode.env.clipboard.writeText(this._currentName);
            vscode.window.showInformationMessage(`Copied "${this._currentName}" to clipboard`);
          }
          break;
        case 'copySvg':
          // Use modified SVG from webview if available, otherwise use original
          const svgToCopy = message.svg || this._currentSvg;
          if (svgToCopy) {
            vscode.env.clipboard.writeText(svgToCopy);
            vscode.window.showInformationMessage('SVG copied to clipboard');
          }
          break;
        case 'resetColors':
          // Send original SVG back to webview
          if (this._currentSvg && this._view) {
            this._view.webview.postMessage({ 
              command: 'resetSvg', 
              svg: this._currentSvg 
            });
            vscode.window.showInformationMessage('Colors reset to original');
          }
          break;
        case 'optimizeSvg':
          if (message.svg) {
            try {
              const svgo = await import('svgo');
              const result = svgo.optimize(message.svg, {
                multipass: true,
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        removeViewBox: false
                      }
                    }
                  },
                  'removeDimensions'
                ]
              });
              // Send optimized SVG back to webview
              webviewView.webview.postMessage({ 
                command: 'svgOptimized', 
                svg: result.data,
                originalSize: message.svg.length,
                optimizedSize: result.data.length
              });
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to optimize SVG: ${error}`);
            }
          }
          break;
        case 'previewComponent':
          if (this._currentName && this._currentSvg) {
            // Pass full icon data including location for save functionality
            vscode.commands.executeCommand('iconManager.colorEditor', {
              icon: {
                name: this._currentName,
                svg: this._currentSvg,
                filePath: this._currentLocation?.file,
                line: this._currentLocation?.line ? this._currentLocation.line - 1 : undefined
              }
            });
          }
          break;
        case 'openDetails':
          if (this._currentName && this._currentSvg) {
            const { IconDetailsPanel } = await import('../panels/IconDetailsPanel');
            IconDetailsPanel.createOrShow(this._extensionUri, {
              name: this._currentName,
              svg: this._currentSvg,
              location: this._currentLocation,
              isBuilt: this._isBuilt,
              animation: this._currentAnimation
            });
          }
          break;
        case 'findUsages':
          if (this._currentName) {
            this._findIconUsages(this._currentName, webviewView.webview);
          }
          break;
        case 'goToUsage':
          if (message.file && message.line) {
            const uri = vscode.Uri.file(message.file);
            const position = new vscode.Position(message.line - 1, 0);
            vscode.window.showTextDocument(uri, {
              selection: new vscode.Range(position, position),
              preview: true
            });
          }
          break;
      }
    });
  }

  private async _findIconUsages(iconName: string, webview: vscode.Webview) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      webview.postMessage({ command: 'usagesResult', usages: [], total: 0 });
      return;
    }

    const usages: { file: string; line: number; preview: string }[] = [];
    
    // Search patterns for icon usage
    const patterns = [
      `name="${iconName}"`,           // <sg-icon name="icon-name">
      `name='${iconName}'`,           // <sg-icon name='icon-name'>
      `"${iconName}"`,                // General string reference
      `'${iconName}'`,                // General string reference
      `icon-${iconName}`,             // CSS class pattern
      `.${iconName}`,                 // Class selector
      `#${iconName}`,                 // ID selector
    ];

    // File types to search
    const includePattern = '**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,svelte,astro}';
    const excludePattern = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**';

    try {
      const files = await vscode.workspace.findFiles(includePattern, excludePattern, 500);
      
      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();
          
          for (const pattern of patterns) {
            let index = 0;
            while ((index = text.indexOf(pattern, index)) !== -1) {
              const position = document.positionAt(index);
              const line = position.line;
              const lineText = document.lineAt(line).text.trim();
              
              // Avoid duplicates on same line
              const existing = usages.find(u => u.file === file.fsPath && u.line === line + 1);
              if (!existing) {
                usages.push({
                  file: file.fsPath,
                  line: line + 1,
                  preview: lineText.substring(0, 80) + (lineText.length > 80 ? '...' : '')
                });
              }
              index += pattern.length;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Sort by file and line
      usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

      webview.postMessage({ 
        command: 'usagesResult', 
        usages: usages.slice(0, 50), // Limit to 50 results
        total: usages.length 
      });
    } catch (error) {
      webview.postMessage({ command: 'usagesResult', usages: [], total: 0 });
    }
  }

  public updatePreview(name: string, svg: string, location?: { file: string; line: number }, isBuilt?: boolean, animation?: PreviewAnimation) {
    this._currentSvg = svg;
    this._currentName = name;
    this._currentLocation = location;
    this._isBuilt = isBuilt;
    this._currentAnimation = animation;
    
    // Detect if SVG is rasterized (too many colors)
    const MAX_COLORS_FOR_EDIT = 50;
    const colorMatches = svg.match(/#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi);
    const isRasterized = colorMatches ? new Set(colorMatches.map(c => c.toLowerCase())).size > MAX_COLORS_FOR_EDIT : false;
    
    // Get saved variants for this icon
    const variants = this._getSavedVariants(name);
    
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(name, svg, location, isBuilt, animation, isRasterized, variants);
    }
  }

  public clearPreview() {
    this._currentSvg = undefined;
    this._currentName = undefined;
    this._currentLocation = undefined;
    this._currentAnimation = undefined;
    
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview('', '');
    }
  }

  private _getHtmlForWebview(name: string, svg: string, location?: { file: string; line: number }, isBuilt?: boolean, animation?: PreviewAnimation, isRasterized?: boolean, variants?: Array<{ name: string; colors: string[] }>): string {
    if (!svg) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="empty">
    <div class="icon">🎨</div>
    <div>Select an icon to preview</div>
  </div>
</body>
</html>`;
    }

    // Clean SVG for display
    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }
    
    // Apply animation style to SVG if present
    let animationStyle = '';
    if (animation && animation.type && animation.type !== 'none') {
      const duration = animation.duration || 1;
      const timing = animation.timing || 'ease';
      const iteration = animation.iteration || 'infinite';
      const delay = animation.delay || 0;
      const direction = animation.direction || 'normal';
      animationStyle = `animation: icon-${animation.type} ${duration}s ${timing} ${delay}s ${iteration} ${direction};`;
      // Add animation to the SVG element
      if (displaySvg.includes('style="')) {
        displaySvg = displaySvg.replace(/style="([^"]*)"/, `style="$1 ${animationStyle}"`);
      } else {
        displaySvg = displaySvg.replace('<svg', `<svg style="${animationStyle}"`);
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>
    /* === RESET & SYSTEM === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* Thin scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
    
    :root {
      --space-xs: 4px;
      --space-sm: 8px;
      --space-md: 12px;
      --space-lg: 16px;
      --radius: 2px;
      --avatar-size: 64px;
      --font-mono: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
      --font-ui: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    }
    
    body {
      font-family: var(--font-ui);
      font-size: 11px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: var(--space-sm);
      line-height: 1.4;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* === HEADER === */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
      padding-bottom: var(--space-sm);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .icon-name {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      font-family: var(--font-mono);
    }
    
    .badge {
      font-size: 9px;
      padding: 2px 5px;
      border-radius: var(--radius);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }
    
    .badge.built {
      color: #73c991;
      border: 1px solid rgba(115, 201, 145, 0.4);
      background: rgba(115, 201, 145, 0.1);
    }
    
    .badge.draft {
      color: #cca652;
      border: 1px solid rgba(204, 166, 82, 0.4);
      background: rgba(204, 166, 82, 0.1);
    }
    
    .badge.rasterized {
      color: #e57373;
      border: 1px solid rgba(229, 115, 115, 0.4);
      background: rgba(229, 115, 115, 0.1);
    }
    
    /* === PREVIEW SURFACE === */
    .preview-surface {
      --checker-size: 10px;
      --checker-color: rgba(128, 128, 128, 0.08);
      position: relative;
      aspect-ratio: 1;
      background-color: var(--vscode-editor-background);
      background-image: 
        linear-gradient(45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(-45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--checker-color) 75%),
        linear-gradient(-45deg, transparent 75%, var(--checker-color) 75%);
      background-size: calc(var(--checker-size) * 2) calc(var(--checker-size) * 2);
      background-position: 0 0, 0 var(--checker-size), var(--checker-size) calc(var(--checker-size) * -1), calc(var(--checker-size) * -1) 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-sm);
      overflow: hidden;
    }
    
    .preview-surface .icon-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-bottom: 52px; /* Space for size-bar + color-bar */
    }
    
    .preview-surface svg {
      width: var(--avatar-size);
      height: var(--avatar-size);
      transition: all 0.15s ease;
    }
    
    /* === SIZE SLIDER (inside preview) === */
    .size-bar {
      position: absolute;
      bottom: 8px;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
    }
    
    .size-slider {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.2);
      outline: none;
    }
    
    .size-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
      border: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    
    .size-slider::-webkit-slider-thumb:hover {
      background: var(--vscode-button-background);
    }
    
    .size-value {
      font-family: var(--font-mono);
      font-size: 9px;
      color: rgba(255, 255, 255, 0.8);
      min-width: 18px;
      text-align: right;
    }

    /* === COLOR BAR (inside preview) === */
    .color-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 4px 8px;
    }

    .color-bar .color-swatch {
      width: 16px;
      height: 16px;
      border-radius: 2px;
      border: none;
      cursor: pointer;
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(128,128,128,0.3);
      transition: transform 0.1s ease;
    }

    .color-bar .color-swatch:hover {
      transform: scale(1.15);
      box-shadow: 0 0 0 2px var(--vscode-focusBorder);
    }

    .color-bar .color-swatch.active {
      box-shadow: 0 0 0 2px var(--vscode-button-background);
    }

    .color-bar .color-swatch input[type="color"] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .color-bar .color-swatch.add {
      background: var(--vscode-input-background);
      border: 1px dashed var(--vscode-input-border, rgba(128,128,128,0.5));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .color-bar .color-swatch.add:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }
    
    /* === VARIANTS BAR (inside preview) === */
    .variants-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 8px;
      background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
    }

    .variant-swatch {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .variant-swatch:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .variant-swatch.active {
      border-color: var(--vscode-button-background);
      box-shadow: 0 0 0 1px var(--vscode-button-background);
    }

    .variant-colors {
      display: flex;
      gap: 2px;
    }

    .variant-colors span {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
    }

    .variant-name {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      max-width: 50px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* === TOOLBAR ROW === */
    .toolbar-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      margin-bottom: var(--space-md);
      padding: var(--space-xs);
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.15));
      border-radius: var(--radius);
    }
    
    .toolbar-btn {
      width: 24px;
      height: 24px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s ease;
    }
    
    .toolbar-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
      color: var(--vscode-foreground);
    }
    
    .toolbar-btn:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    
    .toolbar-btn .codicon {
      font-size: 14px;
    }
    
    /* === ANIMATION KEYFRAMES === */
    @keyframes icon-spin { from { rotate: 0deg; } to { rotate: 360deg; } }
    @keyframes icon-spin-reverse { from { rotate: 360deg; } to { rotate: 0deg; } }
    @keyframes icon-pulse { 0%, 100% { scale: 1; opacity: 1; } 50% { scale: 1.1; opacity: 0.8; } }
    @keyframes icon-pulse-grow { 0%, 100% { scale: 1; } 50% { scale: 1.3; } }
    @keyframes icon-bounce { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }
    @keyframes icon-bounce-horizontal { 0%, 100% { translate: 0 0; } 50% { translate: 4px 0; } }
    @keyframes icon-shake { 0%, 100% { translate: 0 0; } 25% { translate: -2px 0; } 75% { translate: 2px 0; } }
    @keyframes icon-shake-vertical { 0%, 100% { translate: 0 0; } 25% { translate: 0 -2px; } 75% { translate: 0 2px; } }
    @keyframes icon-fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes icon-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes icon-fade-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes icon-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
    @keyframes icon-swing { 0%, 100% { rotate: 0deg; } 20% { rotate: 15deg; } 40% { rotate: -10deg; } 60% { rotate: 5deg; } 80% { rotate: -5deg; } }
    @keyframes icon-flip { 0% { transform: perspective(400px) rotateY(0); } 100% { transform: perspective(400px) rotateY(360deg); } }
    @keyframes icon-flip-x { 0% { transform: perspective(400px) rotateX(0); } 100% { transform: perspective(400px) rotateX(360deg); } }
    @keyframes icon-heartbeat { 0%, 100% { scale: 1; } 14% { scale: 1.3; } 28% { scale: 1; } 42% { scale: 1.3; } 70% { scale: 1; } }
    @keyframes icon-wiggle { 0%, 100% { rotate: 0deg; } 25% { rotate: -10deg; } 75% { rotate: 10deg; } }
    @keyframes icon-wobble { 0% { transform: translateX(0%); } 15% { transform: translateX(-25%) rotate(-5deg); } 30% { transform: translateX(20%) rotate(3deg); } 45% { transform: translateX(-15%) rotate(-3deg); } 60% { transform: translateX(10%) rotate(2deg); } 75% { transform: translateX(-5%) rotate(-1deg); } 100% { transform: translateX(0%); } }
    @keyframes icon-rubber-band { 0% { scale: 1 1; } 30% { scale: 1.25 0.75; } 40% { scale: 0.75 1.25; } 50% { scale: 1.15 0.85; } 65% { scale: 0.95 1.05; } 75% { scale: 1.05 0.95; } 100% { scale: 1 1; } }
    @keyframes icon-jello { 0%, 100% { transform: skewX(0deg) skewY(0deg); } 22% { transform: skewX(-12.5deg) skewY(-12.5deg); } 33% { transform: skewX(6.25deg) skewY(6.25deg); } 44% { transform: skewX(-3.125deg) skewY(-3.125deg); } 55% { transform: skewX(1.5625deg) skewY(1.5625deg); } }
    @keyframes icon-tada { 0% { scale: 1; rotate: 0deg; } 10%, 20% { scale: 0.9; rotate: -3deg; } 30%, 50%, 70%, 90% { scale: 1.1; rotate: 3deg; } 40%, 60%, 80% { scale: 1.1; rotate: -3deg; } 100% { scale: 1; rotate: 0deg; } }
    @keyframes icon-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes icon-glow { 0%, 100% { filter: drop-shadow(0 0 2px currentColor); } 50% { filter: drop-shadow(0 0 8px currentColor); } }
    @keyframes icon-zoom-in { from { scale: 0; opacity: 0; } to { scale: 1; opacity: 1; } }
    @keyframes icon-zoom-out { from { scale: 1; opacity: 1; } to { scale: 0; opacity: 0; } }
    @keyframes icon-slide-in-up { from { translate: 0 100%; opacity: 0; } to { translate: 0 0; opacity: 1; } }
    @keyframes icon-slide-in-down { from { translate: 0 -100%; opacity: 0; } to { translate: 0 0; opacity: 1; } }
    @keyframes icon-slide-in-left { from { translate: -100% 0; opacity: 0; } to { translate: 0 0; opacity: 1; } }
    @keyframes icon-slide-in-right { from { translate: 100% 0; opacity: 0; } to { translate: 0 0; opacity: 1; } }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <span class="icon-name" title="${name}">${name}</span>
    ${isBuilt !== undefined ? `<span class="badge ${isBuilt ? 'built' : 'draft'}">${isBuilt ? 'Built' : 'Draft'}</span>` : ''}
    ${isRasterized ? `<span class="badge rasterized" title="SVG has too many colors for editing">⚠</span>` : ''}
  </header>
  
  <!-- Preview Surface with Size Slider and Variants -->
  <div class="preview-surface" id="preview">
    <div class="icon-container">
      ${displaySvg}
    </div>
    <div class="size-bar">
      <input type="range" class="size-slider" id="sizeSlider" min="16" max="128" value="64" />
      <span class="size-value" id="sizeValue">64</span>
    </div>
    ${!isRasterized && variants && variants.length > 0 ? `
    <div class="variants-bar" id="variantsPalette">
      ${variants.map((v, i) => `
        <button class="variant-swatch ${i === 0 ? 'active' : ''}" data-index="${i}" title="${v.name}" onclick="applyVariant(${i})">
          <span class="variant-colors">${v.colors.slice(0, 3).map(c => `<span style="background:${c}"></span>`).join('')}</span>
          <span class="variant-name">${v.name}</span>
        </button>
      `).join('')}
    </div>
    ` : ''}
  </div>
  
  <!-- Toolbar (Actions) -->
  <div class="toolbar-row">
    ${!isRasterized ? `
    <button class="toolbar-btn" onclick="resetColors()" title="Reset">
      <span class="codicon codicon-discard"></span>
    </button>
    ` : ''}
    <button class="toolbar-btn" onclick="copySvg()" title="Copy SVG">
      <span class="codicon codicon-copy"></span>
    </button>
    <button class="toolbar-btn" onclick="downloadSvg()" title="Download">
      <span class="codicon codicon-desktop-download"></span>
    </button>
    ${!isRasterized ? `
    <button class="toolbar-btn" onclick="previewComponent()" title="Open in Editor">
      <span class="codicon codicon-edit"></span>
    </button>
    ` : ''}
    ${location ? `
    <button class="toolbar-btn" onclick="goToLocation()" title="Go to Source">
      <span class="codicon codicon-go-to-file"></span>
    </button>
    ` : ''}
    <button class="toolbar-btn" onclick="openDetails()" title="Details">
      <span class="codicon codicon-info"></span>
    </button>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    const colorMap = new Map();
    const presets = ['#ffffff','#000000','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
    const savedVariants = ${JSON.stringify(variants || [])};
    const originalSvg = document.querySelector('.icon-container svg')?.outerHTML;
    
    // === SIZE CONTROL ===
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeValue = document.getElementById('sizeValue');
    const root = document.documentElement;
    
    sizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      sizeValue.textContent = size;
      root.style.setProperty('--avatar-size', size + 'px');
    });
    
    // === COLOR DETECTION ===
    function normalizeColor(color) {
      if (!color || color === 'none' || color === 'currentColor') return null;
      const temp = document.createElement('div');
      temp.style.color = color;
      document.body.appendChild(temp);
      const computed = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      const match = computed.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
      if (match) {
        return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      }
      return color;
    }
    
    function detectColors() {
      const svg = document.querySelector('.icon-container svg');
      if (!svg) return [];
      const colors = new Map();
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && val !== 'none') {
            const hex = normalizeColor(val);
            if (hex && !colors.has(hex)) colors.set(hex, []);
            if (hex) colors.get(hex).push({ el, attr });
          }
        });
      });
      return Array.from(colors.entries());
    }
    
    function buildColorUI() {
      const palette = document.getElementById('colorPalette');
      const detected = detectColors();
      
      // Build swatches for detected colors
      let html = detected.map(([hex], i) => \`
        <button class="color-swatch detected active" style="background:\${hex}" title="\${hex}" data-color="\${hex}">
          <input type="color" value="\${hex}" onchange="changeColor('\${hex}', this.value)" />
        </button>
      \`).join('');
      
      // Add preset swatches
      html += presets.filter(p => !detected.find(([h]) => h === p)).slice(0, 8 - detected.length).map(hex => \`
        <button class="color-swatch" style="background:\${hex}" title="\${hex}" onclick="setAllColors('\${hex}')"></button>
      \`).join('');
      
      // Add custom color picker
      html += \`<button class="color-swatch add" title="Custom color">+<input type="color" value="#ffffff" onchange="setAllColors(this.value)" /></button>\`;
      
      palette.innerHTML = html;
      detected.forEach(([hex]) => colorMap.set(hex, hex));
    }
    
    function changeColor(original, newColor) {
      const svg = document.querySelector('.icon-container svg');
      if (!svg) return;
      const current = colorMap.get(original) || original;
      svg.querySelectorAll('*').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          if (normalizeColor(el.getAttribute(attr)) === current) {
            el.setAttribute(attr, newColor);
          }
        });
      });
      colorMap.set(original, newColor);
      buildColorUI();
    }
    
    function setAllColors(color) {
      const svg = document.querySelector('.icon-container svg');
      if (!svg) return;
      svg.querySelectorAll('path, circle, rect, polygon, polyline, line, ellipse').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          const val = el.getAttribute(attr);
          if (val && val !== 'none') el.setAttribute(attr, color);
        });
      });
      svg.style.fill = color;
      buildColorUI();
    }
    
    // === VARIANTS ===
    function applyVariant(index) {
      const variant = savedVariants[index];
      if (!variant || !variant.colors || variant.colors.length === 0) return;
      
      const svg = document.querySelector('.icon-container svg');
      if (!svg) return;
      
      // Get detected colors from original SVG
      const detected = detectColors();
      
      // Apply variant colors to detected colors (in order)
      detected.forEach(([originalColor], i) => {
        const newColor = variant.colors[i % variant.colors.length];
        svg.querySelectorAll('*').forEach(el => {
          ['fill', 'stroke'].forEach(attr => {
            const current = colorMap.get(originalColor) || originalColor;
            if (normalizeColor(el.getAttribute(attr)) === current) {
              el.setAttribute(attr, newColor);
            }
          });
        });
        colorMap.set(originalColor, newColor);
      });
      
      // Update active state
      document.querySelectorAll('.variant-swatch').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });
    }
    
    // === ACTIONS ===
    function goToLocation() { vscode.postMessage({ command: 'goToLocation' }); }
    function copyName() { vscode.postMessage({ command: 'copyName' }); }
    function copySvg() {
      const svgEl = document.querySelector('.icon-container svg');
      vscode.postMessage({ command: 'copySvg', svg: svgEl?.outerHTML });
    }
    function downloadSvg() {
      const svgEl = document.querySelector('.icon-container svg');
      if (svgEl) {
        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '${name}.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    function resetColors() {
      vscode.postMessage({ command: 'resetColors' });
    }
    function optimizeSvg() {
      const svgEl = document.querySelector('.icon-container svg');
      if (svgEl) {
        vscode.postMessage({ command: 'optimizeSvg', svg: svgEl.outerHTML });
      }
    }
    function previewComponent() {
      vscode.postMessage({ command: 'previewComponent' });
    }
    function openDetails() {
      vscode.postMessage({ command: 'openDetails' });
    }
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'svgOptimized') {
        const container = document.querySelector('.icon-container');
        if (container && message.svg) {
          container.innerHTML = message.svg;
          // Reapply size
          const svg = container.querySelector('svg');
          if (svg) {
            svg.style.width = 'var(--avatar-size)';
            svg.style.height = 'var(--avatar-size)';
          }
          buildColorUI();
          // Show savings
          const saved = message.originalSize - message.optimizedSize;
          const percent = Math.round((saved / message.originalSize) * 100);
          console.log(\`Optimized: \${saved} bytes saved (\${percent}%)\`);
        }
      } else if (message.command === 'resetSvg') {
        const container = document.querySelector('.icon-container');
        if (container && message.svg) {
          // Parse and insert the original SVG
          let svg = message.svg;
          if (!svg.includes('width=') && !svg.includes('style=')) {
            svg = svg.replace('<svg', '<svg width="100%" height="100%"');
          }
          container.innerHTML = svg;
          // Reapply size
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = 'var(--avatar-size)';
            svgEl.style.height = 'var(--avatar-size)';
          }
          // Reset color map and rebuild UI
          colorMap.clear();
          buildColorUI();
        }
      }
    });
    
    // Init
    buildColorUI();
  </script>
</body>
</html>`;
  }
}
