import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../utils/configHelper';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { t } from '../i18n';

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
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const line = document.lineAt(range.start.line);
    const lineText = line.text;

    console.log('[IconManager] provideCodeActions called for line:', lineText);

    // Pattern: <img src="...svg" /> - support both <img src and <img  src (multiple spaces)
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;
    
    let match;
    while ((match = imgSvgPattern.exec(lineText)) !== null) {
      const svgPath = match[1];
      const iconName = this.extractIconName(svgPath);
      const fullMatch = match[0];
      
      console.log('[IconManager] Found SVG img:', { svgPath, iconName, fullMatch });
      
      // Always return the action if we find an img with svg on this line
      return [this.createTransformAction(document, svgPath, iconName, fullMatch, range.start.line)];
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
    const formatLabel = isSprite ? t('ui.labels.svgSprite') : t('ui.labels.webComponentJs');
    
    const action = new vscode.CodeAction(
      t('messages.transformToFormat', { format: formatLabel, name: iconName }),
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
      title: t('commands.transformSvg'),
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
        t('messages.svgCanBeConverted', { name: iconName }),
        vscode.DiagnosticSeverity.Hint
      );
      diagnostic.code = 'svg-to-icon';
      diagnostic.source = 'IconWrap';
      
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
      t('messages.importIconName', { name: iconName }),
      vscode.CodeActionKind.QuickFix
    );

    action.command = {
      command: 'iconManager.importIcon',
      title: t('commands.importIcon'),
      arguments: [iconName, document.uri.fsPath, line]
    };

    action.isPreferred = true;
    return action;
  }
}

