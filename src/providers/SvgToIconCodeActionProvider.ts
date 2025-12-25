import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSvgConfig } from '../utils/config';

/**
 * Code Action Provider for transforming SVG references to Icon components
 * Detects: <img src="path/to/icon.svg"> and offers to convert to <Icon name="icon" />
 */
export class SvgToIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    // Get the line text
    const line = document.lineAt(range.start.line);
    const lineText = line.text;

    // Pattern 1: <img src="...svg" />
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
    
    // Pattern 2: <img src={...svg} /> (JSX)
    const imgSvgJsxPattern = /<img\s+[^>]*src=\{([^}]*\.svg[^}]*)\}[^>]*>/gi;

    // Pattern 3: background: url(...svg)
    const bgSvgPattern = /url\(["']?([^"')]*\.svg)["']?\)/gi;

    // Pattern 4: import ... from '...svg'
    const importSvgPattern = /import\s+(\w+)\s+from\s+["']([^"']*\.svg)["']/gi;

    let match;

    // Check for <img src="...svg">
    while ((match = imgSvgPattern.exec(lineText)) !== null) {
      const svgPath = match[1];
      const iconName = this.extractIconName(svgPath);
      const fullMatch = match[0];
      const startPos = line.text.indexOf(fullMatch);
      const matchRange = new vscode.Range(
        range.start.line, startPos,
        range.start.line, startPos + fullMatch.length
      );

      // Quick fix action
      const quickFix = this.createTransformAction(
        document,
        matchRange,
        iconName,
        svgPath,
        fullMatch,
        'quickfix'
      );
      actions.push(quickFix);

      // Also offer to import the SVG to library
      const importAction = this.createImportToLibraryAction(document, svgPath, iconName);
      if (importAction) actions.push(importAction);
    }

    // Check for background: url(...svg)
    while ((match = bgSvgPattern.exec(lineText)) !== null) {
      const svgPath = match[1];
      const iconName = this.extractIconName(svgPath);
      
      const diagnostic = new vscode.CodeAction(
        `💡 SVG detected: "${iconName}" - Consider using Icon component`,
        vscode.CodeActionKind.Empty
      );
      diagnostic.isPreferred = false;
      actions.push(diagnostic);
    }

    return actions.length > 0 ? actions : undefined;
  }

  private extractIconName(svgPath: string): string {
    // Extract filename without extension
    const filename = path.basename(svgPath, '.svg');
    // Convert to kebab-case and clean
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private createTransformAction(
    document: vscode.TextDocument,
    range: vscode.Range,
    iconName: string,
    svgPath: string,
    originalText: string,
    kind: 'quickfix' | 'refactor'
  ): vscode.CodeAction {
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    const action = new vscode.CodeAction(
      `🔄 Transform to <${componentName} ${nameAttr}="${iconName}" />`,
      kind === 'quickfix' ? vscode.CodeActionKind.QuickFix : vscode.CodeActionKind.Refactor
    );

    // Determine the replacement based on file type
    const languageId = document.languageId;
    let replacement: string;

    if (['javascriptreact', 'typescriptreact'].includes(languageId)) {
      replacement = `<${componentName} ${nameAttr}="${iconName}" />`;
    } else if (languageId === 'vue') {
      replacement = `<${componentName} ${nameAttr}="${iconName}" />`;
    } else if (languageId === 'svelte') {
      replacement = `<${componentName} ${nameAttr}="${iconName}" />`;
    } else if (languageId === 'astro') {
      replacement = `<${componentName} ${nameAttr}="${iconName}" />`;
    } else {
      // HTML - use iconify-icon
      replacement = `<iconify-icon icon="${iconName}"></iconify-icon>`;
    }

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, range, replacement);
    
    // Store SVG path for potential import
    action.command = {
      command: 'iconManager.checkAndImportSvg',
      title: 'Check and Import SVG',
      arguments: [svgPath, iconName, document.uri.fsPath]
    };

    action.isPreferred = true;
    return action;
  }

  private createImportToLibraryAction(
    document: vscode.TextDocument,
    svgPath: string,
    iconName: string
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(
      `📥 Import "${iconName}.svg" to Icon Library`,
      vscode.CodeActionKind.Refactor
    );

    action.command = {
      command: 'iconManager.importSvgToLibrary',
      title: 'Import SVG to Library',
      arguments: [svgPath, iconName, document.uri.fsPath]
    };

    return action;
  }
}

/**
 * Diagnostic provider to highlight SVG img references
 */
export class SvgImgDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('iconManager');
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    if (!this.shouldAnalyze(document)) {
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    
    // Pattern for <img src="...svg">
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
    
    let match;
    while ((match = imgSvgPattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      
      const iconName = path.basename(match[1], '.svg');
      
      const diagnostic = new vscode.Diagnostic(
        range,
        `SVG image "${iconName}" can be converted to Icon component for better performance and consistency`,
        vscode.DiagnosticSeverity.Hint
      );
      diagnostic.code = 'svg-to-icon';
      diagnostic.source = 'Icon Manager';
      
      diagnostics.push(diagnostic);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private shouldAnalyze(document: vscode.TextDocument): boolean {
    const supportedLanguages = [
      'html', 'javascript', 'javascriptreact', 
      'typescript', 'typescriptreact',
      'vue', 'svelte', 'astro'
    ];
    return supportedLanguages.includes(document.languageId);
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
