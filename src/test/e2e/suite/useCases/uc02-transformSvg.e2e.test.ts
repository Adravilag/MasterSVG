/**
 * UC-2: Migrar Iconos Inline a Componentes
 * UC-12: Trabajar con Múltiples Frameworks
 *
 * Tests E2E para transformación de SVGs a componentes
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-2: Migrar Iconos Inline a Componentes', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-2.1: Configuración del componente', () => {
    test('CA-2.1.1: Debe configurar componentName', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('componentName', 'Icon', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const name = config.get<string>('componentName', '');
      assert.strictEqual(name, 'Icon', 'componentName debe ser "Icon"');
    });

    test('CA-2.1.2: Debe configurar componentImport', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update(
        'componentImport',
        '@/components/ui/Icon',
        vscode.ConfigurationTarget.Workspace
      );
      await delay(200);

      const importPath = config.get<string>('componentImport', '');
      assert.strictEqual(
        importPath,
        '@/components/ui/Icon',
        'componentImport debe estar configurado'
      );
    });

    test('CA-2.1.3: Debe configurar iconNameAttribute', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('iconNameAttribute', 'name', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const attr = config.get<string>('iconNameAttribute', '');
      assert.strictEqual(attr, 'name', 'iconNameAttribute debe ser "name"');
    });

    test('CA-2.1.4: Debe configurar autoImport', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('autoImport', true, vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const autoImport = config.get<boolean>('autoImport', false);
      assert.strictEqual(autoImport, true, 'autoImport debe estar habilitado');
    });
  });

  suite('CA-2.2: Comando de transformación', () => {
    test('Debe existir comando transformSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.transformSvg'), 'Comando transformSvg debe existir');
    });

    test('Debe existir comando transformSvgFromExplorer', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.transformSvgFromExplorer'),
        'Comando transformSvgFromExplorer debe existir'
      );
    });
  });

  suite('CA-2.3: Transformación de SVG inline', () => {
    let testDocument: vscode.TextDocument;
    const testFilePath = path.join(testWorkspace, 'test-transform.tsx');

    suiteSetup(async () => {
      // Crear archivo de prueba con SVG inline
      const content = `
import React from 'react';

export const MyComponent = () => {
  return (
    <div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
      </svg>
    </div>
  );
};
`;
      fs.writeFileSync(testFilePath, content);
      testDocument = await vscode.workspace.openTextDocument(testFilePath);
      await vscode.window.showTextDocument(testDocument);
      await delay(300);
    });

    test('Debe detectar SVG inline en el documento', async () => {
      const content = testDocument.getText();
      assert.ok(content.includes('<svg'), 'El documento debe contener SVG');
      assert.ok(content.includes('viewBox'), 'El SVG debe tener viewBox');
    });

    test('Debe poder seleccionar el SVG para transformar', async () => {
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor, 'Debe haber un editor activo');

      // Encontrar posición del SVG
      const content = editor.document.getText();
      const svgStart = content.indexOf('<svg');
      const svgEnd = content.indexOf('</svg>') + 6;

      assert.ok(svgStart > 0, 'Debe encontrar inicio de SVG');
      assert.ok(svgEnd > svgStart, 'Debe encontrar fin de SVG');

      // Seleccionar el SVG
      const startPos = editor.document.positionAt(svgStart);
      const endPos = editor.document.positionAt(svgEnd);
      editor.selection = new vscode.Selection(startPos, endPos);

      assert.ok(!editor.selection.isEmpty, 'La selección no debe estar vacía');
    });

    suiteTeardown(async () => {
      // Cerrar documento y eliminar archivo
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  });

  suiteTeardown(async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('componentName', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('componentImport', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('iconNameAttribute', undefined, vscode.ConfigurationTarget.Workspace);
    await config.update('autoImport', undefined, vscode.ConfigurationTarget.Workspace);
  });
});

suite('UC-12: Trabajar con Múltiples Frameworks', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('Formatos de salida soportados', () => {
    test('Debe soportar formato JSX (React)', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputFormat', 'jsx', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('outputFormat', '');
      assert.strictEqual(format, 'jsx');
    });

    test('Debe soportar formato Vue', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputFormat', 'vue', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('outputFormat', '');
      assert.strictEqual(format, 'vue');
    });

    test('Debe soportar formato Svelte', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputFormat', 'svelte', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('outputFormat', '');
      assert.strictEqual(format, 'svelte');
    });

    test('Debe soportar formato Astro', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputFormat', 'astro', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('outputFormat', '');
      assert.strictEqual(format, 'astro');
    });

    test('Debe soportar formato HTML', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('outputFormat', 'html', vscode.ConfigurationTarget.Workspace);
      await delay(200);

      const format = config.get<string>('outputFormat', '');
      assert.strictEqual(format, 'html');
    });
  });

  suite('Detección automática de lenguaje', () => {
    test('Debe detectar archivo .tsx como React', async () => {
      const testFile = path.join(testWorkspace, 'test.tsx');
      fs.writeFileSync(testFile, 'const x = 1;');

      const doc = await vscode.workspace.openTextDocument(testFile);
      assert.ok(
        doc.languageId === 'typescriptreact' || doc.languageId === 'typescript',
        'Debe detectar TypeScript/React'
      );

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      fs.unlinkSync(testFile);
    });

    test('Debe detectar archivo .vue como Vue', async () => {
      const testFile = path.join(testWorkspace, 'test.vue');
      fs.writeFileSync(testFile, '<template></template>');

      const doc = await vscode.workspace.openTextDocument(testFile);
      // Vue puede ser detectado como 'vue' o 'html' dependiendo de las extensiones
      assert.ok(
        ['vue', 'html'].includes(doc.languageId),
        `Debe detectar Vue o HTML, encontrado: ${doc.languageId}`
      );

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      fs.unlinkSync(testFile);
    });
  });

  suiteTeardown(async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('outputFormat', undefined, vscode.ConfigurationTarget.Workspace);
  });
});
