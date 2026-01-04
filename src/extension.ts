import * as vscode from 'vscode';
import {
  WorkspaceSvgProvider,
  SvgItem,
  initIgnoreFileWatcher,
  BuiltIconsProvider,
  SvgFilesProvider,
} from './providers/WorkspaceSvgProvider';
import { SvgTransformer } from './services/SvgTransformer';
import { IconCompletionProvider } from './providers/IconCompletionProvider';
import { IconHoverProvider } from './providers/IconHoverProvider';
import {
  SvgToIconCodeActionProvider,
  MissingIconCodeActionProvider,
  SvgImgDiagnosticProvider,
} from './providers/SvgToIconCodeActionProvider';
import { IconPreviewProvider } from './providers/IconPreviewProvider';
import { getVariantsService } from './services/VariantsService';
import { WelcomePanel } from './panels/WelcomePanel';
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
import { getAnimationService } from './services/AnimationAssignmentService';

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

/**
 * Shows onboarding wizard for first-time users
 */
async function showOnboardingWizard(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('sageboxIconStudio');
  const outputDir = config.get<string>('outputDirectory', '');

  // Skip if already configured
  if (outputDir) {
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  // Show Welcome Panel for first-time configuration
  WelcomePanel.createOrShow(context.extensionUri);
}

export function activate(context: vscode.ExtensionContext) {
  // Show onboarding for first-time users
  showOnboardingWizard(context);

  // Initialize .sageboxignore file watcher
  initIgnoreFileWatcher(context);

  // Set initial context for icons.js existence
  updateIconsJsContext();

  // Initialize services
  const svgTransformer = new SvgTransformer();
  workspaceSvgProvider = new WorkspaceSvgProvider(context);

  // Register the SVG Files tree view
  svgFilesProvider = new SvgFilesProvider(workspaceSvgProvider);
  svgFilesTreeView = vscode.window.createTreeView('sageboxIconStudio.svgFiles', {
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
          iconPreviewProvider.updatePreview(
            svgData.name,
            svgData.svg,
            svgData.location,
            false,
            svgData.animation
          );
        }
      }
    }
  });

  // Register the Built Icons tree view
  builtIconsProvider = new BuiltIconsProvider(workspaceSvgProvider);
  const builtIconsTreeView = vscode.window.createTreeView('sageboxIconStudio.builtIcons', {
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
          iconPreviewProvider.updatePreview(
            svgData.name,
            svgData.svg,
            svgData.location,
            true, // isBuilt
            svgData.animation
          );
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
  const treeView = vscode.window.createTreeView('sageboxIconStudio.workspaceIcons', {
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
      if (
        item.contextValue === 'inlineSvg' ||
        item.contextValue === 'builtIcon' ||
        item.contextValue === 'svgIcon' ||
        item.contextValue === 'iconUsage' ||
        item.contextValue === 'iconUsageMissing'
      ) {
        const svgData = workspaceSvgProvider.getSvgData(item);
        if (svgData) {
          iconPreviewProvider.updatePreview(
            svgData.name,
            svgData.svg,
            svgData.location,
            item.contextValue === 'builtIcon' || item.contextValue === 'iconUsage',
            svgData.animation
          );
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

  // Register completion provider
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    SUPPORTED_LANGUAGES,
    new IconCompletionProvider(workspaceSvgProvider),
    '<',
    '"',
    "'"
  );

  // Register hover provider
  const hoverDisposable = vscode.languages.registerHoverProvider(
    SUPPORTED_LANGUAGES,
    new IconHoverProvider(workspaceSvgProvider)
  );

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

  // Register code action provider for SVG img references
  // Use '*' scheme to match all file types including untitled
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    SUPPORTED_LANGUAGES_WITH_SCHEME,
    new SvgToIconCodeActionProvider(),
    {
      providedCodeActionKinds: SvgToIconCodeActionProvider.providedCodeActionKinds,
    }
  );

  // Register code action provider for missing icons in web components
  const missingIconCodeActionProvider = vscode.languages.registerCodeActionsProvider(
    SUPPORTED_LANGUAGES,
    new MissingIconCodeActionProvider(workspaceSvgProvider),
    {
      providedCodeActionKinds: MissingIconCodeActionProvider.providedCodeActionKinds,
    }
  );

  // Enable diagnostic provider to show hints for SVG img references
  // This creates the diagnostic hints that trigger the code action provider
  const diagnosticProvider = new SvgImgDiagnosticProvider();

  // Update diagnostics when documents change
  vscode.workspace.onDidChangeTextDocument(e => {
    diagnosticProvider.updateDiagnostics(e.document);
  });
  vscode.workspace.onDidOpenTextDocument(doc => {
    diagnosticProvider.updateDiagnostics(doc);
  });
  // Update diagnostics for currently open documents
  vscode.window.visibleTextEditors.forEach(editor => {
    diagnosticProvider.updateDiagnostics(editor.document);
  });

  context.subscriptions.push(
    completionDisposable,
    hoverDisposable,
    svgWatcher,
    variantsWatcher,
    codeActionProvider,
    missingIconCodeActionProvider
  );
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
