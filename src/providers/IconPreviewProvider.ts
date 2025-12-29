import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSvgConfig } from '../utils/config';
import { IconUsageSearchService } from '../services/IconUsageSearchService';
import { PreviewTemplateService } from '../services/PreviewTemplateService';
import { t } from '../i18n';

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
  private readonly _templateService: PreviewTemplateService;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._templateService = new PreviewTemplateService(_extensionUri);
  }

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

  private _readColorMappings(): Record<string, Record<string, string>> {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath || !fs.existsSync(filePath)) return {};
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+colorMappings\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private _applyColorMappings(svg: string, iconName: string): string {
    const mappings = this._readColorMappings()[iconName];
    if (!mappings || Object.keys(mappings).length === 0) return svg;
    
    let result = svg;
    for (const [originalColor, newColor] of Object.entries(mappings)) {
      // Replace color in fill and stroke attributes (case insensitive)
      const regex = new RegExp(originalColor.replace('#', '#?'), 'gi');
      result = result.replace(regex, newColor);
    }
    return result;
  }

  private _getSavedVariants(iconName: string): Array<{ name: string; colors: string[] }> {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName] || {};
    
    // Check if there are color modifications
    const colorMappings = this._readColorMappings()[iconName] || {};
    const hasColorChanges = Object.keys(colorMappings).length > 0;
    
    // Include _original variant for reset functionality, but filter other internal variants
    // Also filter out "custom" if there are no color changes (would be duplicate of _original)
    return Object.entries(iconVariants)
      .filter(([name]) => {
        if (name.startsWith('_') && name !== '_original') return false;
        if (name === 'custom' && !hasColorChanges) return false;
        return true;
      })
      .map(([name, colors]) => ({ name, colors }));
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

    webviewView.webview.html = this._templateService.generateHtml({ name: '', svg: '' });

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
            vscode.window.showInformationMessage(t('messages.copiedNameToClipboard', { name: this._currentName }));
          }
          break;
        case 'copySvg':
          // Use modified SVG from webview if available, otherwise use original
          const svgToCopy = message.svg || this._currentSvg;
          if (svgToCopy) {
            vscode.env.clipboard.writeText(svgToCopy);
            vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
          }
          break;
        case 'refreshPreview':
          // Re-render the current preview with stored values
          if (this._view && this._currentName && this._currentSvg) {
            this.updatePreview(
              this._currentName, 
              this._currentSvg, 
              this._currentLocation, 
              this._isBuilt, 
              this._currentAnimation
            );
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
              vscode.window.showErrorMessage(t('messages.failedToOptimize', { error: String(error) }));
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
            const result = await IconUsageSearchService.findUsages(this._currentName);
            webviewView.webview.postMessage({ 
              command: 'usagesResult', 
              usages: result.usages,
              total: result.total 
            });
          }
          break;
        case 'goToUsage':
          if (message.file && message.line) {
            await IconUsageSearchService.goToLocation(message.file, message.line);
          }
          break;
      }
    });
  }

  public updatePreview(name: string, svg: string, location?: { file: string; line: number }, isBuilt?: boolean, animation?: PreviewAnimation) {
    this._currentSvg = svg;
    this._currentName = name;
    this._currentLocation = location;
    this._isBuilt = isBuilt;
    this._currentAnimation = animation;
    
    // Apply color mappings for built icons to show current colors
    let displaySvg = svg;
    if (isBuilt) {
      displaySvg = this._applyColorMappings(svg, name);
    }
    
    // Detect if SVG is rasterized (too many colors)
    const MAX_COLORS_FOR_EDIT = 50;
    const colorMatches = displaySvg.match(/#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi);
    const isRasterized = colorMatches ? new Set(colorMatches.map(c => c.toLowerCase())).size > MAX_COLORS_FOR_EDIT : false;
    
    // Get saved variants for this icon
    const variants = this._getSavedVariants(name);
    
    if (this._view) {
      this._view.webview.html = this._templateService.generateHtml({
        name, svg: displaySvg, location, isBuilt, animation, isRasterized, variants
      });
    }
  }

  public clearPreview() {
    this._currentSvg = undefined;
    this._currentName = undefined;
    this._currentLocation = undefined;
    this._currentAnimation = undefined;
    
    if (this._view) {
      this._view.webview.html = this._templateService.generateHtml({ name: '', svg: '' });
    }
  }

  /**
   * Update only the SVG content without regenerating the entire HTML.
   * Used when Editor changes colors and needs to sync with TreeView preview.
   * @param currentColors - Optional colors from Editor to show as "custom" variant in real-time
   */
  public updateSvgContent(name: string, svg: string, currentColors?: string[]) {
    // Only update if we're showing the same icon
    if (this._currentName === name && this._view) {
      this._currentSvg = svg;
      this._view.webview.postMessage({
        command: 'updateSvgContent',
        svg: svg,
        customColors: currentColors
      });
    }
  }
}

