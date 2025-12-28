import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../utils/configHelper';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';

/**
 * Icon source options for transformation
 */
export type IconSourceOption = 'iconify' | 'workspace' | 'current' | 'manual';

/**
 * Transform options passed to the command
 */
export interface TransformOptions {
  /** Original SVG path from the img tag */
  originalPath: string;
  /** Extracted icon name */
  iconName: string;
  /** Document URI */
  documentUri: string;
  /** Line number */
  line: number;
  /** Original HTML to replace */
  originalHtml: string;
}

/**
 * Code Action Provider for transforming SVG references to Icon components
 * 
 * Detects: <img src="path/to/icon.svg">
 * Offers: Transform to Web Component with source selection
 */
export class SvgToIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const line = document.lineAt(range.start.line);
    const lineText = line.text;

    // Pattern: <img src="...svg" />
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
    
    let match;
    while ((match = imgSvgPattern.exec(lineText)) !== null) {
      const svgPath = match[1];
      const iconName = this.extractIconName(svgPath);
      const fullMatch = match[0];
      const startPos = lineText.indexOf(fullMatch);
      
      // Check if cursor is within the match
      if (range.start.character >= startPos && 
          range.start.character <= startPos + fullMatch.length) {
        
        return [this.createTransformAction(document, svgPath, iconName, fullMatch, range.start.line)];
      }
    }

    return undefined;
  }

  /**
   * Extract clean icon name from SVG path
   */
  private extractIconName(svgPath: string): string {
    const filename = path.basename(svgPath, '.svg');
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create the single "Transform to Web Component" action
   */
  private createTransformAction(
    document: vscode.TextDocument,
    svgPath: string,
    iconName: string,
    originalHtml: string,
    line: number
  ): vscode.CodeAction {
    const config = getConfig();
    const buildFormat = config.buildFormat || 'icons.ts';
    const isSprite = buildFormat === 'sprite.svg';
    const formatLabel = isSprite ? 'SVG Sprite' : 'Web Component';
    
    const action = new vscode.CodeAction(
      `🔄 Transform to ${formatLabel}: "${iconName}"`,
      vscode.CodeActionKind.QuickFix
    );

    const options: TransformOptions = {
      originalPath: svgPath,
      iconName,
      documentUri: document.uri.fsPath,
      line,
      originalHtml
    };

    action.command = {
      command: 'iconManager.transformSvgReference',
      title: 'Transform SVG Reference',
      arguments: [options]
    };

    action.isPreferred = true;
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
    
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
    
    let match;
    while ((match = imgSvgPattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      
      const iconName = path.basename(match[1], '.svg');
      
      const diagnostic = new vscode.Diagnostic(
        range,
        `SVG "${iconName}" can be converted to Icon component`,
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

/**
 * Code Action Provider for missing icons in web components
 * 
 * Detects: <bz-icon name="missing-icon"> where icon doesn't exist
 * Offers: Import from Iconify or file
 */
export class MissingIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  constructor(private svgProvider: WorkspaceSvgProvider) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const config = getConfig();
    const componentName = config.webComponentName || 'bz-icon';

    const line = document.lineAt(range.start.line);
    const lineText = line.text;

    // Patterns for icon references
    const patterns = [
      new RegExp(`<${componentName}[^>]*name=["']([^"']+)["']`, 'gi'),
      /<iconify-icon[^>]*icon=["']([^"']+)["']/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        const iconName = match[1];
        const icon = this.svgProvider.getIcon(iconName);
        
        if (!icon) {
          const nameStart = match.index + match[0].indexOf(iconName);
          const nameEnd = nameStart + iconName.length;
          
          if (range.start.character >= nameStart && range.start.character <= nameEnd) {
            return [this.createImportAction(iconName, document, range.start.line)];
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Create action for importing missing icon
   */
  private createImportAction(
    iconName: string,
    document: vscode.TextDocument,
    line: number
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `📥 Import icon: "${iconName}"`,
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: 'iconManager.importIcon',
      title: 'Import Icon',
      arguments: [iconName, document.uri.fsPath, line]
    };

    action.isPreferred = true;
    return action;
  }
}
