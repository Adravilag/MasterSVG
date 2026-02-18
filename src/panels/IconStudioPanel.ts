import * as vscode from 'vscode';
import * as path from 'path';
import { getSvgConfig, getFullSvgConfig, updateSvgConfig } from '../utils/config';
import { getFullOutputPath, getFrameworkIconUsage } from '../utils/configHelper';
import { SvgTransformer } from '../services/svg/SvgTransformer';
import { buildIcon, showBuildSuccess } from '../utils/iconBuildHelpers';
import { getComponentExporter } from '../services';
import { ErrorHandler } from '../utils/errorHandler';
import { t } from '../i18n';

// Templates
import iconStudioCss from '../templates/icon-manager/IconStudio.css';
import iconStudioJs from '../templates/icon-manager/IconStudio';
import iconStudioHtml from '../templates/icon-manager/IconStudio.html';

export class IconStudioPanel {
    public static currentPanel: IconStudioPanel | undefined;
    public static readonly viewType = 'masterSVG';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, searchQuery?: string) {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        if (IconStudioPanel.currentPanel) {
            IconStudioPanel.currentPanel._panel.reveal(column);
            if (searchQuery) {
                IconStudioPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            IconStudioPanel.viewType,
            t('treeView.files'),
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'webview'),
                ],
            }
        );

        IconStudioPanel.currentPanel = new IconStudioPanel(panel, context);
        if (searchQuery) {
            IconStudioPanel.currentPanel.postMessage({ type: 'search', query: searchQuery });
        }
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;
        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(m => this._handleMessage(m), null, this._disposables);
        this._panel.onDidChangeViewState(() => { if (this._panel.visible) this._update(); }, null, this._disposables);
    }

    public postMessage(message: any) {
        this._panel.webview.postMessage(message);
    }

    private async _handleMessage(message: any) {
        switch (message.type) {
            case 'insertIcon':
                await this._insertIcon(message.iconName, message.format, !!message.splitTs);
                break;

            case 'setBuildFormat':
                if (message.format) {
                    await updateSvgConfig('buildFormat', message.format);
                    vscode.window.showInformationMessage(t('messages.outputFormatSet', { format: message.format }));
                }
                break;

            case 'updateConfig': {
                try {
                    if (message.key) {
                        await updateSvgConfig(message.key, message.value);
                        // send back full config so webview can refresh
                        const cfg = {
                            componentName: getSvgConfig<string>('componentName', 'Icon'),
                            componentImport: getSvgConfig<string>('componentImport', '@/components/ui/Icon'),
                            outputFormat: getSvgConfig<string>('outputFormat', 'jsx'),
                            iconNameAttribute: getSvgConfig<string>('iconNameAttribute', 'name'),
                            autoImport: getSvgConfig<boolean>('autoImport', true),
                            outputDirectory: getSvgConfig<string>('outputDirectory', ''),
                            buildFormat: getSvgConfig<string>('buildFormat', 'icons.js'),
                        };
                        this.postMessage({ type: 'config', data: cfg });
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(t('messages.saveConfigError'));
                }
                break;
            }

            case 'toggleWatchMode': {
                try {
                    const val = !!message.value;
                    await updateSvgConfig('watchMode', val);
                    // notify webview of change
                    this.postMessage({ type: 'watchMode', enabled: val });
                } catch (e) {
                    vscode.window.showErrorMessage(t('messages.saveConfigError'));
                }
                break;
            }

            case 'getConfig': {
                const cfg = {
                    componentName: getSvgConfig<string>('componentName', 'Icon'),
                    componentImport: getSvgConfig<string>('componentImport', '@/components/ui/Icon'),
                    outputFormat: getSvgConfig<string>('outputFormat', 'jsx'),
                    iconNameAttribute: getSvgConfig<string>('iconNameAttribute', 'name'),
                    autoImport: getSvgConfig<boolean>('autoImport', true),
                    outputDirectory: getSvgConfig<string>('outputDirectory', ''),
                    buildFormat: getSvgConfig<string>('buildFormat', 'icons.js'),
                };
                this.postMessage({ type: 'config', data: cfg });
                break;
            }

            case 'getWorkspaceIcons':
                await this._sendWorkspaceIcons();
                break;

            case 'getLibraryIcons':
                await this._sendLibraryIcons();
                break;

            case 'openFile': {
                // Accept either a string path or a URI-like object
                const arg = message.path;
                const doc = typeof arg === 'string' ? await vscode.workspace.openTextDocument(arg) : await vscode.workspace.openTextDocument(arg);
                await vscode.window.showTextDocument(doc);
                break;
            }

            case 'copyToClipboard':
                await vscode.env.clipboard.writeText(message.text);
                vscode.window.showInformationMessage(t('messages.copiedToClipboard'));
                break;

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

    // --- Helpers de Archivos (VS Code Native API) ---

    private async _getSvgContent(iconName: string): Promise<string | undefined> {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return undefined;

        const configFolders = getSvgConfig<string[]>('svgFolders', []);
        for (const folder of folders) {
            const potentialPaths = [
                ...configFolders.map(f => vscode.Uri.joinPath(folder.uri, f, `${iconName}.svg`)),
                vscode.Uri.joinPath(folder.uri, 'icons', `${iconName}.svg`)
            ];

            for (const uri of potentialPaths) {
                try {
                    const content = await vscode.workspace.fs.readFile(uri);
                    return Buffer.from(content).toString('utf8');
                } catch { continue; }
            }
        }
        return undefined;
    }

    private async _insertIcon(iconName: string, format?: string, splitTs?: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage(t('messages.noActiveEditor'));

        const componentName = getSvgConfig<string>('componentName', 'Icon');
        const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');
        const outputFormat = format || getSvgConfig<string>('outputFormat', 'jsx');
        const buildFormat = getSvgConfig<string>('buildFormat', '');

        const svgContent = await this._getSvgContent(iconName);
        let snippet: string;

        if (splitTs && ['jsx', 'js', 'mjs'].includes(outputFormat)) {
            snippet = await this._handleSplitTs(iconName, svgContent);
        } else if (buildFormat === 'transform' && svgContent) {
            snippet = await this._handleTransform(iconName, svgContent);
        } else {
            snippet = outputFormat === 'html'
                ? `<iconify-icon icon="${iconName}"></iconify-icon>`
                : `<${componentName} ${nameAttr}="${iconName}" />`;
        }

        await editor.insertSnippet(new vscode.SnippetString(snippet));
        vscode.window.showTextDocument(editor.document);
    }

    private async _handleSplitTs(iconName: string, svg?: string): Promise<string> {
        const root = vscode.workspace.workspaceFolders?.[0];
        if (!root) return `<Icon name="${iconName}" />`;

        try {
            const outDir = vscode.Uri.joinPath(root.uri, 'icons');
            const exporter = getComponentExporter();
            // Read user config to honor naming/export preferences
            const exportType = getSvgConfig<'named' | 'default'>('exportType', 'named');
            const naming = getSvgConfig<string>('naming', 'IconHome');
            const typescript = getSvgConfig<boolean>('typescript', true);
            const forwardRef = getSvgConfig<boolean>('forwardRef', true);

            // Compute componentName according to naming convention
            const toPascal = (s: string) => s.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
            const base = toPascal(iconName);
            let componentNameOverride = base;
            if (naming === 'IconHome') componentNameOverride = `Icon${base}`;
            else if (naming === 'HomeIcon') componentNameOverride = `${base}Icon`;

            const result = exporter.export({
                format: 'react',
                iconName,
                componentName: componentNameOverride,
                svg: svg || `<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/></svg>`,
                typescript: typescript,
                forwardRef: forwardRef,
                exportType: exportType,
            });

            await vscode.workspace.fs.createDirectory(outDir);
            await vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(outDir, result.filename),
                Buffer.from(result.code, 'utf8')
            );

            // Regenerar Barrel File (index.ts)
            const entries = await vscode.workspace.fs.readDirectory(outDir);
            const indexContent = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.tsx'))
                .map(([name]) => `export { default as ${name.replace('.tsx', '')} } from './${name.replace('.tsx', '')}';`)
                .join('\n');

                        await vscode.workspace.fs.writeFile(
                                vscode.Uri.joinPath(outDir, 'index.ts'),
                                Buffer.from(indexContent, 'utf8')
                        );

                        // Notify user and offer to open output folder
                        vscode.window
                            .showInformationMessage(
                                `Component files generated: ${outDir.fsPath}`,
                                'Open Folder'
                            )
                            .then(sel => {
                                if (sel === 'Open Folder') {
                                    try {
                                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.joinPath(outDir, result.filename));
                                    } catch (e) { /* ignore */ }
                                }
                            });

                        return `import { ${iconName} } from './icons';\n\n<${iconName} />`;
        } catch (e) {
            return `import ${iconName} from './icons/${iconName}';`;
        }
    }

    private async _handleTransform(iconName: string, svgContent: string): Promise<string> {
        const outputPath = getFullOutputPath();
        if (!outputPath) {
            vscode.window.showWarningMessage(t('messages.outputDirectoryNotConfigured'));
            return `<Icon name="${iconName}" />`;
        }

        const result = await buildIcon({
            iconName,
            svgContent,
            svgTransformer: new SvgTransformer(),
            outputPath
        });

                await vscode.commands.executeCommand('masterSVG.refreshIcons');
                if (result.success) {
                    // Show centralized build success with open-folder action
                    showBuildSuccess(result);
                }
                return getFrameworkIconUsage(iconName, result.format === 'sprite');
    }

    private async _sendWorkspaceIcons() {
        const icons: any[] = [];
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return this.postMessage({ type: 'workspaceIcons', icons: [] });

        const svgFolders = getSvgConfig<string[]>('svgFolders', []);
        for (const folder of folders) {
            for (const f of svgFolders) {
                await this._recursiveScan(vscode.Uri.joinPath(folder.uri, f), icons, f);
            }
        }
        this.postMessage({ type: 'workspaceIcons', icons });
    }

    private async _recursiveScan(uri: vscode.Uri, icons: any[], category: string) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(uri, name);
                if (type === vscode.FileType.Directory) {
                    await this._recursiveScan(childUri, icons, `${category}/${name}`);
                } else if (name.endsWith('.svg')) {
                    const content = await vscode.workspace.fs.readFile(childUri);
                    icons.push({
                        name: name.replace('.svg', ''),
                        svg: Buffer.from(content).toString('utf8'),
                        path: childUri.fsPath,
                        category,
                        source: 'workspace'
                    });
                }
            }
        } catch { /* Carpeta no existe, ignorar */ }
    }

    private async _sendLibraryIcons() {
        let libraryPath = getSvgConfig<string>('libraryPath', '');
        if (!libraryPath) {
            const home = process.env.APPDATA || process.env.HOME || '';
            libraryPath = path.join(home, 'icon-manager', 'icons.json');
        }

        try {
            const uri = vscode.Uri.file(libraryPath);
            const content = await vscode.workspace.fs.readFile(uri);
            this.postMessage({ type: 'libraryIcons', icons: JSON.parse(Buffer.from(content).toString('utf8')) });
        } catch {
            this.postMessage({ type: 'libraryIcons', icons: [] });
        }
    }

    public dispose() {
        IconStudioPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private _update() {
        this._panel.title = 'MasterSVG';
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        const webview = this._panel.webview;
        const nonce = Math.random().toString(36).substring(7);
        const i18nJs = JSON.stringify({
            noIconsFound: t('webview.js.noIconsFound'),
            noIconsMatch: t('webview.js.noIconsMatch'),
            browseIconify: t('webview.js.browseIconify'),
            scanWorkspaceBtn: t('webview.js.scanWorkspaceBtn')
        });
        // Compute webview URIs for external resources (if templates are copied to webview/icon-manager)
        const baseUri = vscode.Uri.joinPath(this._context.extensionUri, 'webview', 'icon-manager');
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(baseUri, 'IconStudio.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(baseUri, 'IconStudio.js'));

        // Use @import inside the inline <style> as primary loader for the external CSS (works with CSP)
        const cssReplacement = `@import url("${cssUri}");\n${iconStudioCss}`;

        // Create a small loader for external JS and keep inline as fallback (inject i18n into inline script)
        const externalLoader = `(function(){var s=document.createElement('script');s.src='${jsUri}';s.nonce='${nonce}';document.head.appendChild(s);})();\n`;
        const jsReplacement = externalLoader + iconStudioJs.replace(/__I18N__/g, i18nJs);

        return iconStudioHtml
            .replace(/\${cspSource}/g, webview.cspSource)
            .replace(/\${nonce}/g, nonce)
            .replace(/\${css}/g, cssReplacement)
            .replace(/\${js}/g, jsReplacement)
            .replace(/\${i18n_title}/g, t('webview.tabs.title'))
            .replace(/\${i18n_searchPlaceholder}/g, t('webview.tabs.searchPlaceholder'))
            .replace(/\${i18n_workspace}/g, t('webview.tabs.workspace'))
            .replace(/\${i18n_library}/g, t('webview.tabs.library'))
            .replace(/\${i18n_online}/g, t('webview.tabs.online'))
            .replace(/\${i18n_transform}/g, t('commands.transform'));
    }
}
