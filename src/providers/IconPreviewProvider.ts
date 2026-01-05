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
  public static readonly viewType = 'masterSVG.preview';

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

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._templateService.generateHtml({ name: '', svg: '' });

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'goToLocation':
          if (this._currentLocation) {
            const uri = vscode.Uri.file(this._currentLocation.file);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(this._currentLocation.line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
              new vscode.Range(position, position),
              vscode.TextEditorRevealType.InCenter
            );
          }
          break;
        case 'copyName':
          if (this._currentName) {
            vscode.env.clipboard.writeText(this._currentName);
            vscode.window.showInformationMessage(
              t('messages.copiedNameToClipboard', { name: this._currentName })
            );
          }
          break;
        case 'copySvg': {
          // Use modified SVG from webview if available, otherwise use original
          const svgToCopy = message.svg || this._currentSvg;
          if (svgToCopy) {
            vscode.env.clipboard.writeText(svgToCopy);
            vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
          }
          break;
        }
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
                        removeViewBox: false,
                      },
                    },
                  },
                  'removeDimensions',
                ],
              });
              // Send optimized SVG back to webview
              webviewView.webview.postMessage({
                command: 'svgOptimized',
                svg: result.data,
                originalSize: message.svg.length,
                optimizedSize: result.data.length,
              });
            } catch (error) {
              vscode.window.showErrorMessage(
                t('messages.failedToOptimize', { error: String(error) })
              );
            }
          }
          break;
        case 'previewComponent':
          if (this._currentName && this._currentSvg) {
            // Pass full icon data including location for save functionality
            vscode.commands.executeCommand('masterSVG.colorEditor', {
              icon: {
                name: this._currentName,
                svg: this._currentSvg,
                filePath: this._currentLocation?.file,
                line: this._currentLocation?.line ? this._currentLocation.line - 1 : undefined,
              },
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
              animation: this._currentAnimation,
            });
          }
          break;
        case 'findUsages':
          if (this._currentName) {
            const result = await IconUsageSearchService.findUsages(this._currentName);
            webviewView.webview.postMessage({
              command: 'usagesResult',
              usages: result.usages,
              total: result.total,
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

  public updatePreview(
    name: string,
    svg: string,
    location?: { file: string; line: number },
    isBuilt?: boolean,
    animation?: PreviewAnimation
  ) {
    console.log(`[IconPreviewProvider.updatePreview] Updating preview for: ${name}, isBuilt: ${isBuilt}`);
    console.log(`[IconPreviewProvider.updatePreview] SVG length: ${svg?.length}, has animation: ${!!animation}`);
    if (animation) {
      console.log(`[IconPreviewProvider.updatePreview] Animation: ${JSON.stringify(animation)}`);
    }
    // Log first 500 chars of SVG for debugging
    console.log(`[IconPreviewProvider.updatePreview] SVG preview: ${svg?.substring(0, 500)}`);

    this._currentSvg = svg;
    this._currentName = name;
    this._currentLocation = location;
    this._isBuilt = isBuilt;
    this._currentAnimation = animation;

    // Preview shows SVG as-is from file, no transformations
    const displaySvg = svg;

    // Detect if SVG is rasterized (too many colors)
    const MAX_COLORS_FOR_EDIT = 50;
    const colorMatches = displaySvg.match(
      /#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi
    );
    const isRasterized = colorMatches
      ? new Set(colorMatches.map(c => c.toLowerCase())).size > MAX_COLORS_FOR_EDIT
      : false;

    if (this._view) {
      this._view.webview.html = this._templateService.generateHtml({
        name,
        svg: displaySvg,
        location,
        isBuilt,
        animation,
        isRasterized,
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
   * Force refresh the preview by clearing CSS cache and regenerating HTML
   * Useful during development to see template changes
   */
  public forceRefresh(): void {
    // Clear CSS cache in template service
    this._templateService.clearCache();

    // If we have current data, regenerate the preview
    if (this._currentSvg && this._currentName) {
      this.updatePreview(
        this._currentName,
        this._currentSvg,
        this._currentLocation,
        this._isBuilt,
        this._currentAnimation
      );
    } else if (this._view) {
      // Otherwise just regenerate empty state
      this._view.webview.html = this._templateService.generateHtml({ name: '', svg: '' });
    }

    vscode.window.showInformationMessage('Preview cache cleared and refreshed');
  }
}
