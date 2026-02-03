import * as vscode from 'vscode';
import { IconUsageSearchService } from '../../services/icon/IconUsageSearchService';
import { PreviewTemplateService } from '../../services/template/PreviewTemplateService';
import type { PreviewAnimation } from '../../services/types';
import { t } from '../../i18n';

// Re-export for backwards compatibility
export type { PreviewAnimation };

/**
 * Message received from the webview
 */
interface WebviewMessage {
  command: string;
  svg?: string;
  file?: string;
  line?: number;
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
    webviewView.webview.onDidReceiveMessage(message => this._handleMessage(message, webviewView));
  }

  /**
   * Handle messages from the webview
   */
  private async _handleMessage(message: WebviewMessage, webviewView: vscode.WebviewView): Promise<void> {
    switch (message.command) {
      case 'goToLocation':
        await this._handleGoToLocation();
        break;
      case 'copyName':
        this._handleCopyName();
        break;
      case 'copySvg':
        this._handleCopySvg(message.svg);
        break;
      case 'refreshPreview':
        this._handleRefreshPreview();
        break;
      case 'optimizeSvg':
        await this._handleOptimizeSvg(message.svg, webviewView);
        break;
      case 'previewComponent':
        this._handlePreviewComponent();
        break;
      case 'openDetails':
        await this._handleOpenDetails();
        break;
      case 'findUsages':
        await this._handleFindUsages(webviewView);
        break;
      case 'goToUsage':
        await this._handleGoToUsage(message.file, message.line);
        break;
    }
  }

  private async _handleGoToLocation(): Promise<void> {
    if (!this._currentLocation) return;
    const uri = vscode.Uri.file(this._currentLocation.file);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    const position = new vscode.Position(this._currentLocation.line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  private _handleCopyName(): void {
    if (!this._currentName) return;
    vscode.env.clipboard.writeText(this._currentName);
    vscode.window.showInformationMessage(t('messages.copiedNameToClipboard', { name: this._currentName }));
  }

  private _handleCopySvg(messageSvg?: string): void {
    const svgToCopy = messageSvg || this._currentSvg;
    if (!svgToCopy) return;
    vscode.env.clipboard.writeText(svgToCopy);
    vscode.window.showInformationMessage(t('messages.svgCopiedToClipboard'));
  }

  private _handleRefreshPreview(): void {
    if (this._view && this._currentName && this._currentSvg) {
      this.updatePreview({
        name: this._currentName,
        svg: this._currentSvg,
        location: this._currentLocation,
        isBuilt: this._isBuilt,
        animation: this._currentAnimation,
      });
    }
  }

  private async _handleOptimizeSvg(svg: string | undefined, webviewView: vscode.WebviewView): Promise<void> {
    if (!svg) return;
    try {
      const svgo = await import('svgo');
      const result = svgo.optimize(svg, {
        multipass: true,
        plugins: [
          { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
          'removeDimensions',
        ],
      });
      webviewView.webview.postMessage({
        command: 'svgOptimized',
        svg: result.data,
        originalSize: svg.length,
        optimizedSize: result.data.length,
      });
    } catch (error) {
      vscode.window.showErrorMessage(t('messages.failedToOptimize', { error: String(error) }));
    }
  }

  private _handlePreviewComponent(): void {
    if (!this._currentName || !this._currentSvg) return;
    vscode.commands.executeCommand('masterSVG.colorEditor', {
      icon: {
        name: this._currentName,
        svg: this._currentSvg,
        filePath: this._currentLocation?.file,
        line: this._currentLocation?.line ? this._currentLocation.line - 1 : undefined,
      },
    });
  }

  private async _handleOpenDetails(): Promise<void> {
    if (!this._currentName || !this._currentSvg) return;
    const { IconDetailsPanel } = await import('../../panels/IconDetailsPanel');
    IconDetailsPanel.createOrShow(this._extensionUri, {
      name: this._currentName,
      svg: this._currentSvg,
      location: this._currentLocation,
      isBuilt: this._isBuilt,
      animation: this._currentAnimation,
    });
  }

  private async _handleFindUsages(webviewView: vscode.WebviewView): Promise<void> {
    if (!this._currentName) return;
    const result = await IconUsageSearchService.findUsages(this._currentName);
    webviewView.webview.postMessage({
      command: 'usagesResult',
      usages: result.usages,
      total: result.total,
    });
  }

  private async _handleGoToUsage(file?: string, line?: number): Promise<void> {
    if (file && line) {
      await IconUsageSearchService.goToLocation(file, line);
    }
  }

  /**
   * Options for updating the preview
   */
  public updatePreview(options: {
    name: string;
    svg: string;
    location?: { file: string; line: number };
    isBuilt?: boolean;
    animation?: PreviewAnimation;
  }) {
    const { name, svg, location, isBuilt, animation } = options;

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
      this.updatePreview({
        name: this._currentName,
        svg: this._currentSvg,
        location: this._currentLocation,
        isBuilt: this._isBuilt,
        animation: this._currentAnimation,
      });
    } else if (this._view) {
      // Otherwise just regenerate empty state
      this._view.webview.html = this._templateService.generateHtml({ name: '', svg: '' });
    }

    vscode.window.showInformationMessage('Preview cache cleared and refreshed');
  }
}
