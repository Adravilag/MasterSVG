import { SvgTransformOptions, SvgTransformResult } from '../types/mastersvgTypes';

export class SvgTransformer {
  /**
   * Transforma un SVG plano en un componente o etiqueta JSX según el formato.
   */
  async transformToComponent(
    svg: string,
    iconName: string,
    options: SvgTransformOptions
  ): Promise<SvgTransformResult> {
    const { componentName = 'Icon', format = 'react' } = options;

    const cleanedSvg = this.cleanSvg(svg);
    const innerContent = this.extractSvgBody(cleanedSvg);
    const attributes = this.extractSvgAttributes(cleanedSvg);
    const viewBox = attributes.viewBox || '0 0 24 24';

    // Para la transformación desde el editor queremos devolver el tag de uso
    // (ej. <Icon name="home" />) en los formatos soportados por la UI.
    const usageFormats = new Set(['react', 'jsx', 'vue', 'svelte', 'astro']);
    let component: string;
    if (format === 'html') {
      // For HTML/Iconify usage we use the web component tag 'icon-icon' by convention
      component = this.generateUsageTag(iconName, 'icon-icon', options.nameAttribute || 'name');
    } else {
      component = usageFormats.has(format)
        ? this.generateUsageTag(iconName, componentName, options.nameAttribute || 'name')
        : this.generateUsageTag(iconName, componentName, options.nameAttribute || 'name');
    }

    return { component, svg: cleanedSvg, iconName };
  }

  // --- GENERADORES DE CÓDIGO ---

  private generateReactComponent(name: string, inner: string, viewBox: string): string {
    return `import React from 'react';

export const ${name} = ({ size = "1em", color = "currentColor", ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="${viewBox}" fill={color} {...props}>
    ${this.convertToJSX(inner)}
  </svg>
);`;
  }

  private generateVueComponent(inner: string, viewBox: string): string {
    return `<template>
  <svg width="size" height="size" viewBox="${viewBox}" :fill="color" v-bind="$attrs">
    ${inner}
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: '1em' },
  color: { type: String, default: 'currentColor' }
});
</script>`;
  }

  private generateSvelteComponent(inner: string, viewBox: string): string {
    return `<script>
  export let size = '1em';
  export let color = 'currentColor';
</script>

<svg width={size} height={size} viewBox="${viewBox}" fill={color} {...$$restProps}>
  ${inner}
</svg>`;
  }

  private generateAstroComponent(inner: string, viewBox: string): string {
    return `---
const { size = "1em", color = "currentColor", ...props } = Astro.props;
---
<svg width={size} height={size} viewBox="${viewBox}" fill={color} {...props}>
  ${inner}
</svg>`;
  }

  // --- UTILIDADES DE PROCESAMIENTO ---

