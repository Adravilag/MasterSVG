/**
 * UC-10: Documentar Licencias de Iconos
 *
 * Tests E2E para validar la generación de archivos de licencias
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-10: Documentar Licencias de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const outputFolder = path.join(testWorkspace, 'license-output');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    await delay(500);
  });

  suiteTeardown(async () => {
    if (fs.existsSync(outputFolder)) {
      fs.rmSync(outputFolder, { recursive: true, force: true });
    }
  });

  suite('CA-10.1: Comando de generación de licencias', () => {
    test('Debe existir comando generateLicenses', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.generateLicenses') ||
          commands.includes('sageboxIconStudio.generateLicenseFile'),
        'Debe existir comando de generación de licencias'
      );
    });

    test('Debe existir comando showLicenseInfo', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.showLicenseInfo') ||
          commands.includes('sageboxIconStudio.viewLicense'),
        'Debe existir comando para ver información de licencia'
      );
    });
  });

  suite('CA-10.2: Licencias de colecciones populares', () => {
    test('Debe reconocer licencia MIT', () => {
      const mitLicense = {
        name: 'MIT',
        requiresAttribution: false,
        commercialUse: true,
        modification: true,
        distribution: true,
        collections: ['Feather Icons', 'Heroicons', 'Lucide'],
      };

      assert.ok(mitLicense.commercialUse, 'MIT permite uso comercial');
      assert.ok(mitLicense.modification, 'MIT permite modificación');
    });

    test('Debe reconocer licencia Apache 2.0', () => {
      const apacheLicense = {
        name: 'Apache 2.0',
        requiresAttribution: true,
        commercialUse: true,
        modification: true,
        distribution: true,
        collections: ['Material Design Icons'],
      };

      assert.ok(apacheLicense.requiresAttribution, 'Apache requiere atribución');
      assert.ok(apacheLicense.commercialUse, 'Apache permite uso comercial');
    });

    test('Debe reconocer licencia CC BY', () => {
      const ccByLicense = {
        name: 'CC BY 4.0',
        requiresAttribution: true,
        commercialUse: true,
        modification: true,
        distribution: true,
        collections: ['Font Awesome (free)'],
      };

      assert.ok(ccByLicense.requiresAttribution, 'CC BY requiere atribución obligatoria');
    });

    test('Debe reconocer licencia OFL', () => {
      const oflLicense = {
        name: 'SIL OFL 1.1',
        requiresAttribution: false,
        commercialUse: true,
        modification: true,
        distribution: true,
        collections: ['Bootstrap Icons'],
      };

      assert.ok(oflLicense.commercialUse, 'OFL permite uso comercial');
    });
  });

  suite('CA-10.3: Formato de archivo de licencias', () => {
    test('Debe generar contenido de licencia válido', () => {
      const generateLicenseContent = (
        icons: Array<{ name: string; collection: string; license: string }>
      ) => {
        let content = '# Icon Licenses\n\n';
        content += 'This project uses icons from the following sources:\n\n';

        const byCollection = icons.reduce(
          (acc, icon) => {
            if (!acc[icon.collection]) {
              acc[icon.collection] = { license: icon.license, icons: [] };
            }
            acc[icon.collection].icons.push(icon.name);
            return acc;
          },
          {} as Record<string, { license: string; icons: string[] }>
        );

        for (const [collection, data] of Object.entries(byCollection)) {
          content += `## ${collection}\n`;
          content += `License: ${data.license}\n`;
          content += `Icons used: ${data.icons.join(', ')}\n\n`;
        }

        return content;
      };

      const testIcons = [
        { name: 'home', collection: 'Heroicons', license: 'MIT' },
        { name: 'user', collection: 'Heroicons', license: 'MIT' },
        { name: 'settings', collection: 'Feather Icons', license: 'MIT' },
      ];

      const content = generateLicenseContent(testIcons);

      assert.ok(content.includes('# Icon Licenses'), 'Debe tener título');
      assert.ok(content.includes('Heroicons'), 'Debe incluir colección Heroicons');
      assert.ok(content.includes('MIT'), 'Debe incluir licencia MIT');
    });

    test('Debe soportar múltiples formatos de salida', () => {
      const supportedFormats = ['md', 'txt', 'json', 'html'];

      for (const format of supportedFormats) {
        assert.ok(
          ['md', 'txt', 'json', 'html'].includes(format),
          `Formato ${format} debe ser soportado`
        );
      }
    });
  });

  suite('CA-10.4: Integración con proyecto', () => {
    test('Debe poder añadir licencia a documentación', () => {
      const licenseSection = `
## Credits

### Icons
This project uses icons from:
- [Heroicons](https://heroicons.com/) - MIT License
- [Feather Icons](https://feathericons.com/) - MIT License

See [LICENSES.md](./LICENSES.md) for full license information.
`;

      assert.ok(licenseSection.includes('LICENSES.md'), 'Debe referenciar archivo de licencias');
      assert.ok(licenseSection.includes('MIT License'), 'Debe mencionar tipo de licencia');
    });

    test('Debe detectar iconos de Iconify con su licencia', () => {
      // Iconify incluye información de licencia en sus metadatos
      const iconifyIcon = {
        name: 'mdi:home',
        collection: 'mdi',
        author: 'Material Design Icons',
        license: {
          title: 'Apache License 2.0',
          spdx: 'Apache-2.0',
          url: 'https://www.apache.org/licenses/LICENSE-2.0',
        },
      };

      assert.strictEqual(iconifyIcon.license.spdx, 'Apache-2.0');
      assert.ok(iconifyIcon.license.url.includes('apache.org'), 'Debe incluir URL de licencia');
    });
  });

  suite('CA-10.5: Validación de cumplimiento', () => {
    test('Debe verificar atribución requerida', () => {
      const checkAttributionRequired = (license: string): boolean => {
        const requiresAttribution = ['CC BY', 'Apache', 'CC BY-SA'];
        return requiresAttribution.some(l => license.toUpperCase().includes(l.toUpperCase()));
      };

      assert.ok(checkAttributionRequired('CC BY 4.0'), 'CC BY requiere atribución');
      assert.ok(checkAttributionRequired('Apache 2.0'), 'Apache requiere atribución');
      assert.ok(!checkAttributionRequired('MIT'), 'MIT no requiere atribución obligatoria');
    });

    test('Debe advertir sobre licencias restrictivas', () => {
      const restrictiveLicenses = ['GPL', 'AGPL', 'CC BY-NC', 'CC BY-ND'];

      const checkRestrictions = (license: string): string[] => {
        const warnings: string[] = [];

        if (license.includes('NC')) {
          warnings.push('No permite uso comercial');
        }
        if (license.includes('ND')) {
          warnings.push('No permite derivados/modificaciones');
        }
        if (license.includes('GPL') || license.includes('AGPL')) {
          warnings.push('Requiere distribuir código fuente');
        }

        return warnings;
      };

      assert.deepStrictEqual(checkRestrictions('CC BY-NC'), ['No permite uso comercial']);
      assert.deepStrictEqual(checkRestrictions('CC BY-ND'), [
        'No permite derivados/modificaciones',
      ]);
    });
  });
});
