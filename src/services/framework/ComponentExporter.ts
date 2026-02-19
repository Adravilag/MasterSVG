import {
  ComponentFormat as CentralizedComponentFormat,
  ComponentExportOptions,
  ComponentExportResult,
  CodeLanguage
} from '../types/mastersvgTypes';

// Templates
import * as T from './templates';

// Aliases para compatibilidad
export type ComponentFormat = CentralizedComponentFormat;
export type ExportOptions = ComponentExportOptions;
export type ExportResult = ComponentExportResult;

// Firma de función para el mapa de estrategias
type IconTemplateFn = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions,
  innerContent?: string
) => string;

export class ComponentExporter {
  /**
   * Mapa de despacho de estrategias.
   * Evita el uso de Switch y reduce la complejidad ciclomática.
   */
  private readonly templateMap: Record<string, IconTemplateFn> = {
    react: T.reactTemplate,
    preact: T.preactTemplate,
    vue: T.vueTemplate,
    'vue-sfc': T.vueSfcTemplate,
    svelte: T.svelteTemplate,
    angular: T.angularTemplate,
    solid: T.solidTemplate,
    qwik: T.qwikTemplate,
    lit: T.litTemplate,
  };

  /**
   * Exporta el SVG al formato de componente especificado.
   */
  export(options: ExportOptions): ExportResult {
    const { format, iconName, svg, typescript: ts = false } = options;
    const componentName = options.componentName || this.toPascalCase(iconName);

    // Parsing inicial común
    const { attributes, innerContent } = this.parseSvg(svg);
    const viewBox = attributes.viewBox || '0 0 24 24';

    // Caso especial: React Native (Inyecta paths directamente en lugar de Sprite)
    if (format === 'react-native') {
      const rnBody = this.convertToReactNative(innerContent, 'color');
      const code = T.reactNativeTemplate(componentName, viewBox, iconName, rnBody, options);
      return {
        code,
        filename: `${componentName}.${ts ? 'tsx' : 'jsx'}`,
        language: (ts ? 'typescriptreact' : 'javascriptreact') as CodeLanguage,
      };
    }

    // Caso general: Uso de estrategias de Sprite
    const templateFn = this.templateMap[format];
    if (!templateFn) {
      throw new Error(`Unsupported format: ${format}`);
    }

    return {
      code: templateFn(componentName, viewBox, iconName, options, innerContent),
      filename: this.resolveFilename(componentName, format, ts),
      language: this.resolveLanguage(format, ts),
    };
  }

  /**
   * Helpers de Resolución con Tipado Estricto
   */
  private resolveFilename(name: string, format: string, ts: boolean): string {
    if (format === 'vue' || format === 'vue-sfc') return `${name}.vue`;
    if (format === 'svelte') return `${name}.svelte`;
    if (format === 'angular') return `${this.toKebabCase(name)}.component.ts`;
    if (format === 'lit') return `${this.toKebabCase(name)}.ts`;
    return `${name}.${ts ? 'tsx' : 'jsx'}`;
  }

  private resolveLanguage(format: string, ts: boolean): CodeLanguage {
    if (format.includes('vue')) return 'vue' as CodeLanguage;
    if (format === 'svelte') return 'svelte' as CodeLanguage;
    if (format === 'angular' || format === 'lit') return 'typescript' as CodeLanguage;

    const lang = ts ? 'typescriptreact' : 'javascriptreact';
    return lang as CodeLanguage;
  }

  /**
   * Parsing & Transformación
   */
  private parseSvg(svg: string): { attributes: Record<string, string>; innerContent: string } {
    const attributes: Record<string, string> = {};
    const svgTagMatch = svg.match(/<svg([^>]*)>/i);

    if (svgTagMatch) {
      const attrRegex = /(\w+[-\w]*)=["']([^"']*)["']/g;
      let match;
      while ((match = attrRegex.exec(svgTagMatch[1])) !== null) {
        attributes[match[1]] = match[2];
      }
    }

    const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return { attributes, innerContent: innerMatch ? innerMatch[1].trim() : '' };
  }

  private convertToReactNative(content: string, colorVar: string): string {
    return content
      .replace(/<(path|circle|rect|line|polyline|polygon|g)/gi, (m) => m.charAt(0) + m.charAt(1).toUpperCase() + m.slice(2))
      .replace(/<\/(path|circle|rect|line|polyline|polygon|g)>/gi, (m) => m.slice(0, 2) + m.charAt(2).toUpperCase() + m.slice(3))
      .replace(/stroke="currentColor"/g, `stroke={${colorVar}}`)
      .replace(/stroke="[^"]+"/g, `stroke={${colorVar}}`)
      .replace(/(stroke-width|stroke-linecap|stroke-linejoin|fill-rule)=/g, (m) => {
        return m.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace('=', '=');
      });
  }

  private toPascalCase(str: string): string {
    return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
  }

  getFormats(): { id: ComponentFormat; name: string; description: string }[] {
    return [
      { id: 'react', name: 'React', description: 'Functional component (SVG Sprite)' },
      { id: 'react-native', name: 'React Native', description: 'Native SVG component (Direct Paths)' },
      { id: 'vue', name: 'Vue 3 (Composition)', description: 'Script setup with Sprite' },
      { id: 'vue-sfc', name: 'Vue SFC', description: 'Options API with Sprite' },
      { id: 'svelte', name: 'Svelte', description: 'Svelte component (Sprite)' },
      { id: 'angular', name: 'Angular', description: 'Standalone component (Sprite)' },
      { id: 'solid', name: 'SolidJS', description: 'Solid component (Sprite)' },
      { id: 'qwik', name: 'Qwik', description: 'Qwik component (Sprite)' },
      { id: 'preact', name: 'Preact', description: 'Preact component (Sprite)' },
      { id: 'lit', name: 'Lit', description: 'Web Component (Sprite)' },
    ];
  }
}

let exporterInstance: ComponentExporter | undefined;
export function getComponentExporter(): ComponentExporter {
  if (!exporterInstance) exporterInstance = new ComponentExporter();
  return exporterInstance;
}
