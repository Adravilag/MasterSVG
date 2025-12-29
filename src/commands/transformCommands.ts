import * as vscode from 'vscode';
import { SvgTransformer } from '../services/SvgTransformer';
import { getConfig, getFullOutputPath } from '../utils/configHelper';
import { addToIconsJs, addToSpriteSvg } from '../utils/iconsFileManager';

/**
 * Interface for providers needed by transform commands
 */
export interface TransformCommandProviders {
  workspaceSvgProvider: {
    refresh(): void;
    getAllIcons(): Promise<Array<{ name: string }>>;
  };
  builtIconsProvider: {
    refresh(): void;
  };
}

/**
 * Registers SVG transformation commands
 */
export function registerTransformCommands(
  context: vscode.ExtensionContext,
  providers: TransformCommandProviders,
  svgTransformer: SvgTransformer
): vscode.Disposable[] {
  const { workspaceSvgProvider, builtIconsProvider } = providers;
  const commands: vscode.Disposable[] = [];

  // Command: Transform inline SVG (also handles IMG references)
  commands.push(
    vscode.commands.registerCommand('iconManager.transformInlineSvg', async (item: any) => {
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
    })
  );

  // Command: Transform selected SVG
  commands.push(
    vscode.commands.registerCommand('iconManager.transformSvg', async () => {
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
    })
  );

  // Command: Optimize SVG
  commands.push(
    vscode.commands.registerCommand('iconManager.optimizeSvg', async () => {
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
    })
  );

  // Command: Insert icon at cursor
  commands.push(
    vscode.commands.registerCommand('iconManager.insertIcon', async (item?: any) => {
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
    })
  );

  return commands;
}
