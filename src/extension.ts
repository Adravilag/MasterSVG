import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IconManagerPanel } from './panels/IconManagerPanel';
import { IconDetailsPanel } from './panels/IconDetailsPanel';
import { IconEditorPanel } from './panels/IconEditorPanel';
import { IconCatalogPanel } from './panels/IconCatalogPanel';
import { WorkspaceSvgProvider, SvgItem, WorkspaceIcon, initIgnoreFileWatcher } from './providers/WorkspaceSvgProvider';
import { SvgTransformer } from './services/SvgTransformer';
import { IconCatalogService } from './services/IconCatalogService';
import { IconCompletionProvider } from './providers/IconCompletionProvider';
import { IconHoverProvider } from './providers/IconHoverProvider';
import { SvgToIconCodeActionProvider, SvgImgDiagnosticProvider } from './providers/SvgToIconCodeActionProvider';
import { IconPreviewProvider } from './providers/IconPreviewProvider';
import { getComponentExporter } from './services/ComponentExporter';
import { getSpriteGenerator, SpriteIcon } from './services/SpriteGenerator';
import { toVariableName } from './utils/extensionHelpers';
import { getIconPickerHtml } from './utils/iconPickerHtml';
import { searchIconify, fetchIconSvg, IconifySearchResult } from './utils/iconifyService';
import { addToIconsJs, addToSpriteSvg, removeFromIconsJs } from './utils/iconsFileManager';
import { getConfig, getFullOutputPath, getOutputPathOrWarn, ensureOutputDirectory } from './utils/configHelper';

let workspaceSvgProvider: WorkspaceSvgProvider;
let diagnosticProvider: SvgImgDiagnosticProvider;
let iconPreviewProvider: IconPreviewProvider;
let iconCatalogService: IconCatalogService;
let workspaceTreeView: vscode.TreeView<SvgItem>;

/**
 * Shows onboarding wizard for first-time users
 */
