import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig, getFullSvgConfig } from '../utils/config';
import { ErrorHandler } from '../utils/errorHandler';
import { t } from '../i18n';

export class IconStudioPanel {
  public static currentPanel: IconStudioPanel | undefined;
  public static readonly viewType = 'masterSVG';

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
    if (IconStudioPanel.currentPanel) {
      IconStudioPanel.currentPanel._panel.reveal(column);
      if (searchQuery) {
        IconStudioPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
      }
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      IconStudioPanel.viewType,
      t('treeView.files'),
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'webview'),
        ],
      }
    );

    IconStudioPanel.currentPanel = new IconStudioPanel(panel, extensionUri, context);

    if (searchQuery) {
      IconStudioPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
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
      message => this._handleMessage(message),
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
    IconStudioPanel.currentPanel = undefined;

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
        vscode.window.showInformationMessage(t('messages.copiedToClipboard'));
        break;

      case 'getConfig': {
        const svgConfig = getFullSvgConfig();
        this.postMessage({
          type: 'config',
          data: {
            componentName: svgConfig.componentName,
            componentImport: svgConfig.componentImport,
            outputFormat: svgConfig.outputFormat,
            iconNameAttribute: svgConfig.iconNameAttribute,
            autoImport: svgConfig.autoImport,
          },
        });
        break;
      }

      case 'getWorkspaceIcons':
        await this._sendWorkspaceIcons();
        break;

      case 'getLibraryIcons':
        await this._sendLibraryIcons();
        break;

      case 'openFile': {
        const doc = await vscode.workspace.openTextDocument(message.path);
        await vscode.window.showTextDocument(doc);
        break;
      }

      case 'scanWorkspace':
        vscode.commands.executeCommand('masterSVG.scanWorkspace');
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
      vscode.window.showErrorMessage(t('messages.noActiveEditor'));
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
    await ErrorHandler.wrapAsync(async () => {
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
            source: 'workspace',
          });
        }
      }
    }, `scanning folder ${folderPath}`);
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

    const result = await ErrorHandler.wrapAsync(async () => {
      const content = fs.readFileSync(libraryPath, 'utf-8');
      const icons = JSON.parse(content);
      this.postMessage({ type: 'libraryIcons', icons });
      return true;
    }, 'loading library icons');

    if (!result) {
      this.postMessage({ type: 'libraryIcons', icons: [] });
    }
  }

  private _update() {
    this._panel.title = 'MasterSVG';
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const nonce = getNonce();

    // Load templates from external files
    // In bundled mode, templates are in dist/templates
    const templatesPath = path.join(this._extensionUri.fsPath, 'dist', 'templates', 'icon-manager');
    const css = fs.readFileSync(path.join(templatesPath, 'IconStudio.css'), 'utf8');
    const jsTemplate = fs.readFileSync(path.join(templatesPath, 'IconStudio.js'), 'utf8');
    let html = fs.readFileSync(path.join(templatesPath, 'IconStudio.html'), 'utf8');

    // Inject i18n translations into JS
    const i18nObject = {
      noIconsFound: t('webview.js.noIconsFound'),
      noIconsMatch: t('webview.js.noIconsMatch'),
      browseIconify: t('webview.js.browseIconify'),
      comingSoon: t('webview.js.comingSoon'),
      scanWorkspaceBtn: t('webview.js.scanWorkspaceBtn'),
    };
    const js = jsTemplate.replace(/__I18N__/g, JSON.stringify(i18nObject));

    // Replace placeholders
    html = html
      .replace(/\${cspSource}/g, webview.cspSource)
      .replace(/\${nonce}/g, nonce)
      .replace(/\${css}/g, css)
      .replace(/\${js}/g, js)
      // i18n translations
      .replace(/\${i18n_title}/g, t('webview.tabs.title'))
      .replace(/\${i18n_searchPlaceholder}/g, t('webview.tabs.searchPlaceholder'))
      .replace(/\${i18n_workspace}/g, t('webview.tabs.workspace'))
      .replace(/\${i18n_library}/g, t('webview.tabs.library'))
      .replace(/\${i18n_online}/g, t('webview.tabs.online'));

    return html;
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
