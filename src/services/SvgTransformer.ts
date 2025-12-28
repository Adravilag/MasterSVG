export interface TransformOptions {
  componentName: string;
  nameAttribute: string;
  format: string;
  optimizeSvg?: boolean;
}

export interface TransformResult {
  component: string;
  svg: string;
  iconName: string;
}

export class SvgTransformer {
  /**
   * Transform raw SVG to an Icon component
   */
  async transformToComponent(
    svg: string,
    iconName: string,
    options: TransformOptions
  ): Promise<TransformResult> {
    const { componentName, nameAttribute, format } = options;

    // Clean and optimize SVG
    const cleanedSvg = this.cleanSvg(svg);

    // Generate component based on format
    let component: string;

    switch (format) {
      case 'vue':
        component = this.generateVueComponent(iconName, componentName, nameAttribute);
        break;
      case 'svelte':
        component = this.generateSvelteComponent(iconName, componentName, nameAttribute);
        break;
      case 'astro':
        component = this.generateAstroComponent(iconName, componentName, nameAttribute);
        break;
      case 'html':
        component = this.generateHtmlComponent(iconName, componentName, nameAttribute);
        break;
      default: // jsx/tsx
        component = this.generateJsxComponent(iconName, componentName, nameAttribute);
    }

    return {
      component,
      svg: cleanedSvg,
      iconName
    };
  }

  /**
   * Extract icon name from file path or SVG content
   */
  extractIconName(input: string): string {
    // If it's a path, extract filename
    if (input.includes('/') || input.includes('\\')) {
      const parts = input.split(/[/\\]/);
      const filename = parts[parts.length - 1];
      return filename.replace('.svg', '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    // If it has a title or id, use that
    const titleMatch = input.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    const idMatch = input.match(/id=["']([^"']+)["']/);
    if (idMatch) {
      return idMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    return 'icon';
  }

  /**
   * Clean and normalize SVG content
   */
  cleanSvg(svg: string): string {
    return svg
      // Remove XML declaration
      .replace(/<\?xml[^>]*\?>/gi, '')
      // Remove DOCTYPE
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove unnecessary whitespace
      .replace(/\s+/g, ' ')
      // Remove editor metadata
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/data-name="[^"]*"/g, '')
      // Clean up attributes
      .replace(/xmlns:xlink="[^"]*"/g, '')
      .replace(/xml:space="[^"]*"/g, '')
      // Normalize
      .trim();
  }

  /**
   * Extract SVG body (content inside <svg> tags)
   * Also removes existing animation styles to prevent duplicates when rebuilding
   */
  extractSvgBody(svg: string): string {
    const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    let body = match ? match[1].trim() : svg;
    
    // Remove existing icon-manager-animation styles to prevent duplicates
    body = body.replace(/<style[^>]*id=["']icon-manager-animation["'][^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove animation wrapper groups (class="icon-anim-...")
    // First unwrap the content, then remove empty wrappers
    body = body.replace(/<g[^>]*class=["']icon-anim-\d+["'][^>]*>([\s\S]*?)<\/g>/gi, '$1');
    
    return body.trim();
  }

  /**
   * Extract SVG attributes (viewBox, etc.)
   */
  extractSvgAttributes(svg: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const svgTagMatch = svg.match(/<svg([^>]*)>/i);
    
    if (svgTagMatch) {
      const attrString = svgTagMatch[1];
      const attrRegex = /(\w+)=["']([^"']*)["']/g;
      let match;
      
      while ((match = attrRegex.exec(attrString)) !== null) {
        attrs[match[1]] = match[2];
      }
    }

    return attrs;
  }

  private generateJsxComponent(iconName: string, componentName: string, nameAttr: string): string {
    return `<${componentName} ${nameAttr}="${iconName}" />`;
  }

  private generateVueComponent(iconName: string, componentName: string, nameAttr: string): string {
    return `<${componentName} ${nameAttr}="${iconName}" />`;
  }

  private generateSvelteComponent(iconName: string, componentName: string, nameAttr: string): string {
    return `<${componentName} ${nameAttr}="${iconName}" />`;
  }

  private generateAstroComponent(iconName: string, componentName: string, nameAttr: string): string {
    return `<${componentName} ${nameAttr}="${iconName}" />`;
  }

  private generateHtmlComponent(iconName: string, componentName: string, nameAttr: string): string {
    // Convert PascalCase/camelCase to kebab-case for Web Component
    let tagName = componentName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
    
    // Custom elements MUST have a hyphen
    if (!tagName.includes('-')) {
      tagName = `${tagName}-icon`;
    }
    
    return `<${tagName} ${nameAttr}="${iconName}"></${tagName}>`;
  }

  /**
   * Batch transform multiple SVG files
   */
  async batchTransform(
    svgFiles: Array<{ path: string; content: string }>,
    options: TransformOptions
  ): Promise<TransformResult[]> {
    const results: TransformResult[] = [];

    for (const file of svgFiles) {
      const iconName = this.extractIconName(file.path);
      const result = await this.transformToComponent(file.content, iconName, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate icons.ts/json export file
   */
  generateIconsFile(
    icons: Array<{ name: string; svg: string }>,
    format: 'ts' | 'json' | 'js'
  ): string {
    if (format === 'json') {
      return JSON.stringify(icons, null, 2);
    }

    const exports = icons.map(icon => {
      const varName = this.toVariableName(icon.name);
      const body = this.extractSvgBody(icon.svg);
      const attrs = this.extractSvgAttributes(icon.svg);
      
      return `export const ${varName} = {
  name: '${icon.name}',
  body: \`${body}\`,
  viewBox: '${attrs.viewBox || '0 0 24 24'}'
};`;
    }).join('\n\n');

    const allNames = icons.map(i => this.toVariableName(i.name)).join(',\n  ');

    return `// Auto-generated by Icon Manager
// Do not edit manually

${exports}

export const icons = {
  ${allNames}
};

export type IconName = keyof typeof icons;
`;
  }

  private toVariableName(name: string): string {
    // Convert icon-name to iconName
    return name
      .split(/[-:]/)
      .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}
