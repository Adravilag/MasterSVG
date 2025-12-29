import * as vscode from 'vscode';

/**
 * Registers navigation-related commands for icons
 */
export function registerNavigationCommands(
  context: vscode.ExtensionContext
): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];

  // Command: Go to usage location
  commands.push(
    vscode.commands.registerCommand('iconManager.goToUsage', async (item: any) => {
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
    vscode.commands.registerCommand('iconManager.goToInlineSvg', async (iconOrItem: any) => {
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
    })
  );

  // Command: Go to Code (for items in Code view with line info)
  commands.push(
    vscode.commands.registerCommand('iconManager.goToCode', async (iconOrItem: any) => {
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
    vscode.commands.registerCommand('iconManager.openSvgFile', async (iconOrItem: any) => {
      const icon = iconOrItem?.icon || iconOrItem;
      if (icon && icon.path) {
        const uri = vscode.Uri.file(icon.path);
        // Try to open with VS Code's built-in SVG preview
        await vscode.commands.executeCommand('vscode.open', uri);
      } else {
        vscode.window.showWarningMessage('No SVG file path available');
      }
    })
  );

  // Command: Copy Icon Name
  commands.push(
    vscode.commands.registerCommand('iconManager.copyIconName', async (iconOrItem: any) => {
      const icon = iconOrItem?.icon || iconOrItem;
      if (icon && icon.name) {
        await vscode.env.clipboard.writeText(icon.name);
        vscode.window.showInformationMessage(`Copied: ${icon.name}`);
      }
    })
  );

  return commands;
}
