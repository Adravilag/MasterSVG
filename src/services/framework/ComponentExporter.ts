import {
  ComponentFormat as CentralizedComponentFormat,
  ComponentExportOptions,
  ComponentExportResult,
} from '../types/mastersvgTypes';

// Re-export centralized types with local aliases for backwards compatibility
export type ComponentFormat = CentralizedComponentFormat;
export type ExportOptions = ComponentExportOptions;
export type ExportResult = ComponentExportResult

export class ComponentExporter {
  /**
   * Export SVG to component in specified format
   */
  export(options: ExportOptions): ExportResult {
    const { format, typescript: _typescript } = options;

    switch (format) {
      case 'react':
      case 'preact':
        return this.exportReact(options);
      case 'react-native':
        return this.exportReactNative(options);
      case 'vue':
        return this.exportVueComposition(options);
      case 'vue-sfc':
        return this.exportVueSFC(options);
      case 'svelte':
        return this.exportSvelte(options);
      case 'angular':
        return this.exportAngular(options);
      case 'solid':
        return this.exportSolid(options);
      case 'qwik':
        return this.exportQwik(options);
      case 'lit':
        return this.exportLit(options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get all available formats
   */
  getFormats(): { id: ComponentFormat; name: string; description: string }[] {
    return [
      { id: 'react', name: 'React', description: 'React functional component with props spread' },
      { id: 'react-native', name: 'React Native', description: 'React Native SVG component' },
      { id: 'vue', name: 'Vue 3 (Composition)', description: 'Vue 3 with script setup' },
      { id: 'vue-sfc', name: 'Vue SFC', description: 'Vue Single File Component' },
      { id: 'svelte', name: 'Svelte', description: 'Svelte component' },
      { id: 'angular', name: 'Angular', description: 'Angular component with @Input' },
      { id: 'solid', name: 'SolidJS', description: 'Solid component' },
      { id: 'qwik', name: 'Qwik', description: 'Qwik component' },
      { id: 'preact', name: 'Preact', description: 'Preact functional component' },
      { id: 'lit', name: 'Lit', description: 'Lit web component' },
    ];
  }

  // ==================== React ====================

  private exportReact(options: ExportOptions): ExportResult {
    const {
      iconName,
      svg,
      typescript,
      memo,
      forwardRef,
      exportType,
      defaultSize = 24,
      defaultColor = 'currentColor',
    } = options;
    const componentName = this.toPascalCase(iconName);
    const ext = typescript ? 'tsx' : 'jsx';

    // Parse SVG and extract attributes
    const { attributes, innerContent } = this.parseSvg(svg);

    // Build props interface
    const propsType = typescript
      ? `interface ${componentName}Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}`
      : '';

    // Build component
    let code = '';

    if (typescript) {
      code += `import React from 'react';\n\n`;
      code += propsType + '\n\n';
    } else {
      code += `import React from 'react';\n\n`;
    }

    const propsArg = typescript
      ? `{ size = ${defaultSize}, color = '${defaultColor}', ...props }: ${componentName}Props`
      : `{ size = ${defaultSize}, color = '${defaultColor}', ...props }`;

    if (forwardRef) {
      const refType = typescript ? `React.Ref<SVGSVGElement>` : '';
      code += `const ${componentName} = React.forwardRef${typescript ? `<SVGSVGElement, ${componentName}Props>` : ''}((${propsArg}, ref${typescript ? `: ${refType}` : ''}) => (\n`;
    } else {
      code += `const ${componentName} = (${propsArg}) => (\n`;
    }

    code += `  <svg\n`;
    code += `    ref={${forwardRef ? 'ref' : 'undefined'}}\n`;
    code += `    width={size}\n`;
    code += `    height={size}\n`;
    code += `    viewBox="${attributes.viewBox || '0 0 24 24'}"\n`;
    code += `    fill="${attributes.fill || 'none'}"\n`;
    code += `    stroke={color}\n`;
    code += `    strokeWidth="${attributes['stroke-width'] || attributes.strokeWidth || '2'}"\n`;
    code += `    strokeLinecap="${attributes['stroke-linecap'] || attributes.strokeLinecap || 'round'}"\n`;
    code += `    strokeLinejoin="${attributes['stroke-linejoin'] || attributes.strokeLinejoin || 'round'}"\n`;
    code += `    {...props}\n`;
    code += `  >\n`;
    code += `    ${this.convertToJSX(innerContent)}\n`;
    code += `  </svg>\n`;

    if (forwardRef) {
      code += `));\n\n`;
      code += `${componentName}.displayName = '${componentName}';\n\n`;
    } else {
      code += `);\n\n`;
    }

    if (memo && !forwardRef) {
      code += `export ${exportType === 'default' ? 'default' : `const ${componentName}Memo =`} React.memo(${componentName});\n`;
    } else {
      code += `export ${exportType === 'default' ? 'default' : ''} ${exportType === 'named' ? `{ ${componentName} }` : componentName};\n`;
    }

    return {
      code,
      filename: `${componentName}.${ext}`,
      language: typescript ? 'typescriptreact' : 'javascriptreact',
    };
  }

  // ==================== React Native ====================

  private exportReactNative(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);
    const ext = typescript ? 'tsx' : 'jsx';

    const { attributes, innerContent } = this.parseSvg(svg);

    let code = typescript
      ? `import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon, G } from 'react-native-svg';

interface ${componentName}Props {
  size?: number;
  color?: string;
}

const ${componentName}: React.FC<${componentName}Props> = ({ size = ${defaultSize}, color = '${defaultColor}' }) => (\n`
      : `import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon, G } from 'react-native-svg';

const ${componentName} = ({ size = ${defaultSize}, color = '${defaultColor}' }) => (\n`;

    code += `  <Svg width={size} height={size} viewBox="${attributes.viewBox || '0 0 24 24'}" fill="none">\n`;
    code += `    ${this.convertToReactNative(innerContent, 'color')}\n`;
    code += `  </Svg>\n`;
    code += `);\n\n`;
    code += `export default ${componentName};\n`;

    return {
      code,
      filename: `${componentName}.${ext}`,
      language: typescript ? 'typescriptreact' : 'javascriptreact',
    };
  }

  // ==================== Vue 3 Composition ====================

  private exportVueComposition(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `<script setup${typescript ? ' lang="ts"' : ''}>
${
  typescript
    ? `interface Props {
  size?: number | string;
  color?: string;
}

`
    : ''
}defineProps${typescript ? '<Props>' : ''}({
  size: { type: [Number, String], default: ${defaultSize} },
  color: { type: String, default: '${defaultColor}' }
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="${attributes.viewBox || '0 0 24 24'}"
    fill="${attributes.fill || 'none'}"
    :stroke="color"
    stroke-width="${attributes['stroke-width'] || '2'}"
    stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
    stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
  >
    ${innerContent.trim()}
  </svg>
</template>
`;

    return {
      code,
      filename: `${componentName}.vue`,
      language: 'vue',
    };
  }

  // ==================== Vue SFC (Options API) ====================

  private exportVueSFC(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `<template>
  <svg
    :width="size"
    :height="size"
    viewBox="${attributes.viewBox || '0 0 24 24'}"
    fill="${attributes.fill || 'none'}"
    :stroke="color"
    stroke-width="${attributes['stroke-width'] || '2'}"
    stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
    stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
  >
    ${innerContent.trim()}
  </svg>
</template>

<script${typescript ? ' lang="ts"' : ''}>
${
  typescript
    ? `import { defineComponent, PropType } from 'vue';

`
    : ''
}export default ${typescript ? 'defineComponent(' : ''}{
  name: '${componentName}',
  props: {
    size: {
      type: ${typescript ? '[Number, String] as PropType<number | string>' : '[Number, String]'},
      default: ${defaultSize}
    },
    color: {
      type: String,
      default: '${defaultColor}'
    }
  }
}${typescript ? ')' : ''};
</script>
`;

    return {
      code,
      filename: `${componentName}.vue`,
      language: 'vue',
    };
  }

  // ==================== Svelte ====================

  private exportSvelte(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `<script${typescript ? ' lang="ts"' : ''}>
  export let size${typescript ? ': number | string' : ''} = ${defaultSize};
  export let color${typescript ? ': string' : ''} = '${defaultColor}';
</script>

<svg
  width={size}
  height={size}
  viewBox="${attributes.viewBox || '0 0 24 24'}"
  fill="${attributes.fill || 'none'}"
  stroke={color}
  stroke-width="${attributes['stroke-width'] || '2'}"
  stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
  stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
  {...$$restProps}
>
  ${innerContent.trim()}
</svg>
`;

    return {
      code,
      filename: `${componentName}.svelte`,
      language: 'svelte',
    };
  }

  // ==================== Angular ====================

  private exportAngular(options: ExportOptions): ExportResult {
    const { iconName, svg, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);
    const selector = this.toKebabCase(iconName);

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `import { Component, Input } from '@angular/core';

@Component({
  selector: '${selector}-icon',
  standalone: true,
  template: \`
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="${attributes.viewBox || '0 0 24 24'}"
      fill="${attributes.fill || 'none'}"
      [attr.stroke]="color"
      stroke-width="${attributes['stroke-width'] || '2'}"
      stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
      stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
    >
      ${innerContent.trim()}
    </svg>
  \`
})
export class ${componentName}IconComponent {
  @Input() size: number | string = ${defaultSize};
  @Input() color: string = '${defaultColor}';
}
`;

    return {
      code,
      filename: `${selector}-icon.component.ts`,
      language: 'typescript',
    };
  }

  // ==================== SolidJS ====================

  private exportSolid(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);
    const ext = typescript ? 'tsx' : 'jsx';

    const { attributes, innerContent } = this.parseSvg(svg);

    let code = '';

    if (typescript) {
      code += `import { Component, JSX, splitProps, mergeProps } from 'solid-js';

interface ${componentName}Props extends JSX.SvgSVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

const ${componentName}: Component<${componentName}Props> = (props) => {
  const merged = mergeProps({ size: ${defaultSize}, color: '${defaultColor}' }, props);
  const [local, others] = splitProps(merged, ['size', 'color']);

  return (\n`;
    } else {
      code += `import { splitProps, mergeProps } from 'solid-js';

const ${componentName} = (props) => {
  const merged = mergeProps({ size: ${defaultSize}, color: '${defaultColor}' }, props);
  const [local, others] = splitProps(merged, ['size', 'color']);

  return (\n`;
    }

    code += `    <svg
      width={local.size}
      height={local.size}
      viewBox="${attributes.viewBox || '0 0 24 24'}"
      fill="${attributes.fill || 'none'}"
      stroke={local.color}
      stroke-width="${attributes['stroke-width'] || '2'}"
      stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
      stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
      {...others}
    >
      ${this.convertToJSX(innerContent)}
    </svg>
  );
};

export default ${componentName};
`;

    return {
      code,
      filename: `${componentName}.${ext}`,
      language: typescript ? 'typescriptreact' : 'javascriptreact',
    };
  }

  // ==================== Qwik ====================

  private exportQwik(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);
    const ext = typescript ? 'tsx' : 'jsx';

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `import { component$${typescript ? ', QwikIntrinsicElements' : ''} } from '@builder.io/qwik';

${
  typescript
    ? `interface ${componentName}Props {
  size?: number | string;
  color?: string;
}

`
    : ''
}export const ${componentName} = component$${typescript ? `<${componentName}Props>` : ''}(({ size = ${defaultSize}, color = '${defaultColor}' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="${attributes.viewBox || '0 0 24 24'}"
      fill="${attributes.fill || 'none'}"
      stroke={color}
      stroke-width="${attributes['stroke-width'] || '2'}"
      stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
      stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
    >
      ${this.convertToJSX(innerContent)}
    </svg>
  );
});
`;

    return {
      code,
      filename: `${componentName}.${ext}`,
      language: typescript ? 'typescriptreact' : 'javascriptreact',
    };
  }

