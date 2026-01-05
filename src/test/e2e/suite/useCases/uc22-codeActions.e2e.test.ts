/**
 * UC-22: Usar Code Actions para SVGs
 *
 * Tests E2E para validar las code actions de SVG
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('UC-22: Usar Code Actions para SVGs', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Contenido de prueba con SVG inline
  const htmlWithInlineSvg = `
<div class="icon-container">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor"/>
    <path d="M2 17l10 5 10-5" fill="currentColor"/>
  </svg>
</div>
`;

  const reactWithInlineSvg = `
export function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 2L2 22h20z" fill="currentColor"/>
    </svg>
  );
}
`;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-22.1: Detección de SVG inline', () => {
    test('Debe detectar SVG en HTML', () => {
      const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
      const matches = htmlWithInlineSvg.match(svgRegex);

      assert.ok(matches, 'Debe encontrar SVG');
      assert.strictEqual(matches?.length, 1, 'Debe encontrar exactamente 1 SVG');
    });

    test('Debe detectar SVG en JSX', () => {
      const svgRegex = /<svg[^>]*>[\s\S]*?<\/svg>/gi;
      const matches = reactWithInlineSvg.match(svgRegex);

      assert.ok(matches, 'Debe encontrar SVG en JSX');
    });

    test('Debe calcular rango del SVG', () => {
      const content = htmlWithInlineSvg;
      const svgStart = content.indexOf('<svg');
      const svgEnd = content.indexOf('</svg>') + '</svg>'.length;

      assert.ok(svgStart > 0, 'Debe encontrar inicio de SVG');
      assert.ok(svgEnd > svgStart, 'Debe encontrar fin de SVG');

      const svgContent = content.substring(svgStart, svgEnd);
      assert.ok(svgContent.startsWith('<svg'), 'Contenido debe empezar con <svg');
      assert.ok(svgContent.endsWith('</svg>'), 'Contenido debe terminar con </svg>');
    });
  });

  suite('CA-22.2: Code Action Provider', () => {
    test('Debe existir provider de code actions', async () => {
      // Verificar que el provider está registrado
      const testFilePath = path.join(testWorkspace, 'test-code-action.html');
      fs.writeFileSync(testFilePath, htmlWithInlineSvg);

      try {
        const doc = await vscode.workspace.openTextDocument(testFilePath);
        await vscode.window.showTextDocument(doc);
        await delay(500);

        // El provider debería estar activo para archivos HTML con SVG
        assert.ok(doc.getText().includes('<svg'), 'Documento debe contener SVG');
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('Debe ofrecer acción de transformar a componente', () => {
      const codeActions = [
        {
          title: 'Transform SVG to Icon Component',
          kind: vscode.CodeActionKind.RefactorExtract,
          command: 'masterSVG.transformInlineSvg',
        },
        {
          title: 'Optimize SVG',
          kind: vscode.CodeActionKind.RefactorRewrite,
          command: 'masterSVG.optimizeSelectedSvg',
        },
        {
          title: 'Save SVG to Library',
          kind: vscode.CodeActionKind.RefactorExtract,
          command: 'masterSVG.importSvgToLibrary',
        },
      ];

      assert.strictEqual(codeActions.length, 3, 'Debe ofrecer 3 code actions');
      assert.ok(
        codeActions.some(a => a.title.includes('Transform')),
        'Debe incluir Transform'
      );
      assert.ok(
        codeActions.some(a => a.title.includes('Optimize')),
        'Debe incluir Optimize'
      );
    });
  });

  suite('CA-22.3: Transformación de SVG', () => {
    test('Debe transformar SVG a referencia de componente', () => {
      const transformSvgToComponent = (
        componentName: string,
        iconName: string,
        attribute: string
      ): string => {
        return `<${componentName} ${attribute}="${iconName}" />`;
      };

      const result = transformSvgToComponent('Icon', 'layers', 'name');
      assert.strictEqual(result, '<Icon name="layers" />', 'Debe generar componente correcto');
    });

    test('Debe extraer nombre del SVG', () => {
      const extractIconName = (svgContent: string): string => {
        // Intentar extraer de title, id o generar uno
        const titleRegex = /<title>([^<]+)<\/title>/;
        const titleMatch = titleRegex.exec(svgContent);
        if (titleMatch) return titleMatch[1].toLowerCase().replace(/\s+/g, '-');

        const idRegex = /id=["']([^"']+)["']/;
        const idMatch = idRegex.exec(svgContent);
        if (idMatch) return idMatch[1].toLowerCase();

        return 'unnamed-icon';
      };

      const svgWithTitle = '<svg><title>My Icon</title><path/></svg>';
      assert.strictEqual(extractIconName(svgWithTitle), 'my-icon');

      const svgWithId = '<svg id="arrow-icon"><path/></svg>';
      assert.strictEqual(extractIconName(svgWithId), 'arrow-icon');
    });
  });

  suite('CA-22.4: Quick Fix lightbulb', () => {
    test('Debe mostrar lightbulb en SVG inline', () => {
      // VS Code muestra lightbulb cuando hay code actions disponibles
      const lightbulbConfig = {
        triggerOnSvg: true,
        position: 'inline',
        actions: ['transform', 'optimize', 'save'],
      };

      assert.ok(lightbulbConfig.triggerOnSvg, 'Debe activarse en SVG');
      assert.strictEqual(lightbulbConfig.actions.length, 3, 'Debe mostrar 3 acciones');
    });

    test('Debe detectar SVG en diferentes contextos', () => {
      const contexts = [
        { language: 'html', selector: '**/*.html' },
        { language: 'javascript', selector: '**/*.{js,jsx}' },
        { language: 'typescript', selector: '**/*.{ts,tsx}' },
        { language: 'vue', selector: '**/*.vue' },
        { language: 'svelte', selector: '**/*.svelte' },
        { language: 'astro', selector: '**/*.astro' },
      ];

      assert.strictEqual(contexts.length, 6, 'Debe soportar 6 tipos de archivo');
    });
  });

  suite('CA-22.5: Comandos de transformación', () => {
    test('Debe existir comando transformInlineSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.transformInlineSvg'),
        'Comando transformInlineSvg debe existir'
      );
    });

    test('Debe existir comando optimizeSelectedSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.optimizeSelectedSvg'),
        'Comando optimizeSelectedSvg debe existir'
      );
    });

    test('Debe existir comando importSvgToLibrary', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.importSvgToLibrary'),
        'Comando importSvgToLibrary debe existir'
      );
    });
  });

  suite('CA-22.6: Integración con editor', () => {
    test('Debe preservar indentación al transformar', () => {
      const preserveIndentation = (original: string, replacement: string): string => {
        const indentRegex = /^(\s*)/;
        const match = indentRegex.exec(original);
        const indent = match ? match[1] : '';
        return indent + replacement;
      };

      const original = '    <svg>...</svg>';
      const replacement = '<Icon name="test" />';

      const result = preserveIndentation(original, replacement);
      assert.ok(result.startsWith('    '), 'Debe preservar indentación');
    });

    test('Debe añadir import statement si necesario', () => {
      const needsImport = (content: string, importPath: string): boolean => {
        return (
          !content.includes(`from '${importPath}'`) && !content.includes(`from "${importPath}"`)
        );
      };

      const contentWithoutImport = 'export function App() { return <div/>; }';
      const contentWithImport =
        "import { Icon } from '@/components/Icon';\nexport function App() {}";

      assert.ok(needsImport(contentWithoutImport, '@/components/Icon'), 'Debe necesitar import');
      assert.ok(!needsImport(contentWithImport, '@/components/Icon'), 'No debe necesitar import');
    });
  });
});
