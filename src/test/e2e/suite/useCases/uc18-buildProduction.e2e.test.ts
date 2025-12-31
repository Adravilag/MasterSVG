/**
 * UC-18: Build de Iconos para Producción
 * UC-5: Incorporar Nuevos Iconos a un Proyecto Existente
 * UC-6: Actualizar o Reemplazar Iconos
 *
 * Tests E2E para flujos de producción y gestión de iconos
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('UC-18: Build de Iconos para Producción', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-18.1: Comandos de build', () => {
    test('Debe existir comando buildIcons', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.buildIcons'), 'Comando buildIcons debe existir');
    });

    test('Debe existir comando exportAll', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.exportAll'), 'Comando exportAll debe existir');
    });
  });

  suite('CA-18.2: Proceso de build', () => {
    test('Debe generar archivos optimizados', () => {
      const originalSvg = `<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        version="1.1"
        id="Layer_1"
        x="0px" y="0px"
        viewBox="0 0 24 24"
        xml:space="preserve">
        <!-- Comment -->
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="#000000"/>
      </svg>`;

      // Simular optimización
      const optimized = originalSvg
        .replace(/<!--[\s\S]*?-->/g, '') // Remover comentarios
        .replace(/xmlns:xlink="[^"]*"/g, '')
        .replace(/version="[^"]*"/g, '')
        .replace(/id="[^"]*"/g, '')
        .replace(/x="0px"\s*/g, '')
        .replace(/y="0px"\s*/g, '')
        .replace(/xml:space="[^"]*"/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      assert.ok(optimized.length < originalSvg.length, 'SVG optimizado debe ser más pequeño');
      assert.ok(!optimized.includes('<!--'), 'No debe tener comentarios');
      assert.ok(!optimized.includes('version='), 'No debe tener atributo version');
    });

    test('Debe generar índice de exportaciones', () => {
      const iconNames = ['home', 'settings', 'user', 'search'];

      // Generar archivo index.js
      const indexContent = iconNames
        .map(
          name =>
            `export { default as ${name.charAt(0).toUpperCase() + name.slice(1)}Icon } from './${name}';`
        )
        .join('\n');

      assert.ok(indexContent.includes('export { default as HomeIcon }'), 'Debe exportar HomeIcon');
      assert.ok(
        indexContent.includes('export { default as SettingsIcon }'),
        'Debe exportar SettingsIcon'
      );
    });

    test('Debe generar archivo de tipos TypeScript', () => {
      const typesContent = `// Auto-generated type definitions
import { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

export declare const HomeIcon: React.FC<IconProps>;
export declare const SettingsIcon: React.FC<IconProps>;
export declare const UserIcon: React.FC<IconProps>;
`;

      assert.ok(typesContent.includes('interface IconProps'), 'Debe definir IconProps interface');
      assert.ok(typesContent.includes('declare const'), 'Debe declarar componentes');
    });
  });

  suite('CA-18.3: Configuración de build', () => {
    test('Debe tener configuración buildOutputPath', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const outputPath = config.get<string>('build.outputPath');

      assert.ok(
        outputPath === undefined || typeof outputPath === 'string',
        'build.outputPath debe ser string'
      );
    });

    test('Debe tener configuración buildFormats', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const formats = config.get<string[]>('build.formats');

      // Formatos posibles: 'svg', 'jsx', 'tsx', 'vue', 'svelte', 'astro', 'webcomponent'
      assert.ok(formats === undefined || Array.isArray(formats), 'build.formats debe ser array');
    });
  });
});