  // ==================== Lit ====================

  private exportLit(options: ExportOptions): ExportResult {
    const { iconName, svg, typescript, defaultSize = 24, defaultColor = 'currentColor' } = options;
    const componentName = this.toPascalCase(iconName);
    const tagName = this.toKebabCase(iconName) + '-icon';
    const ext = 'ts';

    const { attributes, innerContent } = this.parseSvg(svg);

    const code = `import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

@customElement('${tagName}')
export class ${componentName}Icon extends LitElement {
  @property({ type: Number }) size${typescript ? ': number | string' : ''} = ${defaultSize};
  @property({ type: String }) color${typescript ? ': string' : ''} = '${defaultColor}';

  static styles = css\`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  \`;

  render() {
    return html\`
      <svg
        width="\${this.size}"
        height="\${this.size}"
        viewBox="${attributes.viewBox || '0 0 24 24'}"
        fill="${attributes.fill || 'none'}"
        stroke="\${this.color}"
        stroke-width="${attributes['stroke-width'] || '2'}"
        stroke-linecap="${attributes['stroke-linecap'] || 'round'}"
        stroke-linejoin="${attributes['stroke-linejoin'] || 'round'}"
      >
        \${svg\`${innerContent.trim()}\`}
      </svg>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${tagName}': ${componentName}Icon;
  }
}
`;

    return {
      code,
      filename: `${tagName}.${ext}`,
      language: 'typescript',
    };
  }

