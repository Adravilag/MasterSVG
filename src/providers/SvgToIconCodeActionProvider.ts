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
  /** Whether this is an inline SVG */
  isInlineSvg?: boolean;
  /** The inline SVG content */
  svgContent?: string;
  /** Start offset for multi-line replacement */
  startOffset?: number;
  /** End offset for multi-line replacement */
  endOffset?: number;
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

    // Pattern 1: <img src="...svg" /> - support both <img src and <img  src (multiple spaces)
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

    // Pattern 2: Inline <svg> - detect SVG opening tag
    if (lineText.includes('<svg')) {
      const inlineSvgAction = this.detectInlineSvg(document, range.start.line);
      if (inlineSvgAction) {
        return [inlineSvgAction];
      }
    }

    return undefined;
  }

  /**
   * Detect and extract inline SVG from document
   */
  private detectInlineSvg(document: vscode.TextDocument, startLine: number): vscode.CodeAction | undefined {
    const text = document.getText();
    const lineStartOffset = document.offsetAt(new vscode.Position(startLine, 0));
    
    // Find the <svg that contains the cursor position
    const textFromLine = text.substring(lineStartOffset);
    const svgStartMatch = textFromLine.match(/<svg[^>]*>/i);
    
    if (!svgStartMatch) {
      return undefined;
    }

    const svgStartIndex = lineStartOffset + svgStartMatch.index!;
    
    // Find the closing </svg> tag
    let depth = 1;
    let searchIndex = svgStartIndex + svgStartMatch[0].length;
    
    while (depth > 0 && searchIndex < text.length) {
      const openTag = text.indexOf('<svg', searchIndex);
      const closeTag = text.indexOf('</svg>', searchIndex);
      
      if (closeTag === -1) {
        return undefined; // No closing tag found
      }
      
      if (openTag !== -1 && openTag < closeTag) {
        depth++;
        searchIndex = openTag + 4;
      } else {
        depth--;
        if (depth === 0) {
          const svgEndIndex = closeTag + 6;
          const svgContent = text.substring(svgStartIndex, svgEndIndex);
          
          // Generate icon name from nearby context or use generic name
          const iconName = this.suggestIconName(document, startLine, svgContent);
          
          return this.createInlineSvgAction(document, svgContent, iconName, startLine, svgStartIndex, svgEndIndex);
        }
        searchIndex = closeTag + 6;
      }
    }

    return undefined;
  }

  /**
   * Suggest a name for inline SVG based on context
   */
  private suggestIconName(document: vscode.TextDocument, line: number, svgContent: string): string {
    // Try to extract from id attribute
    const idMatch = svgContent.match(/id=["']([^"']+)["']/);
    if (idMatch) {
      return this.cleanIconName(idMatch[1]);
    }

    // Try to extract from aria-label
    const ariaMatch = svgContent.match(/aria-label=["']([^"']+)["']/);
    if (ariaMatch) {
      return this.cleanIconName(ariaMatch[1]);
    }

    // Try to find class name that looks like an icon name
    const classMatch = svgContent.match(/class=["'][^"']*icon[- ]?([a-zA-Z0-9-_]+)/i);
    if (classMatch) {
      return this.cleanIconName(classMatch[1]);
    }

    // Look at surrounding context (comments, variable names)
    if (line > 0) {
      const prevLine = document.lineAt(line - 1).text;
      const commentMatch = prevLine.match(/<!--\s*([^-]+)\s*-->/);
      if (commentMatch) {
        return this.cleanIconName(commentMatch[1].trim());
      }
    }

    // Default name with line number
    return `inline-icon-${line + 1}`;
  }

  /**
   * Clean a string to be a valid icon name
   */
  private cleanIconName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'icon';
  }

  /**
   * Create action for inline SVG transformation
   */
  private createInlineSvgAction(
    document: vscode.TextDocument,
    svgContent: string,
    iconName: string,
    line: number,
    startOffset: number,
    endOffset: number
  ): vscode.CodeAction {
    const config = getConfig();
    const buildFormat = config.buildFormat || 'icons.ts';
    const isSprite = buildFormat === 'sprite.svg';
    const formatLabel = isSprite ? t('ui.labels.svgSprite') : t('ui.labels.webComponentJs');
    
    const action = new vscode.CodeAction(
      t('messages.extractInlineSvg', { name: iconName }) || `Extract inline SVG as "${iconName}"`,
      vscode.CodeActionKind.Refactor
    );

    // Get the original HTML for replacement
    const originalHtml = document.getText().substring(startOffset, endOffset);

    const options: TransformOptions = {
      originalPath: '',
      iconName,
      documentUri: document.uri.fsPath,
      line,
      originalHtml,
      isInlineSvg: true,
      svgContent,
      startOffset,
      endOffset
    };

    action.command = {
      command: 'iconManager.transformSvgReference',
      title: t('commands.transformSvg'),
      arguments: [options]
    };

    return action;
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
 * Detects: <sg-icon name="missing-icon"> where icon doesn't exist
 * Offers: Import from Iconify or file
 */
export class MissingIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor
  ];

  constructor(private svgProvider: WorkspaceSvgProvider) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const config = getConfig();
    const componentName = config.webComponentName || 'sg-icon';

    const line = document.lineAt(range.start.line);
    const lineText = line.text;
    const actions: vscode.CodeAction[] = [];

    // Pattern to detect if cursor is inside the component tag (anywhere)
    const tagPattern = new RegExp(`<${componentName}[^>]*>`, 'gi');
    let tagMatch;
    
    while ((tagMatch = tagPattern.exec(lineText)) !== null) {
      const tagStart = tagMatch.index;
      const tagEnd = tagStart + tagMatch[0].length;
      
      // Check if cursor is within this tag
      if (range.start.character >= tagStart && range.start.character <= tagEnd) {
        // Extract name attribute if present
        const nameMatch = tagMatch[0].match(/name=["']([^"']*)["']/i);
        const iconName = nameMatch ? nameMatch[1] : '';
        
        // Check if icon exists
        const icon = iconName ? this.svgProvider.getIcon(iconName) : undefined;
        
        if (!icon) {
          // Add import action
          if (iconName) {
            actions.push(this.createImportAction(iconName, document, range.start.line));
          }
          
          // Always add "Search in Iconify" action when on the tag
          actions.push(this.createSearchIconifyAction(iconName, document, range.start.line));
          
          // Add "Browse workspace icons" action
          actions.push(this.createBrowseWorkspaceAction(iconName, document, range.start.line));
        }
        
        if (actions.length > 0) {
          return actions;
        }
      }
    }

    // Also support patterns with name attribute for precise targeting
    const patterns = [
      new RegExp(`<${componentName}[^>]*name=["']([^"']*)["']`, 'gi'),
      /<iconify-icon[^>]*icon=["']([^"']*)["']/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        const iconName = match[1] || '';
        const icon = iconName ? this.svgProvider.getIcon(iconName) : undefined;
        
        if (!icon) {
          // Check if cursor is within the match
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          
          if (range.start.character >= matchStart && range.start.character <= matchEnd) {
            if (iconName) {
              actions.push(this.createImportAction(iconName, document, range.start.line));
            }
            actions.push(this.createSearchIconifyAction(iconName, document, range.start.line));
            actions.push(this.createBrowseWorkspaceAction(iconName, document, range.start.line));
            
            if (actions.length > 0) {
              return actions;
            }
          }
        }
      }
    }

    return actions.length > 0 ? actions : undefined;
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

  /**
   * Create action for searching icons in Iconify
   */
  private createSearchIconifyAction(
    suggestedQuery: string,
    document: vscode.TextDocument,
    line: number
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      t('messages.searchIconify') || '🔍 Search in Iconify...',
      vscode.CodeActionKind.Refactor
    );

    action.command = {
      command: 'iconManager.searchIconifyForComponent',
      title: t('commands.searchIconify') || 'Search Iconify',
      arguments: [suggestedQuery, document.uri.fsPath, line]
    };

    return action;
  }

  /**
   * Create action for browsing workspace icons
   */
  private createBrowseWorkspaceAction(
    suggestedName: string,
    document: vscode.TextDocument,
    line: number
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      t('messages.browseWorkspaceIcons') || '📁 Browse workspace icons...',
      vscode.CodeActionKind.Refactor
    );

    action.command = {
      command: 'iconManager.browseWorkspaceIcons',
      title: t('commands.browseWorkspaceIcons') || 'Browse Icons',
      arguments: [suggestedName, document.uri.fsPath, line]
    };

    return action;
  }
}