async function showOnboardingWizard(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('iconManager');
  const outputDir = config.get<string>('outputDirectory', '');
  const hasSeenOnboarding = context.globalState.get<boolean>('hasSeenOnboarding', false);

  // Skip if already configured or user has seen onboarding
  if (outputDir || hasSeenOnboarding) {
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  // Show welcome message with options
  const choice = await vscode.window.showInformationMessage(
    '👋 Welcome to Icon Manager! Where would you like to save your icons?',
    { modal: false },
    'src/icons',
    'src/assets/icons',
    'Choose folder...',
    'Skip'
  );

  if (!choice || choice === 'Skip') {
    await context.globalState.update('hasSeenOnboarding', true);
    return;
  }

  let selectedFolder: string;

  if (choice === 'Choose folder...') {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolder.uri,
      openLabel: 'Select Icons Folder'
    });

    if (!folderUri || folderUri.length === 0) {
      return;
    }

    // Make path relative to workspace
    const fullPath = folderUri[0].fsPath;
    const workspacePath = workspaceFolder.uri.fsPath;
    selectedFolder = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
  } else {
    selectedFolder = choice;
  }

  // Update configuration
  await config.update('outputDirectory', selectedFolder, vscode.ConfigurationTarget.Workspace);

  // Create folder if it doesn't exist
  const fullOutputPath = path.join(workspaceFolder.uri.fsPath, selectedFolder);
  if (!fs.existsSync(fullOutputPath)) {
    fs.mkdirSync(fullOutputPath, { recursive: true });
  }

  await context.globalState.update('hasSeenOnboarding', true);

  // Show success with next steps
  const nextAction = await vscode.window.showInformationMessage(
    `✅ Icons will be saved to "${selectedFolder}". What's next?`,
    'Browse Icons',
    'Search Iconify',
    'Done'
  );

  if (nextAction === 'Browse Icons') {
    vscode.commands.executeCommand('iconManager.openCatalog');
  } else if (nextAction === 'Search Iconify') {
    vscode.commands.executeCommand('iconManager.searchIcons');
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Icon Manager extension is now active!');

  // Show onboarding for first-time users
  showOnboardingWizard(context);

  // Initialize .bezierignore file watcher
  initIgnoreFileWatcher(context);

  // Initialize services
  const svgTransformer = new SvgTransformer();
  workspaceSvgProvider = new WorkspaceSvgProvider(context);
  iconCatalogService = new IconCatalogService(context);

  // Register the tree view for workspace SVGs
  vscode.window.registerTreeDataProvider(
    'iconManager.workspaceIcons',
    workspaceSvgProvider
  );

  // Register the preview panel in sidebar
  iconPreviewProvider = new IconPreviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      IconPreviewProvider.viewType,
      iconPreviewProvider
    )
  );

  // Update preview when tree item is selected
  const treeView = vscode.window.createTreeView('iconManager.workspaceIcons', {
    treeDataProvider: workspaceSvgProvider,
    showCollapseAll: true,
    canSelectMany: true
  });
  workspaceTreeView = treeView;

  treeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as SvgItem;
      if (item.contextValue === 'inlineSvg' || item.contextValue === 'builtIcon' || item.contextValue === 'svgIcon') {
        const svgData = workspaceSvgProvider.getSvgData(item);
        if (svgData) {
          iconPreviewProvider.updatePreview(
            svgData.name,
            svgData.svg,
            svgData.location,
            item.contextValue === 'builtIcon'
          );
        }
      }
    }
  });
  context.subscriptions.push(treeView);

  // Command: Open main panel
  const openPanelCmd = vscode.commands.registerCommand('iconManager.openPanel', () => {
    IconManagerPanel.createOrShow(context.extensionUri, context);
  });

  // Command: Scan workspace for SVGs
  const scanWorkspaceCmd = vscode.commands.registerCommand('iconManager.scanWorkspace', async (uri?: vscode.Uri) => {
    const folder = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (folder) {
      await workspaceSvgProvider.scanFolder(folder);
      await workspaceSvgProvider.scanInlineSvgs();
      await workspaceSvgProvider.scanIconUsages();
      vscode.window.showInformationMessage('SVG scan complete!');
    }
  });

  // Command: Scan for icon usages
  const scanUsagesCmd = vscode.commands.registerCommand('iconManager.scanUsages', async () => {
    await workspaceSvgProvider.scanIconUsages();
    vscode.window.showInformationMessage('Usage scan complete!');
  });

  // Command: Go to usage location
  const goToUsageCmd = vscode.commands.registerCommand('iconManager.goToUsage', async (item: any) => {
    if (item.resourceUri) {
      const document = await vscode.workspace.openTextDocument(item.resourceUri);
      const editor = await vscode.window.showTextDocument(document);
      
      if (item.contextValue === 'iconUsage' && item.usage) {
        const line = item.usage.line - 1;
        const range = new vscode.Range(line, 0, line, document.lineAt(line).text.length);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    }
  });

  // Command: Go to inline SVG
  const goToInlineSvgCmd = vscode.commands.registerCommand('iconManager.goToInlineSvg', async (iconOrItem: any) => {
    // Handle both direct icon object and item with icon property
    const icon = iconOrItem?.icon || iconOrItem;
    if (icon && icon.filePath && icon.line !== undefined) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(icon.filePath));
      const editor = await vscode.window.showTextDocument(document);
      const line = icon.line;
      const range = new vscode.Range(line, 0, line, document.lineAt(line).text.length);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  });

  // Command: Transform inline SVG
  const transformInlineSvgCmd = vscode.commands.registerCommand('iconManager.transformInlineSvg', async (item: any) => {
    if (item.icon && item.icon.filePath && item.icon.svg) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.icon.filePath));
      const editor = await vscode.window.showTextDocument(document);

      const text = document.getText();
      const svgStart = text.indexOf(item.icon.svg);
      if (svgStart === -1) {
        vscode.window.showWarningMessage('Could not find SVG in document');
        return;
      }

      const startPos = document.positionAt(svgStart);
      const endPos = document.positionAt(svgStart + item.icon.svg.length);
      const range = new vscode.Range(startPos, endPos);

      const format = await vscode.window.showQuickPick(
        [
          { label: 'Component', description: 'Convert to <Icon name="..."/>' },
          { label: 'Sprite', description: 'Convert to <use href="sprite.svg#..."/>' },
          { label: 'Optimize', description: 'Keep inline but optimize' }
        ],
        { placeHolder: 'Select transformation type' }
      );

      if (!format) return;

      const config = vscode.workspace.getConfiguration('iconManager');
      const outputDir = config.get<string>('outputDirectory', '');
      const componentName = config.get<string>('componentName', 'Icon');
      const nameAttr = config.get<string>('nameAttribute', 'name');
      const iconName = item.label as string;

      let replacement: string;

      if (format.label === 'Component') {
        replacement = `<${componentName} ${nameAttr}="${iconName}" />`;
        const fullOutputPath = getFullOutputPath();
        if (fullOutputPath) {
          await addToIconsJs(fullOutputPath, iconName, item.icon.svg, svgTransformer);
        }
      } else if (format.label === 'Sprite') {
        replacement = `<svg class="icon"><use href="${outputDir}/sprite.svg#${iconName}"></use></svg>`;
        const fullOutputPath = getFullOutputPath();
        if (fullOutputPath) {
          await addToSpriteSvg(fullOutputPath, iconName, item.icon.svg, svgTransformer);
        }
      } else {
        replacement = svgTransformer.cleanSvg(item.icon.svg);
      }

      await editor.edit((editBuilder) => {
        editBuilder.replace(range, replacement);
      });

      workspaceSvgProvider.refresh();
      vscode.window.showInformationMessage(`Transformed SVG to ${format.label} format`);
    }
  });

  // Command: Configure icon manager for project
  const configureProjectCmd = vscode.commands.registerCommand('iconManager.configureProject', async () => {
    const config = getConfig();
    const outputDir = await vscode.window.showInputBox({
      prompt: 'Enter the output directory for generated icons',
      value: config.outputDirectory || 'icons',
      placeHolder: 'e.g., src/icons, assets/icons'
    });

    if (outputDir !== undefined) {
      const vscodeConfig = vscode.workspace.getConfiguration('iconManager');
      await vscodeConfig.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Workspace);
      ensureOutputDirectory();
      vscode.window.showInformationMessage(`Output directory set to: ${outputDir}`);
    }
  });

  // Command: Edit .bezierignore file
  const editIgnoreFileCmd = vscode.commands.registerCommand('iconManager.editIgnoreFile', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    const ignoreFilePath = path.join(workspaceFolder.uri.fsPath, '.bezierignore');
    
    // Create file with template if it doesn't exist
    if (!fs.existsSync(ignoreFilePath)) {
      const template = `# Bezier - Ignore File
# This file works similar to .gitignore
# Patterns listed here will be excluded from scanning

# Examples:

# Ignore entire directories
# bak/
# temp/

# Ignore specific files  
# svgs/old-icon.svg

# Ignore by pattern (** matches any path)
# **/backup/**
# **/*-old.svg

# Ignore files starting with underscore
# _*.svg

# Ignore node_modules (already ignored by default)
# node_modules/
`;
      fs.writeFileSync(ignoreFilePath, template, 'utf-8');
    }

    // Open the file
    const doc = await vscode.workspace.openTextDocument(ignoreFilePath);
    await vscode.window.showTextDocument(doc);
  });

  // Command: Refresh icons list
  const refreshIconsCmd = vscode.commands.registerCommand('iconManager.refreshIcons', () => {
    workspaceSvgProvider.refresh();
  });

  // Command: Build icons library
  const buildIconsCmd = vscode.commands.registerCommand('iconManager.buildIcons', async () => {
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    await workspaceSvgProvider.scanInlineSvgs();
    vscode.window.showInformationMessage('Icons library built successfully!');
  });

  // Command: Transform selected SVG
  const transformSvgCmd = vscode.commands.registerCommand('iconManager.transformSvg', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.selection;
    const svgContent = editor.document.getText(selection);

    if (!svgContent.includes('<svg')) {
      vscode.window.showWarningMessage('Please select an SVG element');
      return;
    }

    const format = await vscode.window.showQuickPick(
      ['react', 'vue', 'svelte', 'astro', 'html'],
      { placeHolder: 'Select output format' }
    );

    if (!format) return;

    const componentName = await vscode.window.showInputBox({
      prompt: 'Enter component name',
      placeHolder: 'e.g., IconHome, ArrowIcon'
    });

    if (!componentName) return;

    const config = vscode.workspace.getConfiguration('iconManager');
    const nameAttr = config.get<string>('nameAttribute', 'name');
    
    const result = await svgTransformer.transformToComponent(svgContent, componentName, {
      componentName: config.get<string>('componentName', 'Icon'),
      nameAttribute: nameAttr,
      format: format as any
    });

    await editor.edit((editBuilder) => {
      editBuilder.replace(selection, result.component);
    });

    vscode.window.showInformationMessage(`SVG transformed to ${format} component`);
  });

  // Command: Optimize SVG
  const optimizeSvgCmd = vscode.commands.registerCommand('iconManager.optimizeSvg', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.selection;
    const svgContent = editor.document.getText(selection);

    if (!svgContent.includes('<svg')) {
      vscode.window.showWarningMessage('Please select an SVG element');
      return;
    }

    const optimized = svgTransformer.cleanSvg(svgContent);
    await editor.edit((editBuilder) => {
      editBuilder.replace(selection, optimized);
    });

    vscode.window.showInformationMessage('SVG optimized!');
  });

  // Command: Insert icon at cursor
  const insertIconCmd = vscode.commands.registerCommand('iconManager.insertIcon', async (item?: any) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let iconName: string;
    if (item && typeof item.label === 'string') {
      iconName = item.label;
    } else {
      const icons = await workspaceSvgProvider.getAllIcons();
      const names = icons.map(i => i.name);
      const selected = await vscode.window.showQuickPick(names, {
        placeHolder: 'Select icon to insert'
      });
      if (!selected) return;
      iconName = selected;
    }

    const config = getConfig();
    const snippet = `<${config.componentName} ${config.nameAttribute}="${iconName}" />`;

    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, snippet);
    });
  });

  // Command: Preview icon
  const previewIconCmd = vscode.commands.registerCommand('iconManager.previewIcon', (item: any) => {
    if (item?.icon?.svg) {
      const svgData = workspaceSvgProvider.getSvgData(item);
      if (svgData) {
        iconPreviewProvider.updatePreview(
          svgData.name,
          svgData.svg,
          svgData.location,
          item.contextValue === 'builtIcon'
        );
      }
    }
  });

  // Register completion provider
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
      { language: 'html' }
    ],
    new IconCompletionProvider(workspaceSvgProvider),
    '<', '"', "'"
  );

  // Register hover provider
  const hoverDisposable = vscode.languages.registerHoverProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
      { language: 'html' }
    ],
    new IconHoverProvider(workspaceSvgProvider)
  );

  // Watch for SVG file changes
  const svgWatcher = vscode.workspace.createFileSystemWatcher('**/*.svg');
  svgWatcher.onDidCreate(() => workspaceSvgProvider.refresh());
  svgWatcher.onDidDelete(() => workspaceSvgProvider.refresh());
  svgWatcher.onDidChange(() => workspaceSvgProvider.refresh());

  // Register code action provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
      { language: 'html' }
    ],
    new SvgToIconCodeActionProvider(),
    {
      providedCodeActionKinds: SvgToIconCodeActionProvider.providedCodeActionKinds
    }
  );

  // Register diagnostic provider
  diagnosticProvider = new SvgImgDiagnosticProvider();

  // Register diagnostic provider listeners to detect <img src="...svg"> in documents
  const diagnosticChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    diagnosticProvider.updateDiagnostics(event.document);
  });

  const diagnosticOpenListener = vscode.workspace.onDidOpenTextDocument(document => {
    diagnosticProvider.updateDiagnostics(document);
  });

  const diagnosticCloseListener = vscode.workspace.onDidCloseTextDocument(document => {
    // Clear diagnostics when document is closed
    diagnosticProvider.updateDiagnostics(document);
  });

  // Update diagnostics for already open documents
  vscode.workspace.textDocuments.forEach(document => {
    diagnosticProvider.updateDiagnostics(document);
  });

  // Command: Import SVG to library
  const importSvgToLibraryCmd = vscode.commands.registerCommand('iconManager.importSvgToLibrary', async (item?: any) => {
    let svgPath: string | undefined;
    let svgContent: string | undefined;
    let iconName: string | undefined;

    if (item?.resourceUri) {
      svgPath = item.resourceUri.fsPath;
      svgContent = fs.readFileSync(svgPath as string, 'utf-8');
      iconName = path.basename(svgPath as string, '.svg');
    } else {
      const files = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] }
      });

      if (!files || files.length === 0) return;
      svgPath = files[0].fsPath;
      svgContent = fs.readFileSync(svgPath, 'utf-8');
      iconName = path.basename(svgPath, '.svg');
    }

    if (!svgContent) return;

    const fullOutputPath = getOutputPathOrWarn();
    if (!fullOutputPath) return;

    await addToIconsJs(fullOutputPath, iconName!, svgContent, svgTransformer);
    workspaceSvgProvider.refresh();
    vscode.window.showInformationMessage(`✅ Icon "${iconName}" imported to library!`);
  });

  // Command: Check and import inline SVG
  const checkAndImportSvgCmd = vscode.commands.registerCommand('iconManager.checkAndImportSvg', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const text = editor.document.getText();
    const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
    const matches = [...text.matchAll(svgRegex)];

    if (matches.length === 0) {
      vscode.window.showInformationMessage('No inline SVGs found in this file');
      return;
    }

    const items = matches.map((match, index) => ({
      label: `SVG #${index + 1}`,
      description: match[0].substring(0, 50) + '...',
      svgContent: match[0],
      index: match.index
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an SVG to import'
    });

    if (!selected) return;

    const iconName = await vscode.window.showInputBox({
      prompt: 'Enter icon name',
      placeHolder: 'e.g., arrow-right, home-icon'
    });

    if (!iconName) return;

    const fullOutputPath = getOutputPathOrWarn();
    if (!fullOutputPath) return;

    await addToIconsJs(fullOutputPath, iconName, selected.svgContent, svgTransformer);

    workspaceSvgProvider.refresh();
    vscode.window.showInformationMessage(`✅ Icon "${iconName}" imported!`);
  });

  // Command: Delete icons
  const deleteIconsCmd = vscode.commands.registerCommand('iconManager.deleteIcons', async (item: any, selectedItems?: any[]) => {
    const itemsToDelete = selectedItems && selectedItems.length > 0 ? selectedItems : [item];
    const names = itemsToDelete.map((i: any) => typeof i.label === 'string' ? i.label : '').filter(Boolean);

    if (names.length === 0) {
      vscode.window.showWarningMessage('No icons selected for deletion');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete ${names.length} icon(s): ${names.join(', ')}?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') return;

    const fullOutputPath = getFullOutputPath();
    if (!fullOutputPath) return;

    removeFromIconsJs(fullOutputPath, names);

    workspaceSvgProvider.refresh();
    vscode.window.showInformationMessage(`Deleted ${names.length} icon(s)`);
  });

  // Command: Rename icon
  const renameIconCmd = vscode.commands.registerCommand('iconManager.renameIcon', async (item: any, providedNewName?: string) => {
    if (!item?.icon) {
      vscode.window.showWarningMessage('Select an icon to rename');
      return;
    }

    const icon = item.icon;
    const oldName = icon.name;
    const isBuiltIcon = item.contextValue === 'builtIcon';
    const isSvgFile = item.contextValue === 'svgIcon';

    // Use provided name or prompt for new name
    let newName = providedNewName;
    if (!newName) {
      newName = await vscode.window.showInputBox({
        prompt: 'Enter new name for the icon',
        value: oldName,
        placeHolder: 'icon-name',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (value === oldName) {
            return 'Enter a different name';
          }
          // Basic validation: no special characters except dash and underscore
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, dashes and underscores';
          }
          return undefined;
        }
      });
    }

    if (!newName) return;

    try {
      let newPath: string | undefined;
      
      if (isSvgFile && icon.path) {
        // Rename the actual SVG file
        const oldPath = icon.path;
        const dir = path.dirname(oldPath);
        newPath = path.join(dir, `${newName}.svg`);

        if (fs.existsSync(newPath)) {
          vscode.window.showErrorMessage(`A file named "${newName}.svg" already exists`);
          return;
        }

        fs.renameSync(oldPath, newPath);
        
        // Update references to this SVG file in the workspace
        const oldFileName = `${oldName}.svg`;
        const newFileName = `${newName}.svg`;
        let referencesUpdated = 0;
        
        // Search for files that reference this SVG
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const filesToSearch = await vscode.workspace.findFiles(
            '**/*.{html,htm,jsx,tsx,js,ts,vue,svelte,css,scss,md}',
            '**/node_modules/**'
          );
          
          for (const fileUri of filesToSearch) {
            try {
              const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
              
              // Create patterns to match various reference styles
              const escapedOldFileName = oldFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              // Single comprehensive pattern that matches:
              // src="./filename.svg", src="../path/filename.svg", src="filename.svg"
              // Also handles single quotes
              const srcPattern = new RegExp(
                `(src\\s*=\\s*["'])([^"']*?)${escapedOldFileName}(["'])`,
                'g'
              );
              
              // URL pattern for CSS: url('./filename.svg'), url(filename.svg), etc.
              const urlPattern = new RegExp(
                `(url\\s*\\(\\s*["']?)([^)"']*?)${escapedOldFileName}(["']?\\s*\\))`,
                'g'
              );
              
              // Import patterns
              const importFromPattern = new RegExp(
                `(from\\s+["'])([^"']*?)${escapedOldFileName}(["'])`,
                'g'
              );
              const importDirectPattern = new RegExp(
                `(import\\s+["'])([^"']*?)${escapedOldFileName}(["'])`,
                'g'
              );
              const requirePattern = new RegExp(
                `(require\\s*\\(\\s*["'])([^"']*?)${escapedOldFileName}(["']\\s*\\))`,
                'g'
              );
              
              // href patterns for <a>, <link>, etc.
              const hrefPattern = new RegExp(
                `(href\\s*=\\s*["'])([^"']*?)${escapedOldFileName}(["'])`,
                'g'
              );
              
              let newContent = content;
              let fileModified = false;
              
              const patterns = [srcPattern, urlPattern, importFromPattern, importDirectPattern, requirePattern, hrefPattern];
              
              for (const pattern of patterns) {
                const matches = newContent.match(pattern);
                if (matches && matches.length > 0) {
                  newContent = newContent.replace(pattern, `$1$2${newFileName}$3`);
                  fileModified = true;
                }
              }
              
              if (fileModified) {
                fs.writeFileSync(fileUri.fsPath, newContent);
                referencesUpdated++;
              }
            } catch (err) {
              // Skip files that can't be read/written
              console.log(`[Bezier] Could not update references in ${fileUri.fsPath}: ${err}`);
            }
          }
        }
        
        if (referencesUpdated > 0) {
          vscode.window.showInformationMessage(`Renamed "${oldName}.svg" to "${newName}.svg" and updated ${referencesUpdated} file(s) with references`);
        } else {
          vscode.window.showInformationMessage(`Renamed "${oldName}.svg" to "${newName}.svg"`);
        }
      } else if (isBuiltIcon) {
        // Rename in icons.ts/icons.js
        const fullOutputPath = getFullOutputPath();
        if (!fullOutputPath) return;

        const iconsPath = path.join(fullOutputPath, 'icons.ts');
        const iconsJsPath = path.join(fullOutputPath, 'icons.js');
        
        let targetFile = '';
        if (fs.existsSync(iconsPath)) {
          targetFile = iconsPath;
        } else if (fs.existsSync(iconsJsPath)) {
          targetFile = iconsJsPath;
        }

        if (!targetFile) {
          vscode.window.showErrorMessage('Could not find icons.ts or icons.js');
          return;
        }

        let content = fs.readFileSync(targetFile, 'utf-8');
        
        // Replace the icon name in the file
        // Pattern: 'old-name': `<svg...` or "old-name": `<svg...
        const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(['"])${escapedOldName}\\1(\\s*:\\s*)`, 'g');
        
        // Check if pattern exists (use a fresh regex for test)
        const testPattern = new RegExp(`(['"])${escapedOldName}\\1(\\s*:\\s*)`);
        if (!testPattern.test(content)) {
          vscode.window.showErrorMessage(`Could not find icon "${oldName}" in library`);
          return;
        }

        const newContent = content.replace(pattern, `$1${newName}$1$2`);
        fs.writeFileSync(targetFile, newContent);
        
        vscode.window.showInformationMessage(`Renamed "${oldName}" to "${newName}" in library`);
      }

      // Refresh the tree view
      workspaceSvgProvider.refresh();
      
      // Return the new path for SVG files so callers can update their references
      return { newName, newPath };
    } catch (error) {
      vscode.window.showErrorMessage(`Error renaming icon: ${error}`);
      return undefined;
    }
  });

  // Command: Open color editor (uses full IconEditorPanel with animations, variants, etc.)
  const colorEditorCmd = vscode.commands.registerCommand('iconManager.colorEditor', async (iconNameOrItem?: string | SvgItem | vscode.Uri) => {
    let iconName: string | undefined;
    let svg: string | undefined;
    let filePath: string | undefined;
    let lineNumber: number | undefined;
    
    // Handle different input types
    if (iconNameOrItem instanceof vscode.Uri) {
      // Called from explorer context menu with a file URI
      filePath = iconNameOrItem.fsPath;
      if (filePath.endsWith('.svg') && fs.existsSync(filePath)) {
        svg = fs.readFileSync(filePath, 'utf-8');
        iconName = path.basename(filePath, '.svg');
        lineNumber = 1;
      }
    } else if (typeof iconNameOrItem === 'string') {
      iconName = iconNameOrItem;
    } else if (iconNameOrItem?.icon) {
      // Use getSvgData to properly handle all icon types including svgIcon files
      const svgData = workspaceSvgProvider.getSvgData(iconNameOrItem);
      if (svgData) {
        iconName = svgData.name;
        svg = svgData.svg;
        filePath = svgData.location?.file;
        lineNumber = svgData.location?.line;
      } else {
        iconName = iconNameOrItem.icon.name;
        svg = iconNameOrItem.icon.svg;
        filePath = iconNameOrItem.icon.filePath || iconNameOrItem.icon.path;
        lineNumber = iconNameOrItem.icon.line;
      }
    } else {
      // Try to get from active editor selection
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        const selectedText = editor.document.getText(editor.selection);
        if (selectedText.includes('<svg')) {
          svg = selectedText;
          iconName = 'selected-svg';
          filePath = editor.document.uri.fsPath;
          lineNumber = editor.selection.start.line;
        }
      }
    }

    if (!iconName) {
      vscode.window.showWarningMessage('Select an icon from the tree view or select SVG code in the editor');
      return;
    }

    // If no SVG provided, try to get it
    if (!svg) {
      const icon = workspaceSvgProvider.getIconByName(iconName);
      if (icon?.svg) {
        svg = icon.svg;
        filePath = icon.filePath || icon.path;
        lineNumber = icon.line;
      }
    }

    if (!svg) {
      vscode.window.showWarningMessage(`Could not find SVG data for ${iconName}`);
      return;
    }
    
    // Use IconEditorPanel for editing colors, optimizing, animations, etc.
    IconEditorPanel.createOrShow(context.extensionUri, {
      name: iconName,
      svg: svg,
      location: filePath && lineNumber !== undefined ? { file: filePath, line: lineNumber } : undefined
    });

    // Reveal icon in tree view
    vscode.commands.executeCommand('iconManager.revealInTree', iconName, filePath, lineNumber);
  });

  // Command: Show icon details (uses full IconDetailsPanel with zoom, optimization, etc.)
  const showDetailsCmd = vscode.commands.registerCommand('iconManager.showDetails', async (item?: SvgItem | vscode.Uri) => {
    let iconName: string | undefined;
    let svg: string | undefined;
    let filePath: string | undefined;
    let lineNumber: number | undefined;
    let isBuilt = false;

    if (item instanceof vscode.Uri) {
      // Called from explorer context menu with a file URI
      filePath = item.fsPath;
      if (filePath.endsWith('.svg') && fs.existsSync(filePath)) {
        svg = fs.readFileSync(filePath, 'utf-8');
        iconName = path.basename(filePath, '.svg');
        lineNumber = 1;
      }
    } else if (item) {
      const svgData = workspaceSvgProvider.getSvgData(item);
      if (svgData) {
        iconName = svgData.name;
        svg = svgData.svg;
        filePath = svgData.location?.file;
        lineNumber = svgData.location?.line;
        isBuilt = item.contextValue === 'builtIcon';
      }
    }

    if (iconName && svg) {
      IconDetailsPanel.createOrShow(context.extensionUri, {
        name: iconName,
        svg: svg,
        location: filePath && lineNumber !== undefined ? { file: filePath, line: lineNumber } : undefined,
        isBuilt: isBuilt
      });

      // Reveal icon in tree view
      vscode.commands.executeCommand('iconManager.revealInTree', iconName, filePath, lineNumber);
    }
  });

  // Command: Open icon catalog
  const openCatalogCmd = vscode.commands.registerCommand('iconManager.openCatalog', () => {
    IconCatalogPanel.createOrShow(context.extensionUri, iconCatalogService);
  });

  // Command: Generate licenses file
  const generateLicensesCmd = vscode.commands.registerCommand('iconManager.generateLicenses', async () => {
    const fullOutputPath = getOutputPathOrWarn();
    if (!fullOutputPath) return;

    const files = await iconCatalogService.generateLicenseFiles(fullOutputPath);
    vscode.window.showInformationMessage(`License files generated: ${files.join(', ')}`);
  });

  // Command: Export as component
  const exportComponentCmd = vscode.commands.registerCommand('iconManager.exportComponent', async (item?: any) => {
    if (!item?.icon?.svg) {
      vscode.window.showWarningMessage('Select an icon to export');
      return;
    }

    const format = await vscode.window.showQuickPick(
      [
        { label: 'React', value: 'react' },
        { label: 'Vue', value: 'vue' },
        { label: 'Svelte', value: 'svelte' },
        { label: 'Angular', value: 'angular' },
        { label: 'Web Component', value: 'webcomponent' }
      ],
      { placeHolder: 'Select component format' }
    );

    if (!format) return;

    const iconName = typeof item.label === 'string' ? item.label : 'icon';
    const exporter = getComponentExporter();
    const componentCode = exporter.export(iconName);

    const doc = await vscode.workspace.openTextDocument({
      content: componentCode.code,
      language: format.value === 'vue' ? 'vue' :
        format.value === 'svelte' ? 'svelte' :
          format.value === 'angular' ? 'typescript' : 'typescriptreact'
    });
    await vscode.window.showTextDocument(doc);
  });

  // Command: Generate sprite
  const generateSpriteCmd = vscode.commands.registerCommand('iconManager.generateSprite', async () => {
    const icons = await workspaceSvgProvider.getAllIcons();
    if (icons.length === 0) {
      vscode.window.showWarningMessage('No icons found in library');
      return;
    }

    const formatChoice = await vscode.window.showQuickPick(
      [
        { label: 'SVG Sprite', value: 'svg' as const },
        { label: 'Web Component (JS)', value: 'css' as const },
        { label: 'Both', value: 'both' as const }
      ],
      { placeHolder: 'Select sprite format' }
    );

    if (!formatChoice) return;

    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const config = getConfig();
    const webComponentName = config.webComponentName;

    const spriteIcons: SpriteIcon[] = icons
      .filter((icon): icon is WorkspaceIcon & { svg: string } => !!icon.svg)
      .map(icon => ({
        id: icon.name,
        name: icon.name,
        svg: icon.svg,
        viewBox: '0 0 24 24'
      }));

    const generator = getSpriteGenerator();

    if (formatChoice.value === 'svg' || formatChoice.value === 'both') {
      const result = generator.generate(spriteIcons, { outputPath });
      fs.writeFileSync(path.join(outputPath, 'sprite.svg'), result.sprite);
    }

    if (formatChoice.value === 'css' || formatChoice.value === 'both') {
      const result = generator.generate(spriteIcons, { 
        outputPath, 
        generateHelper: true, 
        helperFormat: 'vanilla',
        webComponentName
      });
      if (result.helperComponent) {
        fs.writeFileSync(path.join(outputPath, 'icons.js'), result.helperComponent);
      }
    }

    vscode.window.showInformationMessage(`Sprite generated in ${outputPath}`);
  });

  // Command: Add SVG to collection (search Iconify)
  const addSvgToCollectionCmd = vscode.commands.registerCommand('iconManager.addSvgToCollection', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Search for icons (e.g., "arrow", "home", "user")',
      placeHolder: 'Enter search term'
    });

    if (!query) return;

    const results = await searchIconify(query);

    if (results.length === 0) {
      vscode.window.showInformationMessage(`No icons found for "${query}"`);
      return;
    }

    showIconPickerPanel(context, results, query, svgTransformer, workspaceSvgProvider);
  });

  // Command: Remove missing reference (delete the <img> tag)
  const removeReferenceCmd = vscode.commands.registerCommand('iconManager.removeReference', async (item: any) => {
    if (!item?.icon?.filePath || item.icon.line === undefined) {
      vscode.window.showWarningMessage('Cannot find the reference location');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Remove reference to "${item.icon.name}.svg"?`,
      { modal: true },
      'Remove'
    );

    if (confirm !== 'Remove') return;

    try {
      const document = await vscode.workspace.openTextDocument(item.icon.filePath);
      const line = document.lineAt(item.icon.line);
      const text = line.text;
      
      // Find the <img> tag in this line
      const imgMatch = text.match(/<img\s+[^>]*src=["'][^"']*\.svg["'][^>]*>/i);
      
      if (imgMatch) {
        const edit = new vscode.WorkspaceEdit();
        const startIndex = text.indexOf(imgMatch[0]);
        const startPos = new vscode.Position(item.icon.line, startIndex);
        const endPos = new vscode.Position(item.icon.line, startIndex + imgMatch[0].length);
        
        edit.delete(document.uri, new vscode.Range(startPos, endPos));
        await vscode.workspace.applyEdit(edit);
        await document.save();
        
        vscode.window.showInformationMessage(`Removed reference to "${item.icon.name}.svg"`);
        workspaceSvgProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error removing reference: ${error}`);
    }
  });

  // Command: Find and replace path for missing reference
  const findAndReplaceCmd = vscode.commands.registerCommand('iconManager.findAndReplace', async (item: any) => {
    if (!item?.icon?.filePath || item.icon.line === undefined) {
      vscode.window.showWarningMessage('Cannot find the reference location');
      return;
    }

    // Get the current path from the reference
    const currentPath = item.icon.path;
    const currentName = item.icon.name;

    // Offer options: browse for file, search workspace, Iconify, or enter path manually
    const choice = await vscode.window.showQuickPick([
      { label: '$(file-directory) Browse for SVG file', value: 'browse' },
      { label: '$(search) Search workspace for SVG', value: 'search' },
      { label: '$(cloud-download) Search Iconify', value: 'iconify' },
      { label: '$(edit) Enter new path manually', value: 'manual' }
    ], {
      placeHolder: 'How do you want to find the replacement SVG?'
    });

    if (!choice) return;

    let newPath: string | undefined;

    if (choice.value === 'browse') {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] },
        title: 'Select SVG file'
      });

      if (fileUri && fileUri[0]) {
        // Make path relative to the file containing the reference
        const refFileDir = path.dirname(item.icon.filePath);
        newPath = './' + path.relative(refFileDir, fileUri[0].fsPath).replace(/\\/g, '/');
      }
    } else if (choice.value === 'search') {
      // Search for SVG files in workspace
      const svgFiles = await vscode.workspace.findFiles('**/*.svg', '**/node_modules/**', 100);
      
      if (svgFiles.length === 0) {
        vscode.window.showWarningMessage('No SVG files found in workspace');
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const items = svgFiles.map(f => {
        const relativePath = path.relative(workspaceRoot, f.fsPath).replace(/\\/g, '/');
        return {
          label: path.basename(f.fsPath),
          description: relativePath,
          fsPath: f.fsPath
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Search for replacement SVG (current: ${currentName}.svg)`,
        matchOnDescription: true
      });

      if (selected) {
        const refFileDir = path.dirname(item.icon.filePath);
        newPath = './' + path.relative(refFileDir, selected.fsPath).replace(/\\/g, '/');
      }
    } else if (choice.value === 'iconify') {
      // Search Iconify for a replacement icon
      const query = await vscode.window.showInputBox({
        prompt: `Search Iconify for a replacement icon`,
        value: currentName,
        placeHolder: 'Enter search term (e.g., arrow, home, user)'
      });

      if (!query) return;

      const results = await searchIconify(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No icons found for "${query}"`);
        return;
      }

      // Show webview picker with icon previews
      const selectedIcon = await showIconifyReplacementPicker(context, results, query, currentName);

      if (!selectedIcon) return;

      // Ask where to save the icon
      const saveChoice = await vscode.window.showQuickPick([
        { label: '$(file-add) Save next to referenced file', value: 'same-dir' },
        { label: '$(folder) Choose folder', value: 'choose' }
      ], {
        placeHolder: 'Where do you want to save the new SVG?'
      });

      if (!saveChoice) return;

      let savePath: string;
      const iconFileName = `${selectedIcon.prefix}-${selectedIcon.name}.svg`;
      const refFileDir = path.dirname(item.icon.filePath);

      if (saveChoice.value === 'same-dir') {
        savePath = path.join(refFileDir, iconFileName);
      } else {
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: 'Select folder to save the SVG'
        });

        if (!folderUri || !folderUri[0]) return;
        savePath = path.join(folderUri[0].fsPath, iconFileName);
      }

      // Save the SVG file
      fs.writeFileSync(savePath, selectedIcon.svg);
      vscode.window.showInformationMessage(`Saved icon to ${path.basename(savePath)}`);

      // Set the new path relative to the reference file
      newPath = './' + path.relative(refFileDir, savePath).replace(/\\/g, '/');
    } else {
      newPath = await vscode.window.showInputBox({
        prompt: 'Enter the new SVG path',
        value: currentPath,
        placeHolder: './path/to/icon.svg'
      });
    }

    if (!newPath) return;

    try {
      const document = await vscode.workspace.openTextDocument(item.icon.filePath);
      const line = document.lineAt(item.icon.line);
      const text = line.text;
      
      // Find the src attribute and replace the path
      const imgMatch = text.match(/<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/i);
      
      if (imgMatch) {
        const oldSrc = imgMatch[1];
        const newText = text.replace(oldSrc, newPath);
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, line.range, newText);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        
        vscode.window.showInformationMessage(`Updated path from "${oldSrc}" to "${newPath}"`);
        workspaceSvgProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error updating path: ${error}`);
    }
  });

  // Command: Reveal icon in tree view
  const revealInTreeCmd = vscode.commands.registerCommand('iconManager.revealInTree', async (iconName: string, filePath?: string, lineNumber?: number) => {
    if (!iconName && !filePath) return;

    console.log(`[Bezier] revealInTree: name="${iconName}", path="${filePath}", line=${lineNumber}`);

    try {
      // Ensure the tree is initialized before searching
      await workspaceSvgProvider.ensureInitialized();
      
      // First try to find a cached item (already rendered in tree)
      let item = workspaceSvgProvider.findItemByIconNameOrPath(iconName, filePath, lineNumber);
      console.log(`[Bezier] findItemByIconNameOrPath:`, item?.label, item?.icon?.name, item?.icon?.path);
      
      if (!item) {
        // If not cached, try to find the icon and create an item
        let icon = workspaceSvgProvider.getIconByName(iconName);
        console.log(`[Bezier] getIconByName:`, icon?.name, icon?.path);
        
        if (!icon && filePath) {
          icon = workspaceSvgProvider.getIconByPath(filePath);
        }

        if (icon) {
          item = workspaceSvgProvider.createSvgItemFromIcon(icon);
        }
      }

      if (item && workspaceTreeView) {
        try {
          // Use focus: true to ensure the treeview gets focus
          await workspaceTreeView.reveal(item, { select: true, focus: true, expand: true });
        } catch (revealError) {
          // If reveal fails, the item might not be in the visible tree yet
          // This can happen if the parent sections are collapsed
          console.log('[Bezier] Reveal failed, item may not be visible:', revealError);
        }
      }
    } catch (error) {
      // Silently fail - this is a nice-to-have feature
      console.log('[Bezier] Could not reveal in tree:', error);
    }
  });

  context.subscriptions.push(
    openPanelCmd,
    scanWorkspaceCmd,
    scanUsagesCmd,
    goToUsageCmd,
    goToInlineSvgCmd,
    transformInlineSvgCmd,
    configureProjectCmd,
    editIgnoreFileCmd,
    refreshIconsCmd,
    buildIconsCmd,
    transformSvgCmd,
    optimizeSvgCmd,
    insertIconCmd,
    previewIconCmd,
    completionDisposable,
    hoverDisposable,
    svgWatcher,
    codeActionProvider,
    importSvgToLibraryCmd,
    checkAndImportSvgCmd,
    diagnosticProvider,
    diagnosticChangeListener,
    diagnosticOpenListener,
    diagnosticCloseListener,
    deleteIconsCmd,
    renameIconCmd,
    colorEditorCmd,
    showDetailsCmd,
    openCatalogCmd,
    generateLicensesCmd,
    exportComponentCmd,
    generateSpriteCmd,
    addSvgToCollectionCmd,
    removeReferenceCmd,
    findAndReplaceCmd,
    revealInTreeCmd
  );
}

export function deactivate() {
  // Cleanup
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Shows a webview panel to select an icon from Iconify with previews
 * Returns a promise that resolves with the selected icon info or undefined
 */
function showIconifyReplacementPicker(
  context: vscode.ExtensionContext,
  icons: IconifySearchResult[],
  query: string,
  missingIconName: string
): Promise<{ prefix: string; name: string; svg: string } | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'iconifyReplacePicker',
      `Replace: ${missingIconName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    let resolved = false;

    panel.webview.html = getIconifyReplacePickerHtml(icons, query, missingIconName);

    panel.onDidDispose(() => {
      if (!resolved) {
        resolve(undefined);
      }
    });

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'selectIcon') {
          const { prefix, name, color } = message;

          try {
            const svg = await fetchIconSvg(prefix, name, color !== '#ffffff' ? color : undefined);

            if (!svg) {
              vscode.window.showErrorMessage('Failed to fetch icon SVG');
              return;
            }

            resolved = true;
            panel.dispose();
            resolve({ prefix, name, svg });

          } catch (error) {
            vscode.window.showErrorMessage(`Error fetching icon: ${error}`);
          }
        } else if (message.command === 'cancel') {
          resolved = true;
          panel.dispose();
          resolve(undefined);
        }
      },
      undefined,
      context.subscriptions
    );
  });
}

