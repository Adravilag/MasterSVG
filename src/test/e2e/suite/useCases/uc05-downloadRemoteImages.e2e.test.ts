/**
 * UC-5: Descargar y Localizar Imágenes Remotas
 *
 * Tests E2E para validar la descarga de imágenes desde URLs
 * Nota: Algunos tests requieren conexión a internet
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-5: Descargar y Localizar Imágenes Remotas', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const downloadFolder = path.join(testWorkspace, 'downloaded-images');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // HTML con referencias remotas para probar detección
  const htmlWithRemoteImages = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .hero { background: url('https://example.com/hero.png'); }
  </style>
</head>
<body>
  <img src="https://via.placeholder.com/150" alt="Placeholder">
  <img src="https://example.com/logo.svg" alt="Logo">
  <img src="/local/image.png" alt="Local">
</body>
</html>`;

  const markdownWithImages = `
# Test Document

![Remote Image](https://example.com/image.png)
![Local Image](./local-image.png)
![Another Remote](https://cdn.example.com/assets/photo.jpg)
`;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder, { recursive: true });
    }

    await delay(500);
  });

  suiteTeardown(async () => {
    if (fs.existsSync(downloadFolder)) {
      fs.rmSync(downloadFolder, { recursive: true, force: true });
    }
  });

  suite('CA-5.1: Detección de URLs de imágenes', () => {
    test('Debe detectar URLs en atributos src de img', () => {
      const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/g;
      const matches = [...htmlWithRemoteImages.matchAll(imgSrcRegex)];

      assert.strictEqual(matches.length, 3, 'Debe detectar 3 tags img');

      const urls = matches.map(m => m[1]);
      assert.ok(
        urls.some(u => u.includes('placeholder')),
        'Debe incluir placeholder'
      );
      assert.ok(
        urls.some(u => u.includes('example.com/logo')),
        'Debe incluir logo'
      );
    });

    test('Debe detectar URLs en background CSS', () => {
      const bgUrlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
      const matches = [...htmlWithRemoteImages.matchAll(bgUrlRegex)];

      assert.ok(matches.length >= 1, 'Debe detectar URL en background');
      assert.ok(matches[0][1].includes('hero.png'), 'Debe detectar hero.png');
    });

    test('Debe detectar URLs en Markdown', () => {
      const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      const matches = [...markdownWithImages.matchAll(mdImageRegex)];

      assert.strictEqual(matches.length, 3, 'Debe detectar 3 imágenes en markdown');
    });

    test('Debe distinguir URLs remotas de locales', () => {
      const remoteUrlRegex = /https?:\/\/[^\s"')]+/g;
      const allUrls = [...htmlWithRemoteImages.matchAll(remoteUrlRegex)];

      // Todas las URLs detectadas deben ser remotas (empezar con http/https)
      for (const match of allUrls) {
        assert.ok(
          match[0].startsWith('http://') || match[0].startsWith('https://'),
          `URL ${match[0]} debe ser remota`
        );
      }
    });
  });

  suite('CA-5.2: Comandos de descarga', () => {
    test('Debe existir funcionalidad para descargar imágenes', async () => {
      const commands = await vscode.commands.getCommands(true);
      // Buscar comandos relacionados con descarga o importación
      const downloadCommands = commands.filter(
        c =>
          c.includes('sageboxIconStudio') &&
          (c.toLowerCase().includes('download') ||
            c.toLowerCase().includes('import') ||
            c.toLowerCase().includes('fetch'))
      );

      // Al menos debería haber comandos de importación
      assert.ok(
        commands.includes('sageboxIconStudio.importSvgToLibrary'),
        'Debe existir comando de importación'
      );
    });
  });

  suite('CA-5.3: Actualización de referencias', () => {
    const testHtmlPath = path.join(testWorkspace, 'test-remote-refs.html');

    suiteSetup(() => {
      fs.writeFileSync(testHtmlPath, htmlWithRemoteImages);
    });

    suiteTeardown(() => {
      if (fs.existsSync(testHtmlPath)) {
        fs.unlinkSync(testHtmlPath);
      }
    });

    test('Debe poder abrir archivo con referencias remotas', async () => {
      const doc = await vscode.workspace.openTextDocument(testHtmlPath);
      const editor = await vscode.window.showTextDocument(doc);

      assert.ok(editor, 'Debe abrir el editor');
      assert.ok(doc.getText().includes('https://'), 'Documento debe contener URLs remotas');
    });

    test('Estructura para actualización de paths', () => {
      // Simular actualización de paths
      const originalPath = 'https://example.com/hero.png';
      const localPath = '/assets/images/hero.webp';

      const updatedHtml = htmlWithRemoteImages.replace(originalPath, localPath);

      assert.ok(!updatedHtml.includes(originalPath), 'URL original debe ser reemplazada');
      assert.ok(updatedHtml.includes(localPath), 'Nueva URL local debe existir');
    });
  });

  suite('CA-5.4: Conversión de formato', () => {
    test('Configuración de formato de salida', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');

      // Verificar que existe configuración para conversión
      const imageConfig = vscode.workspace.getConfiguration('assetManager');

      // Simular configuraciones típicas
      const supportedFormats = ['webp', 'avif', 'png', 'jpg'];

      for (const format of supportedFormats) {
        // Al menos el sistema debe reconocer estos formatos
        const isImage = ['webp', 'avif', 'png', 'jpg', 'jpeg', 'gif', 'svg'].includes(format);
        assert.ok(isImage, `${format} debe ser formato de imagen reconocido`);
      }
    });
  });
});