  // ==================== Helpers ====================

  private parseSvg(svg: string): { attributes: Record<string, string>; innerContent: string } {
    const attributes: Record<string, string> = {};

    // Extract SVG tag attributes
    const svgTagMatch = svg.match(/<svg([^>]*)>/i);
    if (svgTagMatch) {
      const attrStr = svgTagMatch[1];
      const attrRegex = /(\w+[-\w]*)=["']([^"']*)["']/g;
      let match;
      while ((match = attrRegex.exec(attrStr)) !== null) {
        attributes[match[1]] = match[2];
      }
    }

    // Extract inner content
    const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    const innerContent = innerMatch ? innerMatch[1].trim() : '';

    return { attributes, innerContent };
  }

  private convertToJSX(content: string): string {
    return (
      content
        // Convert attributes to camelCase
        .replace(/stroke-width=/g, 'strokeWidth=')
        .replace(/stroke-linecap=/g, 'strokeLinecap=')
        .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
        .replace(/stroke-dasharray=/g, 'strokeDasharray=')
        .replace(/stroke-dashoffset=/g, 'strokeDashoffset=')
        .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
        .replace(/stroke-opacity=/g, 'strokeOpacity=')
        .replace(/fill-opacity=/g, 'fillOpacity=')
        .replace(/fill-rule=/g, 'fillRule=')
        .replace(/clip-path=/g, 'clipPath=')
        .replace(/clip-rule=/g, 'clipRule=')
        .replace(/font-family=/g, 'fontFamily=')
        .replace(/font-size=/g, 'fontSize=')
        .replace(/text-anchor=/g, 'textAnchor=')
        .replace(/stop-color=/g, 'stopColor=')
        .replace(/stop-opacity=/g, 'stopOpacity=')
        // Handle class -> className
        .replace(/\sclass=/g, ' className=')
    );
  }

