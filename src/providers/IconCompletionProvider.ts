import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from './WorkspaceSvgProvider';
import { getSvgConfig } from '../utils/config';
import { ANIMATION_CATEGORIES } from '../services/AnimationKeyframes';

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
    const webComponentName = getSvgConfig<string>('webComponentName', 'sg-icon');
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');

    // Check if we're inside an icon component tag and need attribute names
    const iconTagPatterns = [
      new RegExp(`<${componentName}[^>]*\\s+$`),           // <Icon ... |
      new RegExp(`<${webComponentName}[^>]*\\s+$`),        // <sg-icon ... |
      new RegExp(`<${componentName}[^>]*\\s+[a-z]*$`, 'i'), // <Icon ... var|
      new RegExp(`<${webComponentName}[^>]*\\s+[a-z]*$`, 'i') // <sg-icon ... var|
    ];
    
    const shouldCompleteAttribute = iconTagPatterns.some(p => p.test(linePrefix));
    if (shouldCompleteAttribute) {
      // Check what partial text has been typed
      const partialAttrMatch = linePrefix.match(/\s+([a-z]*)$/i);
      const partialText = partialAttrMatch ? partialAttrMatch[1].toLowerCase() : '';
      
      // Get existing attributes in this tag to avoid duplicates
      const existingAttrs = this.getExistingAttributes(linePrefix);
      
      return this.getAttributeCompletions(partialText, existingAttrs);
    }

    // Check if we're completing variant attribute value
    const variantPatterns = [
      new RegExp(`<${componentName}[^>]*variant=["']$`),
      new RegExp(`<${webComponentName}[^>]*variant=["']$`),
      /variant=["']$/
    ];
    
    const shouldCompleteVariant = variantPatterns.some(p => p.test(linePrefix));
    if (shouldCompleteVariant) {
      // Try to extract the icon name from the line
      const iconNameMatch = fullLine.match(new RegExp(`${nameAttr}=["']([^"']+)["']`));
      const iconName = iconNameMatch ? iconNameMatch[1] : null;
      
      return this.getVariantCompletions(iconName);
    }

    // Check if we're completing animation attribute value
    const animationPatterns = [
      new RegExp(`<${componentName}[^>]*animation=["']$`),
      new RegExp(`<${webComponentName}[^>]*animation=["']$`),
      /animation=["']$/
    ];
    
    const shouldCompleteAnimation = animationPatterns.some(p => p.test(linePrefix));
    if (shouldCompleteAnimation) {
      return this.getAnimationCompletions();
    }

    // Match patterns like: <Icon name=" or icon=" or name="
    const patterns = [
      new RegExp(`<${componentName}[^>]*${nameAttr}=["']$`),
      new RegExp(`<${webComponentName}[^>]*${nameAttr}=["']$`),
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
        // Skip internal variants (starting with _)
        if (variantName.startsWith('_')) continue;
        
        const colors = iconVariants[variantName];
        const item = new vscode.CompletionItem(variantName, vscode.CompletionItemKind.Color);
        item.detail = `🎨 Variant for ${iconName}`;
        item.documentation = this.createVariantDocumentation(variantName, colors, iconName);
        item.sortText = `0${variantName}`;
        items.push(item);
      }
    } else {
      // Show all Variants from all icons
      for (const [icon, Variants] of Object.entries(allVariants)) {
        for (const variantName of Object.keys(Variants)) {
          // Skip internal variants (starting with _)
          if (variantName.startsWith('_')) continue;
          
          const colors = Variants[variantName];
          const item = new vscode.CompletionItem(variantName, vscode.CompletionItemKind.Color);
          item.detail = `🎨 Variant from ${icon}`;
          item.documentation = this.createVariantDocumentation(variantName, colors, icon);
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

  /**
   * Create rich documentation for variant with color swatches
   */
  private createVariantDocumentation(variantName: string, colors: string[], iconName?: string): vscode.MarkdownString {
    const colorSwatches = colors.map(color => {
      // Create inline color swatch using Unicode blocks or HTML
      const safeColor = color.replace(/[^#a-fA-F0-9,()rgb]/g, '');
      return `<span style="background-color:${safeColor};color:${safeColor};border:1px solid #888;border-radius:2px;">&nbsp;&nbsp;&nbsp;</span> \`${color}\``;
    }).join('\n\n');

    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;
    md.appendMarkdown(`**🎨 ${variantName}**\n\n`);
    if (iconName) {
      md.appendMarkdown(`*Icon: ${iconName}*\n\n`);
    }
    md.appendMarkdown(`**Colors:**\n\n${colorSwatches}\n\n`);
    md.appendMarkdown(`---\n*Use \`variant="${variantName}"\` to apply*`);
    return md;
  }

  private getAnimationCompletions(): vscode.CompletionItem[] {
    // Animation metadata with descriptions and icons
    const animationMeta: Record<string, { description: string; icon: string }> = {
      // Basic
      'none': { description: 'No animation', icon: '⏹️' },
      'spin': { description: 'Continuous 360° rotation', icon: '🔄' },
      'spin-reverse': { description: 'Counter-clockwise rotation', icon: '🔃' },
      'pulse': { description: 'Scale up/down with opacity', icon: '💓' },
      'pulse-grow': { description: 'Scale up and down', icon: '📈' },
      'bounce': { description: 'Vertical bouncing', icon: '⬆️' },
      'bounce-horizontal': { description: 'Horizontal bouncing', icon: '↔️' },
      'shake': { description: 'Horizontal shaking', icon: '↔️' },
      'shake-vertical': { description: 'Vertical shaking', icon: '↕️' },
      'fade': { description: 'Fade in and out', icon: '👻' },
      'float': { description: 'Gentle floating', icon: '🎈' },
      'blink': { description: 'Blink on/off', icon: '💡' },
      'glow': { description: 'Glowing effect', icon: '✨' },
      // Attention
      'swing': { description: 'Pendulum swing', icon: '🎐' },
      'wobble': { description: 'Wobbly motion', icon: '〰️' },
      'rubber-band': { description: 'Rubber band stretch', icon: '🔗' },
      'jello': { description: 'Jello wiggle', icon: '🟡' },
      'heartbeat': { description: 'Double-pulse heartbeat', icon: '❤️' },
      'tada': { description: 'Celebration effect', icon: '🎉' },
      // Entrance/Exit
      'fade-in': { description: 'Fade in from transparent', icon: '🌅' },
      'fade-out': { description: 'Fade out to transparent', icon: '🌆' },
      'zoom-in': { description: 'Zoom in from small', icon: '🔍' },
      'zoom-out': { description: 'Zoom out to small', icon: '🔎' },
      'slide-in-up': { description: 'Slide in from bottom', icon: '⬆️' },
      'slide-in-down': { description: 'Slide in from top', icon: '⬇️' },
      'slide-in-left': { description: 'Slide in from left', icon: '⬅️' },
      'slide-in-right': { description: 'Slide in from right', icon: '➡️' },
      'flip': { description: 'Flip on Y axis', icon: '🔀' },
      'flip-x': { description: 'Flip on X axis', icon: '🔁' },
      // Draw (for stroke-based SVGs)
      'draw': { description: 'Draw stroke animation', icon: '✏️' },
      'draw-reverse': { description: 'Undraw stroke animation', icon: '🧹' },
      'draw-loop': { description: 'Draw and undraw loop', icon: '🔄' },
    };

    const items: vscode.CompletionItem[] = [];
    let sortIndex = 0;

    // Group animations by category
    const categoryLabels: Record<string, string> = {
      basic: '🎯 Basic',
      attention: '👀 Attention',
      entrance: '🚪 Entrance/Exit',
      draw: '✏️ Draw'
    };

    for (const [category, animations] of Object.entries(ANIMATION_CATEGORIES)) {
      for (const animName of animations) {
        const meta = animationMeta[animName] || { description: animName, icon: '🎬' };
        
        const item = new vscode.CompletionItem(animName, vscode.CompletionItemKind.EnumMember);
        item.detail = `${meta.icon} ${meta.description}`;
        
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`${meta.icon} **${animName}**\n\n`);
        md.appendMarkdown(`${meta.description}\n\n`);
        md.appendMarkdown(`*Category: ${categoryLabels[category] || category}*\n\n`);
        md.appendMarkdown(`---\n*Use \`animation="${animName}"\` to apply*`);
        item.documentation = md;
        
        // Sort by category then by name
        const categoryIndex = Object.keys(ANIMATION_CATEGORIES).indexOf(category);
        item.sortText = `${categoryIndex}${String(sortIndex).padStart(2, '0')}`;
        
        items.push(item);
        sortIndex++;
      }
    }

    return items;
  }

  /**
   * Get completions for icon component attribute names
   */
  private getAttributeCompletions(partialText: string, existingAttrs: Set<string>): vscode.CompletionItem[] {
    const nameAttr = getSvgConfig<string>('iconNameAttribute', 'name');
    
    // Build animation type hint from ANIMATION_CATEGORIES
    const allAnimations = Object.values(ANIMATION_CATEGORIES).flat();
    const animationTypeHint = allAnimations.slice(0, 6).join(' | ') + ' | ... (32 total)';
    
    const attributes = [
      { name: nameAttr, description: 'Icon name identifier', type: 'string', required: true },
      { name: 'variant', description: 'Color variant to apply', type: 'string' },
      { name: 'animation', description: 'Animation effect', type: animationTypeHint },
      { name: 'size', description: 'Icon size in pixels or CSS units', type: 'number | string' },
      { name: 'color', description: 'Icon color (overrides variant)', type: 'string' },
      { name: 'light-color', description: 'Color for light mode', type: 'string' },
      { name: 'dark-color', description: 'Color for dark mode', type: 'string' },
      { name: 'class', description: 'CSS class name', type: 'string' },
      { name: 'style', description: 'Inline CSS styles', type: 'string' }
    ];

    const items: vscode.CompletionItem[] = [];
    
    for (const attr of attributes) {
      // Skip if already exists in tag
      if (existingAttrs.has(attr.name)) continue;
      
      // Filter by partial text if provided
      if (partialText && !attr.name.toLowerCase().startsWith(partialText)) continue;
      
      const item = new vscode.CompletionItem(attr.name, vscode.CompletionItemKind.Property);
      item.detail = attr.type;
      item.documentation = new vscode.MarkdownString(`**${attr.name}**\n\n${attr.description}\n\nType: \`${attr.type}\``);
      
      // Insert attribute with quotes and place cursor inside
      item.insertText = new vscode.SnippetString(`${attr.name}="\${1}"`);
      item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Trigger Suggest'
      };
      
      // Required attributes first
      item.sortText = attr.required ? `0${attr.name}` : `1${attr.name}`;
      
      // Preselect variant and animation as they're common
      if (attr.name === 'variant' || attr.name === 'animation') {
        item.preselect = true;
      }
      
      items.push(item);
    }
    
    return items;
  }

  /**
   * Extract existing attributes from the current tag
   */
  private getExistingAttributes(linePrefix: string): Set<string> {
    const attrs = new Set<string>();
    // Match attribute="value" or attribute='value' patterns
    const attrRegex = /([a-z-]+)=["'][^"']*["']/gi;
    let match;
    while ((match = attrRegex.exec(linePrefix)) !== null) {
      attrs.add(match[1].toLowerCase());
    }
    return attrs;
  }

  private readVariantsFromFile(): Record<string, Record<string, string[]>> {
    try {
      const outputDir = getSvgConfig<string>('outputDirectory', '');
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || !outputDir) return {};
      
      const filePath = path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
      if (!fs.existsSync(filePath)) return {};
      
      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse: export const Variants = { ... }; (with flexible whitespace)
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*?\n\});?/);
      if (match) {
        // Safely evaluate the object literal
        try {
          return new Function(`return ${match[1]}`)();
        } catch (parseError) {
          console.error('Error parsing Variants object:', parseError);
          return {};
        }
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