  cleanSvg(svg: string): string {
    return svg
      .replace(/<\?xml[^>]*\?>/gi, '') // Eliminar declaración XML
      .replace(/<!DOCTYPE[^>]*>/gi, '') // Eliminar DOCTYPE
      .replace(/<!--[\s\S]*?-->/g, '') // Eliminar comentarios
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '') // Eliminar metadatos
      .replace(/\s(xmlns|xml:space|data-name|version)="[^"]*"/g, '') // Atributos innecesarios
      .replace(/\s+/g, ' ') // Colapsar espacios
      .trim();
  }

  extractSvgBody(svg: string): string {
    const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    let body = match ? match[1].trim() : svg;

    // Si detectamos JSX previo (ej. className), lo normalizamos a SVG plano
    if (body.includes('className=')) {
        body = body.replace(/className=/g, 'class=');
    }
    // Eliminar estilos de animación específicos del gestor
    body = body.replace(/<style[^>]*id=["']icon-manager-animation["'][^>]*>[\s\S]*?<\/style>/gi, '');
    // Eliminar reglas @keyframes residuales
    body = body.replace(/@keyframes[\s\S]*?\}/gi, '');
    // Eliminar wrappers de animación <g class="icon-anim-...">...</g> conservando su contenido
    body = body.replace(/<g[^>]*class=["'][^"']*icon-anim-[^"']*["'][^>]*>([\s\S]*?)<\/g>/gi, '$1');

    return body.replace(/>\s+</g, '><').trim();
  }

  extractSvgAttributes(svg: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const svgTagMatch = svg.match(/<svg([^>]*)>/i);
    if (svgTagMatch) {
      const attrRegex = /([\w-]+)=["']([^"']*)["']/g;
      let match;
      while ((match = attrRegex.exec(svgTagMatch[1])) !== null) {
        attrs[match[1]] = match[2];
      }
    }
    return attrs;
  }

  private convertToJSX(content: string): string {
    // Mapa de atributos para compatibilidad con React
    const MAP: Record<string, string> = {
      'stroke-width': 'strokeWidth',
      'stroke-linecap': 'strokeLinecap',
      'stroke-linejoin': 'strokeLinejoin',
      'fill-rule': 'fillRule',
      'clip-rule': 'clipRule',
      'class': 'className'
    };

    return content.replace(/([\w-]+)=/g, (match, key) => {
      return MAP[key] ? ` ${MAP[key]}=` : match;
    });
  }

  private generateUsageTag(iconName: string, componentName: string, nameAttr: string): string {
    return `<${componentName} ${nameAttr}="${iconName}" />`;
  }

  // =====================================================
  // Métodos adicionales requeridos por tests
  // =====================================================

  extractIconName(input: string): string {
    const trimmed = input.trim();
    // Si el contenido parece un SVG (empieza por '<'), tratar como contenido, no como path
    if (trimmed.startsWith('<')) {
      return 'svg-';
    }

    // Si parece una ruta de archivo
    if (input.includes('/') || input.includes('\\')) {
      const parts = input.replace(/\\/g, '/').split('/');
      let filename = parts[parts.length - 1];
      // eliminar extensión
      filename = filename.replace(/\.svg$/i, '');
      // reemplazar separadores y caracteres especiales por guiones
      filename = filename.replace(/[^a-zA-Z0-9]+/g, '-');
      // eliminar guiones duplicados y guiones al inicio/fin
      filename = filename.replace(/-+/g, '-').replace(/^-|-$/g, '');
      return filename.toLowerCase();
    }
    // Para cualquier otro caso, devolver el prefijo por defecto
    return 'svg-';
  }

  async batchTransform(
    files: Array<{ path?: string; content: string }>,
    options: SvgTransformOptions
  ): Promise<Array<SvgTransformResult>> {
    if (!files || files.length === 0) return [];

    const results: SvgTransformResult[] = [];
    for (const f of files) {
      const name = f.path ? this.extractIconName(f.path) : this.extractIconName(f.content);
      // Reuse transformToComponent
      const res = await this.transformToComponent(f.content, name, options);
      results.push(res);
    }
    return results;
  }

  generateIconsFile(
    icons: Array<{ name: string; svg: string }>,
    format: 'json' | 'ts' | 'js' = 'ts'
  ): string {
    const DEFAULT_VIEWBOX = '0 0 24 24';

    if (format === 'json') {
      return JSON.stringify(icons);
    }

    const header = `// Auto-generated by MasterSVG - Do not edit manually\n`;

    const toVarName = (name: string) => {
      return name
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((s, i) => (i === 0 ? s.toLowerCase() : s[0].toUpperCase() + s.slice(1).toLowerCase()))
        .join('');
    };

    const lines: string[] = [header];

    for (const icon of icons) {
      const attrs = this.extractSvgAttributes(icon.svg);
      const viewBox = attrs.viewBox || DEFAULT_VIEWBOX;
      const body = this.extractSvgBody(this.cleanSvg(icon.svg));
      const varName = toVarName(icon.name);

      const obj = format === 'ts'
        ? `export const ${varName} = { name: '${icon.name}', viewBox: '${viewBox}', body: ` + "`" + `${body}` + "`" + ' };'
        : `export const ${varName} = { name: '${icon.name}', viewBox: '${viewBox}', body: ` + "`" + `${body}` + "`" + ' };';

      lines.push(obj);
    }

    if (format === 'ts') {
      // export icons array and type
      lines.push('\nexport const icons = [' + icons.map(i => toVarName(i.name)).join(', ') + '];');
      const union = icons.map(i => `'${i.name}'`).join(' | ');
      lines.push(`export type IconName = ${union};`);
    } else {
      lines.push('\nexport const icons = [' + icons.map(i => toVarName(i.name)).join(', ') + '];');
    }

    return lines.join('\n');
  }
}