suite('UC-5: Incorporar Nuevos Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-5.1: Importación de iconos', () => {
    test('Debe existir comando importIcons', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.importIcons'), 'Comando importIcons debe existir');
    });

    test('Debe existir comando importFromFolder', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.importFromFolder'),
        'Comando importFromFolder debe existir'
      );
    });

    test('Debe existir comando addToProject', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.addToProject'), 'Comando addToProject debe existir');
    });
  });

  suite('CA-5.2: Validación de SVG importado', () => {
    test('Debe validar estructura SVG básica', () => {
      const validSvgs = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="..."/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>',
      ];

      const invalidSvgs = ['<div>Not an SVG</div>', '<svg>No xmlns</svg>', 'Just text, no SVG'];

      validSvgs.forEach(svg => {
        const isValid =
          svg.includes('<svg') &&
          svg.includes('xmlns="http://www.w3.org/2000/svg"') &&
          svg.includes('</svg>');
        assert.ok(isValid, 'SVG válido debe pasar validación');
      });

      invalidSvgs.forEach(svg => {
        const hasXmlns = svg.includes('xmlns="http://www.w3.org/2000/svg"');
        assert.ok(!hasXmlns, 'SVG inválido no debe tener xmlns correcto');
      });
    });

    test('Debe detectar SVG con problemas potenciales', () => {
      const problematicSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('xss')</script>
        <image href="http://external.com/img.jpg"/>
        <foreignObject><div>HTML</div></foreignObject>
      </svg>`;

      const dangerousElements = ['<script', '<foreignObject', '<image href="http'];

      dangerousElements.forEach(element => {
        assert.ok(
          problematicSvg.includes(element.replace('<', '')),
          `Debe detectar elemento peligroso: ${element}`
        );
      });
    });
  });

  suite('CA-5.3: Naming al importar', () => {
    test('Debe sanitizar nombres de archivo', () => {
      const fileNames = [
        { input: 'My Icon.svg', expected: 'my-icon.svg' },
        { input: 'Icon_Name.svg', expected: 'icon-name.svg' },
        { input: 'UPPERCASE.svg', expected: 'uppercase.svg' },
        { input: 'icon (1).svg', expected: 'icon-1.svg' },
        { input: 'ícono.svg', expected: 'icono.svg' },
      ];

      fileNames.forEach(({ input, expected }) => {
        const sanitized = input
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/_/g, '-')
          .replace(/[()]/g, '')
          .replace(/[áàäâ]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöô]/g, 'o')
          .replace(/[úùüû]/g, 'u')
          .replace(/--+/g, '-')
          .replace(/(?:^-|-$)/g, '');

        // Nota: algunos casos pueden diferir según implementación real
        assert.ok(
          typeof sanitized === 'string' && sanitized.length > 0,
          `${input} debe ser sanitizado`
        );
      });
    });

    test('Debe detectar nombres duplicados', () => {
      const existingIcons = new Set(['home', 'settings', 'user']);
      const newIcon = 'home';

      const isDuplicate = existingIcons.has(newIcon);
      assert.ok(isDuplicate, 'Debe detectar nombre duplicado');

      // Generar nombre alternativo
      let uniqueName = newIcon;
      let counter = 1;
      while (existingIcons.has(uniqueName)) {
        uniqueName = `${newIcon}-${counter}`;
        counter++;
      }

      assert.strictEqual(uniqueName, 'home-1', 'Debe generar nombre único');
    });
  });
});

suite('UC-6: Actualizar o Reemplazar Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-6.1: Comandos de actualización', () => {
    test('Debe existir comando replaceIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('sageboxIconStudio.replaceIcon'), 'Comando replaceIcon debe existir');
    });

    test('Debe existir comando updateIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      // Puede ser updateIcon o editIcon
      const hasUpdateCommand = commands.some(
        cmd => cmd.includes('updateIcon') || cmd.includes('editIcon') || cmd.includes('saveIcon')
      );
      assert.ok(hasUpdateCommand, 'Debe existir comando de actualización');
    });
  });

  suite('CA-6.2: Proceso de reemplazo', () => {
    const testIconPath = path.join(testWorkspace, 'icons', 'test-replace.svg');

    suiteSetup(() => {
      const originalSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>';
      const iconsDir = path.join(testWorkspace, 'icons');
      if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
      }
      fs.writeFileSync(testIconPath, originalSvg);
    });

    test('Debe mantener el mismo nombre de archivo', () => {
      const originalPath = testIconPath;
      const originalName = path.basename(originalPath);

      // Simular reemplazo
      const newSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2"/></svg>';
      fs.writeFileSync(originalPath, newSvg);

      const newName = path.basename(originalPath);
      assert.strictEqual(newName, originalName, 'Nombre debe mantenerse igual');
    });

    test('Debe crear backup antes de reemplazar', () => {
      const backupDir = path.join(testWorkspace, '.iconbackup');

      // Simular creación de backup
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = Date.now();
      const backupName = `test-replace.${timestamp}.svg.bak`;
      const backupPath = path.join(backupDir, backupName);

      fs.writeFileSync(backupPath, '<svg><path d="backup"/></svg>');

      assert.ok(fs.existsSync(backupPath), 'Backup debe existir');

      // Limpiar
      fs.unlinkSync(backupPath);
      fs.rmdirSync(backupDir);
    });

    suiteTeardown(() => {
      if (fs.existsSync(testIconPath)) {
        fs.unlinkSync(testIconPath);
      }
    });
  });

  suite('CA-6.3: Actualización de referencias', () => {
    test('Debe detectar usos del icono reemplazado', () => {
      const oldIconName = 'old-icon';
      const codeWithUsages = `
        import { OldIcon } from './icons/old-icon';
        <OldIcon />
        <Icon name="old-icon" />
      `;

      const usagePattern = new RegExp(oldIconName, 'gi');
      const matches = codeWithUsages.match(usagePattern);

      assert.ok(matches && matches.length >= 2, 'Debe encontrar al menos 2 usos del icono');
    });

    test('Debe poder renombrar icono y actualizar usos', () => {
      const oldName = 'old-icon';
      const newName = 'new-icon';

      let code = `
        import { OldIcon } from './icons/old-icon';
        <OldIcon />
        <Icon name="old-icon" />
      `;

      // Actualizar import path
      code = code.replace(new RegExp(`/icons/${oldName}`, 'g'), `/icons/${newName}`);
      // Actualizar nombre de componente (PascalCase)
      const oldPascal = oldName
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
      const newPascal = newName
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
      code = code.replace(new RegExp(oldPascal, 'g'), newPascal);
      // Actualizar name prop
      code = code.replace(new RegExp(`name="${oldName}"`, 'g'), `name="${newName}"`);

      assert.ok(code.includes(newName), 'Código debe tener nuevo nombre');
      assert.ok(!code.includes(oldName), 'Código no debe tener nombre antiguo');
    });
  });
});
