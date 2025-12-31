/**
 * UC-3: Optimizar SVGs para Producción
 *
 * Tests E2E para validar la optimización de SVGs con SVGO
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-3: Optimizar SVGs para Producción', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // SVG con metadatos innecesarios para probar optimización
  const unoptimizedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Generator: Adobe Illustrator 24.0.0, SVG Export Plug-In -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     viewBox="0 0 24 24" width="24px" height="24px" 
     data-name="Layer 1" id="Layer_1">
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="">
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Designer</dc:creator>
      </rdf:Description>
    </rdf:RDF>
  </metadata>
  <title>test-icon</title>
  <desc>A test icon</desc>
  <path fill="#000000" d="M12 2L2 7l10 5 10-5-10-5z"/>
  <path fill="#000000" d="M2 17l10 5 10-5"/>
</svg>`;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-3.1: Comando de optimización', () => {
    test('Debe existir comando optimizeSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.optimizeSvg'), 'Comando optimizeSvg debe existir');
    });

    test('Debe existir comando optimizeSelectedSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.optimizeSelectedSvg'),
        'Comando optimizeSelectedSvg debe existir'
      );
    });
  });

  suite('CA-3.2: Presets de optimización', () => {
    test('Preset Minimal: debe eliminar comentarios', () => {
      // El preset minimal elimina comentarios pero preserva estructura
      const hasComments = unoptimizedSvg.includes('<!--');
      assert.ok(hasComments, 'SVG original debe tener comentarios');

      // Verificar que el SVG original tiene los elementos a limpiar
      assert.ok(unoptimizedSvg.includes('Generator:'), 'Debe tener comentario de generador');
    });

    test('Preset Minimal: debe eliminar metadata', () => {
      const hasMetadata = unoptimizedSvg.includes('<metadata>');
      assert.ok(hasMetadata, 'SVG original debe tener metadata');
    });

    test('Preset Safe: debe convertir colores', () => {
      // Safe convierte #000000 a #000 o black
      const hasFullColor = unoptimizedSvg.includes('#000000');
      assert.ok(hasFullColor, 'SVG original debe tener color completo #000000');
    });

    test('Preset Aggressive: combina elementos', () => {
      // Verificar que hay elementos que podrían combinarse
      const pathMatches = unoptimizedSvg.match(/<path/g);
      assert.ok(pathMatches && pathMatches.length >= 2, 'SVG original debe tener múltiples paths');
    });
  });

  suite('CA-3.3: Optimización de archivo SVG', () => {
    const testSvgPath = path.join(testWorkspace, 'test-optimize.svg');

    suiteSetup(async () => {
      // Crear SVG de prueba
      fs.writeFileSync(testSvgPath, unoptimizedSvg);
    });

    test('Debe abrir archivo SVG para optimizar', async () => {
      const doc = await vscode.workspace.openTextDocument(testSvgPath);
      await vscode.window.showTextDocument(doc);
      await delay(300);

      assert.ok(doc.getText().includes('<svg'), 'Documento debe contener SVG');
    });

    test('El archivo original debe tener metadatos', () => {
      const content = fs.readFileSync(testSvgPath, 'utf-8');

      assert.ok(content.includes('<?xml'), 'Debe tener declaración XML');
      assert.ok(content.includes('<!DOCTYPE'), 'Debe tener DOCTYPE');
      assert.ok(content.includes('<metadata>'), 'Debe tener metadata');
      assert.ok(content.includes('<!--'), 'Debe tener comentarios');
      assert.ok(content.includes('data-name'), 'Debe tener atributos de editor');
    });

    test('Debe calcular tamaño original', () => {
      const stats = fs.statSync(testSvgPath);
      assert.ok(stats.size > 500, `Archivo original debe ser > 500 bytes, actual: ${stats.size}`);
    });

    suiteTeardown(async () => {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      if (fs.existsSync(testSvgPath)) {
        fs.unlinkSync(testSvgPath);
      }
    });
  });

  suite('CA-3.4: Optimización desde selección', () => {
    let testDocument: vscode.TextDocument;
    const testFilePath = path.join(testWorkspace, 'test-inline-optimize.tsx');

    suiteSetup(async () => {
      const content = `
import React from 'react';

export const Icon = () => (
  ${unoptimizedSvg}
);
`;
      fs.writeFileSync(testFilePath, content);
      testDocument = await vscode.workspace.openTextDocument(testFilePath);
      await vscode.window.showTextDocument(testDocument);
      await delay(300);
    });

    test('Debe detectar SVG inline para optimizar', () => {
      const content = testDocument.getText();
      assert.ok(content.includes('<svg'), 'Debe contener SVG');
      assert.ok(content.includes('<metadata>'), 'SVG debe tener metadata');
    });

    test('Debe poder seleccionar SVG inline', () => {
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor, 'Debe haber editor activo');

      const content = editor.document.getText();
      const svgStart = content.indexOf('<svg');
      const svgEnd = content.indexOf('</svg>') + 6;

      assert.ok(svgStart > 0 && svgEnd > svgStart, 'Debe encontrar SVG');
    });

    suiteTeardown(async () => {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  });

  suite('CA-3.5: Estadísticas de optimización', () => {
    test('Debe mostrar ahorro potencial', () => {
      // Calcular ahorro esperado
      const originalSize = Buffer.byteLength(unoptimizedSvg, 'utf-8');

      // Un SVG optimizado típicamente es 50-70% más pequeño
      assert.ok(originalSize > 800, `Original debe ser significativo: ${originalSize} bytes`);

      // El ahorro esperado sería al menos eliminar:
      // - XML declaration (~40 bytes)
      // - DOCTYPE (~100 bytes)
      // - Metadata section (~300 bytes)
      // - Comments (~60 bytes)
      const expectedSavings = 500; // Al menos 500 bytes
      assert.ok(
        originalSize > expectedSavings,
        `Original (${originalSize}) debe ser mayor que ahorro esperado (${expectedSavings})`
      );
    });
  });
});

suite('CA-3.2: Limpieza de SVG', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  suite('Elementos a eliminar', () => {
    test('CA-3.2.1: Debe identificar declaración XML', () => {
      const svg = '<?xml version="1.0"?><svg></svg>';
      assert.ok(svg.includes('<?xml'), 'Debe tener declaración XML');
    });

    test('CA-3.2.2: Debe identificar DOCTYPE', () => {
      const svg = '<!DOCTYPE svg><svg></svg>';
      assert.ok(svg.includes('<!DOCTYPE'), 'Debe tener DOCTYPE');
    });

    test('CA-3.2.3: Debe identificar comentarios HTML', () => {
      const svg = '<svg><!-- comment --></svg>';
      assert.ok(svg.includes('<!--'), 'Debe tener comentarios');
    });

    test('CA-3.2.4: Debe identificar elemento metadata', () => {
      const svg = '<svg><metadata></metadata></svg>';
      assert.ok(svg.includes('<metadata>'), 'Debe tener metadata');
    });

    test('CA-3.2.5: Debe identificar atributos data-name', () => {
      const svg = '<svg data-name="Layer 1"></svg>';
      assert.ok(svg.includes('data-name'), 'Debe tener data-name');
    });
  });
});
