import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IconEditorPanel } from '../panels/IconEditorPanel';
import { IconDetailsPanel } from '../panels/IconDetailsPanel';
import { WorkspaceSvgProvider, SvgItem, WorkspaceIcon } from '../providers/WorkspaceSvgProvider';
import { IconPreviewProvider } from '../providers/IconPreviewProvider';
import { getComponentExporter } from '../services/ComponentExporter';
import { t } from '../i18n';

/**
 * Interface for providers needed by editor commands
 */
export interface EditorCommandProviders {
  workspaceSvgProvider: WorkspaceSvgProvider;
  iconPreviewProvider: IconPreviewProvider;
}

/**
 * Register editor-related commands (preview, color editor, show details, export component)
 */
export function registerEditorCommands(
  context: vscode.ExtensionContext,
  providers: EditorCommandProviders
): vscode.Disposable[] {
  const { workspaceSvgProvider, iconPreviewProvider } = providers;
  const disposables: vscode.Disposable[] = [];

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
  disposables.push(previewIconCmd);

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
        vscode.window.showWarningMessage(t('messages.pleaseSelectValidSvgFile'));
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
      vscode.window.showWarningMessage(t('messages.selectIconFromTreeOrEditor'));
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
      vscode.window.showWarningMessage(t('messages.couldNotFindSvgData', { name: iconName }));
      return;
    }
    
    // Check if SVG is rasterized (too many colors to edit)
    const MAX_COLORS_FOR_EDIT = 50;
    const colorMatches = svg.match(/#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi);
    const uniqueColors = colorMatches ? new Set(colorMatches.map(c => c.toLowerCase())).size : 0;
    if (uniqueColors > MAX_COLORS_FOR_EDIT) {
      vscode.window.showWarningMessage(t('messages.cannotEditRasterized', { name: iconName, colors: uniqueColors, maxColors: MAX_COLORS_FOR_EDIT }));
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
  disposables.push(colorEditorCmd);

  // Command: Show icon details (uses full IconDetailsPanel with zoom, optimization, etc.)
  const showDetailsCmd = vscode.commands.registerCommand('iconManager.showDetails', async (item?: SvgItem | WorkspaceIcon | vscode.Uri) => {
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
    } else if (item instanceof SvgItem) {
      // Called with SvgItem (from tree view context menu)
      const svgData = workspaceSvgProvider.getSvgData(item);
      if (svgData) {
        iconName = svgData.name;
        svg = svgData.svg;
        filePath = svgData.location?.file;
        lineNumber = svgData.location?.line;
        isBuilt = item.contextValue === 'builtIcon';
      }
    } else if (item) {
      // Called with WorkspaceIcon directly (from double-click command)
      const icon = item as WorkspaceIcon;
      iconName = icon.name;
      svg = icon.svg;
      filePath = icon.filePath || icon.path;
      lineNumber = icon.line ?? 1;
      isBuilt = icon.isBuilt ?? false;
      
      // Load SVG from file if not in memory
      if (!svg && icon.path && fs.existsSync(icon.path)) {
        try {
          svg = fs.readFileSync(icon.path, 'utf-8');
        } catch {
          // Ignore read errors
        }
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
  disposables.push(showDetailsCmd);

  // Command: Export as component
  const exportComponentCmd = vscode.commands.registerCommand('iconManager.exportComponent', async (item?: any) => {
    if (!item?.icon?.svg) {
      vscode.window.showWarningMessage(t('messages.selectIconToExport'));
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
      { placeHolder: t('ui.placeholders.selectComponentFormat') }
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
  disposables.push(exportComponentCmd);

  // Command: Update TreeView preview from Editor color changes
  const updateTreeViewPreviewCmd = vscode.commands.registerCommand(
    'iconManager.updateTreeViewPreview',
    (name: string, svg: string, currentColors?: string[]) => {
      iconPreviewProvider.updateSvgContent(name, svg, currentColors);
    }
  );
  disposables.push(updateTreeViewPreviewCmd);

  return disposables;
}