  private convertToReactNative(content: string, colorVar: string): string {
    return (
      content
        // Convert element names to PascalCase
        .replace(/<path/g, '<Path')
        .replace(/<\/path>/g, '</Path>')
        .replace(/<circle/g, '<Circle')
        .replace(/<\/circle>/g, '</Circle>')
        .replace(/<rect/g, '<Rect')
        .replace(/<\/rect>/g, '</Rect>')
        .replace(/<line/g, '<Line')
        .replace(/<\/line>/g, '</Line>')
        .replace(/<polyline/g, '<Polyline')
        .replace(/<\/polyline>/g, '</Polyline>')
        .replace(/<polygon/g, '<Polygon')
        .replace(/<\/polygon>/g, '</Polygon>')
        .replace(/<g/g, '<G')
        .replace(/<\/g>/g, '</G>')
        // Convert stroke="currentColor" to use prop
        .replace(/stroke="currentColor"/g, `stroke={${colorVar}}`)
        .replace(/stroke="[^"]+"/g, `stroke={${colorVar}}`)
        // Convert attributes
        .replace(/stroke-width=/g, 'strokeWidth=')
        .replace(/stroke-linecap=/g, 'strokeLinecap=')
        .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
        .replace(/fill-rule=/g, 'fillRule=')
    );
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}

// Singleton instance
let exporterInstance: ComponentExporter | undefined;

export function getComponentExporter(): ComponentExporter {
  if (!exporterInstance) {
    exporterInstance = new ComponentExporter();
  }
  return exporterInstance;
}
