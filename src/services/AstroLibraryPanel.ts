/**
 * AstroLibraryPanel - Webview panel for the Astro icon library
 * Embeds the Astro icon manager UI inside VS Code
 */

import * as vscode from 'vscode';
import { getAstroLibraryService, IconSelectionResult } from './AstroLibraryService';

export interface IconSelectedMessage {
  type: 'iconSelected';
  icon: IconSelectionResult;
}

export interface CloseMessage {
  type: 'close';
}

export type LibraryMessage = IconSelectedMessage | CloseMessage;

/**
 * Panel that displays the Astro icon library
 */
export class AstroLibraryPanel {
  public static currentPanel: AstroLibraryPanel | undefined;
  private static readonly viewType = 'mastersvgIconLibrary';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private onIconSelectedCallback?: (icon: IconSelectionResult) => void;
  private onCloseCallback?: () => void;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Set the webview's initial html content
    this.update();

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: LibraryMessage) => {
        switch (message.type) {
          case 'iconSelected':
            if (this.onIconSelectedCallback) {
              this.onIconSelectedCallback(message.icon);
            }
            break;
          case 'close':
            if (this.onCloseCallback) {
              this.onCloseCallback();
            }
            this.dispose();
            break;
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Create or show the panel
   */
  public static async createOrShow(
    extensionUri: vscode.Uri,
    query?: string,
    mode: 'browse' | 'search' = 'browse'
  ): Promise<AstroLibraryPanel> {
    const column = vscode.ViewColumn.One;

    // Start the Astro server if not running
    const astroService = getAstroLibraryService();

    const serverStarted = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Starting Icon Library...',
        cancellable: false,
      },
      async () => {
        return await astroService.startServer();
      }
    );

    if (!serverStarted) {
      throw new Error('Failed to start icon library server');
    }

    // If panel exists, show it
    if (AstroLibraryPanel.currentPanel) {
      AstroLibraryPanel.currentPanel.panel.reveal(column);
      AstroLibraryPanel.currentPanel.updateContent(query, mode);
      return AstroLibraryPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      AstroLibraryPanel.viewType,
      '📚 Icon Library',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    AstroLibraryPanel.currentPanel = new AstroLibraryPanel(panel, extensionUri);
    AstroLibraryPanel.currentPanel.updateContent(query, mode);

    return AstroLibraryPanel.currentPanel;
  }

  /**
   * Set callback for when an icon is selected
   */
  public onIconSelected(callback: (icon: IconSelectionResult) => void): void {
    this.onIconSelectedCallback = callback;
  }

  /**
   * Set callback for when panel is closed
   */
  public onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Update the webview content
   */
  private updateContent(query?: string, mode: 'browse' | 'search' = 'browse'): void {
    const astroService = getAstroLibraryService();
    let url = astroService.getLibraryUrl();

    // Add query parameters
    const params = new URLSearchParams();
    if (query) {
      params.set('search', query);
    }
    params.set('mode', 'vscode'); // Special mode for VS Code integration
    params.set('view', mode);

    const queryString = params.toString();
    if (queryString) {
      url += '?' + queryString;
    }

    this.panel.webview.html = this.getHtmlForWebview(url);
  }

  /**
   * Update the webview (initial load)
   */
  private update(): void {
    this.updateContent();
  }

  /**
   * Generate HTML for the webview
   */
  private getHtmlForWebview(iframeUrl: string): string {
    const nonce = getNonce();
    const styles = this.getWebviewStyles();
    const scripts = this.getWebviewScripts(nonce);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:*; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Icon Library</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    ${this.getHeaderHtml()}
    <div class="iframe-container">
      <iframe id="library-frame" src="${iframeUrl}" onload="this.classList.add('loaded')" allow="clipboard-write"></iframe>
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading Icon Library...</p>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">${scripts}</script>
</body>
</html>`;
  }

  private getHeaderHtml(): string {
    return `<div class="header">
      <h1>📚 MasterSVG Icon Library</h1>
      <div class="header-actions">
        <button class="header-btn btn-secondary" onclick="openExternal()">Open in Browser</button>
        <button class="header-btn btn-secondary" onclick="closePanel()">Close</button>
      </div>
    </div>`;
  }

  private getWebviewStyles(): string {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: var(--vscode-editor-background, #1e1e1e); }
    .container { display: flex; flex-direction: column; height: 100vh; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--vscode-sideBar-background, #252526); border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c); }
    .header h1 { font-size: 14px; font-weight: 500; color: var(--vscode-foreground, #cccccc); }
    .header-actions { display: flex; gap: 8px; }
    .header-btn { padding: 4px 12px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; transition: 150ms ease; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground, #3a3d41); color: var(--vscode-button-secondaryForeground, #cccccc); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    .iframe-container { flex: 1; position: relative; }
    iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
    .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--vscode-foreground, #cccccc); }
    .loading-spinner { width: 32px; height: 32px; border: 3px solid var(--vscode-button-secondaryBackground, #3a3d41); border-top-color: var(--vscode-button-background, #0e639c); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    iframe.loaded + .loading { display: none; }`;
  }

  private getWebviewScripts(_nonce: string): string {
    return `
    const vscode = acquireVsCodeApi();
    const iframe = document.getElementById('library-frame');
    window.addEventListener('message', (event) => {
      if (event.origin !== 'http://localhost:4568') return;
      const message = event.data;
      if (message.type === 'iconSelected' || message.type === 'selectIcon') {
        vscode.postMessage({
          type: 'iconSelected',
          icon: { name: message.name || message.icon?.name, content: message.content || message.svg || message.icon?.content, category: message.category || message.icon?.category }
        });
      }
      if (message.type === 'close') vscode.postMessage({ type: 'close' });
    });
    function openExternal() {
      const url = iframe.src;
      vscode.postMessage({ type: 'openExternal', url: url.replace('?mode=vscode', '').replace('&mode=vscode', '') });
    }
    function closePanel() { vscode.postMessage({ type: 'close' }); }`;
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    AstroLibraryPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

/**
 * Generate a random nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
