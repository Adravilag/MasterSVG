import * as vscode from 'vscode';
import {
  WorkspaceSvgProvider,
  SvgItem,
  initIgnoreFileWatcher,
  BuiltIconsProvider,
  SvgFilesProvider,
  IconCompletionProvider,
  IconHoverProvider,
  SvgToIconCodeActionProvider,
  MissingIconCodeActionProvider,
  SvgImgDiagnosticProvider,
  IconPreviewProvider,
} from './providers';
import { getSvgConfig } from './utils/config';
import { buildIcon } from './utils/iconBuildHelpers';
import * as path from 'path';
import IconImportCodeActionProvider from './providers/IconImportCodeActionProvider';
import { SvgTransformer, getVariantsService, getAnimationService } from './services';
import { WelcomePanel } from './panels/WelcomePanel';
import { IconStudioPanel } from './panels/IconStudioPanel';
import {
  updateIconsJsContext,
} from './utils/configHelper';
import { registerTreeViewCommands } from './commands/treeViewCommands';
import { registerRefreshCommands } from './commands/refreshCommands';
import { registerBuildCommands } from './commands/buildCommands';
import { registerNavigationCommands } from './commands/navigationCommands';
import { registerPanelCommands } from './commands/panelCommands';
import { registerReferenceCommands } from './commands/referenceCommands';
import { registerConfigCommands } from './commands/configCommands';
import { registerIconCommands } from './commands/iconCommands';
import { registerTransformCommands } from './commands/transformCommands';
import {
  registerIconifyCommands,
} from './commands/iconifyCommands';
import { registerEditorCommands } from './commands/editorCommands';
import { registerSpriteCommands } from './commands/spriteCommands';
import { registerMiscCommands } from './commands/miscCommands';
import { registerImportCommands } from './commands/importCommands';
import { registerLicenseCommands } from './commands/licenseCommands';
import { registerLibraryCommands } from './commands/libraryCommands';

/**
 * Supported language selectors for code intelligence features
 */
const SUPPORTED_LANGUAGES: vscode.DocumentSelector = [
  { language: 'javascript' },
  { language: 'typescript' },
  { language: 'javascriptreact' },
  { language: 'typescriptreact' },
  { language: 'vue' },
  { language: 'svelte' },
  { language: 'html' },
];

/**
 * Supported language selectors with scheme for code actions
 */
const SUPPORTED_LANGUAGES_WITH_SCHEME: vscode.DocumentSelector = [
  { language: 'javascript', scheme: '*' },
  { language: 'typescript', scheme: '*' },
  { language: 'javascriptreact', scheme: '*' },
  { language: 'typescriptreact', scheme: '*' },
  { language: 'vue', scheme: '*' },
  { language: 'svelte', scheme: '*' },
  { language: 'html', scheme: '*' },
];

let workspaceSvgProvider: WorkspaceSvgProvider;
let builtIconsProvider: BuiltIconsProvider;
let svgFilesProvider: SvgFilesProvider;
let iconPreviewProvider: IconPreviewProvider;
let workspaceTreeView: vscode.TreeView<SvgItem>;
let svgFilesTreeView: vscode.TreeView<SvgItem>;
let svgWatcher: vscode.FileSystemWatcher | undefined;
let watchModePending = new Set<string>();
let watchModeTimer: NodeJS.Timeout | undefined;
let watchModeEnabled = false;

// Code-integration disposables (managed dynamically)
let completionDisposable: vscode.Disposable | undefined;
let hoverDisposable: vscode.Disposable | undefined;
let codeActionProvider: vscode.Disposable | undefined;
let missingIconCodeActionProvider: vscode.Disposable | undefined;
let iconImportCodeActionProvider: vscode.Disposable | undefined;
let diagnosticProvider: SvgImgDiagnosticProvider | undefined;
let diagOnChangeDisposable: vscode.Disposable | undefined;
let diagOnOpenDisposable: vscode.Disposable | undefined;

/**
 * Shows onboarding wizard for first-time users
 */
