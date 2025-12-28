import * as vscode from 'vscode';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { getSvgConfig } from '../utils/config';

export class IconHoverProvider implements vscode.HoverProvider {
  constructor(private svgProvider: WorkspaceSvgProvider) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    // Get the line and try to find icon reference
    const line = document.lineAt(position).text;
    
    // Patterns to match icon references
    const patterns = [
      // <Icon name="icon-name" /> or <icon name="icon-name">
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']([^"']+)["']`, 'gi'),
      // <iconify-icon icon="prefix:name" />
      /<iconify-icon[^>]*icon=["']([^"']+)["']/gi,
      // Generic name="icon" or icon="icon"
      /(?:name|icon)=["']([a-z0-9:-]+)["']/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const iconName = match[1];
        const startIndex = match.index + match[0].indexOf(iconName);
        const endIndex = startIndex + iconName.length;

        // Check if cursor is within the icon name
        if (position.character >= startIndex && position.character <= endIndex) {
          const icon = this.svgProvider.getIcon(iconName);
          
          if (icon) {
            const markdown = new vscode.MarkdownString();
            markdown.supportHtml = true;
            markdown.isTrusted = true;

            // Add SVG preview if available
            if (icon.svg) {
              const preview = this.createSvgPreview(icon.svg);
              markdown.appendMarkdown(preview + '\n\n');
            }

            markdown.appendMarkdown(`**${icon.name}**\n\n`);
            markdown.appendMarkdown(`- Source: \`${icon.source}\`\n`);
            markdown.appendMarkdown(`- Category: \`${icon.category || 'none'}\`\n`);
            markdown.appendMarkdown(`- Path: \`${icon.path}\`\n`);

            const range = new vscode.Range(
              position.line, startIndex,
              position.line, endIndex
            );

            return new vscode.Hover(markdown, range);
          } else {
            // Icon not found in workspace
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportHtml = true;
            markdown.appendMarkdown(`⚠️ **Icon not found**: \`${iconName}\`\n\n`);
            markdown.appendMarkdown(`This icon is not in your workspace or library.\n\n`);
            markdown.appendMarkdown(`[� Import "${iconName}"](command:iconManager.importIcon?${encodeURIComponent(JSON.stringify([iconName, document.uri.fsPath, position.line]))})`);
            
            return new vscode.Hover(markdown);
          }
        }
      }
    }

    return null;
  }

  private createSvgPreview(svg: string): string {
    // Extract viewBox if present
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    
    // Remove existing width/height/class attributes
    let cleanSvg = svg
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '')
      .replace(/\s+class="[^"]*"/g, '');
    
    // Ensure viewBox is set
    if (!cleanSvg.includes('viewBox')) {
      cleanSvg = cleanSvg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
    }
    
    // Add width/height for proper display
    cleanSvg = cleanSvg.replace(
      /<svg/,
      '<svg width="64" height="64"'
    );
    
    // URL encode the SVG for use in data URI (more reliable than base64)
    const encoded = encodeURIComponent(cleanSvg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    
    // Use markdown image syntax instead of HTML
    return `![icon](data:image/svg+xml,${encoded})`;
  }
}
