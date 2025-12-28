import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IconManagerPanel } from './panels/IconManagerPanel';
import { IconDetailsPanel } from './panels/IconDetailsPanel';
import { IconEditorPanel } from './panels/IconEditorPanel';
import { WelcomePanel } from './panels/WelcomePanel';
import { WorkspaceSvgProvider, SvgItem, WorkspaceIcon, initIgnoreFileWatcher, BuiltIconsProvider, SvgFilesProvider } from './providers/WorkspaceSvgProvider';
import { SvgTransformer } from './services/SvgTransformer';
import { IconCompletionProvider } from './providers/IconCompletionProvider';
import { IconHoverProvider } from './providers/IconHoverProvider';
import { SvgToIconCodeActionProvider, MissingIconCodeActionProvider, TransformOptions } from './providers/SvgToIconCodeActionProvider';
import { IconPreviewProvider } from './providers/IconPreviewProvider';
import { getComponentExporter } from './services/ComponentExporter';
import { getSpriteGenerator, SpriteIcon } from './services/SpriteGenerator';
import { toVariableName } from './utils/extensionHelpers';
import { getIconPickerHtml } from './utils/iconPickerHtml';
import { searchIconify, fetchIconSvg, IconifySearchResult } from './utils/iconifyService';
import { addToIconsJs, addToSpriteSvg, removeFromIconsJs, cleanSpriteSvg, generateWebComponent } from './utils/iconsFileManager';
import { getConfig, getFullOutputPath, getOutputPathOrWarn, ensureOutputDirectory } from './utils/configHelper';

let workspaceSvgProvider: WorkspaceSvgProvider;
let builtIconsProvider: BuiltIconsProvider;
let svgFilesProvider: SvgFilesProvider;
let iconPreviewProvider: IconPreviewProvider;
let workspaceTreeView: vscode.TreeView<SvgItem>;
let svgFilesTreeView: vscode.TreeView<SvgItem>;

/**
 * Write file using VS Code API to avoid conflicts with open editors
 */
