import * as vscode from 'vscode';
import { IconCatalogService, CatalogIcon, ICON_COLLECTIONS } from '../services/IconCatalogService';

export class IconCatalogPanel {
  public static currentPanel: IconCatalogPanel | undefined;
  public static readonly viewType = 'iconCatalog';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _catalogService: IconCatalogService;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, catalogService: IconCatalogService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (IconCatalogPanel.currentPanel) {
      IconCatalogPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      IconCatalogPanel.viewType,
      'Icon Catalog',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    IconCatalogPanel.currentPanel = new IconCatalogPanel(panel, extensionUri, catalogService);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    catalogService: IconCatalogService
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._catalogService = catalogService;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'search':
            await this._handleSearch(message.query, message.collection);
            break;
          case 'fetchSvg':
            await this._handleFetchSvg(message.icon);
            break;
          case 'addToProject':
            await this._handleAddToProject(message.icon, message.svg);
            break;
          case 'copyToClipboard':
            await vscode.env.clipboard.writeText(message.svg);
            vscode.window.showInformationMessage('SVG copied to clipboard');
            break;
          case 'openCollection':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async _handleSearch(query: string, collection?: string) {
    try {
      this._panel.webview.postMessage({ command: 'searchStart' });
      
      const results = await this._catalogService.searchIcons(query, collection);
      
      this._panel.webview.postMessage({
        command: 'searchResults',
        results: results.slice(0, 100) // Limit results
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'searchError',
        error: String(error)
      });
    }
  }

  private async _handleFetchSvg(icon: CatalogIcon) {
    try {
      const svg = await this._catalogService.fetchIconSvg(icon);
      this._panel.webview.postMessage({
        command: 'svgFetched',
        icon: icon.name,
        collection: icon.collection,
        svg
      });
    } catch (error) {
      console.error('Error fetching SVG:', error);
    }
  }

  private async _handleAddToProject(icon: CatalogIcon, svg: string) {
    try {
      // Add to project tracking
      this._catalogService.addIconToProject(icon, svg);
      
      // Ask user what to do with the icon
      const action = await vscode.window.showQuickPick([
        { label: '📋 Copy to clipboard', value: 'copy' },
        { label: '📁 Save to file', value: 'save' },
        { label: '➕ Add to icons.js', value: 'icons-js' }
      ], {
        placeHolder: `What do you want to do with "${icon.name}"?`
      });

      if (!action) return;

      switch (action.value) {
        case 'copy':
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage(`"${icon.name}" copied! (from ${ICON_COLLECTIONS[icon.collection].name})`);
          break;
        case 'save':
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${icon.name}.svg`),
            filters: { 'SVG Files': ['svg'] }
          });
          if (uri) {
            const fs = await import('fs');
            fs.writeFileSync(uri.fsPath, svg);
            vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
          }
          break;
        case 'icons-js':
          await this._addToIconsJs(icon.name, svg);
          break;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  }

  private async _addToIconsJs(iconName: string, svg: string) {
    // Find icons.js in workspace
    const files = await vscode.workspace.findFiles('**/icons.js', '**/node_modules/**', 5);
    
    if (files.length === 0) {
      vscode.window.showWarningMessage('No icons.js file found in workspace');
      return;
    }

    const targetFile = files.length === 1 
      ? files[0]
      : await vscode.window.showQuickPick(
          files.map(f => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
          { placeHolder: 'Select icons.js file' }
        ).then(item => item?.uri);

    if (!targetFile) return;

    // Open and edit the file
    const document = await vscode.workspace.openTextDocument(targetFile);
    const text = document.getText();

    // Try to find the export object/array
    const editor = await vscode.window.showTextDocument(document);
    
    // Create the icon entry
    const iconEntry = `\n  '${iconName}': \`${svg.replace(/`/g, '\\`')}\`,`;

    // Find position to insert (before last closing brace/bracket)
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const insertPos = Math.max(lastBrace, lastBracket);

    if (insertPos > 0) {
      const position = document.positionAt(insertPos);
      await editor.edit(editBuilder => {
        editBuilder.insert(position, iconEntry);
      });
      vscode.window.showInformationMessage(`Added "${iconName}" to ${vscode.workspace.asRelativePath(targetFile)}`);
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const collections = this._catalogService.getCollections();
    
    const collectionsOptions = collections
      .map(c => `<option value="${c.id}">${c.name} (${c.totalIcons}+ icons)</option>`)
      .join('');

    const collectionsCards = collections
      .map(c => `
        <div class="collection-card" onclick="selectCollection('${c.id}')">
          <div class="collection-header">
            <span class="collection-name">${c.name}</span>
            <span class="collection-license">${c.license}</span>
          </div>
          <div class="collection-desc">${c.description}</div>
          <div class="collection-stats">
            <span>${c.totalIcons}+ icons</span>
            <span class="style-badge">${c.style}</span>
          </div>
          <a class="collection-link" href="#" onclick="event.stopPropagation(); openCollection('${c.website}')">
            Visit website →
          </a>
        </div>
      `)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Icon Catalog</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    
    .header {
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 20px;
      margin-bottom: 8px;
    }
    
    .header p {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    
    .search-section {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .search-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 6px;
      font-size: 14px;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    
    .collection-select {
      padding: 10px 14px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border-radius: 6px;
      min-width: 200px;
    }
    
    .search-btn {
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    
    .search-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .collection-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .collection-card:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(-2px);
    }
    
    .collection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .collection-name {
      font-weight: 600;
      font-size: 14px;
    }
    
    .collection-license {
      font-size: 10px;
      padding: 2px 6px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
    }
    
    .collection-desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      line-height: 1.4;
    }
    
    .collection-stats {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    
    .style-badge {
      padding: 1px 6px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 3px;
    }
    
    .collection-link {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    
    .collection-link:hover {
      text-decoration: underline;
    }
    
    .results-section {
      display: none;
    }
    
    .results-section.active {
      display: block;
    }
    
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .results-count {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    
    .back-btn {
      padding: 6px 12px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
    }
    
    .icon-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .icon-card:hover {
      border-color: var(--vscode-focusBorder);
      transform: scale(1.02);
    }
    
    .icon-preview {
      width: 48px;
      height: 48px;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .icon-preview svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
    
    .icon-name {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .icon-collection {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.7;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--vscode-panel-border);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .preview-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .preview-modal.active {
      display: flex;
    }
    
    .preview-content {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
    }
    
    .preview-icon {
      width: 96px;
      height: 96px;
      margin: 0 auto 16px;
      padding: 16px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    
    .preview-icon svg {
      width: 100%;
      height: 100%;
    }
    
    .preview-name {
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 4px;
    }
    
    .preview-collection {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      margin-bottom: 20px;
    }
    
    .preview-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .preview-btn {
      padding: 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    
    .preview-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .preview-btn.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 Icon Catalog</h1>
    <p>Search and add icons from popular open-source collections</p>
  </div>
  
  <div class="search-section">
    <input type="text" class="search-input" id="searchInput" placeholder="Search icons (e.g., arrow, user, home)..." />
    <select class="collection-select" id="collectionSelect">
      <option value="">All Collections</option>
      ${collectionsOptions}
    </select>
    <button class="search-btn" onclick="search()">Search</button>
  </div>
  
  <div id="collectionsSection">
    <h3 style="margin-bottom: 16px; font-size: 14px;">Available Collections</h3>
    <div class="collections-grid">
      ${collectionsCards}
    </div>
  </div>
  
  <div class="results-section" id="resultsSection">
    <div class="results-header">
      <span class="results-count" id="resultsCount">0 results</span>
      <button class="back-btn" onclick="showCollections()">← Back to collections</button>
    </div>
    <div class="results-grid" id="resultsGrid"></div>
  </div>
  
  <div class="loading" id="loading" style="display: none;">
    <div class="loading-spinner"></div>
    <div>Searching icons...</div>
  </div>
  
  <div class="preview-modal" id="previewModal" onclick="closePreview(event)">
    <div class="preview-content" onclick="event.stopPropagation()">
      <div class="preview-icon" id="previewIcon"></div>
      <div class="preview-name" id="previewName"></div>
      <div class="preview-collection" id="previewCollection"></div>
      <div class="preview-actions">
        <button class="preview-btn primary" onclick="addToProject()">➕ Add to Project</button>
        <button class="preview-btn secondary" onclick="copyToClipboard()">📋 Copy SVG</button>
        <button class="preview-btn secondary" onclick="closePreview()">Cancel</button>
      </div>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    let currentIcon = null;
    let currentSvg = null;
    const svgCache = new Map();
    
    // Enter key to search
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') search();
    });
    
    function search() {
      const query = document.getElementById('searchInput').value.trim();
      if (!query) return;
      
      const collection = document.getElementById('collectionSelect').value;
      
      document.getElementById('loading').style.display = 'block';
      document.getElementById('collectionsSection').style.display = 'none';
      document.getElementById('resultsSection').classList.remove('active');
      
      vscode.postMessage({ command: 'search', query, collection: collection || undefined });
    }
    
    function selectCollection(id) {
      document.getElementById('collectionSelect').value = id;
      document.getElementById('searchInput').focus();
    }
    
    function showCollections() {
      document.getElementById('collectionsSection').style.display = 'block';
      document.getElementById('resultsSection').classList.remove('active');
    }
    
    function openCollection(url) {
      vscode.postMessage({ command: 'openCollection', url });
    }
    
    function showIcon(icon) {
      currentIcon = icon;
      
      document.getElementById('previewName').textContent = icon.name;
      document.getElementById('previewCollection').textContent = 'from ' + icon.collection;
      document.getElementById('previewModal').classList.add('active');
      
      // Check cache or fetch SVG
      const key = icon.collection + ':' + icon.name;
      if (svgCache.has(key)) {
        currentSvg = svgCache.get(key);
        document.getElementById('previewIcon').innerHTML = currentSvg;
      } else {
        document.getElementById('previewIcon').innerHTML = '<div class="loading-spinner"></div>';
        vscode.postMessage({ command: 'fetchSvg', icon });
      }
    }
    
    function closePreview(event) {
      if (!event || event.target.classList.contains('preview-modal')) {
        document.getElementById('previewModal').classList.remove('active');
        currentIcon = null;
        currentSvg = null;
      }
    }
    
    function addToProject() {
      if (currentIcon && currentSvg) {
        vscode.postMessage({ command: 'addToProject', icon: currentIcon, svg: currentSvg });
        closePreview();
      }
    }
    
    function copyToClipboard() {
      if (currentSvg) {
        vscode.postMessage({ command: 'copyToClipboard', svg: currentSvg });
      }
    }
    
    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      switch (message.command) {
        case 'searchStart':
          document.getElementById('loading').style.display = 'block';
          break;
          
        case 'searchResults':
          document.getElementById('loading').style.display = 'none';
          document.getElementById('resultsSection').classList.add('active');
          document.getElementById('resultsCount').textContent = message.results.length + ' results';
          
          const grid = document.getElementById('resultsGrid');
          grid.innerHTML = message.results.map(icon => \`
            <div class="icon-card" onclick='showIcon(\${JSON.stringify(icon)})'>
              <div class="icon-preview" id="preview-\${icon.collection}-\${icon.name}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </div>
              <div class="icon-name">\${icon.name}</div>
              <div class="icon-collection">\${icon.collection}</div>
            </div>
          \`).join('');
          
          // Lazy load SVGs for visible icons
          message.results.slice(0, 20).forEach(icon => {
            vscode.postMessage({ command: 'fetchSvg', icon });
          });
          break;
          
        case 'searchError':
          document.getElementById('loading').style.display = 'none';
          alert('Search error: ' + message.error);
          break;
          
        case 'svgFetched':
          const key = message.collection + ':' + message.icon;
          svgCache.set(key, message.svg);
          
          // Update preview if open
          if (currentIcon && currentIcon.name === message.icon && currentIcon.collection === message.collection) {
            currentSvg = message.svg;
            document.getElementById('previewIcon').innerHTML = message.svg;
          }
          
          // Update grid icon
          const previewEl = document.getElementById('preview-' + message.collection + '-' + message.icon);
          if (previewEl) {
            previewEl.innerHTML = message.svg;
          }
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    IconCatalogPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
