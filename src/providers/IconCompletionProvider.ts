import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { getSvgConfig } from '../utils/config';

export class IconCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private svgProvider: WorkspaceSvgProvider) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const fullLine = document.lineAt(position).text;
    
    // Check if we're in an icon-related context
    const componentName = getSvgConfig<string>('componentName', 'Icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    // Check if we're completing variant attribute
    const variantPatterns = [
      new RegExp(`<${componentName}[^>]*variant=["']$`),
      /variant=["']$/
    ];
    
    const shouldCompleteVariant = variantPatterns.some(p => p.test(linePrefix));
    if (shouldCompleteVariant) {
      // Try to extract the icon name from the line
      const iconNameMatch = fullLine.match(new RegExp(`${nameAttr}=["']([^"']+)["']`));
      const iconName = iconNameMatch ? iconNameMatch[1] : null;
      
      return this.getVariantCompletions(iconName);
    }

    // Check if we're completing animation attribute
    const animationPatterns = [
      new RegExp(`<${componentName}[^>]*animation=["']$`),
      /animation=["']$/
    ];
    
    const shouldCompleteAnimation = animationPatterns.some(p => p.test(linePrefix));
    if (shouldCompleteAnimation) {
      return this.getAnimationCompletions();
    }

    // Match patterns like: <Icon name=" or icon=" or name="
    const patterns = [
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']$`),
      new RegExp(`<iconify-icon[^>]*icon=["']$`),
      new RegExp(`${nameAttr}=["']$`),
      /icon=["']$/
    ];

    const shouldComplete = patterns.some(p => p.test(linePrefix));
    if (!shouldComplete) return [];

    const icons = await this.svgProvider.getAllIcons();
    const items: vscode.CompletionItem[] = [];

    for (const icon of icons) {
      const item = new vscode.CompletionItem(icon.name, vscode.CompletionItemKind.Value);
      item.detail = `${icon.source} - ${icon.category || 'uncategorized'}`;
      item.documentation = new vscode.MarkdownString(`**${icon.name}**\n\nSource: ${icon.source}\nPath: ${icon.path}`);
      
      // If we have the SVG, show a preview
      if (icon.svg) {
        const svgPreview = this.createSvgPreview(icon.svg);
        item.documentation = new vscode.MarkdownString(`${svgPreview}\n\n**${icon.name}**\n\nSource: ${icon.source}`);
        item.documentation.supportHtml = true;
        item.documentation.isTrusted = true;
      }

      item.sortText = icon.source === 'workspace' ? `0${icon.name}` : `1${icon.name}`;
      items.push(item);
    }

    return items;
  }

  private getVariantCompletions(iconName: string | null): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const allVariants = this.readVariantsFromFile();
    
    if (iconName && allVariants[iconName]) {
      // Show Variants for this specific icon
      const iconVariants = allVariants[iconName];
      for (const variantName of Object.keys(iconVariants)) {
        const colors = iconVariants[variantName];
        const item = new vscode.CompletionItem(variantName, vscode.CompletionItemKind.Color);
        item.detail = `Variant for ${iconName}`;
        item.documentation = new vscode.MarkdownString(`**${variantName}**\n\nColors: ${colors.join(', ')}`);
        item.sortText = `0${variantName}`;
        items.push(item);
      }
    } else {
      // Show all Variants from all icons
      for (const [icon, Variants] of Object.entries(allVariants)) {
        for (const variantName of Object.keys(Variants)) {
          const colors = Variants[variantName];
          const item = new vscode.CompletionItem(variantName, vscode.CompletionItemKind.Color);
          item.detail = `Variant from ${icon}`;
          item.documentation = new vscode.MarkdownString(`**${variantName}**\n\nFrom: ${icon}\nColors: ${colors.join(', ')}`);
          // Avoid duplicates by using icon name in sortText
          item.sortText = `1${variantName}_${icon}`;
          items.push(item);
        }
      }
      
      // Remove duplicates by variant name (keep first occurrence)
      const seen = new Set<string>();
      return items.filter(item => {
        if (seen.has(item.label as string)) return false;
        seen.add(item.label as string);
        return true;
      });
    }
    
    return items;
  }

  private getAnimationCompletions(): vscode.CompletionItem[] {
    const animations = [
      { name: 'spin', description: 'Continuous 360° rotation' },
      { name: 'pulse', description: 'Scale up/down with opacity change' },
      { name: 'bounce', description: 'Vertical bouncing motion' },
      { name: 'shake', description: 'Horizontal shaking motion' },
      { name: 'fade', description: 'Fade in and out' },
      { name: 'none', description: 'No animation' }
    ];

    return animations.map((anim, index) => {
      const item = new vscode.CompletionItem(anim.name, vscode.CompletionItemKind.EnumMember);
      item.detail = anim.description;
      item.documentation = new vscode.MarkdownString(`**${anim.name}**\n\n${anim.description}`);
      item.sortText = String(index).padStart(2, '0');
      return item;
    });
  }

  private readVariantsFromFile(): Record<string, Record<string, string[]>> {
    try {
      const outputDir = getSvgConfig<string>('outputDirectory', '');
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || !outputDir) return {};
      
      const filePath = path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
      if (!fs.existsSync(filePath)) return {};
      
      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse: export const Variants = { ... };
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private createSvgPreview(svg: string): string {
    // Normalize SVG for preview
    const cleanSvg = svg
      .replace(/width="[^"]*"/g, 'width="48"')
      .replace(/height="[^"]*"/g, 'height="48"')
      .replace(/class="[^"]*"/g, '')
      .replace(/style="[^"]*"/g, '');
    
    // Convert to data URI for markdown
    const encoded = Buffer.from(cleanSvg).toString('base64');
    return `<img src="data:image/svg+xml;base64,${encoded}" width="48" height="48" />`;
  }
}
