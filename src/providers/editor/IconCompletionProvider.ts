import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSvgProvider } from '../tree/WorkspaceSvgProvider';
import { getSvgConfig } from '../../utils/config';
import { ANIMATION_CATEGORIES, ANIMATION_KEYFRAMES } from '../../services/animation/AnimationKeyframes';
import { AnimationPreset, getVariantsService } from '../../services/icon/VariantsService';

interface AnimationItemParams {
  animName: string;
  category: string;
  sortIndex: number;
  iconSvg: string | undefined;
  animationMeta: Record<string, { description: string; icon: string }>;
  categoryLabels: Record<string, string>;
}

interface AnimationDocParams {
  animName: string;
  meta: { description: string; icon: string };
  category: string;
  categoryLabels: Record<string, string>;
  iconSvg: string | undefined;
}

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
    const config = this.getCompletionConfig();

    // Try each completion type in order
    const attrResult = this.tryAttributeCompletion(linePrefix, config);
    if (attrResult) return attrResult;

    const variantResult = this.tryVariantCompletion(linePrefix, fullLine, config);
    if (variantResult) return variantResult;

    const animResult = this.tryAnimationCompletion(linePrefix, fullLine, config);
    if (animResult) return animResult;

    return this.tryIconNameCompletion(linePrefix, config);
  }

  private getCompletionConfig(): { componentName: string; webComponentName: string; nameAttr: string } {
    return {
      componentName: getSvgConfig<string>('componentName', 'Icon'),
      webComponentName: getSvgConfig<string>('webComponentName', 'svg-icon'),
      nameAttr: getSvgConfig<string>('iconNameAttribute', 'name'),
    };
  }

  private tryAttributeCompletion(
    linePrefix: string,
    config: { componentName: string; webComponentName: string }
  ): vscode.CompletionItem[] | null {
    const iconTagPatterns = [
      new RegExp(`<${config.componentName}[^>]*\\s+$`),
      new RegExp(`<${config.webComponentName}[^>]*\\s+$`),
      new RegExp(`<${config.componentName}[^>]*\\s+[a-z]*$`, 'i'),
      new RegExp(`<${config.webComponentName}[^>]*\\s+[a-z]*$`, 'i'),
    ];

    if (!iconTagPatterns.some(p => p.test(linePrefix))) return null;

    const partialAttrMatch = linePrefix.match(/\s+([a-z]*)$/i);
    const partialText = partialAttrMatch ? partialAttrMatch[1].toLowerCase() : '';
    const existingAttrs = this.getExistingAttributes(linePrefix);
    return this.getAttributeCompletions(partialText, existingAttrs);
  }

  private tryVariantCompletion(
    linePrefix: string,
    fullLine: string,
    config: { componentName: string; webComponentName: string; nameAttr: string }
  ): vscode.CompletionItem[] | null {
    const variantPatterns = [
      new RegExp(`<${config.componentName}[^>]*variant=["']$`),
      new RegExp(`<${config.webComponentName}[^>]*variant=["']$`),
      /variant=["']$/,
    ];

    if (!variantPatterns.some(p => p.test(linePrefix))) return null;

    const iconNameMatch = fullLine.match(new RegExp(`${config.nameAttr}=["']([^"']+)["']`));
    return this.getVariantCompletions(iconNameMatch ? iconNameMatch[1] : null);
  }

  private tryAnimationCompletion(
    linePrefix: string,
    fullLine: string,
    config: { componentName: string; webComponentName: string; nameAttr: string }
  ): vscode.CompletionItem[] | null {
    const animationPatterns = [
      new RegExp(`<${config.componentName}[^>]*animation=["']$`),
      new RegExp(`<${config.webComponentName}[^>]*animation=["']$`),
      /animation=["']$/,
    ];

    if (!animationPatterns.some(p => p.test(linePrefix))) return null;

    const iconNameMatch = fullLine.match(new RegExp(`${config.nameAttr}=["']([^"']+)["']`));
    return this.getAnimationCompletions(iconNameMatch ? iconNameMatch[1] : null);
  }

  private async tryIconNameCompletion(
    linePrefix: string,
    config: { componentName: string; webComponentName: string; nameAttr: string }
  ): Promise<vscode.CompletionItem[]> {
    const patterns = [
      new RegExp(`<${config.componentName}[^>]*${config.nameAttr}=["']$`),
      new RegExp(`<${config.webComponentName}[^>]*${config.nameAttr}=["']$`),
      new RegExp(`<iconify-icon[^>]*icon=["']$`),
      new RegExp(`${config.nameAttr}=["']$`),
      /icon=["']$/,
    ];

    if (!patterns.some(p => p.test(linePrefix))) return [];

    return this.buildIconCompletionItems();
  }

  private async buildIconCompletionItems(): Promise<vscode.CompletionItem[]> {
    const icons = await this.svgProvider.getAllIcons();
    return icons.map(icon => this.createIconCompletionItem(icon));
  }

  private createIconCompletionItem(icon: { name: string; source: string; category?: string; path: string; svg?: string }): vscode.CompletionItem {
    const item = new vscode.CompletionItem(icon.name, vscode.CompletionItemKind.Value);
    item.detail = `${icon.source} - ${icon.category || 'uncategorized'}`;

    if (icon.svg) {
      const svgPreview = this.createSvgPreview(icon.svg);
      item.documentation = new vscode.MarkdownString(`${svgPreview}\n\n**${icon.name}**\n\nSource: ${icon.source}`);
      item.documentation.supportHtml = true;
      item.documentation.isTrusted = true;
    } else {
      item.documentation = new vscode.MarkdownString(`**${icon.name}**\n\nSource: ${icon.source}\nPath: ${icon.path}`);
    }

    item.sortText = icon.source === 'workspace' ? `0${icon.name}` : `1${icon.name}`;
    return item;
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
   * Create rich documentation for variant with color swatches and preview
   */
  private createVariantDocumentation(
    variantName: string,
    colors: string[],
    iconName?: string
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.supportThemeIcons = true;
    md.isTrusted = true;

    // Add SVG preview with variant colors applied
    if (iconName) {
      const icon = this.svgProvider.getIcon(iconName);
      if (icon?.svg) {
        const preview = this.createVariantSvgPreview(icon.svg, iconName, variantName);
        md.appendMarkdown(preview + '\n\n');
      }
    }

    md.appendMarkdown(`**🎨 ${variantName}**\n\n`);

    // Color swatches
    const colorSwatches = colors
      .map(color => {
        const safeColor = color.replace(/[^#a-fA-F0-9,()rgb]/g, '');
        return `<span style="background-color:${safeColor};color:${safeColor};border:1px solid #888;border-radius:2px;">&nbsp;&nbsp;&nbsp;</span> \`${color}\``;
      })
      .join('\n\n');

    md.appendMarkdown(`**Colors:**\n\n${colorSwatches}\n\n`);
    md.appendMarkdown(`---\n*Use \`variant="${variantName}"\` to apply*`);
    return md;
  }

  /**
   * Create SVG preview with variant colors applied
   */
  private createVariantSvgPreview(svg: string, iconName: string, variantName: string): string {
    const size = 48;

    // Read variants data
    const variantsData = this.readVariantsFromFile();
    const iconVariants = variantsData[iconName];

    if (!iconVariants) {
      return this.createSvgPreview(svg);
    }

    const originalColors = iconVariants['_original'] || [];
    const variantColors = iconVariants[variantName] || [];

    // Apply color replacements
    let modifiedSvg = svg;
    for (let i = 0; i < originalColors.length && i < variantColors.length; i++) {
      const original = originalColors[i];
      const replacement = variantColors[i];
      const colorRegex = new RegExp(this.escapeRegex(original), 'gi');
      modifiedSvg = modifiedSvg.replace(colorRegex, replacement);
    }

    // Clean and format SVG
    const viewBoxMatch = modifiedSvg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

    let cleanSvg = modifiedSvg
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '')
      .replace(/\s+class="[^"]*"/g, '');

    if (!cleanSvg.includes('viewBox')) {
      cleanSvg = cleanSvg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
    }

    cleanSvg = cleanSvg.replace(/<svg/, `<svg width="${size}" height="${size}"`);

    const encoded = encodeURIComponent(cleanSvg).replace(/'/g, '%27').replace(/"/g, '%22');

    return `![icon](data:image/svg+xml,${encoded})`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getAnimationCompletions(iconName: string | null): vscode.CompletionItem[] {
    const iconSvg = iconName ? this.svgProvider.getIcon(iconName)?.svg : undefined;
    const items = this.buildCategoryAnimationItems(iconSvg);
    this.addIconAnimationPresets(items, iconName, iconSvg);
    return items;
  }

  private getAnimationMeta(): Record<string, { description: string; icon: string }> {
    return {
      none: { description: 'No animation', icon: '⏹️' },
      spin: { description: 'Continuous 360° rotation', icon: '🔄' },
      'spin-reverse': { description: 'Counter-clockwise rotation', icon: '🔃' },
      pulse: { description: 'Scale up/down with opacity', icon: '💓' },
      'pulse-grow': { description: 'Scale up and down', icon: '📈' },
      bounce: { description: 'Vertical bouncing', icon: '⬆️' },
      'bounce-horizontal': { description: 'Horizontal bouncing', icon: '↔️' },
      shake: { description: 'Horizontal shaking', icon: '↔️' },
      'shake-vertical': { description: 'Vertical shaking', icon: '↕️' },
      fade: { description: 'Fade in and out', icon: '👻' },
      float: { description: 'Gentle floating', icon: '🎈' },
      blink: { description: 'Blink on/off', icon: '💡' },
      glow: { description: 'Glowing effect', icon: '✨' },
      swing: { description: 'Pendulum swing', icon: '🎐' },
      wobble: { description: 'Wobbly motion', icon: '〰️' },
      'rubber-band': { description: 'Rubber band stretch', icon: '🔗' },
      jello: { description: 'Jello wiggle', icon: '🟡' },
      heartbeat: { description: 'Double-pulse heartbeat', icon: '❤️' },
      tada: { description: 'Celebration effect', icon: '🎉' },
      'fade-in': { description: 'Fade in from transparent', icon: '🌅' },
      'fade-out': { description: 'Fade out to transparent', icon: '🌆' },
      'zoom-in': { description: 'Zoom in from small', icon: '🔍' },
      'zoom-out': { description: 'Zoom out to small', icon: '🔎' },
      'slide-in-up': { description: 'Slide in from bottom', icon: '⬆️' },
      'slide-in-down': { description: 'Slide in from top', icon: '⬇️' },
      'slide-in-left': { description: 'Slide in from left', icon: '⬅️' },
      'slide-in-right': { description: 'Slide in from right', icon: '➡️' },
      flip: { description: 'Flip on Y axis', icon: '🔀' },
      'flip-x': { description: 'Flip on X axis', icon: '🔁' },
      draw: { description: 'Draw stroke animation', icon: '✏️' },
      'draw-reverse': { description: 'Undraw stroke animation', icon: '🧹' },
      'draw-loop': { description: 'Draw and undraw loop', icon: '🔄' },
      custom: { description: 'Custom CSS animation (define your own keyframes)', icon: '🎨' },
    };
  }

  private getCategoryLabels(): Record<string, string> {
    return {
      basic: '🎯 Basic',
      attention: '👀 Attention',
      entrance: '🚪 Entrance/Exit',
      draw: '✏️ Draw',
      custom: '🎨 Custom',
    };
  }

  private buildCategoryAnimationItems(iconSvg: string | undefined): vscode.CompletionItem[] {
    const animationMeta = this.getAnimationMeta();
    const categoryLabels = this.getCategoryLabels();
    const items: vscode.CompletionItem[] = [];
    let sortIndex = 0;

    for (const [category, animations] of Object.entries(ANIMATION_CATEGORIES)) {
      for (const animName of animations) {
        const item = this.createAnimationItem({ animName, category, sortIndex, iconSvg, animationMeta, categoryLabels });
        items.push(item);
        sortIndex++;
      }
    }
    return items;
  }

  private createAnimationItem(params: AnimationItemParams): vscode.CompletionItem {
    const { animName, category, sortIndex, iconSvg, animationMeta, categoryLabels } = params;
    const meta = animationMeta[animName] || { description: animName, icon: '🎬' };
    const item = new vscode.CompletionItem(animName, vscode.CompletionItemKind.EnumMember);
    item.detail = `${meta.icon} ${meta.description}`;
    item.documentation = this.buildAnimationDocumentation({ animName, meta, category, categoryLabels, iconSvg });
    const categoryIndex = Object.keys(ANIMATION_CATEGORIES).indexOf(category);
    item.sortText = `${categoryIndex}${String(sortIndex).padStart(2, '0')}`;
    return item;
  }

  private buildAnimationDocumentation(params: AnimationDocParams): vscode.MarkdownString {
    const { animName, meta, category, categoryLabels, iconSvg } = params;
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    if (iconSvg && animName !== 'none') {
      md.appendMarkdown(this.createAnimatedSvgPreview(iconSvg, animName) + '\n\n');
    }
    md.appendMarkdown(`${meta.icon} **${animName}**\n\n`);
    md.appendMarkdown(`${meta.description}\n\n`);
    md.appendMarkdown(`*Category: ${categoryLabels[category] || category}*\n\n`);
    md.appendMarkdown(`---\n*Use \`animation="${animName}"\` to apply*`);
    return md;
  }

  private addIconAnimationPresets(
    items: vscode.CompletionItem[],
    iconName: string | null,
    iconSvg: string | undefined
  ): void {
    if (!iconName) return;

    const variantsService = getVariantsService();
    const iconPresets = variantsService.getAnimationPresets(iconName);
    if (iconPresets.length === 0) return;

    const separatorItem = new vscode.CompletionItem('─ Animaciones del icono ─', vscode.CompletionItemKind.Text);
    separatorItem.sortText = '999animation-header';
    items.push(separatorItem);

    iconPresets.forEach((preset: AnimationPreset, idx: number) => {
      items.push(this.createPresetItem(preset, idx, iconSvg));
    });
  }

  private createPresetItem(preset: AnimationPreset, idx: number, iconSvg: string | undefined): vscode.CompletionItem {
    const item = new vscode.CompletionItem(preset.name, vscode.CompletionItemKind.Variable);
    item.detail = `🎨 Animación: ${preset.type}`;
    item.documentation = this.buildPresetDocumentation(preset, iconSvg);
    item.sortText = `999animation-${String(idx).padStart(2, '0')}-${preset.name}`;
    return item;
  }

  private buildPresetDocumentation(preset: AnimationPreset, iconSvg: string | undefined): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    if (iconSvg && preset.type !== 'none') {
      md.appendMarkdown(this.createAnimatedSvgPreview(iconSvg, preset.type) + '\n\n');
    }
    md.appendMarkdown(`🎨 **${preset.name}**\n\n`);
    md.appendMarkdown(`*Animación: ${preset.type}*\n\n`);

    if (preset.duration) md.appendMarkdown(`• Duración: ${preset.duration}s\n`);
    if (preset.delay) md.appendMarkdown(`• Retardo: ${preset.delay}s\n`);
    if (preset.iteration) md.appendMarkdown(`• Repeticiones: ${preset.iteration}\n`);
    if (preset.timing) md.appendMarkdown(`• Tiempo: ${preset.timing}\n`);

    md.appendMarkdown(`\n---\n*Usa \`animation="${preset.name}"\` para aplicar*`);
    return md;
  }

  /**
   * Get completions for icon component attribute names
   */
  private getAttributeCompletions(
    partialText: string,
    existingAttrs: Set<string>
  ): vscode.CompletionItem[] {
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
      { name: 'style', description: 'Inline CSS styles', type: 'string' },
    ];

    const items: vscode.CompletionItem[] = [];

    for (const attr of attributes) {
      // Skip if already exists in tag
      if (existingAttrs.has(attr.name)) continue;

      // Filter by partial text if provided
      if (partialText && !attr.name.toLowerCase().startsWith(partialText)) continue;

      const item = new vscode.CompletionItem(attr.name, vscode.CompletionItemKind.Property);
      item.detail = attr.type;
      item.documentation = new vscode.MarkdownString(
        `**${attr.name}**\n\n${attr.description}\n\nType: \`${attr.type}\``
      );

      // Insert attribute with quotes and place cursor inside
      item.insertText = new vscode.SnippetString(`${attr.name}="\${1}"`);
      item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Trigger Suggest',
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
        } catch {
          // Failed to parse Variants object
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

  /**
   * Create an animated SVG preview for the completion hover
   */
  private createAnimatedSvgPreview(svg: string, animationName: string): string {
    const size = 48;

    // Extract viewBox if present
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

    // Clean SVG
    let cleanSvg = svg
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '')
      .replace(/\s+class="[^"]*"/g, '');

    // Ensure viewBox is set
    if (!cleanSvg.includes('viewBox')) {
      cleanSvg = cleanSvg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
    }

    // Add width/height
    cleanSvg = cleanSvg.replace(/<svg/, `<svg width="${size}" height="${size}"`);

    // Add animation if keyframes exist
    const keyframes = ANIMATION_KEYFRAMES[animationName];
    if (keyframes) {
      const duration = this.getAnimationDuration(animationName);
      const timing = this.getAnimationTiming(animationName);

      const styleContent = `
        ${keyframes}
        svg { animation: ${animationName} ${duration} ${timing} infinite; }
      `.trim();

      cleanSvg = cleanSvg.replace(/<svg([^>]*)>/, `<svg$1><style>${styleContent}</style>`);
    }

    // URL encode for data URI
    const encoded = encodeURIComponent(cleanSvg).replace(/'/g, '%27').replace(/"/g, '%22');

    return `![icon](data:image/svg+xml,${encoded})`;
  }

  private getAnimationDuration(animationType: string): string {
    const fastAnimations = ['spin', 'spin-reverse', 'blink'];
    const slowAnimations = ['float', 'fade', 'glow'];

    if (fastAnimations.includes(animationType)) return '1s';
    if (slowAnimations.includes(animationType)) return '2s';
    return '1.5s';
  }

  private getAnimationTiming(animationType: string): string {
    const linearAnimations = ['spin', 'spin-reverse'];
    const easeOutAnimations = ['bounce', 'bounce-horizontal', 'slide-in-up', 'slide-in-down'];

    if (linearAnimations.includes(animationType)) return 'linear';
    if (easeOutAnimations.includes(animationType)) return 'ease-out';
    return 'ease-in-out';
  }
}
