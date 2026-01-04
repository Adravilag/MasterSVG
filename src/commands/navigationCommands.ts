import * as vscode from 'vscode';
import { t } from '../i18n';

// Double-click detection state
let lastClickTime = 0;
let lastClickedIconName: string | undefined;
const DOUBLE_CLICK_THRESHOLD = 400; // ms

/**
 * Registers navigation-related commands for icons
 */
export function registerNavigationCommands(_context: vscode.ExtensionContext): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  // Command: Handle icon click with double-click detection
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.iconClick', async (icon: any) => {
      if (!icon) return;
      
      const now = Date.now();
      const iconName = icon.name;
      
      if (iconName === lastClickedIconName && (now - lastClickTime) < DOUBLE_CLICK_THRESHOLD) {
        // Double click detected - open details
        lastClickTime = 0;
        lastClickedIconName = undefined;
        await vscode.commands.executeCommand('sageboxIconStudio.showDetails', icon);
      } else {
        // Single click - just record the click (preview is updated by selection handler)
        lastClickTime = now;
        lastClickedIconName = iconName;
      }
    })
  );

  // Command: Go to usage location
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.goToUsage', async (item: any) => {
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
    })
  );

  // Command: Go to inline SVG
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.goToInlineSvg', async (iconOrItem: any) => {
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
          // Fallback: try to find and select the element from the document text
          const text = document.getText();
          const lines = text.split('\n');
          const startLine = icon.line;

          // Check if this is an IMG reference or inline SVG
          const isImgRef = icon.category === 'img-ref';
          
          if (isImgRef) {
            // For IMG references, find and select the <img> tag
            // Search on the exact line first, then nearby lines (file may have changed)
            let foundLine = -1;
            let imgTagIndex = -1;
            
            // Build search pattern for this specific SVG path
            const iconName = icon.name;
            const searchPatterns = [
              new RegExp(`<img[^>]*${iconName}\\.svg`, 'i'),
              /<img[^>]*\.svg/i
            ];
            
            // Search on the exact line and ±2 lines
            for (let offset = 0; offset <= 2; offset++) {
              for (const lineOffset of [0, -offset, offset]) {
                if (lineOffset === 0 && offset !== 0) continue; // Skip 0 offset when offset > 0
                
                const checkLine = startLine + lineOffset;
                if (checkLine < 0 || checkLine >= lines.length) continue;
                
                const lineText = lines[checkLine];
                for (const pattern of searchPatterns) {
                  const match = lineText.match(pattern);
                  if (match) {
                    foundLine = checkLine;
                    imgTagIndex = lineText.indexOf(match[0]);
                    break;
                  }
                }
                if (foundLine !== -1) break;
              }
              if (foundLine !== -1) break;
            }
            
            if (foundLine !== -1 && imgTagIndex !== -1) {
              const lineText = lines[foundLine];
              // Find the closing > of the img tag
              let endCol = lineText.indexOf('>', imgTagIndex);
              if (endCol !== -1) {
                endCol += 1; // Include the >
              } else {
                endCol = lineText.length;
              }
              
              const startPos = new vscode.Position(foundLine, imgTagIndex);
              const endPos = new vscode.Position(foundLine, endCol);
              const range = new vscode.Range(startPos, endPos);
              editor.selection = new vscode.Selection(range.start, range.end);
              editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            } else {
              // Fallback: just position at the stored line/column
              const column = icon.column || 0;
              const position = new vscode.Position(startLine, column);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
          } else {
            // For inline SVGs, find <svg tag
            const lineText = lines[startLine] || '';
            let svgStartCol = 0;
            let svgEndLine = startLine;
            let svgEndCol = lineText.length;

            const svgTagIndex = lineText.indexOf('<svg');
            if (svgTagIndex !== -1) {
              svgStartCol = svgTagIndex;

              // Find closing </svg> - can be on same line or later
              let depth = 0;
              for (let i = startLine; i < lines.length; i++) {
                const currentLine = lines[i];
                const startIdx = i === startLine ? svgStartCol : 0;

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
                if (depth === 0 && svgEndLine !== startLine) break;
              }
            }

            const startPos = new vscode.Position(startLine, svgStartCol);
            const endPos = new vscode.Position(svgEndLine, svgEndCol);
            const range = new vscode.Range(startPos, endPos);
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          }
        }
      }
    })
  );

  // Command: Go to Code (for items in Code view with line info)
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.goToCode', async (iconOrItem: any) => {
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
      } else if (icon && icon.path) {
        // For SVG files (FILES view), open the file at line 1
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(icon.path));
        await vscode.window.showTextDocument(document);
      }
    })
  );

  // Command: Open SVG File (opens SVG as preview/image)
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.openSvgFile', async (iconOrItem: any) => {
      const icon = iconOrItem?.icon || iconOrItem;
      if (icon && icon.path) {
        const uri = vscode.Uri.file(icon.path);
        // Try to open with VS Code's built-in SVG preview
        await vscode.commands.executeCommand('vscode.open', uri);
      } else {
        vscode.window.showWarningMessage(t('messages.noSvgPathAvailable'));
      }
    })
  );

  // Command: Copy Icon Name
  commands.push(
    vscode.commands.registerCommand('sageboxIconStudio.copyIconName', async (iconOrItem: any) => {
      const icon = iconOrItem?.icon || iconOrItem;
      if (icon && icon.name) {
        await vscode.env.clipboard.writeText(icon.name);
        vscode.window.showInformationMessage(t('messages.iconCopied', { name: icon.name }));
      }
    })
  );

  return commands;
}