async function writeFileWithVSCode(filePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

/**
 * Shows onboarding wizard for first-time users
 */
async function showOnboardingWizard(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('iconManager');
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
  console.log('Icon Manager extension is now active!');

  // Show onboarding for first-time users
  showOnboardingWizard(context);

  // Initialize .bezierignore file watcher
  initIgnoreFileWatcher(context);

  // Initialize services
  const svgTransformer = new SvgTransformer();
  workspaceSvgProvider = new WorkspaceSvgProvider(context);

  // Register the tree view for workspace SVGs
  vscode.window.registerTreeDataProvider(
    'iconManager.workspaceIcons',
    workspaceSvgProvider
  );

  // Register the SVG Files tree view
  svgFilesProvider = new SvgFilesProvider(workspaceSvgProvider);
  svgFilesTreeView = vscode.window.createTreeView('iconManager.svgFiles', {
    treeDataProvider: svgFilesProvider,
    showCollapseAll: false
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
  const builtIconsTreeView = vscode.window.createTreeView('iconManager.builtIcons', {
    treeDataProvider: builtIconsProvider,
    showCollapseAll: false
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
    vscode.window.registerWebviewViewProvider(
      IconPreviewProvider.viewType,
      iconPreviewProvider
    )
  );

  // Update preview when tree item is selected
  const treeView = vscode.window.createTreeView('iconManager.workspaceIcons', {
    treeDataProvider: workspaceSvgProvider,
    showCollapseAll: false,
    canSelectMany: true
  });
  workspaceTreeView = treeView;

  // Track expand state for toggle icons
  let isWorkspaceExpanded = false;
  let isBuiltExpanded = false;
  let isSvgFilesExpanded = false;

  // Set initial context
  vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', false);
  vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', false);
  vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', false);

  // Command: Expand All (workspace icons - Code view)
  const expandAllCmd = vscode.commands.registerCommand('iconManager.expandAll', async () => {
    const roots = await workspaceSvgProvider.getChildren();
    for (const root of roots) {
      try {
        await treeView.reveal(root, { expand: 2, focus: false, select: false });
      } catch (e) {
        // Ignore errors
      }
    }
    isWorkspaceExpanded = true;
    vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', true);
  });

  // Command: Collapse All (workspace icons - Code view)
  const collapseAllCmd = vscode.commands.registerCommand('iconManager.collapseAll', async () => {
    await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.workspaceIcons.collapseAll');
    isWorkspaceExpanded = false;
    vscode.commands.executeCommand('setContext', 'iconManager.workspaceExpanded', false);
  });

  // Command: Expand All SVG Files
  const expandSvgFilesCmd = vscode.commands.registerCommand('iconManager.expandSvgFiles', async () => {
    const roots = await svgFilesProvider.getChildren();
    for (const root of roots) {
      try {
        await svgFilesTreeView.reveal(root, { expand: 2, focus: false, select: false });
      } catch (e) {
        // Ignore errors
      }
    }
    isSvgFilesExpanded = true;
    vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', true);
  });

  // Command: Collapse All SVG Files
  const collapseSvgFilesCmd = vscode.commands.registerCommand('iconManager.collapseSvgFiles', async () => {
    await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.svgFiles.collapseAll');
    isSvgFilesExpanded = false;
    vscode.commands.executeCommand('setContext', 'iconManager.svgFilesExpanded', false);
  });

  // Command: Expand All Built Icons
  const expandBuiltCmd = vscode.commands.registerCommand('iconManager.expandBuiltIcons', async () => {
    const roots = await builtIconsProvider.getChildren();
    for (const root of roots) {
      try {
        await builtIconsTreeView.reveal(root, { expand: 2, focus: false, select: false });
      } catch (e) {
        // Ignore errors
      }
    }
    isBuiltExpanded = true;
    vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', true);
  });

  // Command: Collapse All Built Icons
  const collapseBuiltCmd = vscode.commands.registerCommand('iconManager.collapseBuiltIcons', async () => {
    await vscode.commands.executeCommand('workbench.actions.treeView.iconManager.builtIcons.collapseAll');
    isBuiltExpanded = false;
    vscode.commands.executeCommand('setContext', 'iconManager.builtExpanded', false);
  });

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
            item.contextValue === 'builtIcon',
            svgData.animation
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

  // Command: Open welcome/setup panel
  const openWelcomeCmd = vscode.commands.registerCommand('iconManager.openWelcome', () => {
    WelcomePanel.createOrShow(context.extensionUri);
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
      
      // If we have full SVG position info (start and end), select the entire SVG
      if (icon.endLine !== undefined && icon.endColumn !== undefined) {
        const startPos = new vscode.Position(icon.line, icon.column || 0);
        const endPos = new vscode.Position(icon.endLine, icon.endColumn);
        const range = new vscode.Range(startPos, endPos);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } else {
        // Fallback: try to find and select the full SVG from the document text
        const text = document.getText();
        const lines = text.split('\n');
        let svgStartLine = icon.line;
        let svgStartCol = 0;
        let svgEndLine = icon.line;
        let svgEndCol = lines[icon.line]?.length || 0;
        
        // Find <svg on the start line or nearby
        const lineText = lines[svgStartLine] || '';
        const svgTagIndex = lineText.indexOf('<svg');
        if (svgTagIndex !== -1) {
          svgStartCol = svgTagIndex;
          
          // Find closing </svg> - can be on same line or later
          let depth = 0;
          for (let i = svgStartLine; i < lines.length; i++) {
            const currentLine = lines[i];
            const startIdx = i === svgStartLine ? svgStartCol : 0;
            
            for (let j = startIdx; j < currentLine.length; j++) {
              if (currentLine.substring(j, j + 4) === '<svg') {
                depth++;
              } else if (currentLine.substring(j, j + 6) === '</svg>') {
                depth--;
                if (depth === 0) {
                  svgEndLine = i;
                  svgEndCol = j + 6;
                  break;
                }
              }
            }
            if (depth === 0 && svgEndLine !== svgStartLine) break;
          }
        }
        
        const startPos = new vscode.Position(svgStartLine, svgStartCol);
        const endPos = new vscode.Position(svgEndLine, svgEndCol);
        const range = new vscode.Range(startPos, endPos);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    }
  });

  // Command: Go to Code (for items in Code view with line info)
  const goToCodeCmd = vscode.commands.registerCommand('iconManager.goToCode', async (iconOrItem: any) => {
    const icon = iconOrItem?.icon || iconOrItem;
    if (icon && icon.filePath && icon.line !== undefined) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(icon.filePath));
      const editor = await vscode.window.showTextDocument(document);
      
      const line = icon.line;
      const column = icon.column || 0;
      const position = new vscode.Position(line, column);
      
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  });

  // Command: Copy Icon Name
  const copyIconNameCmd = vscode.commands.registerCommand('iconManager.copyIconName', async (iconOrItem: any) => {
    const icon = iconOrItem?.icon || iconOrItem;
    if (icon && icon.name) {
      await vscode.env.clipboard.writeText(icon.name);
      vscode.window.showInformationMessage(`Copied: ${icon.name}`);
    }
  });

  // Command: Transform inline SVG (also handles IMG references)
  const transformInlineSvgCmd = vscode.commands.registerCommand('iconManager.transformInlineSvg', async (item: any) => {
    if (item.icon && item.icon.filePath && item.icon.svg) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.icon.filePath));
      const editor = await vscode.window.showTextDocument(document);

      const text = document.getText();
      let svgStart = -1;
      let svgContent = item.icon.svg;
      let isImgReference = item.icon.category === 'img-ref';
      let imgTagMatch: RegExpExecArray | null = null;
      let imgTagText = '';

      if (isImgReference) {
        // For IMG references, find the <img> tag that references this SVG
        const iconName = item.icon.name;
        // Escape special regex characters in icon name
        const escapedIconName = iconName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imgRegex = new RegExp(`<img\\s+[^>]*src=["'][^"']*${escapedIconName}\\.svg["'][^>]*>`, 'gi');
        
        console.log('[Bezier] Searching for IMG ref:', iconName, 'in file:', item.icon.filePath, 'at line:', item.icon.line);
        
        // Search around the recorded line
        if (item.icon.line !== undefined) {
          const searchRadius = 5;
          const startLine = Math.max(0, item.icon.line - searchRadius);
          const endLine = Math.min(document.lineCount - 1, item.icon.line + searchRadius);
          
          for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            imgTagMatch = imgRegex.exec(line.text);
            if (imgTagMatch) {
              svgStart = document.offsetAt(line.range.start) + imgTagMatch.index;
              imgTagText = imgTagMatch[0];
              console.log('[Bezier] Found IMG tag at line', i, ':', imgTagText);
              break;
            }
            imgRegex.lastIndex = 0; // Reset regex for next line
          }
        }
        
        // If not found by line, search entire document
        if (svgStart === -1) {
          imgRegex.lastIndex = 0;
          imgTagMatch = imgRegex.exec(text);
          if (imgTagMatch) {
            svgStart = imgTagMatch.index;
            imgTagText = imgTagMatch[0];
            console.log('[Bezier] Found IMG tag in document:', imgTagText);
          }
        }
        
        if (svgStart === -1) {
          console.log('[Bezier] IMG tag not found. Regex pattern:', imgRegex.source);
          vscode.window.showWarningMessage('Could not find IMG reference in document. The file might have changed. Please refresh the icons list.');
          return;
        }
      } else {
        // For inline SVGs, find the actual SVG content
        svgStart = text.indexOf(item.icon.svg);

        // Fallback: Try to find SVG at the recorded line number if exact match fails
        if (svgStart === -1 && item.icon.line !== undefined) {
          try {
            // Check lines around the recorded line (in case of small shifts)
            const searchRadius = 5;
            const startLine = Math.max(0, item.icon.line - searchRadius);
            const endLine = Math.min(document.lineCount - 1, item.icon.line + searchRadius);
            
            for (let i = startLine; i <= endLine; i++) {
              const line = document.lineAt(i);
              if (line.text.includes('<svg')) {
                const textFromLine = text.substring(document.offsetAt(line.range.start));
                const match = /<svg\s[^>]*>[\s\S]*?<\/svg>/i.exec(textFromLine);
                if (match) {
                  svgStart = document.offsetAt(line.range.start) + match.index;
                  svgContent = match[0];
                  break;
                }
              }
            }
          } catch (e) {
            console.error('Error searching for SVG fallback:', e);
          }
        }

        if (svgStart === -1) {
          vscode.window.showWarningMessage('Could not find SVG in document. The file might have changed. Please refresh the icons list.');
          return;
        }
      }

      // Calculate range differently for IMG refs vs inline SVGs
      let range: vscode.Range;
      if (isImgReference) {
        const startPos = document.positionAt(svgStart);
        const endPos = document.positionAt(svgStart + imgTagText.length);
        range = new vscode.Range(startPos, endPos);
      } else {
        const startPos = document.positionAt(svgStart);
        const endPos = document.positionAt(svgStart + svgContent.length);
        range = new vscode.Range(startPos, endPos);
      }

      const config = getConfig();
      const buildFormat = config.buildFormat || 'icons.ts';
      const isSprite = buildFormat === 'sprite.svg';
      const outputDir = config.outputDirectory;
      const webComponentName = config.webComponentName || 'bz-icon';
      const iconName = item.label as string;

      let replacement: string;
      const fullOutputPath = getFullOutputPath();

      if (isSprite) {
        // Sprite format
        replacement = `<svg class="icon" aria-hidden="true"><use href="${outputDir}/sprite.svg#${iconName}"></use></svg>`;
        if (fullOutputPath) {
          await addToSpriteSvg(fullOutputPath, iconName, item.icon.svg, svgTransformer);
        }
      } else {
        // Web Component format
        replacement = `<${webComponentName} name="${iconName}"></${webComponentName}>`;
        if (fullOutputPath) {
          await addToIconsJs(fullOutputPath, iconName, item.icon.svg, svgTransformer);
        }
      }

      await editor.edit((editBuilder) => {
        editBuilder.replace(range, replacement);
      });

      workspaceSvgProvider.refresh();
      builtIconsProvider.refresh();
      const formatName = isSprite ? 'Sprite' : 'Web Component';
      vscode.window.showInformationMessage(`Transformed SVG to ${formatName} format`);
    }
  });

  // Command: Configure icon manager for project
  const configureProjectCmd = vscode.commands.registerCommand('iconManager.configureProject', async () => {
    const config = vscode.workspace.getConfiguration('iconManager');
    
    const items: vscode.QuickPickItem[] = [
      { 
        label: 'Output Directory', 
        description: config.get<string>('outputDirectory'),
        detail: 'Directory where icons.ts or sprite.svg will be generated' 
      },
      { 
        label: 'SVG Folders', 
        description: (config.get<string[]>('svgFolders') || []).join(', '),
        detail: 'Folders to scan for SVG files' 
      },
      { 
        label: 'Component Name', 
        description: config.get<string>('componentName'),
        detail: 'Name of the Icon component (e.g. Icon)' 
      },
      { 
        label: 'Output Format', 
        description: config.get<string>('outputFormat'),
        detail: 'Default output format (jsx, vue, svelte, etc.)' 
      },
      { 
        label: 'Web Component Name', 
        description: config.get<string>('webComponentName'),
        detail: 'Name for the custom element (e.g. bezier-icon)' 
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a setting to configure'
    });

    if (!selection) {
        return;
    }

    if (selection.label === 'Output Directory') {
      const outputDir = await vscode.window.showInputBox({
        prompt: 'Enter the output directory for generated icons',
        value: config.get('outputDirectory') || 'bezier-icons',
        placeHolder: 'e.g., src/icons, assets/icons'
      });

      if (outputDir !== undefined) {
        await config.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Workspace);
        ensureOutputDirectory();
        vscode.window.showInformationMessage(`Output directory set to: ${outputDir}`);
      }
    } else if (selection.label === 'SVG Folders') {
        const currentFolders = config.get<string[]>('svgFolders') || [];
        const foldersStr = await vscode.window.showInputBox({
            prompt: 'Enter SVG folders to scan (comma separated)',
            value: currentFolders.join(', '),
            placeHolder: 'src/icons, assets/svg'
        });
        if (foldersStr !== undefined) {
            const folders = foldersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
            await config.update('svgFolders', folders, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`SVG folders updated`);
            vscode.commands.executeCommand('iconManager.refreshIcons');
        }
    } else if (selection.label === 'Component Name') {
       const name = await vscode.window.showInputBox({
        prompt: 'Enter the component name',
        value: config.get('componentName') || 'Icon'
      });
      if (name) {
        await config.update('componentName', name, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Component name set to: ${name}`);
      }
    } else if (selection.label === 'Output Format') {
        const format = await vscode.window.showQuickPick(['jsx', 'vue', 'svelte', 'astro', 'html'], {
            placeHolder: 'Select output format'
        });
        if (format) {
            await config.update('outputFormat', format, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Output format set to: ${format}`);
        }
    } else if (selection.label === 'Web Component Name') {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter the web component name',
            value: config.get('webComponentName') || 'bezier-icon'
        });
        if (name) {
            await config.update('webComponentName', name, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Web component name set to: ${name}`);
        }
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

  // Command: Refresh all views
  const refreshIconsCmd = vscode.commands.registerCommand('iconManager.refreshIcons', () => {
    // Refresh builtIconsProvider first so svgFilesProvider can get build status
    builtIconsProvider.refresh();
    svgFilesProvider.refresh();
    workspaceSvgProvider.refresh();
  });

  // Command: Build All References - transforms all img references to web components
  const buildAllReferencesCmd = vscode.commands.registerCommand('iconManager.buildAllReferences', async () => {
    const config = getConfig();
    const componentName = config.webComponentName || 'bz-icon';
    const buildFormat = config.buildFormat || 'icons.js';
    
    // Get all img references from workspaceSvgProvider
    const imgRefs = workspaceSvgProvider.getImgReferences();
    
    if (!imgRefs || imgRefs.length === 0) {
      vscode.window.showInformationMessage('No IMG references found to transform');
      return;
    }
    
    // Filter only existing references
    const validRefs = imgRefs.filter(ref => ref.exists !== false);
    
    if (validRefs.length === 0) {
      vscode.window.showWarningMessage('All IMG references point to missing files');
      return;
    }
    
    const confirm = await vscode.window.showInformationMessage(
      `Transform ${validRefs.length} IMG reference${validRefs.length > 1 ? 's' : ''} to <${componentName}>?`,
      'Yes', 'No'
    );
    
    if (confirm !== 'Yes') return;
    
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building references...',
      cancellable: false
    }, async (progress) => {
      let transformed = 0;
      let failed = 0;
      
      // Group by file for efficient editing
      const refsByFile = new Map<string, typeof validRefs>();
      for (const ref of validRefs) {
        if (!ref.filePath) continue;
        const list = refsByFile.get(ref.filePath) || [];
        list.push(ref);
        refsByFile.set(ref.filePath, list);
      }
      
      for (const [filePath, refs] of refsByFile) {
        progress.report({ message: `Processing ${path.basename(filePath)}...` });
        
        try {
          const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
          const edit = new vscode.WorkspaceEdit();
          
          // Process refs in reverse order (bottom to top) to maintain line positions
          const sortedRefs = [...refs].sort((a, b) => (b.line || 0) - (a.line || 0));
          
          for (const ref of sortedRefs) {
            if (ref.line === undefined || !ref.svg || !ref.path) continue;
            
            const line = document.lineAt(ref.line);
            const lineText = line.text;
            
            // Find the img tag
            const imgRegex = new RegExp(`<img\\s+[^>]*src=["'][^"']*${ref.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.svg["'][^>]*>`, 'gi');
            const match = imgRegex.exec(lineText);
            
            if (match) {
              const startPos = new vscode.Position(ref.line, match.index);
              const endPos = new vscode.Position(ref.line, match.index + match[0].length);
              const range = new vscode.Range(startPos, endPos);
              
              // Build the icon and get its name
              const iconName = ref.name;
              const outputPath = getFullOutputPath();
              
              // Add to library based on build format
              if (outputPath) {
                const transformer = new SvgTransformer();
                if (buildFormat === 'sprite.svg') {
                  await addToSpriteSvg(outputPath, iconName, ref.svg, transformer);
                } else {
                  await addToIconsJs(outputPath, iconName, ref.svg, transformer);
                }
              }
              
              // Create replacement
              const replacement = `<${componentName} name="${iconName}"></${componentName}>`;
              edit.replace(document.uri, range, replacement);
              transformed++;
            }
          }
          
          await vscode.workspace.applyEdit(edit);
          await document.save();
        } catch (err) {
          console.error('[Bezier] Error transforming references in', filePath, err);
          failed++;
        }
      }
      
      // Refresh views
      workspaceSvgProvider.refresh();
      builtIconsProvider.refresh();
      
      if (failed > 0) {
        vscode.window.showWarningMessage(`Transformed ${transformed} references. ${failed} file(s) had errors.`);
      } else {
        vscode.window.showInformationMessage(`Successfully transformed ${transformed} IMG reference${transformed > 1 ? 's' : ''} to <${componentName}>`);
      }
    });
  });

  // Command: Build All SVG Files to library
  const buildAllFilesCmd = vscode.commands.registerCommand('iconManager.buildAllFiles', async () => {
    const config = getConfig();
    const buildFormat = config.buildFormat || 'icons.js';
    
    // Ensure provider is initialized
    await svgFilesProvider.ensureReady();
    
    // Get all SVG files from svgFilesProvider
    const svgFilesMap = svgFilesProvider.getSvgFilesMap();
    console.log('[Bezier] buildAllFiles: svgFilesMap size:', svgFilesMap.size);
    
    const allSvgFiles = Array.from(svgFilesMap.values()).filter(icon => icon.path);
    console.log('[Bezier] buildAllFiles: filtered files:', allSvgFiles.length);
    
    if (allSvgFiles.length === 0) {
      vscode.window.showInformationMessage('No SVG files found in workspace');
      return;
    }
    
    const confirm = await vscode.window.showInformationMessage(
      `Build ${allSvgFiles.length} SVG file${allSvgFiles.length > 1 ? 's' : ''} to ${buildFormat}?`,
      'Yes', 'No'
    );
    
    if (confirm !== 'Yes') return;
    
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building SVG files...',
      cancellable: false
    }, async (progress) => {
      let built = 0;
      let failed = 0;
      const outputPath = getFullOutputPath();
      
      if (!outputPath) {
        vscode.window.showErrorMessage('Output path not configured');
        return;
      }
      
      const transformer = new SvgTransformer();
      const isIconsJs = buildFormat !== 'sprite.svg';
      
      for (const icon of allSvgFiles) {
        progress.report({ message: `Building ${icon.name}...` });
        
        try {
          // Load SVG content from file if not cached
          let svgContent = icon.svg;
          if (!svgContent && icon.path) {
            svgContent = fs.readFileSync(icon.path, 'utf-8');
          }
          
          if (!svgContent || !icon.name) {
            failed++;
            continue;
          }
          
          if (isIconsJs) {
            // Skip web component generation until all icons are added
            await addToIconsJs(outputPath, icon.name, svgContent, transformer, undefined, true);
          } else {
            await addToSpriteSvg(outputPath, icon.name, svgContent, transformer);
          }
          built++;
        } catch (err) {
          console.error('[Bezier] Error building', icon.name, err);
          failed++;
        }
      }
      
      // Generate web component once at the end (only for icons.js format)
      if (isIconsJs && built > 0) {
        progress.report({ message: 'Generating web component...' });
        const { generateWebComponent } = await import('./utils/iconsFileManager');
        await generateWebComponent(outputPath);
      }
      
      // Ask if user wants to delete original files
      const deleteOption = await vscode.window.showInformationMessage(
        `Built ${built} icon${built > 1 ? 's' : ''}. Delete original SVG files?`,
        'Delete All', 'Keep All'
      );
      
      if (deleteOption === 'Delete All') {
        let deleted = 0;
        for (const icon of allSvgFiles) {
          if (icon.path) {
            try {
              await vscode.workspace.fs.delete(vscode.Uri.file(icon.path));
              deleted++;
            } catch (err) {
              console.error('[Bezier] Error deleting', icon.path, err);
            }
          }
        }
        vscode.window.showInformationMessage(`Deleted ${deleted} original SVG file${deleted > 1 ? 's' : ''}`);
      }
      
      // Refresh views
      svgFilesProvider.refresh();
      builtIconsProvider.refresh();
      
      if (failed > 0 && deleteOption !== 'Delete All') {
        vscode.window.showWarningMessage(`Built ${built} icons. ${failed} file(s) had errors.`);
      }
    });
  });

  // Command: Refresh FILES view only
  const refreshFilesCmd = vscode.commands.registerCommand('iconManager.refreshFiles', () => {
    svgFilesProvider.refresh();
  });

  // Command: Refresh CODE view only
  const refreshCodeCmd = vscode.commands.registerCommand('iconManager.refreshCode', () => {
    workspaceSvgProvider.refresh();
  });

  // Command: Refresh BUILT view only
  const refreshBuiltCmd = vscode.commands.registerCommand('iconManager.refreshBuilt', () => {
    builtIconsProvider.refresh();
  });

  // Command: Partial refresh for a single SVG file (after save/edit)
  const refreshSvgFileCmd = vscode.commands.registerCommand('iconManager.refreshSvgFile', (filePath: string) => {
    if (filePath) {
      svgFilesProvider.refreshFile(filePath);
    }
  });

  // Command: Build icons library
  const buildIconsCmd = vscode.commands.registerCommand('iconManager.buildIcons', async () => {
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building icons library...',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Scanning icons...' });
      await workspaceSvgProvider.scanInlineSvgs();
      const icons = await workspaceSvgProvider.getAllIcons();
      
      if (icons.length === 0) {
        vscode.window.showWarningMessage('No icons found to build');
        return;
      }

      progress.report({ message: 'Generating output...' });
      const config = getConfig();
      const webComponentName = config.webComponentName;
      const buildFormat = config.buildFormat || 'icons.ts';

      // Helper function to count unique colors in SVG
      const countSvgColors = (svg: string): number => {
        const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|(?:fill|stroke|stop-color|flood-color|lighting-color)\s*[:=]\s*["']?([a-zA-Z]+)["']?/gi;
        const colors = new Set<string>();
        let match;
        while ((match = colorRegex.exec(svg)) !== null) {
          colors.add(match[0].toLowerCase());
        }
        return colors.size;
      };
      
      const MAX_COLORS_FOR_BUILD = 50;

      // Collect all icons with their SVG content and animation settings
      const iconList: Array<{ name: string; svg: string; animation?: { type: string; duration: number; timing: string; iteration: string; delay?: number; direction?: string } }> = [];
      const processedNames = new Set<string>();
      const skippedIcons: string[] = [];

      for (const icon of icons) {
        if (processedNames.has(icon.name)) continue;

        let svgContent = icon.svg;
        
        // If SVG content is missing but we have a file path, try to read it
        if (!svgContent && icon.path && fs.existsSync(icon.path) && icon.path.toLowerCase().endsWith('.svg')) {
          try {
            svgContent = fs.readFileSync(icon.path, 'utf-8');
          } catch (e) {
            console.error(`Failed to read SVG for ${icon.name}`, e);
          }
        }

        if (!svgContent) continue;
        
        // Skip SVGs with too many colors (rasterized images)
        const colorCount = countSvgColors(svgContent);
        if (colorCount > MAX_COLORS_FOR_BUILD) {
          skippedIcons.push(`${icon.name} (${colorCount} colors)`);
          continue;
        }
        
        processedNames.add(icon.name);
        // Include animation settings if present
        iconList.push({ 
          name: icon.name, 
          svg: svgContent,
          animation: icon.animation
        });
      }

      // Import the build functions
      const { buildIconsFileContent, buildSpriteFileContent } = await import('./utils/outputFileManager');
      const { generateWebComponent } = await import('./utils/iconsFileManager');

      if (buildFormat === 'sprite.svg') {
        // Generate sprite.svg using SpriteGenerator for proper symbol generation
        const generator = getSpriteGenerator();
        const spriteIcons: SpriteIcon[] = iconList.map(icon => ({
          id: icon.name,
          name: icon.name,
          svg: icon.svg,
          viewBox: undefined
        }));
        
        const result = generator.generate(spriteIcons, { 
          outputPath, 
          generateHelper: true, 
          helperFormat: 'vanilla',
          webComponentName,
          generateTypes: true
        });

        if (result.sprite) {
          await writeFileWithVSCode(path.join(outputPath, 'sprite.svg'), result.sprite);
        }
        if (result.helperComponent) {
          await writeFileWithVSCode(path.join(outputPath, 'icons.js'), result.helperComponent);
        }
        if (result.typeDefinitions) {
          await writeFileWithVSCode(path.join(outputPath, 'icons.d.ts'), result.typeDefinitions);
        }
      } else {
        // Generate icons.js with inline bodies (supports animations)
        const iconsContent = buildIconsFileContent(iconList, svgTransformer);
        await writeFileWithVSCode(path.join(outputPath, 'icons.js'), iconsContent);
        
        // Generate icon.js web component that uses icons.js
        const webComponent = await generateWebComponent(outputPath);
        await writeFileWithVSCode(webComponent.path, webComponent.content);
        
        // Generate icons.d.ts with correct icon names
        const iconNames = iconList.map(i => i.name);
        const typesContent = generateTypesFileContent(iconNames);
        await writeFileWithVSCode(path.join(outputPath, 'icons.d.ts'), typesContent);
      }

      // Show warning if icons were skipped
      if (skippedIcons.length > 0) {
        vscode.window.showWarningMessage(
          `Skipped ${skippedIcons.length} rasterized SVG(s) with too many colors: ${skippedIcons.slice(0, 3).join(', ')}${skippedIcons.length > 3 ? '...' : ''}`
        );
      }

      workspaceSvgProvider.refresh();
    });
    
    const config = getConfig();
    const formatName = config.buildFormat === 'sprite.svg' ? 'sprite.svg' : 'icons.js';
    vscode.window.showInformationMessage(`Icons library built as ${formatName} in ${outputPath}`);
  });

  // Helper function to generate types file content
  function generateTypesFileContent(iconNames: string[]): string {
    const sortedNames = [...iconNames].sort();
    return `// Auto-generated by Icon Manager
// Do not edit manually

export type IconName = ${sortedNames.map(n => `'${n}'`).join(' | ')};

export const iconNames = [
${sortedNames.map(n => `  '${n}'`).join(',\n')}
] as const;

export type IconNameTuple = typeof iconNames;

/**
 * Check if a string is a valid icon name
 */
export function isValidIconName(name: string): name is IconName {
  return iconNames.includes(name as IconName);
}
`;
  }

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
          item.contextValue === 'builtIcon',
          svgData.animation
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
  svgWatcher.onDidCreate(() => svgFilesProvider.refresh());
  svgWatcher.onDidDelete(() => svgFilesProvider.refresh());
  svgWatcher.onDidChange(() => svgFilesProvider.refresh());

  // Register code action provider for SVG img references
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

  // Register code action provider for missing icons in web components
  const missingIconCodeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
      { language: 'html' }
    ],
    new MissingIconCodeActionProvider(workspaceSvgProvider),
    {
      providedCodeActionKinds: MissingIconCodeActionProvider.providedCodeActionKinds
    }
  );

  // Note: Diagnostic provider disabled to avoid showing problem badges in tree views
  // Quick fix actions still work without visible diagnostics
  // diagnosticProvider = new SvgImgDiagnosticProvider();

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

    // Use configured build format
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';
    
    if (isSprite) {
      await addToSpriteSvg(fullOutputPath, iconName!, svgContent, svgTransformer);
    } else {
      await addToIconsJs(fullOutputPath, iconName!, svgContent, svgTransformer);
    }
    
    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    const formatName = isSprite ? 'sprite' : 'icons library';
    vscode.window.showInformationMessage(`✅ Icon "${iconName}" imported to ${formatName}!`);
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

    // Use configured build format
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';
    
    if (isSprite) {
      await addToSpriteSvg(fullOutputPath, iconName, selected.svgContent, svgTransformer);
    } else {
      await addToIconsJs(fullOutputPath, iconName, selected.svgContent, svgTransformer);
    }

    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    const formatName = isSprite ? 'sprite' : 'icons library';
    vscode.window.showInformationMessage(`✅ Icon "${iconName}" imported to ${formatName}!`);
  });

  // Command: Transform SVG reference to web component (unified flow)
  const transformSvgReferenceCmd = vscode.commands.registerCommand('iconManager.transformSvgReference', async (options: TransformOptions) => {
    const { originalPath, iconName, documentUri, line, originalHtml } = options;
    const docDir = path.dirname(documentUri);
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';
    const componentName = config.webComponentName || 'bz-icon';

    // Show source selection menu
    const sourceChoice = await vscode.window.showQuickPick([
      { 
        label: '$(cloud-download) Search in Iconify', 
        description: 'Find and build an icon from Iconify library',
        value: 'iconify' 
      },
      { 
        label: '$(file-media) Use referenced SVG file', 
        description: `Build from: ${originalPath}`,
        value: 'current' 
      },
      { 
        label: '$(library) Browse built icons', 
        description: 'Select an icon already in your library',
        value: 'built' 
      }
    ], {
      placeHolder: `Transform to ${isSprite ? 'SVG Sprite' : 'Web Component'} - Select icon source`,
      title: `🔄 Transform: ${iconName}`
    });

    if (!sourceChoice) return;

    let svgContent: string | undefined;
    let finalIconName = iconName;
    let skipBuild = false; // Flag to skip building if icon already exists

    if (sourceChoice.value === 'iconify') {
      // Search Iconify
      const query = await vscode.window.showInputBox({
        prompt: 'Search Iconify for an icon',
        value: iconName,
        placeHolder: 'Enter search term (e.g., arrow, home, user)'
      });

      if (!query) return;

      const results = await searchIconify(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No icons found for "${query}"`);
        return;
      }

      const selectedIcon = await showIconifyReplacementPicker(context, results, query, iconName);
      if (!selectedIcon) return;

      svgContent = selectedIcon.svg;
      finalIconName = selectedIcon.name;

    } else if (sourceChoice.value === 'current') {
      // Use the referenced SVG file
      const fullSvgPath = path.isAbsolute(originalPath) 
        ? originalPath 
        : path.resolve(docDir, originalPath);

      if (!fs.existsSync(fullSvgPath)) {
        vscode.window.showErrorMessage(`SVG file not found: ${originalPath}`);
        return;
      }

      svgContent = fs.readFileSync(fullSvgPath, 'utf-8');

      // Ask about deleting original
      const deleteChoice = await vscode.window.showQuickPick([
        { label: '$(trash) Delete original SVG', description: 'Remove the source file after build', value: true },
        { label: '$(file) Keep original SVG', description: 'Preserve the source file', value: false }
      ], {
        placeHolder: 'What to do with the original file?'
      });

      if (deleteChoice?.value) {
        try {
          fs.unlinkSync(fullSvgPath);
        } catch (e) {
          console.error('Failed to delete original SVG:', e);
        }
      }

    } else if (sourceChoice.value === 'built') {
      // Browse built icons from library
      await builtIconsProvider.ensureReady();
      const builtIcons = builtIconsProvider.getBuiltIconsList();
      
      if (builtIcons.length === 0) {
        vscode.window.showWarningMessage('No built icons found. Build some icons first.');
        return;
      }

      const items = builtIcons.map(icon => ({
        label: icon.name,
        description: icon.animation ? `🎬 ${icon.animation.type}` : '',
        icon
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a built icon',
        matchOnDescription: true
      });

      if (!selected) return;

      finalIconName = selected.label;
      skipBuild = true; // Icon already built, just replace the reference
    }

    if (!svgContent && !skipBuild) return;

    // Build the icon (skip if using an already built icon)
    if (!skipBuild) {
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;

      if (isSprite) {
        await addToSpriteSvg(outputPath, finalIconName, svgContent!, svgTransformer);
      } else {
        await addToIconsJs(outputPath, finalIconName, svgContent!, svgTransformer);
      }
    }

    // Replace in document
    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      const lineText = document.lineAt(line).text;
      
      // Determine replacement based on format and file type
      let replacement: string;
      
      if (isSprite) {
        replacement = `<svg class="icon" aria-hidden="true"><use href="sprite.svg#${finalIconName}"></use></svg>`;
      } else {
        const languageId = document.languageId;
        if (['javascriptreact', 'typescriptreact', 'vue', 'svelte', 'astro'].includes(languageId)) {
          replacement = `<${componentName} name="${finalIconName}" />`;
        } else {
          replacement = `<${componentName} name="${finalIconName}"></${componentName}>`;
        }
      }
      
      const newText = lineText.replace(originalHtml, replacement);
      
      if (newText !== lineText) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
        await vscode.workspace.applyEdit(edit);
      }

      // Check if script import is missing (only for HTML files and web component format)
      if (!isSprite && ['html', 'htm'].includes(path.extname(documentUri).slice(1).toLowerCase())) {
        const fullText = document.getText();
        const hasIconScript = fullText.includes('icon.js') || fullText.includes('icons.js');
        
        if (!hasIconScript) {
          const outputDir = config.outputDirectory || 'bezier-icons';
          const addScript = await vscode.window.showWarningMessage(
            `⚠️ Missing script import! Add <script type="module" src="./${outputDir}/icon.js"></script> to your HTML <head>`,
            'Copy to Clipboard',
            'Dismiss'
          );
          
          if (addScript === 'Copy to Clipboard') {
            const scriptTag = `<script type="module" src="./${outputDir}/icon.js"></script>`;
            await vscode.env.clipboard.writeText(scriptTag);
            vscode.window.showInformationMessage('Script tag copied to clipboard!');
          }
        }
      }
    } catch (e) {
      console.error('Failed to replace in document:', e);
    }

    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    
    vscode.window.showInformationMessage(`✅ Icon "${finalIconName}" transformed to <${componentName}>!`);
  });

  // Command: Delete icons
  const deleteIconsCmd = vscode.commands.registerCommand('iconManager.deleteIcons', async (item: any, selectedItems?: any[]) => {
    const itemsToDelete = selectedItems && selectedItems.length > 0 ? selectedItems : [item];
    
    if (itemsToDelete.length === 0) {
      vscode.window.showWarningMessage('No icons selected for deletion');
      return;
    }

    const names = itemsToDelete.map((i: any) => typeof i.label === 'string' ? i.label : '').filter(Boolean);
    
    const confirm = await vscode.window.showWarningMessage(
      `Delete ${names.length} icon(s): ${names.join(', ')}?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') return;

    const fullOutputPath = getFullOutputPath();
    let deletedCount = 0;
    const builtIconsToDelete: string[] = [];
    const svgFilesToRemove: { name: string; path: string }[] = [];

    for (const item of itemsToDelete) {
        if ((item.contextValue === 'svgIcon' || item.contextValue === 'svgIconBuilt' || 
             item.contextValue === 'svgIconRasterized' || item.contextValue === 'svgIconRasterizedBuilt') && item.resourceUri) {
            // Delete physical file
            try {
                await vscode.workspace.fs.delete(item.resourceUri);
                deletedCount++;
                // Track for cache removal with path
                if (typeof item.label === 'string') {
                    svgFilesToRemove.push({ 
                      name: item.label, 
                      path: item.resourceUri.fsPath 
                    });
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete ${item.label}: ${error}`);
            }
        } else if (item.contextValue === 'builtIcon' || item.contextValue === 'builtIconRasterized') {
            // Collect built icons to delete from icons.js
            if (typeof item.label === 'string') {
                builtIconsToDelete.push(item.label);
            }
        }
    }

    // Process built icons deletion
    if (builtIconsToDelete.length > 0 && fullOutputPath) {
        const removed = removeFromIconsJs(fullOutputPath, builtIconsToDelete);
        if (removed) {
            deletedCount += builtIconsToDelete.length;
        }
    }

    // Remove from cache and do partial refresh for each deleted file
    for (const { path: filePath } of svgFilesToRemove) {
        // removeItem handles both cache removal and partial view refresh
        svgFilesProvider.removeItem(filePath);
    }
    
    // Full refresh for built icons (they're in a different file)
    if (builtIconsToDelete.length > 0) {
        builtIconsProvider.refresh();
    }
    
    if (deletedCount > 0) {
        vscode.window.showInformationMessage(`Deleted ${deletedCount} icon(s)`);
    }
  });

  // Command: Remove from Built (unbuild icon without deleting file)
  const removeFromBuiltCmd = vscode.commands.registerCommand('iconManager.removeFromBuilt', async (item: any) => {
    if (!item?.icon) {
      vscode.window.showWarningMessage('Select an icon to remove from built');
      return;
    }

    const iconName = typeof item.label === 'string' ? item.label : item.icon?.name;
    if (!iconName) {
      vscode.window.showWarningMessage('Could not determine icon name');
      return;
    }

    const fullOutputPath = getFullOutputPath();
    if (!fullOutputPath) {
      vscode.window.showWarningMessage('Output directory not configured');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Remove "${iconName}" from built icons library?`,
      { modal: true },
      'Remove'
    );

    if (confirm !== 'Remove') {
      return;
    }

    const removed = removeFromIconsJs(fullOutputPath, [iconName]);
    if (removed) {
      builtIconsProvider.refresh();
      workspaceSvgProvider.refresh();
      vscode.window.showInformationMessage(`Removed "${iconName}" from built icons`);
    } else {
      vscode.window.showErrorMessage(`Failed to remove "${iconName}" from built icons`);
    }
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
        // Rename in icons.js, icons.js, sprite.svg, etc.
        const fullOutputPath = getFullOutputPath();
        if (!fullOutputPath) return;

        const iconsBzJsPath = path.join(fullOutputPath, 'icons.js');
        const iconsJsPath = path.join(fullOutputPath, 'icons.js');
        const iconsDtsPath = path.join(fullOutputPath, 'icons.d.ts');
        const spritePath = path.join(fullOutputPath, 'sprite.svg');
        
        const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let foundInAnyFile = false;
        let filesUpdated = 0;

        // Update icons.js (format: name: 'icon-name' inside export const iconName = { ... })
        if (fs.existsSync(iconsBzJsPath)) {
          let content = fs.readFileSync(iconsBzJsPath, 'utf-8');
          
          // Pattern for name property: name: 'old-name' or name: "old-name"
          const testPattern = new RegExp(`name:\\s*['"]${escapedOldName}['"]`);
          
          if (testPattern.test(content)) {
            foundInAnyFile = true;
            content = content.replace(
              new RegExp(`(name:\\s*['"])${escapedOldName}(['"])`, 'g'), 
              `$1${newName}$2`
            );
            fs.writeFileSync(iconsBzJsPath, content);
            filesUpdated++;
          }
        }

        // Update icons.js (has ICON_NAMES array and sprite uses)
        if (fs.existsSync(iconsJsPath)) {
          let content = fs.readFileSync(iconsJsPath, 'utf-8');
          
          // Pattern for array items: 'old-name' or "old-name"
          // Use non-global regex for test
          const testPattern = new RegExp(`(['"])${escapedOldName}\\1`);
          
          if (testPattern.test(content)) {
            foundInAnyFile = true;
            content = content.replace(new RegExp(`(['"])${escapedOldName}\\1`, 'g'), `$1${newName}$1`);
            fs.writeFileSync(iconsJsPath, content);
            filesUpdated++;
          }
        }

        // Update icons.d.ts (TypeScript types)
        if (fs.existsSync(iconsDtsPath)) {
          let content = fs.readFileSync(iconsDtsPath, 'utf-8');
          // Use non-global regex for test
          const testPattern = new RegExp(`(['"])${escapedOldName}\\1`);
          
          if (testPattern.test(content)) {
            foundInAnyFile = true;
            content = content.replace(new RegExp(`(['"])${escapedOldName}\\1`, 'g'), `$1${newName}$1`);
            fs.writeFileSync(iconsDtsPath, content);
            filesUpdated++;
          }
        }

        // Update sprite.svg (symbol ids)
        if (fs.existsSync(spritePath)) {
          let content = fs.readFileSync(spritePath, 'utf-8');
          
          // Pattern: id="old-name" in symbol tags - use non-global for test
          const testPattern = new RegExp(`<symbol[^>]*id=["']${escapedOldName}["']`);
          
          if (testPattern.test(content)) {
            foundInAnyFile = true;
            content = content.replace(new RegExp(`(<symbol[^>]*id=["'])${escapedOldName}(["'])`, 'g'), `$1${newName}$2`);
            fs.writeFileSync(spritePath, content);
            filesUpdated++;
          }
        }

        if (!foundInAnyFile) {
          vscode.window.showErrorMessage(`Could not find icon "${oldName}" in build files`);
          return;
        }

        // Partial refresh for built icons - update both providers
        console.log(`[Bezier] Calling renameBuiltIcon("${oldName}", "${newName}")`);
        workspaceSvgProvider.renameBuiltIcon(oldName, newName);
        builtIconsProvider.refresh(); // Refresh the BuiltIconsProvider tree view
        
        vscode.window.showInformationMessage(`Renamed "${oldName}" to "${newName}" (${filesUpdated} file${filesUpdated > 1 ? 's' : ''} updated)`);
      }

      // For SVG files, use partial refresh if we have the new path
      if (isSvgFile && newPath) {
        workspaceSvgProvider.renameSvgFile(oldName, newName, newPath);
        svgFilesProvider.refresh(); // Refresh the SvgFilesProvider tree view
      } else if (!isBuiltIcon) {
        // Fallback to full refresh for other cases
        workspaceSvgProvider.refresh();
      }
      
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
    let isBuilt = false;
    let animation: any;
    
    // Handle different input types
    if (iconNameOrItem instanceof vscode.Uri) {
      // Called from explorer context menu with a file URI
      filePath = iconNameOrItem.fsPath;
      if (filePath.toLowerCase().endsWith('.svg') && fs.existsSync(filePath)) {
        svg = fs.readFileSync(filePath, 'utf-8');
        iconName = path.basename(filePath, path.extname(filePath));
        lineNumber = 1;
      } else {
        vscode.window.showWarningMessage('Please select a valid SVG file');
        return;
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
        animation = svgData.animation;
      } else {
        iconName = iconNameOrItem.icon.name;
        svg = iconNameOrItem.icon.svg;
        filePath = iconNameOrItem.icon.filePath || iconNameOrItem.icon.path;
        lineNumber = iconNameOrItem.icon.line;
        animation = iconNameOrItem.icon.animation;
      }
      isBuilt = iconNameOrItem.contextValue === 'builtIcon';
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
    
    // Check if SVG is rasterized (too many colors to edit)
    const MAX_COLORS_FOR_EDIT = 50;
    const colorMatches = svg.match(/#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi);
    const uniqueColors = colorMatches ? new Set(colorMatches.map(c => c.toLowerCase())).size : 0;
    if (uniqueColors > MAX_COLORS_FOR_EDIT) {
      vscode.window.showWarningMessage(`Cannot edit "${iconName}": This SVG has ${uniqueColors} unique colors (likely a rasterized image). Color editing is disabled for SVGs with more than ${MAX_COLORS_FOR_EDIT} colors.`);
      return;
    }
    
    // Use IconEditorPanel for editing colors, optimizing, animations, etc.
    IconEditorPanel.createOrShow(context.extensionUri, {
      name: iconName,
      svg: svg,
      location: filePath && lineNumber !== undefined ? { file: filePath, line: lineNumber } : undefined,
      isBuilt: isBuilt,
      animation: animation
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

    const spriteIcons: SpriteIcon[] = [];
    
    for (const icon of icons) {
      let svgContent = icon.svg;

      // If SVG content is missing but we have a file path, try to read it
      if (!svgContent && icon.path && fs.existsSync(icon.path) && icon.path.toLowerCase().endsWith('.svg')) {
        try {
          svgContent = fs.readFileSync(icon.path, 'utf-8');
        } catch (e) {
          console.error(`Failed to read SVG for ${icon.name}`, e);
        }
      }

      if (svgContent) {
        spriteIcons.push({
          id: icon.name,
          name: icon.name,
          svg: svgContent,
          viewBox: undefined // Let generator extract it
        });
      }
    }

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

  // Command: View Sprite Content (from explorer context menu or tree view)
  const viewSpriteCmd = vscode.commands.registerCommand('iconManager.viewSprite', async (itemOrUri?: vscode.Uri | SvgItem) => {
    let spritePath: string;

    if (itemOrUri instanceof vscode.Uri) {
      // Called from explorer context menu with file URI
      spritePath = itemOrUri.fsPath;
    } else if (itemOrUri && 'category' in itemOrUri && itemOrUri.category?.startsWith('built:')) {
      // Called from tree view with SvgItem
      const fileName = itemOrUri.category.replace('built:', '');
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      spritePath = path.join(outputPath, fileName);
    } else {
      // Called from command palette - use default output path
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      spritePath = path.join(outputPath, 'sprite.svg');
    }
    
    if (!fs.existsSync(spritePath)) {
      vscode.window.showWarningMessage('sprite.svg not found.');
      return;
    }

    // Read sprite content and parse symbols
    const content = fs.readFileSync(spritePath, 'utf-8');
    const symbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
    const icons: { id: string; viewBox: string; content: string }[] = [];
    let match;

    while ((match = symbolRegex.exec(content)) !== null) {
      icons.push({
        id: match[1],
        viewBox: match[2],
        content: match[3]
      });
    }

    if (icons.length === 0) {
      vscode.window.showWarningMessage('No icons found in sprite.svg');
      return;
    }

    // Create webview panel with visual preview
    const panel = vscode.window.createWebviewPanel(
      'spritePreview',
      'SVG Sprite',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));

    // Handle messages from webview (context menu actions)
    panel.webview.onDidReceiveMessage(async (message) => {
      const iconData = icons.find(i => i.id === message.iconId);
      if (!iconData) return;

      switch (message.command) {
        case 'copyName':
          await vscode.env.clipboard.writeText(message.iconId);
          vscode.window.showInformationMessage(`Copied: ${message.iconId}`);
          break;

        case 'copySvg':
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage('SVG copied to clipboard');
          break;

        case 'editIcon':
          // Use the existing IconEditorPanel with sprite file info
          const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          IconEditorPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: editSvg,
            spriteFile: spritePath,
            viewBox: iconData.viewBox
          });
          break;

        case 'showDetails':
          // Use the existing IconDetailsPanel
          const detailsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          IconDetailsPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: detailsSvg,
            isBuilt: true
          });
          break;

        case 'exportComponent':
          // Export as component using ComponentExporter
          try {
            const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
            const componentExporter = getComponentExporter();
            const result = componentExporter.export({
              format: 'react',
              typescript: true,
              iconName: message.iconId,
              svg: fullSvg
            });
            
            // Show in new document
            const doc = await vscode.workspace.openTextDocument({ content: result.code, language: 'typescriptreact' });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to export component: ${err}`);
          }
          break;

        case 'renameIcon':
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new icon name',
            value: message.iconId,
            validateInput: (value) => {
              if (!value || value.trim() === '') return 'Name cannot be empty';
              if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return 'Invalid name format';
              return null;
            }
          });
          
          if (newName && newName !== message.iconId) {
            // Replace in sprite file
            let spriteContent = fs.readFileSync(spritePath, 'utf-8');
            const oldIdPattern = new RegExp(`id=["']${message.iconId}["']`, 'g');
            spriteContent = spriteContent.replace(oldIdPattern, `id="${newName}"`);
            fs.writeFileSync(spritePath, spriteContent, 'utf-8');
            
            // Update icons array and refresh panel
            iconData.id = newName;
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon renamed to: ${newName}`);
          }
          break;

        case 'openFile':
          // Open the sprite file in editor
          const doc = await vscode.workspace.openTextDocument(spritePath);
          await vscode.window.showTextDocument(doc);
          break;

        case 'deleteIcon':
          const confirm = await vscode.window.showWarningMessage(
            `Delete "${message.iconId}" from sprite?`,
            { modal: true },
            'Delete'
          );
          
          if (confirm === 'Delete') {
            // Remove symbol from sprite file
            let spriteContent = fs.readFileSync(spritePath, 'utf-8');
            const symbolPattern = new RegExp(`<symbol[^>]*id=["']${message.iconId}["'][^>]*>[\\s\\S]*?<\\/symbol>\\s*`, 'gi');
            spriteContent = spriteContent.replace(symbolPattern, '');
            fs.writeFileSync(spritePath, spriteContent, 'utf-8');
            
            // Remove from icons array and refresh panel
            const index = icons.findIndex(i => i.id === message.iconId);
            if (index > -1) icons.splice(index, 1);
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(spritePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon deleted: ${message.iconId}`);
          }
          break;

        case 'refresh':
          // Re-read sprite file and update icons array
          const newContent = fs.readFileSync(spritePath, 'utf-8');
          const newSymbolRegex = /<symbol[^>]*id=['"]([^'"]+)['"][^>]*viewBox=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/symbol>/gi;
          icons.length = 0; // Clear array
          let newMatch;
          while ((newMatch = newSymbolRegex.exec(newContent)) !== null) {
            icons.push({
              id: newMatch[1],
              viewBox: newMatch[2],
              content: newMatch[3]
            });
          }
          // Send new icons data to webview instead of replacing HTML
          panel.webview.postMessage({ 
            command: 'refreshComplete', 
            icons: icons.map(icon => {
              const cleanContent = icon.content
                .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
                .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
                .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '');
              return {
                id: icon.id,
                viewBox: icon.viewBox,
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${cleanContent}</svg>`
              };
            }),
            count: icons.length
          });
          break;
      }
    });
  });

  // Command: Clean Sprite (remove invalid HTML content)
  const cleanSpriteCmd = vscode.commands.registerCommand('iconManager.cleanSprite', async () => {
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const result = cleanSpriteSvg(outputPath);
    
    if (result.removed.length === 0) {
      vscode.window.showInformationMessage('Sprite is clean - no invalid content found.');
    } else {
      vscode.window.showInformationMessage(
        `Cleaned sprite: removed ${result.removed.length} invalid entries. ${result.kept} icons remaining.`
      );
      builtIconsProvider.refresh();
    }
  });

  // Command: View Icons File Content (from tree view context menu)
  const viewIconsFileCmd = vscode.commands.registerCommand('iconManager.viewIconsFile', async (item?: SvgItem) => {
    let iconsFilePath: string;

    if (item?.category?.startsWith('built:')) {
      // Called from tree view with file item
      const fileName = item.category.replace('built:', '');
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      iconsFilePath = path.join(outputPath, fileName);
    } else {
      // Called from command palette - find the icons file
      const outputPath = getOutputPathOrWarn();
      if (!outputPath) return;
      
      // Try different file names
      for (const name of ['icons.js', 'icons.ts', 'icons.js']) {
        const filePath = path.join(outputPath, name);
        if (fs.existsSync(filePath)) {
          iconsFilePath = filePath;
          break;
        }
      }
      
      if (!iconsFilePath!) {
        vscode.window.showWarningMessage('No icons file found.');
        return;
      }
    }
    
    if (!fs.existsSync(iconsFilePath)) {
      vscode.window.showWarningMessage('Icons file not found.');
      return;
    }

    // Read file content and parse icons
    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const iconPattern = /export\s+const\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?body:\s*`([^`]*)`[\s\S]*?viewBox:\s*['"]([^'"]+)['"][\s\S]*?\};/g;
    const icons: { id: string; viewBox: string; content: string }[] = [];
    let match;

    while ((match = iconPattern.exec(content)) !== null) {
      icons.push({
        id: match[2], // Use the name property value
        viewBox: match[4],
        content: match[3] // body content
      });
    }

    if (icons.length === 0) {
      vscode.window.showWarningMessage('No icons found in the file');
      return;
    }

    // Create webview panel with visual preview (reusing sprite preview HTML)
    const panel = vscode.window.createWebviewPanel(
      'iconsFilePreview',
      'Icons File',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath));

    // Handle messages from webview (same as sprite view)
    panel.webview.onDidReceiveMessage(async (message) => {
      const iconData = icons.find(i => i.id === message.iconId);
      if (!iconData) return;

      switch (message.command) {
        case 'copyName':
          await vscode.env.clipboard.writeText(message.iconId);
          vscode.window.showInformationMessage(`Copied: ${message.iconId}`);
          break;

        case 'copySvg':
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          await vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage('SVG copied to clipboard');
          break;

        case 'editIcon':
          const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          IconEditorPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: editSvg,
            iconsFile: iconsFilePath,
            viewBox: iconData.viewBox
          });
          break;

        case 'showDetails':
          const detailsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
          IconDetailsPanel.createOrShow(context.extensionUri, {
            name: message.iconId,
            svg: detailsSvg,
            isBuilt: true
          });
          break;

        case 'exportComponent':
          try {
            const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconData.viewBox}" fill="currentColor">${iconData.content}</svg>`;
            const componentExporter = getComponentExporter();
            const result = componentExporter.export({
              format: 'react',
              typescript: true,
              iconName: message.iconId,
              svg: fullSvg
            });
            
            const doc = await vscode.workspace.openTextDocument({ content: result.code, language: 'typescriptreact' });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to export component: ${err}`);
          }
          break;

        case 'renameIcon':
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new icon name',
            value: message.iconId,
            validateInput: (value) => {
              if (!value || value.trim() === '') return 'Name cannot be empty';
              if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) return 'Invalid name format';
              return null;
            }
          });
          
          if (newName && newName !== message.iconId) {
            // Update icon in the file
            let fileContent = fs.readFileSync(iconsFilePath, 'utf-8');
            // Replace name property
            const namePattern = new RegExp(`(export\\s+const\\s+\\w+\\s*=\\s*\\{[\\s\\S]*?name:\\s*['"])${message.iconId}(['"])`, 'g');
            fileContent = fileContent.replace(namePattern, `$1${newName}$2`);
            // Replace variable name (convert icon name to valid JS variable)
            const oldVarName = message.iconId.replace(/-/g, '_');
            const newVarName = newName.replace(/-/g, '_');
            const varPattern = new RegExp(`export\\s+const\\s+${oldVarName}\\s*=`, 'g');
            fileContent = fileContent.replace(varPattern, `export const ${newVarName} =`);
            fs.writeFileSync(iconsFilePath, fileContent, 'utf-8');
            
            // Update icons array and refresh
            iconData.id = newName;
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon renamed to: ${newName}`);
          }
          break;

        case 'openFile':
          // Open the icons file in editor
          const openDoc = await vscode.workspace.openTextDocument(iconsFilePath);
          await vscode.window.showTextDocument(openDoc);
          break;

        case 'deleteIcon':
          const confirm = await vscode.window.showWarningMessage(
            `Delete "${message.iconId}" from icons file?`,
            { modal: true },
            'Delete'
          );
          
          if (confirm === 'Delete') {
            // Remove icon from file
            let fileContent = fs.readFileSync(iconsFilePath, 'utf-8');
            const varName = message.iconId.replace(/-/g, '_');
            // Pattern to match the entire export const statement
            const iconPattern = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*\\{[\\s\\S]*?\\};\\s*`, 'g');
            fileContent = fileContent.replace(iconPattern, '');
            fs.writeFileSync(iconsFilePath, fileContent, 'utf-8');
            
            // Remove from icons array and refresh
            const index = icons.findIndex(i => i.id === message.iconId);
            if (index > -1) icons.splice(index, 1);
            panel.webview.html = getSpritePreviewHtml(icons, path.basename(iconsFilePath));
            builtIconsProvider.refresh();
            vscode.window.showInformationMessage(`Icon deleted: ${message.iconId}`);
          }
          break;

        case 'refresh':
          // Re-read file and update icons array
          const newContent = fs.readFileSync(iconsFilePath, 'utf-8');
          const newIconPattern = /export\s+const\s+(\w+)\s*=\s*\{[\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?body:\s*`([^`]*)`[\s\S]*?viewBox:\s*['"]([^'"]+)['"][\s\S]*?\};/g;
          icons.length = 0;
          let newMatch;
          while ((newMatch = newIconPattern.exec(newContent)) !== null) {
            icons.push({
              id: newMatch[2],
              viewBox: newMatch[4],
              content: newMatch[3]
            });
          }
          panel.webview.postMessage({ 
            command: 'refreshComplete', 
            icons: icons.map(icon => ({
              id: icon.id,
              viewBox: icon.viewBox,
              svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${icon.content}</svg>`
            })),
            count: icons.length
          });
          break;
      }
    });
  });

  // Command: Delete built file (sprite.svg or icons.js)
  const deleteBuiltFileCmd = vscode.commands.registerCommand('iconManager.deleteBuiltFile', async (item?: SvgItem) => {
    if (!item?.category?.startsWith('built:')) {
      vscode.window.showWarningMessage('No file selected');
      return;
    }

    const fileName = item.category.replace('built:', '');
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    const filePath = path.join(outputPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`File not found: ${fileName}`);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete "${fileName}"? This action cannot be undone.`,
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      try {
        fs.unlinkSync(filePath);
        builtIconsProvider.refresh();
        vscode.window.showInformationMessage(`Deleted: ${fileName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
      }
    }
  });

  // Command: Search icons (Iconify)
  const searchIconsCmd = vscode.commands.registerCommand('iconManager.searchIcons', async () => {
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

  // Command: Search Iconify with pre-filled query (for hover links)
  const searchIconifyCmd = vscode.commands.registerCommand('iconManager.searchIconify', async (query?: string) => {
    // If no query provided, show input box
    const searchTerm = query || await vscode.window.showInputBox({
      prompt: 'Search for icons in Iconify',
      placeHolder: 'Enter search term (e.g., "arrow", "home", "user")'
    });

    if (!searchTerm) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Searching "${searchTerm}" in Iconify...`,
      cancellable: false
    }, async () => {
      const results = await searchIconify(searchTerm);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No icons found for "${searchTerm}" in Iconify`);
        return;
      }

      showIconPickerPanel(context, results, searchTerm, svgTransformer, workspaceSvgProvider);
    });
  });

  // Command: Import missing icon (for web components with missing icons)
  const importIconCmd = vscode.commands.registerCommand('iconManager.importIcon', async (iconName: string, sourceFile?: string, line?: number) => {
    const config = getConfig();
    const isSprite = config.buildFormat === 'sprite.svg';

    // Show source selection menu
    const sourceChoice = await vscode.window.showQuickPick([
      { 
        label: '$(cloud-download) Search in Iconify', 
        description: 'Find and build an icon from Iconify library',
        value: 'iconify' 
      },
      { 
        label: '$(folder-opened) Browse for SVG file', 
        description: 'Select an existing SVG file',
        value: 'file' 
      }
    ], {
      placeHolder: `Import icon "${iconName}" - Select source`,
      title: `📥 Import: ${iconName}`
    });

    if (!sourceChoice) return;

    let svgContent: string | undefined;
    let finalIconName = iconName;

    if (sourceChoice.value === 'iconify') {
      // Search Iconify
      const query = await vscode.window.showInputBox({
        prompt: 'Search Iconify for an icon',
        value: iconName,
        placeHolder: 'Enter search term (e.g., arrow, home, user)'
      });

      if (!query) return;

      const results = await searchIconify(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No icons found for "${query}"`);
        return;
      }

      const selectedIcon = await showIconifyReplacementPicker(context, results, query, iconName);
      if (!selectedIcon) return;

      svgContent = selectedIcon.svg;
      finalIconName = selectedIcon.name;

    } else if (sourceChoice.value === 'file') {
      // Browse for SVG file
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'SVG Files': ['svg'] },
        title: `Select SVG file for "${iconName}"`
      });

      if (!fileUri?.[0]) return;

      svgContent = fs.readFileSync(fileUri[0].fsPath, 'utf-8');
      // Keep the original icon name for consistency
    }

    if (!svgContent) return;

    // Build the icon
    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    if (isSprite) {
      await addToSpriteSvg(outputPath, finalIconName, svgContent, svgTransformer);
    } else {
      await addToIconsJs(outputPath, finalIconName, svgContent, svgTransformer);
    }

    // Update reference if icon name changed
    if (sourceFile && line !== undefined && finalIconName !== iconName) {
      try {
        const document = await vscode.workspace.openTextDocument(sourceFile);
        const lineText = document.lineAt(line).text;
        
        const newText = lineText.replace(
          new RegExp(`name=["']${iconName}["']`, 'g'),
          `name="${finalIconName}"`
        );
        
        if (newText !== lineText) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, new vscode.Range(line, 0, line, lineText.length), newText);
          await vscode.workspace.applyEdit(edit);
        }
      } catch (e) {
        console.error('Failed to update icon reference:', e);
      }
    }

    workspaceSvgProvider.refresh();
    builtIconsProvider.refresh();
    
    const formatName = isSprite ? 'sprite' : 'icons library';
    vscode.window.showInformationMessage(`✅ Icon "${finalIconName}" imported to ${formatName}!`);
  });

  // Command: Add SVG to build (uses buildFormat from config)
  const addSvgToCollectionCmd = vscode.commands.registerCommand('iconManager.addSvgToCollection', async (item: any) => {
    // Get the icon from the tree item
    const icon = item?.icon;
    if (!icon) {
      vscode.window.showWarningMessage('No icon selected');
      return;
    }

    // Get config
    const config = getConfig();
    const buildFormat = config.buildFormat || 'icons.ts';
    const isSprite = buildFormat === 'sprite.svg';
    const deleteDefault = vscode.workspace.getConfiguration('iconManager').get<boolean>('deleteAfterBuild', false);

    // Ask about deleting original
    const deleteChoice = await vscode.window.showQuickPick([
      { 
        label: '$(trash) Delete original SVG', 
        description: 'Remove the source file after build',
        value: true 
      },
      { 
        label: '$(file) Keep original SVG', 
        description: 'Preserve the source file',
        value: false 
      }
    ], {
      placeHolder: 'What to do with the original file?',
      title: `Add to ${isSprite ? 'Sprite' : 'Icons Library'}`
    });

    // If cancelled, use config default
    const deleteOriginal = deleteChoice?.value ?? deleteDefault;

    const outputPath = getOutputPathOrWarn();
    if (!outputPath) return;

    try {
      // Read SVG content if not already loaded
      let svgContent = icon.svg;
      if (!svgContent && icon.path) {
        svgContent = fs.readFileSync(icon.path, 'utf-8');
      }

      if (!svgContent) {
        vscode.window.showErrorMessage('Could not read SVG content');
        return;
      }

      const results: string[] = [];

      // Add to configured format (sprite OR component, not both)
      if (isSprite) {
        await addToSpriteSvg(outputPath, icon.name, svgContent, svgTransformer);
        results.push('sprite.svg');
      } else {
        await addToIconsJs(outputPath, icon.name, svgContent, svgTransformer);
        results.push('icons.js');
      }

      // Delete original file if requested
      if (deleteOriginal && icon.path && fs.existsSync(icon.path)) {
        const iconPath = icon.path;
        fs.unlinkSync(iconPath);
        results.push('original deleted');
        // removeItem handles both cache removal and partial view refresh
        svgFilesProvider.removeItem(iconPath);
      }

      // Add new built icon to cache and refresh built icons view
      const outputPath2 = getFullOutputPath();
      const builtIcon: WorkspaceIcon = { 
        name: icon.name, 
        svg: svgContent, 
        path: outputPath2 || icon.path,
        source: 'library',
        isBuilt: true
      };
      workspaceSvgProvider.addBuiltIcon(icon.name, builtIcon);
      // Partial refresh of built icons - refresh the file that contains this icon
      const fileName = path.basename(builtIcon.path);
      builtIconsProvider.refreshFile(fileName);
      
      // Also refresh svgFilesProvider to update build status labels (even if file wasn't deleted)
      if (!deleteOriginal) {
        svgFilesProvider.refreshFile(icon.path);
      }

      vscode.window.showInformationMessage(`✓ "${icon.name}" added to ${results.join(' and ')}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to add icon: ${error.message}`);
    }
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
    openWelcomeCmd,
    scanWorkspaceCmd,
    scanUsagesCmd,
    goToUsageCmd,
    goToInlineSvgCmd,
    goToCodeCmd,
    copyIconNameCmd,
    transformInlineSvgCmd,
    configureProjectCmd,
    editIgnoreFileCmd,
    refreshIconsCmd,
    buildAllReferencesCmd,
    buildAllFilesCmd,
    refreshFilesCmd,
    refreshCodeCmd,
    refreshBuiltCmd,
    refreshSvgFileCmd,
    buildIconsCmd,
    transformSvgCmd,
    optimizeSvgCmd,
    insertIconCmd,
    previewIconCmd,
    completionDisposable,
    hoverDisposable,
    svgWatcher,
    codeActionProvider,
    missingIconCodeActionProvider,
    importSvgToLibraryCmd,
    checkAndImportSvgCmd,
    transformSvgReferenceCmd,
    deleteIconsCmd,
    removeFromBuiltCmd,
    renameIconCmd,
    colorEditorCmd,
    showDetailsCmd,
    exportComponentCmd,
    generateSpriteCmd,
    viewSpriteCmd,
    viewIconsFileCmd,
    deleteBuiltFileCmd,
    cleanSpriteCmd,
    searchIconsCmd,
    searchIconifyCmd,
    importIconCmd,
    addSvgToCollectionCmd,
    removeReferenceCmd,
    findAndReplaceCmd,
    revealInTreeCmd,
    expandAllCmd,
    expandBuiltCmd,
    collapseAllCmd,
    collapseBuiltCmd,
    expandSvgFilesCmd,
    collapseSvgFilesCmd
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
        Build
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

  <p class="subtitle">Results for "${escapedQuery}" — ${icons.length} icons found. Click to build.</p>
  
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
          
          // Use configured build format
          const config = getConfig();
          const isSprite = config.buildFormat === 'sprite.svg';
          
          if (isSprite) {
            await addToSpriteSvg(fullOutputPath, iconName, svg, svgTransformer);
          } else {
            await addToIconsJs(fullOutputPath, iconName, svg, svgTransformer);
          }

          provider.refresh();
          builtIconsProvider.refresh();
          const formatName = isSprite ? 'sprite' : 'library';
          vscode.window.showInformationMessage(`✅ Icon "${iconName}" added to your ${formatName}!`);

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

/**
 * Generates HTML for sprite preview webview
 */
function getSpritePreviewHtml(icons: { id: string; viewBox: string; content: string }[], fileName: string): string {
  const iconCards = icons.map(icon => {
    // Clean content - remove text, title, desc, and embedded style/script elements
    const cleanContent = icon.content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove embedded styles (may contain animations)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
      .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '');
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="currentColor">${cleanContent}</svg>`;
    return `
      <div class="icon-card" data-icon-id="${icon.id}" title="${icon.id}">
        <div class="icon-preview">${svg}</div>
        <div class="icon-name">${icon.id}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SVG Sprite Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-foreground, #cccccc);
      padding: 20px;
      min-height: 100vh;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border, #454545);
    }
    
    .header h1 {
      font-size: 18px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header h1::before {
      content: '🎨';
    }
    
    .stats {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #858585);
    }
    
    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .toggle-group {
      display: flex;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--vscode-button-border, #454545);
    }
    
    .toggle-btn {
      padding: 6px 14px;
      font-size: 12px;
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .toggle-btn:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }
    
    .toggle-btn.active {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
    }
    
    .search-box {
      flex: 1;
      max-width: 300px;
      padding: 6px 12px;
      font-size: 12px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #454545);
      border-radius: 4px;
      outline: none;
    }
    
    .search-box:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .refresh-btn {
      padding: 6px 12px;
      font-size: 12px;
      background: var(--vscode-button-secondaryBackground, #3c3c3c);
      color: var(--vscode-button-secondaryForeground, #cccccc);
      border: 1px solid var(--vscode-button-border, #454545);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .refresh-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #4a4a4a);
    }

    .refresh-btn.loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .refresh-btn .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }
    
    .icon-card {
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #454545);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .icon-card:hover {
      border-color: var(--vscode-focusBorder, #007fd4);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .icon-preview {
      width: 48px;
      height: 48px;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.15s ease;
    }
    
    .icon-preview svg {
      width: 32px;
      height: 32px;
      color: var(--vscode-foreground, #cccccc);
    }
        
    /* Light mode background for icons */
    body.light-mode .icon-preview {
      background: #ffffff;
    }
    
    body.light-mode .icon-preview svg {
      color: #1e1e1e;
    }
    
    /* Dark mode (default) */
    body.dark-mode .icon-preview,
    body:not(.light-mode) .icon-preview {
      background: #2d2d2d;
    }
    
    .icon-name {
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #858585);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground, #858585);
    }
    
    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    /* Context Menu Styles */
    .context-menu {
      position: fixed;
      background: var(--vscode-menu-background, #252526);
      border: 1px solid var(--vscode-menu-border, #454545);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      min-width: 180px;
      padding: 4px 0;
      z-index: 1000;
      display: none;
    }

    .context-menu.visible {
      display: block;
    }

    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      font-size: 12px;
      color: var(--vscode-menu-foreground, #cccccc);
      cursor: pointer;
      transition: background 0.1s ease;
    }

    .context-menu-item:hover {
      background: var(--vscode-menu-selectionBackground, #094771);
      color: var(--vscode-menu-selectionForeground, #ffffff);
    }

    .context-menu-item .menu-icon {
      width: 14px;
      text-align: center;
      opacity: 0.8;
    }

    .context-menu-separator {
      height: 1px;
      background: var(--vscode-menu-separatorBackground, #454545);
      margin: 4px 0;
    }

    .context-menu-item.danger {
      color: var(--vscode-errorForeground, #f14c4c);
    }

    .context-menu-item.danger:hover {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    }
  </style>
</head>
<body class="dark-mode">
  <div class="header">
    <h1>${fileName}</h1>
    <span class="stats">${icons.length} icons</span>
  </div>
  
  <div class="controls">
    <div class="toggle-group">
      <button class="toggle-btn" onclick="setMode('light')">Light</button>
      <button class="toggle-btn active" onclick="setMode('dark')">Dark</button>
    </div>
    <input type="text" class="search-box" placeholder="Search icons..." oninput="filterIcons(this.value)" />
    <button class="refresh-btn" onclick="refreshSprite()" title="Refresh sprite">
      <span id="refreshIcon">🔄</span>
      <span>Refresh</span>
    </button>
  </div>
  
  <div class="icon-grid" id="iconGrid">
    ${iconCards}
  </div>

  <!-- Context Menu -->
  <div class="context-menu" id="contextMenu">
    <div class="context-menu-item" data-action="copyName">
      <span class="menu-icon">📋</span>
      <span>Copy Name</span>
    </div>
    <div class="context-menu-item" data-action="copySvg">
      <span class="menu-icon">📄</span>
      <span>Copy SVG</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="editIcon">
      <span class="menu-icon">✏️</span>
      <span>Edit Icon</span>
    </div>
    <div class="context-menu-item" data-action="showDetails">
      <span class="menu-icon">ℹ️</span>
      <span>Show Details</span>
    </div>
    <div class="context-menu-item" data-action="exportComponent">
      <span class="menu-icon">📦</span>
      <span>Export as Component</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="openFile">
      <span class="menu-icon">📂</span>
      <span>Open File</span>
    </div>
    <div class="context-menu-item" data-action="renameIcon">
      <span class="menu-icon">🏷️</span>
      <span>Rename Icon</span>
    </div>
    <div class="context-menu-item danger" data-action="deleteIcon">
      <span class="menu-icon">🗑️</span>
      <span>Delete Icon</span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let selectedIconId = null;
    const contextMenu = document.getElementById('contextMenu');
    function setMode(mode) {
      document.body.classList.remove('light-mode', 'dark-mode');
      document.body.classList.add(mode + '-mode');
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === mode);
      });
    }
    
    function filterIcons(query) {
      const cards = document.querySelectorAll('.icon-card');
      const q = query.toLowerCase();
      cards.forEach(card => {
        const name = card.getAttribute('data-icon-id').toLowerCase();
        card.style.display = name.includes(q) ? '' : 'none';
      });
    }

    function hideContextMenu() {
      contextMenu.classList.remove('visible');
      selectedIconId = null;
    }

    function showContextMenu(x, y, iconId) {
      selectedIconId = iconId;
      
      // Position the menu
      contextMenu.style.left = x + 'px';
      contextMenu.style.top = y + 'px';
      contextMenu.classList.add('visible');
      
      // Adjust if menu goes outside viewport
      const rect = contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
      }
    }

    // Function to attach listeners to cards
    function attachCardListeners() {
      document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
          const name = card.getAttribute('data-icon-id');
          navigator.clipboard.writeText(name);
          card.style.borderColor = '#10b981';
          setTimeout(() => card.style.borderColor = '', 1000);
        });
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const iconId = card.getAttribute('data-icon-id');
          showContextMenu(e.pageX, e.pageY, iconId);
        });
      });
    }
    
    // Initial attachment of listeners
    attachCardListeners();

    // Hide context menu on click outside
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    // Handle context menu item clicks
    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        if (selectedIconId && action) {
          vscode.postMessage({ command: action, iconId: selectedIconId });
        }
        hideContextMenu();
      });
    });

    // Handle escape key to close menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    });

    // Refresh sprite content
    function refreshSprite() {
      const btn = document.querySelector('.refresh-btn');
      const icon = document.getElementById('refreshIcon');
      btn.classList.add('loading');
      icon.classList.add('spin');
      vscode.postMessage({ command: 'refresh' });
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'refreshComplete') {
        const btn = document.querySelector('.refresh-btn');
        const icon = document.getElementById('refreshIcon');
        btn.classList.remove('loading');
        icon.classList.remove('spin');
        
        // Update the grid with new icons
        if (message.icons) {
          const grid = document.getElementById('iconGrid');
          const stats = document.querySelector('.stats');
          
          // Rebuild grid
          grid.innerHTML = message.icons.map(icon => \`
            <div class="icon-card" data-icon-id="\${icon.id}" title="\${icon.id}">
              <div class="icon-preview">\${icon.svg}</div>
              <div class="icon-name">\${icon.id}</div>
            </div>
          \`).join('');
          
          // Update stats
          stats.textContent = message.count + ' icons';
          
          // Re-attach event listeners
          attachCardListeners();
        }
      }
    });
  </script>
</body>
</html>`;
}
