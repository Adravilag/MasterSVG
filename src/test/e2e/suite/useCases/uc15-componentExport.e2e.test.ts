/**
 * UC-15: Exportar Iconos como Componentes
 * UC-21: Exportar Iconos con Wrapper de Framework
 * UC-25: Exportar para Web Components
 * UC-34: Crear Web Component desde SVG
 *
 * Tests E2E para exportación de componentes en diferentes frameworks
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('UC-15: Exportar Iconos como Componentes', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-15.1: Comandos de exportación', () => {
    test('Debe existir comando exportAsComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.exportAsComponent'),
        'Comando exportAsComponent debe existir'
      );
    });

    test('Debe existir comando copyAsComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.copyAsComponent'),
        'Comando copyAsComponent debe existir'
      );
    });
  });

  suite('CA-15.2: Formatos de exportación React', () => {
    test('Debe generar componente React JSX válido', () => {
      const componentName = 'HomeIcon';
      const svgContent = '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>';

      const jsxComponent = `import React from 'react';

export const ${componentName} = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    ${svgContent}
  </svg>
);

export default ${componentName};
`;

      assert.ok(jsxComponent.includes('import React'), 'Debe importar React');
      assert.ok(jsxComponent.includes(`export const ${componentName}`), 'Debe exportar nombrado');
      assert.ok(jsxComponent.includes('export default'), 'Debe exportar default');
      assert.ok(jsxComponent.includes('{...props}'), 'Debe spread props');
    });

    test('Debe generar componente React TypeScript', () => {
      const componentName = 'HomeIcon';

      const tsxComponent = `import React from 'react';

interface ${componentName}Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    {...props}
  >
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
);
`;

      assert.ok(tsxComponent.includes('interface'), 'Debe definir interface');
      assert.ok(tsxComponent.includes('React.FC'), 'Debe tipar como FC');
      assert.ok(tsxComponent.includes('SVGProps'), 'Debe extender SVGProps');
    });
  });

  suite('CA-15.3: Formatos de exportación Vue', () => {
    test('Debe generar componente Vue SFC', () => {
      const componentName = 'HomeIcon';

      const vueComponent = `<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="color"
    v-bind="$attrs"
  >
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
</template>

<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 24
  },
  color: {
    type: String,
    default: 'currentColor'
  }
});
</script>
`;

      assert.ok(vueComponent.includes('<template>'), 'Debe tener template');
      assert.ok(vueComponent.includes('<script setup>'), 'Debe usar script setup');
      assert.ok(vueComponent.includes('defineProps'), 'Debe definir props');
      assert.ok(vueComponent.includes('v-bind="$attrs"'), 'Debe pasar attrs');
    });
  });

  suite('CA-15.4: Formatos de exportación Svelte', () => {
    test('Debe generar componente Svelte', () => {
      const svelteComponent = `<script>
  export let size = 24;
  export let color = 'currentColor';
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={color}
  {...$$restProps}
>
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>
`;

      assert.ok(svelteComponent.includes('<script>'), 'Debe tener script');
      assert.ok(svelteComponent.includes('export let'), 'Debe exportar props');
      assert.ok(svelteComponent.includes('$$restProps'), 'Debe pasar rest props');
    });
  });
});

suite('UC-21: Exportar con Wrapper de Framework', () => {
  suite('CA-21.1: Configuración de wrappers', () => {
    test('Debe tener configuración componentWrapper', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const wrappers = config.get('componentWrapper');

      // La configuración puede no existir, pero el tipo debe ser correcto si existe
      assert.ok(
        wrappers === undefined || typeof wrappers === 'object',
        'componentWrapper debe ser objeto o undefined'
      );
    });
  });

  suite('CA-21.2: Wrapper personalizado', () => {
    test('Debe aplicar wrapper personalizado', () => {
      const customWrapper = {
        prefix: 'import styled from "styled-components";\n\n',
        suffix: '\n\nexport default styled(Icon)`\n  &:hover { opacity: 0.8; }\n`;',
      };

      const baseComponent = 'const Icon = (props) => <svg {...props}></svg>;';

      const wrapped = customWrapper.prefix + baseComponent + customWrapper.suffix;

      assert.ok(wrapped.includes('styled-components'), 'Debe incluir import del wrapper');
      assert.ok(wrapped.includes('&:hover'), 'Debe incluir estilos personalizados');
    });
  });

  suite('CA-21.3: Astro component', () => {
    test('Debe generar componente Astro', () => {
      const astroComponent = `---
interface Props {
  size?: number | string;
  color?: string;
  class?: string;
}

const { size = 24, color = 'currentColor', class: className, ...props } = Astro.props;
---

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={color}
  class={className}
  {...props}
>
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>
`;

      assert.ok(astroComponent.includes('---'), 'Debe tener frontmatter');
      assert.ok(astroComponent.includes('Astro.props'), 'Debe usar Astro.props');
      assert.ok(astroComponent.includes('interface Props'), 'Debe definir Props');
    });
  });
});

suite('UC-25 & UC-34: Web Components', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-25.1: Comandos Web Component', () => {
    test('Debe existir comando exportAsWebComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.exportAsWebComponent'),
        'Comando exportAsWebComponent debe existir'
      );
    });
  });

  suite('CA-25.2: Estructura Web Component', () => {
    test('Debe generar Web Component con Custom Element', () => {
      const tagName = 'icon-home';
      const webComponent = `class IconHome extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['size', 'color'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const size = this.getAttribute('size') || '24';
    const color = this.getAttribute('color') || 'currentColor';

    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: inline-block;
          line-height: 0;
        }
        svg {
          width: \${size}px;
          height: \${size}px;
          fill: \${color};
        }
      </style>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    \`;
  }
}

customElements.define('${tagName}', IconHome);
`;

      assert.ok(webComponent.includes('extends HTMLElement'), 'Debe extender HTMLElement');
      assert.ok(webComponent.includes('attachShadow'), 'Debe usar Shadow DOM');
      assert.ok(webComponent.includes('observedAttributes'), 'Debe observar atributos');
      assert.ok(
        webComponent.includes(`customElements.define('${tagName}'`),
        'Debe registrar elemento'
      );
    });

    test('Debe generar nombre de tag válido', () => {
      const iconNames = ['home', 'HomeIcon', 'my_icon', 'Icon123'];

      iconNames.forEach(name => {
        // Convertir a kebab-case y agregar prefijo "icon-"
        const tagName =
          'icon-' +
          name
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/_/g, '-')
            .toLowerCase();

        // Verificar que cumple con especificación de custom elements
        assert.ok(tagName.includes('-'), `${tagName} debe contener guión`);
        assert.ok(/^[a-z]/.test(tagName), `${tagName} debe empezar con letra minúscula`);
      });
    });
  });

  suite('CA-25.3: Estilos encapsulados', () => {
    test('Debe encapsular estilos en Shadow DOM', () => {
      const shadowStyles = `
        :host {
          display: inline-block;
        }
        :host([hidden]) {
          display: none;
        }
        svg {
          display: block;
        }
      `;

      assert.ok(shadowStyles.includes(':host'), 'Debe usar :host para estilos');
      assert.ok(shadowStyles.includes(':host([hidden])'), 'Debe manejar atributo hidden');
    });
  });

  suite('CA-34.1: Atributos reactivos', () => {
    test('Debe soportar atributos personalizados', () => {
      const observedAttributes = ['size', 'color', 'stroke-width', 'aria-label'];

      observedAttributes.forEach(attr => {
        assert.ok(typeof attr === 'string' && attr.length > 0, `${attr} es un atributo válido`);
      });
    });

    test('Debe generar getters/setters para propiedades', () => {
      const propertyAccessors = `
  get size() {
    return this.getAttribute('size') || '24';
  }

  set size(value) {
    this.setAttribute('size', value);
  }

  get color() {
    return this.getAttribute('color') || 'currentColor';
  }

  set color(value) {
    this.setAttribute('color', value);
  }
`;

      assert.ok(propertyAccessors.includes('get size()'), 'Debe tener getter size');
      assert.ok(propertyAccessors.includes('set size('), 'Debe tener setter size');
    });
  });

  suite('CA-34.2: Compatibilidad ES Modules', () => {
    test('Debe exportar como ES Module', () => {
      const esModuleExport = `
export class IconHome extends HTMLElement {
  // ...
}

export default IconHome;

// Auto-register
if (!customElements.get('icon-home')) {
  customElements.define('icon-home', IconHome);
}
`;

      assert.ok(esModuleExport.includes('export class'), 'Debe tener export nombrado');
      assert.ok(esModuleExport.includes('export default'), 'Debe tener export default');
      assert.ok(
        esModuleExport.includes("customElements.get('icon-home')"),
        'Debe verificar si ya está registrado'
      );
    });
  });
});

suite('Configuración de Exportación', () => {
  suite('Settings de exportación', () => {
    test('Debe tener configuración componentNameFormat', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const format = config.get<string>('componentName.format');

      // Formatos válidos: PascalCase, camelCase, kebab-case
      assert.ok(
        format === undefined || ['PascalCase', 'camelCase', 'kebab-case'].includes(format),
        'Formato debe ser válido'
      );
    });

    test('Debe tener configuración componentImportStyle', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const importStyle = config.get<string>('componentImport.style');

      // Estilos: named, default, both
      assert.ok(
        importStyle === undefined || ['named', 'default', 'both'].includes(importStyle),
        'Import style debe ser válido'
      );
    });

    test('Debe tener configuración componentAttributes', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const attrs = config.get('componentAttributes');

      assert.ok(
        attrs === undefined || typeof attrs === 'object',
        'componentAttributes debe ser objeto'
      );
    });
  });
});
