import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig, getFullSvgConfig } from '../utils/config';

export class IconManagerPanel {
  public static currentPanel: IconManagerPanel | undefined;
  public static readonly viewType = 'iconManager';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    searchQuery?: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, show it
    if (IconManagerPanel.currentPanel) {
      IconManagerPanel.currentPanel._panel.reveal(column);
      if (searchQuery) {
        IconManagerPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
      }
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      IconManagerPanel.viewType,
      'Icon Manager',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'webview')
        ]
      }
    );

    IconManagerPanel.currentPanel = new IconManagerPanel(panel, extensionUri, context);

    if (searchQuery) {
      IconManagerPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;

    // Set initial HTML
    this._update();

    // Listen for disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );

    // Update when panel becomes visible
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );
  }

  public postMessage(message: any) {
    this._panel.webview.postMessage(message);
  }

  public dispose() {
    IconManagerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _handleMessage(message: any) {
    switch (message.type) {
      case 'insertIcon':
        await this._insertIcon(message.iconName, message.format);
        break;

      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.text);
        vscode.window.showInformationMessage('Copied to clipboard!');
        break;

      case 'getConfig':
        const svgConfig = getFullSvgConfig();
        this.postMessage({
          type: 'config',
          data: {
            componentName: svgConfig.componentName,
            componentImport: svgConfig.componentImport,
            outputFormat: svgConfig.outputFormat,
            iconNameAttribute: svgConfig.iconNameAttribute,
            autoImport: svgConfig.autoImport
          }
        });
        break;

      case 'getWorkspaceIcons':
        await this._sendWorkspaceIcons();
        break;

      case 'getLibraryIcons':
        await this._sendLibraryIcons();
        break;

      case 'openFile':
        const doc = await vscode.workspace.openTextDocument(message.path);
        await vscode.window.showTextDocument(doc);
        break;

      case 'scanWorkspace':
        vscode.commands.executeCommand('iconManager.scanWorkspace');
        break;

      case 'showError':
        vscode.window.showErrorMessage(message.text);
        break;

      case 'showInfo':
        vscode.window.showInformationMessage(message.text);
        break;
    }
  }

  private async _insertIcon(iconName: string, format?: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');
    const outputFormat = format || getSvgConfig<string>('outputFormat', 'jsx');

    let snippet: string;
    switch (outputFormat) {
      case 'html':
        snippet = `<iconify-icon icon="${iconName}"></iconify-icon>`;
        break;
      default:
        snippet = `<${componentName} ${nameAttr}="${iconName}" />`;
    }

    await editor.insertSnippet(new vscode.SnippetString(snippet));

    // Focus back to editor
    vscode.window.showTextDocument(editor.document);
  }

  private async _sendWorkspaceIcons() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.postMessage({ type: 'workspaceIcons', icons: [] });
      return;
    }

    const svgFolders = getSvgConfig<string[]>('svgFolders', []);
    const icons: any[] = [];

    for (const folder of workspaceFolders) {
      for (const svgFolder of svgFolders) {
        const fullPath = path.join(folder.uri.fsPath, svgFolder);
        if (fs.existsSync(fullPath)) {
          await this._scanSvgFolder(fullPath, icons, svgFolder);
        }
      }
    }

    this.postMessage({ type: 'workspaceIcons', icons });
  }

  private async _scanSvgFolder(folderPath: string, icons: any[], category: string) {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        await this._scanSvgFolder(fullPath, icons, `${category}/${entry.name}`);
      } else if (entry.isFile() && entry.name.endsWith('.svg')) {
        const name = path.basename(entry.name, '.svg');
        const svg = fs.readFileSync(fullPath, 'utf-8');
        
        icons.push({
          name,
          svg,
          path: fullPath,
          category,
          source: 'workspace'
        });
      }
    }
  }

  private async _sendLibraryIcons() {
    let libraryPath = getSvgConfig<string>('libraryPath', '');

    if (!libraryPath) {
      // Default to AppData location
      const appDataPath = process.env.APPDATA || process.env.HOME || '';
      libraryPath = path.join(appDataPath, 'icon-manager', 'icons.json');
    }

    if (!fs.existsSync(libraryPath)) {
      this.postMessage({ type: 'libraryIcons', icons: [] });
      return;
    }

    try {
      const content = fs.readFileSync(libraryPath, 'utf-8');
      const icons = JSON.parse(content);
      this.postMessage({ type: 'libraryIcons', icons });
    } catch (error) {
      this.postMessage({ type: 'libraryIcons', icons: [] });
    }
  }

  private _update() {
    this._panel.title = 'Icon Manager';
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const nonce = getNonce();

    // For now, use a simple embedded UI
    // Later this can load from the Astro app build
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <title>Icon Manager</title>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d30;
      --text-primary: #cccccc;
      --text-secondary: #969696;
      --accent: #0e639c;
      --accent-hover: #1177bb;
      --border: #3c3c3c;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-editor-background, var(--bg-primary));
      color: var(--vscode-foreground, var(--text-primary));
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-input {
      flex: 1;
      padding: 8px 12px;
      background: var(--vscode-input-background, var(--bg-tertiary));
      color: var(--vscode-input-foreground, var(--text-primary));
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 4px;
      font-size: inherit;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder, var(--accent));
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
    }

    .tab {
      padding: 10px 16px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: inherit;
      border-bottom: 2px solid transparent;
    }

    .tab:hover {
      color: var(--text-primary);
    }

    .tab.active {
      color: var(--text-primary);
      border-bottom-color: var(--accent);
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .icons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 8px;
    }

    .icon-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: var(--bg-secondary);
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .icon-item:hover {
      background: var(--bg-tertiary);
      border-color: var(--border);
    }

    .icon-item.selected {
      border-color: var(--accent);
      background: rgba(14, 99, 156, 0.15);
    }

    .icon-item svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    .icon-item .name {
      margin-top: 6px;
      font-size: 10px;
      color: var(--text-secondary);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      text-align: center;
      padding: 40px;
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      opacity: 0.5;
      margin-bottom: 16px;
    }

    .btn {
      padding: 8px 16px;
      background: var(--vscode-button-background, var(--accent));
      color: var(--vscode-button-foreground, white);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: inherit;
      margin-top: 16px;
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground, var(--accent-hover));
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <input type="text" class="search-input" id="searchInput" placeholder="Search icons...">
    </div>
    
    <div class="tabs">
      <button class="tab active" data-tab="workspace">Workspace</button>
      <button class="tab" data-tab="library">Library</button>
      <button class="tab" data-tab="online">Online</button>
    </div>

    <div class="content" id="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    let currentTab = 'workspace';
    let workspaceIcons = [];
    let libraryIcons = [];
    let searchQuery = '';

    const content = document.getElementById('content');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.querySelectorAll('.tab');

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderContent();
      });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderContent();
    });

    // Message handling
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'workspaceIcons':
          workspaceIcons = message.icons || [];
          if (currentTab === 'workspace') renderContent();
          break;
          
        case 'libraryIcons':
          libraryIcons = message.icons || [];
          if (currentTab === 'library') renderContent();
          break;
          
        case 'search':
          searchInput.value = message.query;
          searchQuery = message.query.toLowerCase();
          renderContent();
          break;
      }
    });

    function renderContent() {
      switch (currentTab) {
        case 'workspace':
          renderIcons(workspaceIcons);
          break;
        case 'library':
          renderIcons(libraryIcons);
          break;
        case 'online':
          renderOnline();
          break;
      }
    }

    function renderIcons(icons) {
      const filtered = icons.filter(icon => 
        icon.name.toLowerCase().includes(searchQuery)
      );

      if (filtered.length === 0) {
        content.innerHTML = \`
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>\${icons.length === 0 ? 'No icons found. Scan your workspace to detect SVG files.' : 'No icons match your search.'}</p>
            \${icons.length === 0 ? '<button class="btn" onclick="scanWorkspace()">Scan Workspace</button>' : ''}
          </div>
        \`;
        return;
      }

      content.innerHTML = '<div class="icons-grid"></div>';
      const grid = content.querySelector('.icons-grid');

      filtered.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-item';
        item.innerHTML = \`
          \${icon.svg || '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4"/></svg>'}
          <span class="name" title="\${icon.name}">\${icon.name}</span>
        \`;
        item.addEventListener('click', () => insertIcon(icon.name));
        grid.appendChild(item);
      });
    }

    function renderOnline() {
      content.innerHTML = \`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <p>Browse icons from Iconify</p>
          <p style="font-size: 11px; margin-top: 8px;">Coming soon...</p>
        </div>
      \`;
    }

    function insertIcon(name) {
      vscode.postMessage({ type: 'insertIcon', iconName: name });
    }

    function scanWorkspace() {
      vscode.postMessage({ type: 'scanWorkspace' });
    }

    // Initial load
    vscode.postMessage({ type: 'getWorkspaceIcons' });
    vscode.postMessage({ type: 'getLibraryIcons' });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
