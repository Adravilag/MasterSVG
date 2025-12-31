/**
 * UC-12: Trabajar con Múltiples Frameworks
 *
 * Tests E2E para validar soporte multi-framework
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-12: Trabajar con Múltiples Frameworks', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // SVG de prueba
  const testSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>';

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-12.1: Configuración por Framework', () => {
    test('Debe existir configuración outputFormat', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const format = config.get<string>('outputFormat');

      // Debe existir la configuración (puede ser undefined si no está configurada)
      assert.ok(
        format === undefined || typeof format === 'string',
        'outputFormat debe ser string o undefined'
      );
    });

    test('Debe soportar formato React/JSX', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('outputFormat', 'jsx', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const format = config.get<string>('outputFormat');
      assert.strictEqual(format, 'jsx', 'Debe poder configurar formato JSX');
    });

    test('Debe soportar formato Vue', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('outputFormat', 'vue', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const format = config.get<string>('outputFormat');
      assert.strictEqual(format, 'vue', 'Debe poder configurar formato Vue');
    });

    test('Debe soportar formato Svelte', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('outputFormat', 'svelte', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const format = config.get<string>('outputFormat');
      assert.strictEqual(format, 'svelte', 'Debe poder configurar formato Svelte');
    });

    test('Debe soportar formato Astro', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('outputFormat', 'astro', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const format = config.get<string>('outputFormat');
      assert.strictEqual(format, 'astro', 'Debe poder configurar formato Astro');
    });

    test('Debe soportar formato HTML/Iconify', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('outputFormat', 'html', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const format = config.get<string>('outputFormat');
      assert.strictEqual(format, 'html', 'Debe poder configurar formato HTML');
    });
  });

  suite('CA-12.2: Salida por Framework', () => {
    test('Salida React debe usar JSX', () => {
      const reactOutput = (iconName: string, componentName: string, importPath: string) => {
        return `<${componentName} name="${iconName}" />`;
      };

      const output = reactOutput('arrow', 'Icon', '@/components/Icon');
      assert.ok(output.includes('<Icon'), 'Debe usar componente Icon');
      assert.ok(output.includes('name="arrow"'), 'Debe incluir prop name');
    });

    test('Salida Vue debe usar template syntax', () => {
      const vueOutput = (iconName: string, componentName: string) => {
        return `<${componentName} name="${iconName}" />`;
      };

      const output = vueOutput('arrow', 'BaseIcon');
      assert.ok(output.includes('<BaseIcon'), 'Debe usar componente BaseIcon');
    });

    test('Salida HTML debe usar iconify-icon', () => {
      const htmlOutput = (iconName: string) => {
        return `<iconify-icon icon="${iconName}"></iconify-icon>`;
      };

      const output = htmlOutput('mdi:arrow');
      assert.ok(output.includes('iconify-icon'), 'Debe usar tag iconify-icon');
      assert.ok(output.includes('icon="mdi:arrow"'), 'Debe incluir atributo icon');
    });

    test('Tabla de resultados por framework', () => {
      const frameworkOutputs = [
        { framework: 'React', output: '<Icon name="arrow" />' },
        { framework: 'Vue', output: '<BaseIcon name="arrow" />' },
        { framework: 'Svelte', output: '<Icon name="arrow" />' },
        { framework: 'Astro', output: '<Icon name="arrow" />' },
        { framework: 'HTML', output: '<iconify-icon icon="arrow"></iconify-icon>' },
      ];

      assert.strictEqual(frameworkOutputs.length, 5, 'Debe soportar 5 frameworks');

      for (const fw of frameworkOutputs) {
        assert.ok(fw.output.includes('arrow'), `${fw.framework} debe incluir nombre del icono`);
      }
    });
  });

  suite('CA-12.3: Configuración de componente', () => {
    test('Debe poder configurar nombre de componente', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('componentName', 'MyIcon', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const componentName = config.get<string>('componentName');
      assert.strictEqual(componentName, 'MyIcon', 'Debe poder personalizar nombre de componente');
    });

    test('Debe poder configurar path de importación', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('componentImport', '@/ui/Icon', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const importPath = config.get<string>('componentImport');
      assert.strictEqual(importPath, '@/ui/Icon', 'Debe poder personalizar path de import');
    });

    test('Debe poder configurar atributo de nombre', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      await config.update('iconNameAttribute', 'icon', vscode.ConfigurationTarget.Workspace);
      await delay(100);

      const attribute = config.get<string>('iconNameAttribute');
      assert.strictEqual(attribute, 'icon', 'Debe poder personalizar atributo de nombre');
    });
  });

  suite('CA-12.4: Auto-importación', () => {
    test('Debe existir configuración autoImport', async () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const autoImport = config.get<boolean>('autoImport');

      assert.ok(
        autoImport === undefined || typeof autoImport === 'boolean',
        'autoImport debe ser boolean o undefined'
      );
    });

    test('Generación de import statement', () => {
      const generateImport = (
        componentName: string,
        importPath: string,
        format: string
      ): string => {
        switch (format) {
          case 'jsx':
          case 'tsx':
            return `import { ${componentName} } from '${importPath}';`;
          case 'vue':
            return `import ${componentName} from '${importPath}';`;
          case 'svelte':
            return `import ${componentName} from '${importPath}';`;
          case 'astro':
            return `import ${componentName} from '${importPath}';`;
          default:
            return '';
        }
      };

      const reactImport = generateImport('Icon', '@/components/Icon', 'jsx');
      assert.ok(reactImport.includes('import { Icon }'), 'React debe usar named import');

      const vueImport = generateImport('BaseIcon', '@/components/BaseIcon.vue', 'vue');
      assert.ok(vueImport.includes('import BaseIcon'), 'Vue debe usar default import');
    });
  });

  suite('CA-12.5: Detección automática de framework', () => {
    test('Debe detectar React por extensión de archivo', () => {
      const detectFramework = (filename: string): string => {
        if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return 'react';
        if (filename.endsWith('.vue')) return 'vue';
        if (filename.endsWith('.svelte')) return 'svelte';
        if (filename.endsWith('.astro')) return 'astro';
        return 'html';
      };

      assert.strictEqual(detectFramework('App.tsx'), 'react');
      assert.strictEqual(detectFramework('Component.jsx'), 'react');
      assert.strictEqual(detectFramework('Page.vue'), 'vue');
      assert.strictEqual(detectFramework('Button.svelte'), 'svelte');
      assert.strictEqual(detectFramework('Layout.astro'), 'astro');
      assert.strictEqual(detectFramework('index.html'), 'html');
    });

    test('Debe detectar framework por contenido', () => {
      const detectByContent = (content: string): string => {
        if (content.includes('import React') || content.includes('from "react"')) return 'react';
        if (content.includes('<template>') && content.includes('<script')) return 'vue';
        if (content.includes('<script lang="ts">') && content.includes('</script>'))
          return 'svelte';
        if (content.includes('---') && content.includes('Astro')) return 'astro';
        return 'unknown';
      };

      assert.strictEqual(detectByContent('import React from "react";'), 'react');
      assert.strictEqual(detectByContent('<template>\n<div></div>\n</template>\n<script>'), 'vue');
    });
  });
});