async function showOnboardingWizard(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  // Only show Welcome Panel for first-time users or when not configured
  try {
    if (!WelcomePanel.isConfigured()) {
      WelcomePanel.createOrShow(context.extensionUri);
    }
  } catch (err) {
    // If any error occurs while checking configuration, fall back to not showing
    console.error('[MasterSVG] Failed to evaluate welcome state:', err);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Show onboarding for first-time users
  showOnboardingWizard(context);

  // Initialize .msignore file watcher
  initIgnoreFileWatcher(context);

  // Set initial context for icons.js existence
  updateIconsJsContext();

  // Initialize services
  const svgTransformer = new SvgTransformer();
  workspaceSvgProvider = new WorkspaceSvgProvider(context);

  // Register the SVG Files tree view
  svgFilesProvider = new SvgFilesProvider(workspaceSvgProvider);
  svgFilesTreeView = vscode.window.createTreeView('masterSVG.svgFiles', {
    treeDataProvider: svgFilesProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(svgFilesTreeView);

  // Update preview when SVG file is selected
  svgFilesTreeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as SvgItem;
      if (item.icon) {
        const svgData = workspaceSvgProvider.getSvgData(item);
        if (svgData) {
          iconPreviewProvider.updatePreview({
            name: svgData.name,
            svg: svgData.svg,
            location: svgData.location,
            isBuilt: false,
            animation: svgData.animation,
          });
        }
      }
    }
  });

  // Register the Built Icons tree view
  builtIconsProvider = new BuiltIconsProvider(workspaceSvgProvider);
  const builtIconsTreeView = vscode.window.createTreeView('masterSVG.builtIcons', {
    treeDataProvider: builtIconsProvider,
    showCollapseAll: false,
    canSelectMany: true,
  });
  context.subscriptions.push(builtIconsTreeView);

  // Connect SvgFilesProvider with BuiltIconsProvider to show build status
  svgFilesProvider.setBuiltIconsProvider(builtIconsProvider);

  // Update preview when built icon is selected
  builtIconsTreeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as SvgItem;
      if (item.icon) {
        const svgData = workspaceSvgProvider.getSvgData(item);
        if (svgData) {
          iconPreviewProvider.updatePreview({
            name: svgData.name,
            svg: svgData.svg,
            location: svgData.location,
            isBuilt: true,
            animation: svgData.animation,
          });
        }
      }
    }
  });

  // Register the preview panel in sidebar
  iconPreviewProvider = new IconPreviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IconPreviewProvider.viewType, iconPreviewProvider)
  );

  // Update preview when tree item is selected
  const treeView = vscode.window.createTreeView('masterSVG.workspaceIcons', {
    treeDataProvider: workspaceSvgProvider,
    showCollapseAll: false,
    canSelectMany: true,
  });
  workspaceTreeView = treeView;

  // Register tree view commands (expand/collapse)
  const treeViewCommands = registerTreeViewCommands(
    context,
    {
      workspace: treeView,
      builtIcons: builtIconsTreeView,
      svgFiles: svgFilesTreeView,
    },
    {
      workspaceSvgProvider,
      builtIconsProvider,
      svgFilesProvider,
    }
  );
  context.subscriptions.push(...treeViewCommands);

  // Update preview when workspace tree item is selected
  treeView.onDidChangeSelection(e => {
    if (e.selection.length > 0) {
      const item = e.selection[0] as SvgItem;
      if (item.icon) {
        const svgData = workspaceSvgProvider.getSvgData(item);
        if (svgData) {
          iconPreviewProvider.updatePreview({
            name: svgData.name,
            svg: svgData.svg,
            location: svgData.location,
            isBuilt: item.icon.isBuilt === true,
            animation: svgData.animation,
          });
        }
      }
    }
  });
  context.subscriptions.push(treeView);

  // Register navigation commands (goToUsage, goToInlineSvg, goToCode, copyIconName)
  const navigationCommands = registerNavigationCommands(context);
  context.subscriptions.push(...navigationCommands);

  // Register reference commands (removeReference, findAndReplace, revealInTree)
  const referenceCommands = registerReferenceCommands(context, { workspaceSvgProvider, workspaceTreeView });
  context.subscriptions.push(...referenceCommands);

  // Register panel commands (openPanel, openWelcome, scanWorkspace, scanUsages)
  const panelCommands = registerPanelCommands(context, workspaceSvgProvider);
  context.subscriptions.push(...panelCommands);

  // Register config commands (configureProject, editIgnoreFile)
  const configCommands = registerConfigCommands(context);
  context.subscriptions.push(...configCommands);

  // Register icon commands (deleteIcons, removeFromBuilt, renameIcon)
  const iconCommands = registerIconCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
    svgFilesProvider,
  });
  context.subscriptions.push(...iconCommands);

  // Register transform commands (transformInlineSvg, transformSvg, optimizeSvg, insertIcon)
  const transformCommands = registerTransformCommands(
    context,
    { workspaceSvgProvider, builtIconsProvider },
    svgTransformer
  );
  context.subscriptions.push(...transformCommands);

  // Register refresh commands (from module)
  const refreshCommands = registerRefreshCommands({
    workspaceSvgProvider,
    builtIconsProvider,
    svgFilesProvider,
    iconPreviewProvider,
  });
  context.subscriptions.push(...refreshCommands);

  // Register build commands (from module)
  const buildCommands = registerBuildCommands(
    context,
    {
      workspaceSvgProvider,
      builtIconsProvider,
      svgFilesProvider,
    },
    svgTransformer
  );
  context.subscriptions.push(...buildCommands);

  // Register Iconify commands (from module)
  registerIconifyCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
    svgTransformer,
  });

  // Register editor commands (from module)
  const editorCommands = registerEditorCommands(context, {
    workspaceSvgProvider,
    iconPreviewProvider,
  });
  context.subscriptions.push(...editorCommands);

  // Register sprite commands (from module)
  const spriteCommands = registerSpriteCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
  });
  context.subscriptions.push(...spriteCommands);

  // Register misc commands (from module)
  const miscCommands = registerMiscCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
    svgFilesProvider,
    svgTransformer,
    workspaceTreeView,
  });
  context.subscriptions.push(...miscCommands);

  // Register import commands (importSvgToLibrary, checkAndImportSvg, addSvgToCollection)
  const importCommands = registerImportCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
    svgFilesProvider,
    svgTransformer,
  });
  context.subscriptions.push(...importCommands);

  // Register license commands
  const licenseCommands = registerLicenseCommands(context);
  context.subscriptions.push(...licenseCommands);

  // Register library commands (Astro icon library)
  registerLibraryCommands(context, {
    workspaceSvgProvider,
    builtIconsProvider,
    svgTransformer,
  });

  // Register completion provider
  const codeIntegrationEnabled = vscode.workspace.getConfiguration('masterSVG').get<boolean>('codeIntegrationEnabled', false);

  // Watch for SVG file changes
  svgWatcher = vscode.workspace.createFileSystemWatcher('**/*.svg');
  svgWatcher.onDidCreate(() => svgFilesProvider.refresh());
  svgWatcher.onDidDelete(() => svgFilesProvider.refresh());
  svgWatcher.onDidChange(() => svgFilesProvider.refresh());

  // Watch for variants.js changes and refresh the built icons tree
  const variantsWatcher = vscode.workspace.createFileSystemWatcher('**/variants.js');
  variantsWatcher.onDidCreate(() => builtIconsProvider.refresh());
  variantsWatcher.onDidChange(() => builtIconsProvider.refresh());
  variantsWatcher.onDidDelete(() => builtIconsProvider.refresh());

  // Manage code-integration providers at runtime
  function setupCodeIntegration(enabled: boolean) {
    // If enabling and not already registered
    if (enabled) {
      if (!completionDisposable) {
        completionDisposable = vscode.languages.registerCompletionItemProvider(
          SUPPORTED_LANGUAGES,
          new IconCompletionProvider(workspaceSvgProvider),
          '<',
          '"',
          "'"
        );
        context.subscriptions.push(completionDisposable);
      }

      if (!hoverDisposable) {
        hoverDisposable = vscode.languages.registerHoverProvider(
          SUPPORTED_LANGUAGES,
          new IconHoverProvider(workspaceSvgProvider)
        );
        context.subscriptions.push(hoverDisposable);
      }

      if (!codeActionProvider) {
        codeActionProvider = vscode.languages.registerCodeActionsProvider(
          SUPPORTED_LANGUAGES_WITH_SCHEME,
          new SvgToIconCodeActionProvider(),
          {
            providedCodeActionKinds: SvgToIconCodeActionProvider.providedCodeActionKinds,
          }
        );
        context.subscriptions.push(codeActionProvider);
      }

      if (!missingIconCodeActionProvider) {
        missingIconCodeActionProvider = vscode.languages.registerCodeActionsProvider(
          SUPPORTED_LANGUAGES,
          new MissingIconCodeActionProvider(workspaceSvgProvider),
          { providedCodeActionKinds: MissingIconCodeActionProvider.providedCodeActionKinds }
        );
        context.subscriptions.push(missingIconCodeActionProvider);
      }

      if (!iconImportCodeActionProvider) {
        iconImportCodeActionProvider = vscode.languages.registerCodeActionsProvider(
          SUPPORTED_LANGUAGES_WITH_SCHEME,
          new IconImportCodeActionProvider(),
          { providedCodeActionKinds: IconImportCodeActionProvider.providedCodeActionKinds }
        );
        context.subscriptions.push(iconImportCodeActionProvider);
      }

      if (!diagnosticProvider) {
        diagnosticProvider = new SvgImgDiagnosticProvider();
        // attach listeners and keep disposables so we can remove on disable
        diagOnChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
          diagnosticProvider && diagnosticProvider.updateDiagnostics(e.document);
        });
        diagOnOpenDisposable = vscode.workspace.onDidOpenTextDocument(doc => {
          diagnosticProvider && diagnosticProvider.updateDiagnostics(doc);
        });
        context.subscriptions.push(diagOnChangeDisposable, diagOnOpenDisposable);
        // Update diagnostics for currently open documents
        vscode.window.visibleTextEditors.forEach(editor => {
          diagnosticProvider && diagnosticProvider.updateDiagnostics(editor.document);
        });
      }
      return;
    }

    // If disabling, dispose existing providers and listeners
    try {
      completionDisposable && completionDisposable.dispose();
      completionDisposable = undefined;
      hoverDisposable && hoverDisposable.dispose();
      hoverDisposable = undefined;
      codeActionProvider && codeActionProvider.dispose();
      codeActionProvider = undefined;
      missingIconCodeActionProvider && missingIconCodeActionProvider.dispose();
      missingIconCodeActionProvider = undefined;
      iconImportCodeActionProvider && iconImportCodeActionProvider.dispose();
      iconImportCodeActionProvider = undefined;
      // diagnostics
      diagOnChangeDisposable && diagOnChangeDisposable.dispose();
      diagOnChangeDisposable = undefined;
      diagOnOpenDisposable && diagOnOpenDisposable.dispose();
      diagOnOpenDisposable = undefined;
      diagnosticProvider && diagnosticProvider.dispose && diagnosticProvider.dispose();
      diagnosticProvider = undefined;
    } catch (e) {
      // ignore disposal errors
    }
  }

  // Initialize based on current config
  setupCodeIntegration(codeIntegrationEnabled);

  // React to runtime changes in the configuration
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('masterSVG.codeIntegrationEnabled')) {
      const enabled = vscode.workspace.getConfiguration('masterSVG').get<boolean>('codeIntegrationEnabled', false);
      setupCodeIntegration(enabled);
    }
  }));

  // Always subscribe watchers
  context.subscriptions.push(svgWatcher, variantsWatcher);

  // Setup Watch Mode if enabled in configuration
  try {
    watchModeEnabled = getSvgConfig<boolean>('watchMode', false);
  } catch (e) {
    watchModeEnabled = false;
  }
  // Watch Mode control helpers
  let watchCreateDisp: vscode.Disposable | undefined;
  let watchChangeDisp: vscode.Disposable | undefined;
  let watchDeleteDisp: vscode.Disposable | undefined;

  async function processWatchBatch() {
    const panel = IconStudioPanel.currentPanel;
    // notify webview processing started
    try { if (panel) panel.postMessage({ type: 'watchProcessing', state: 'start' }); } catch (e) {}

    const files = Array.from(watchModePending);
    watchModePending.clear();
    if (files.length === 0) {
      try { if (panel) panel.postMessage({ type: 'watchProcessing', state: 'end' }); } catch (e) {}
      return;
    }

    for (const filePath of files) {
      try {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        const svg = Buffer.from(content).toString('utf8');
        const iconName = path.basename(filePath, path.extname(filePath));
        await buildIcon({ iconName, svgContent: svg, svgTransformer });
      } catch (err) {
        // ignore individual failures
      }
    }

    // Refresh all views and preview
    try {
      await vscode.commands.executeCommand('masterSVG.refreshIcons');
      iconPreviewProvider && typeof iconPreviewProvider.forceRefresh === 'function' && iconPreviewProvider.forceRefresh();
    } catch (e) { /* ignore */ }

    try { if (panel) panel.postMessage({ type: 'watchProcessing', state: 'end' }); } catch (e) {}
  }

  function scheduleProcess() {
    if (watchModeTimer) clearTimeout(watchModeTimer);
    watchModeTimer = setTimeout(() => {
      void processWatchBatch();
    }, 800);
  }

  function handleSvgFsEvent(fsPath: string, _kind: 'create' | 'change' | 'delete') {
    if (_kind === 'delete') {
      vscode.commands.executeCommand('masterSVG.refreshIcons');
      return;
    }

    const svgFolders = getSvgConfig<string[]>('svgFolders', []);
    const inConfigured = svgFolders.length === 0 || svgFolders.some(folder => fsPath.includes(folder.replace(/\\/g, '/')));
    if (!inConfigured) return;

    watchModePending.add(fsPath);
    scheduleProcess();
  }

  function startWatchMode() {
    if (!svgWatcher) return;
    // remove default quick refresh handlers
    // register our handlers
    watchCreateDisp = svgWatcher.onDidCreate(uri => handleSvgFsEvent(uri.fsPath, 'create'));
    watchChangeDisp = svgWatcher.onDidChange(uri => handleSvgFsEvent(uri.fsPath, 'change'));
    watchDeleteDisp = svgWatcher.onDidDelete(uri => handleSvgFsEvent(uri.fsPath, 'delete'));
  }

  function stopWatchMode() {
    watchCreateDisp && watchCreateDisp.dispose();
    watchChangeDisp && watchChangeDisp.dispose();
    watchDeleteDisp && watchDeleteDisp.dispose();
    watchCreateDisp = watchChangeDisp = watchDeleteDisp = undefined;
  }

  if (watchModeEnabled) {
    startWatchMode();
  }

  // React to watchMode changes in configuration at runtime
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('masterSVG.watchMode')) {
      const enabled = vscode.workspace.getConfiguration('masterSVG').get<boolean>('watchMode', false);
      if (enabled && !watchModeEnabled) {
        watchModeEnabled = true;
        startWatchMode();
      } else if (!enabled && watchModeEnabled) {
        watchModeEnabled = false;
        stopWatchMode();
      }
      // notify IconStudioPanel if open
      try {
        const panel = (global as any).IconStudioPanel ? (global as any).IconStudioPanel.currentPanel : undefined;
        if (panel) panel.postMessage({ type: 'config', data: { watchMode: enabled } });
      } catch (e) {}
    }
  }));
}

export function deactivate() {
  // Cleanup file watcher
  if (svgWatcher) {
    svgWatcher.dispose();
    svgWatcher = undefined;
  }

  // Reset animation service cache
  getAnimationService().resetCache();

  // Clear providers
  workspaceSvgProvider = undefined!;
  builtIconsProvider = undefined!;
  svgFilesProvider = undefined!;
  iconPreviewProvider = undefined!;
  workspaceTreeView = undefined!;
  svgFilesTreeView = undefined!;
}
