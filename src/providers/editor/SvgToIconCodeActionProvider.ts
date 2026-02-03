import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../../utils/configHelper';
import { WorkspaceSvgProvider } from '../tree/WorkspaceSvgProvider';
import { t } from '../../i18n';
import {
  IconSourceOption as CentralizedIconSourceOption,
  CodeActionTransformOptions,
} from '../../services/types/mastersvgTypes';

// Re-export for backwards compatibility
export type IconSourceOption = CentralizedIconSourceOption;
export type TransformOptions = CodeActionTransformOptions;

/**
 * Code Action Provider for transforming SVG references to Icon components
 *
 * Detects: <img src="path/to/icon.svg">
 * Offers: Transform to Web Component with source selection
 */
export class SvgToIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const line = document.lineAt(range.start.line);
    const lineText = line.text;

    // Pattern 1: <img src="...svg" /> - support both <img src and <img  src (multiple spaces)
    const imgSvgPattern = /<img\s+[^>]*src=["']([^"']*\.svg)["'][^>]*>/gi;

    let match;
    while ((match = imgSvgPattern.exec(lineText)) !== null) {
      const svgPath = match[1];
      const iconName = this.extractIconName(svgPath);
      const fullMatch = match[0];

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
  private detectInlineSvg(
    document: vscode.TextDocument,
    startLine: number
  ): vscode.CodeAction | undefined {
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

          // Skip sprite references (<use href="#icon-..."> or <use xlink:href="#...">)
          // These are references to icons in sprite.svg, not actual inline SVGs to extract
          if (/<use\s+[^>]*(href|xlink:href)=["']#/i.test(svgContent)) {
            return undefined;
          }

          // Skip dynamic Angular SVGs with bindings or control flow
          // [attr.width], [attr.height], @switch, @case, @if, @for, etc.
          if (/\[attr\.|\[ngClass\]|\[ngStyle\]|@switch|@case|@if|@for|@default/.test(svgContent)) {
            return undefined;
          }

          // Generate icon name from nearby context or use generic name
          const iconName = this.suggestIconName(document, startLine, svgContent);

          return this.createInlineSvgAction(
            document,
            svgContent,
            iconName,
            startLine,
            svgStartIndex,
            svgEndIndex
          );
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

    // Try to extract from data-icon, data-name, or data-testid
    const dataMatch = svgContent.match(/data-(?:icon|name|testid)=["']([^"']+)["']/i);
    if (dataMatch) {
      return this.cleanIconName(dataMatch[1]);
    }

    // Try to extract from <title> element inside SVG
    const titleMatch = svgContent.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      return this.cleanIconName(titleMatch[1]);
    }

    // Try to find class name that looks like an icon name
    const classMatch = svgContent.match(/class=["'][^"']*icon[- ]?([a-zA-Z0-9-_]+)/i);
    if (classMatch) {
      return this.cleanIconName(classMatch[1]);
    }

    // Look at surrounding context (comments, variable names)
    if (line > 0) {
      const prevLine = document.lineAt(line - 1).text;

      // Check for HTML comment: <!-- check icon -->
      const commentMatch = prevLine.match(/<!--\s*([^-]+?)\s*(?:icon)?\s*-->/i);
      if (commentMatch) {
        return this.cleanIconName(commentMatch[1].trim());
      }

      // Check for variable assignment: const CheckIcon = ...
      const varMatch = prevLine.match(/(?:const|let|var)\s+(\w+Icon|\w+Svg)\s*=/i);
      if (varMatch) {
        return this.cleanIconName(varMatch[1].replace(/Icon$|Svg$/i, ''));
      }
    }

    // Try to find parent component name (React/Vue style)
    const fullText = document.getText();
    const svgStartOffset = document.offsetAt(new vscode.Position(line, 0));
    const textBefore = fullText.substring(Math.max(0, svgStartOffset - 200), svgStartOffset);
    const componentMatch = textBefore.match(/<([A-Z][a-zA-Z]*(?:Icon|Svg)|Icon\.([A-Z][a-zA-Z]*))[^>]*>\s*$/i);
    if (componentMatch) {
      const name = componentMatch[2] || componentMatch[1];
      return this.cleanIconName(name.replace(/Icon$|Svg$/i, ''));
    }

    // Try to infer from path d attribute (common shapes)
    const pathMatch = svgContent.match(/d=["']([^"']+)["']/);
    if (pathMatch) {
      const pathName = this.inferNameFromPath(pathMatch[1]);
      if (pathName) return pathName;
    }

    // Default name with line number
    return `inline-icon-${line + 1}`;
  }

  /**
   * Try to infer icon name from SVG path data
   */
  private inferNameFromPath(pathData: string): string | null {
    // Common checkmark pattern: M5 13l4 4L19 7
    if (/m\s*5.*l\s*4\s*4.*l.*7|m.*l.*4\s*4.*19\s*7/i.test(pathData)) {
      return 'check';
    }

    // X/close patterns
    if (/m\s*6.*18.*m\s*6.*6.*18/i.test(pathData) || /m.*6\s*6.*18\s*18.*m.*6\s*18.*18\s*6/i.test(pathData)) {
      return 'close';
    }

    // Plus pattern
    if (/m\s*12\s*5.*v\s*14.*m\s*5\s*12.*h\s*14/i.test(pathData)) {
      return 'plus';
    }

    // Minus pattern
    if (/m\s*5\s*12.*h\s*14/i.test(pathData) && !/v/i.test(pathData)) {
      return 'minus';
    }

    // Adjustments/sliders pattern (Heroicons adjustments-horizontal)
    if (/M\d+\.?\d*\s*6.*M\d+\.?\d*\s*6a.*M.*12.*M.*18|h\d+.*m.*h\d+.*m.*h\d+/i.test(pathData)) {
      return 'adjustments';
    }

    // Menu/hamburger pattern
    if (/M3.*h18.*M3.*12.*h18.*M3.*h18|m\s*4\s*6.*h\s*16.*m.*h\s*16.*m.*h\s*16/i.test(pathData)) {
      return 'menu';
    }

    // Search/magnifier pattern
    if (/M21\s*21.*l.*-5.*-5|circle.*line|m.*10.*a.*8.*8/i.test(pathData)) {
      return 'search';
    }

    // Home pattern
    if (/M3\s*12.*l.*9.*-9.*9.*9|m.*10.*20.*v.*-6.*h.*4.*v.*6/i.test(pathData)) {
      return 'home';
    }

    // User/person pattern
    if (/M15\.75\s*6.*a.*3\.75|M17\.982.*15\.75.*a.*9/i.test(pathData)) {
      return 'user';
    }

    // Settings/cog pattern
    if (/M9\.594.*3\.94|M10\.343.*3\.94|cog|gear/i.test(pathData)) {
      return 'settings';
    }

    // Heart pattern
    if (/M21\s*8\.25.*c.*0.*-3.*-2\.25|M11\.645.*20\.91/i.test(pathData)) {
      return 'heart';
    }

    // Star pattern
    if (/M11\.48.*3\.499|M12\s*2.*l.*3\.09.*6\.26/i.test(pathData)) {
      return 'star';
    }

    // Trash pattern
    if (/M14\.74\s*9.*l.*-0\.346.*9|M19\s*7.*l.*-0\.867/i.test(pathData)) {
      return 'trash';
    }

    // Edit/pencil pattern
    if (/M16\.862.*4\.487|m.*16\.862.*4\.487|M11\s*5.*H6.*a.*2/i.test(pathData)) {
      return 'edit';
    }

    return null;
  }

  /**
   * Clean a string to be a valid icon name
   */
  private cleanIconName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50) || 'icon'
    );
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
    const _formatLabel = isSprite ? t('ui.labels.svgSprite') : t('ui.labels.webComponentJs');

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
      endOffset,
    };

    action.command = {
      command: 'masterSVG.transformSvgReference',
      title: t('commands.transformSvg'),
      arguments: [options],
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
      originalHtml,
    };

    action.command = {
      command: 'masterSVG.transformSvgReference',
      title: t('commands.transformSvg'),
      arguments: [options],
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
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('masterSVG');
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
      diagnostic.source = 'masterSVG';

      diagnostics.push(diagnostic);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private shouldAnalyze(document: vscode.TextDocument): boolean {
    const supportedLanguages = [
      'html',
      'javascript',
      'javascriptreact',
      'typescript',
      'typescriptreact',
      'vue',
      'svelte',
      'astro',
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
 * Detects: <svg-icon name="missing-icon"> where icon doesn't exist
 * Offers: Import from Iconify or file
 */
export class MissingIconCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  constructor(private svgProvider: WorkspaceSvgProvider) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const config = getConfig();
    const componentName = config.webComponentName || 'svg-icon';

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
      /<iconify-icon[^>]*icon=["']([^"']*)["']/gi,
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
      command: 'masterSVG.importIcon',
      title: t('commands.importIcon'),
      arguments: [iconName, document.uri.fsPath, line],
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
      command: 'masterSVG.searchIconifyForComponent',
      title: t('commands.searchIconify') || 'Search Iconify',
      arguments: [suggestedQuery, document.uri.fsPath, line],
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
      command: 'masterSVG.browseWorkspaceIcons',
      title: t('commands.browseWorkspaceIcons') || 'Browse Icons',
      arguments: [suggestedName, document.uri.fsPath, line],
    };

    return action;
  }
}