/**
 * Generate HTML for the Iconify replacement picker
 */
function getIconifyReplacePickerHtml(icons: IconifySearchResult[], query: string, missingIconName: string): string {
  const escapedQuery = query.replace(/"/g, '&quot;');
  const escapedMissing = missingIconName.replace(/"/g, '&quot;');
  
  const iconCards = icons.map(icon => `
    <div class="icon-card" data-prefix="${icon.prefix}" data-name="${icon.name}">
      <div class="icon-preview">
        <img src="https://api.iconify.design/${icon.prefix}/${icon.name}.svg?color=%23ffffff" alt="${icon.name}" loading="lazy" />
      </div>
      <div class="icon-info">
        <span class="icon-name">${icon.name}</span>
        <span class="icon-prefix">${icon.prefix}</span>
      </div>
      <button class="select-btn" onclick="selectIcon('${icon.prefix}', '${icon.name}')">
        Select
      </button>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Replace Icon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 1.3rem;
    }
    .cancel-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .cancel-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .info-box {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .info-box .icon { font-size: 20px; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px;
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    .toolbar label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .color-picker {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
    }
    .color-presets {
      display: flex;
      gap: 6px;
    }
    .color-preset {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s;
    }
    .color-preset:hover { transform: scale(1.15); }
    .color-preset.active { border-color: var(--vscode-focusBorder); }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }
    .icon-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.2s;
    }
    .icon-card:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(-2px);
    }
    .icon-preview {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .icon-preview img {
      width: 100%;
      height: 100%;
    }
    .icon-info {
      text-align: center;
      margin-bottom: 8px;
    }
    .icon-name {
      display: block;
      font-size: 11px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 110px;
    }
    .icon-prefix {
      display: block;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .select-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .select-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔄 Replace Missing Icon</h1>
    <button class="cancel-btn" onclick="cancel()">Cancel</button>
  </div>
  
  <div class="info-box">
    <span class="icon">⚠️</span>
    <span>Missing icon: <strong>${escapedMissing}.svg</strong> — Select a replacement from Iconify</span>
  </div>
  
  <div class="toolbar">
    <label>
      🎨 Color:
      <input type="color" id="colorPicker" class="color-picker" value="#ffffff" />
    </label>
    <div class="color-presets">
      <button class="color-preset active" style="background: #ffffff" data-color="#ffffff" title="White"></button>
      <button class="color-preset" style="background: #000000" data-color="#000000" title="Black"></button>
      <button class="color-preset" style="background: #3b82f6" data-color="#3b82f6" title="Blue"></button>
      <button class="color-preset" style="background: #10b981" data-color="#10b981" title="Green"></button>
      <button class="color-preset" style="background: #f59e0b" data-color="#f59e0b" title="Orange"></button>
      <button class="color-preset" style="background: #ef4444" data-color="#ef4444" title="Red"></button>
      <button class="color-preset" style="background: #8b5cf6" data-color="#8b5cf6" title="Purple"></button>
    </div>
  </div>

  <p class="subtitle">Results for "${escapedQuery}" — ${icons.length} icons found. Click to select.</p>
  
  <div class="grid">
    ${iconCards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentColor = '#ffffff';
    
    function updateIconColors(color) {
      currentColor = color;
      const encodedColor = encodeURIComponent(color);
      document.querySelectorAll('.icon-preview img').forEach(img => {
        const src = img.src;
        img.src = src.replace(/color=[^&]*/, 'color=' + encodedColor);
      });
      document.querySelectorAll('.color-preset').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
      document.getElementById('colorPicker').value = color;
    }
    
    document.getElementById('colorPicker').addEventListener('input', (e) => {
      updateIconColors(e.target.value);
    });
    
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        updateIconColors(btn.dataset.color);
      });
    });
    
    function selectIcon(prefix, name) {
      vscode.postMessage({ command: 'selectIcon', prefix, name, color: currentColor });
    }
    
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }
  </script>
</body>
</html>`;
}

function showIconPickerPanel(
  context: vscode.ExtensionContext,
  icons: IconifySearchResult[],
  query: string,
  svgTransformer: SvgTransformer,
  provider: WorkspaceSvgProvider
): void {
  const panel = vscode.window.createWebviewPanel(
    'iconPicker',
    `Icons: ${query}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getIconPickerHtml(icons, query);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'addIcon') {
        const { prefix, name, color } = message;

        try {
          const svg = await fetchIconSvg(prefix, name, color !== '#ffffff' ? color : undefined);

          if (!svg) {
            vscode.window.showErrorMessage('Failed to fetch icon SVG');
            return;
          }

          const fullOutputPath = getOutputPathOrWarn();
          if (!fullOutputPath) return;

          const iconName = `${prefix}-${name}`;
          await addToIconsJs(fullOutputPath, iconName, svg, svgTransformer);

          provider.refresh();
          vscode.window.showInformationMessage(`✅ Icon "${iconName}" added to your library!`);

          panel.webview.postMessage({ command: 'iconAdded', prefix, name });

        } catch (error) {
          vscode.window.showErrorMessage(`Error adding icon: ${error}`);
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

