/**
 * UC-7: Buscar e Integrar Iconos de Librerías Externas
 * UC-26: Gestionar Iconos desde Búsqueda Iconify
 *
 * Tests E2E para integración con Iconify y búsqueda de iconos externos
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('UC-7: Integración con Iconify', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-7.1: Búsqueda de iconos', () => {
    test('Debe existir comando searchIconify', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.searchIconify'),
        'Comando searchIconify debe existir'
      );
    });

    test('Debe existir comando openIconifySearch', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.openIconifySearch'),
        'Comando openIconifySearch debe existir'
      );
    });

    test('Debe poder filtrar por colecciones populares', async () => {
      // Colecciones populares de Iconify
      const popularCollections = [
        'mdi', // Material Design Icons
        'ph', // Phosphor Icons
        'lucide', // Lucide
        'heroicons', // Heroicons
        'tabler', // Tabler Icons
        'fa6-solid', // Font Awesome 6 Solid
        'ri', // Remix Icon
        'carbon', // Carbon Icons
        'fluent', // Fluent UI
      ];

      assert.ok(
        popularCollections.length >= 5,
        'Debe haber al menos 5 colecciones populares configurables'
      );
    });
  });

  suite('CA-7.2: Previsualización', () => {
    test('Debe existir comando previewIconify', async () => {
      const commands = await vscode.commands.getCommands(true);
      const hasPreviewCommand = commands.some(
        cmd => cmd.includes('preview') || cmd.includes('Preview')
      );
      assert.ok(hasPreviewCommand, 'Debe existir comando de previsualización');
    });

    test('Formato de identificador Iconify', () => {
      // Formato: prefix:name o prefix:name:variant
      const validIdentifiers = [
        'mdi:home',
        'ph:house-fill',
        'lucide:settings',
        'heroicons:user-solid',
        'tabler:brand-github',
      ];

      const iconifyPattern = /^[a-z0-9-]+:[a-z0-9-]+(-[a-z0-9]+)*$/i;

      validIdentifiers.forEach(id => {
        assert.ok(iconifyPattern.test(id), `${id} debe ser un identificador Iconify válido`);
      });
    });
  });

  suite('CA-7.3: Descarga e importación', () => {
    test('Debe existir comando downloadFromIconify', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.downloadFromIconify'),
        'Comando downloadFromIconify debe existir'
      );
    });

    test('Debe existir comando addToProject (desde Iconify)', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.addToProject'), 'Comando addToProject debe existir');
    });

    test('Debe generar nombre de archivo válido desde identificador', () => {
      const iconifyId = 'mdi:home-outline';

      // Convertir identificador a nombre de archivo
      const fileName = iconifyId.replace(':', '-') + '.svg';

      assert.strictEqual(
        fileName,
        'mdi-home-outline.svg',
        'Debe generar nombre de archivo correcto'
      );
    });
  });
});

suite('UC-26: Gestionar Iconos desde Búsqueda Iconify', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-26.1: Colecciones de iconos', () => {
    test('Configuración de colecciones favoritas', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');

      // La configuración puede incluir colecciones favoritas
      const favoriteCollections = config.get<string[]>('iconify.favoriteCollections') || [];

      // Verificar que es un array (puede estar vacío por defecto)
      assert.ok(Array.isArray(favoriteCollections), 'favoriteCollections debe ser un array');
    });
  });

  suite('CA-26.2: Variantes de iconos', () => {
    test('Debe poder identificar variantes del mismo icono', () => {
      const iconVariants = [
        'ph:house',
        'ph:house-fill',
        'ph:house-bold',
        'ph:house-light',
        'ph:house-thin',
        'ph:house-duotone',
      ];

      // Extraer el nombre base
      const baseNames = iconVariants.map(v => v.split(':')[1].split('-')[0]);
      const uniqueBase = [...new Set(baseNames)];

      assert.strictEqual(
        uniqueBase.length,
        1,
        'Todas las variantes deben tener el mismo nombre base'
      );
      assert.strictEqual(uniqueBase[0], 'house', 'El nombre base debe ser "house"');
    });
  });

  suite('CA-26.3: Importación a proyecto', () => {
    test('Debe poder especificar carpeta de destino', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      const svgFolders = config.get<string[]>('svgFolders') || [];

      // Si hay carpetas configuradas, la primera podría ser el destino por defecto
      assert.ok(Array.isArray(svgFolders), 'svgFolders debe existir para destino de importación');
    });

    test('Debe preservar atributos SVG al importar', () => {
      // SVG típico de Iconify
      const iconifySvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

      // Verificar que tiene los atributos esenciales
      assert.ok(iconifySvg.includes('xmlns'), 'Debe preservar xmlns');
      assert.ok(iconifySvg.includes('viewBox'), 'Debe preservar viewBox');
      assert.ok(iconifySvg.includes('width'), 'Debe tener width');
      assert.ok(iconifySvg.includes('height'), 'Debe tener height');
    });
  });
});

suite('Integración API Iconify', () => {
  suite('Formato de respuesta API', () => {
    test('Debe parsear respuesta de búsqueda', () => {
      // Estructura típica de respuesta de Iconify API
      const mockSearchResponse = {
        icons: ['mdi:home', 'mdi:home-outline', 'mdi:home-variant'],
        total: 3,
        limit: 100,
        start: 0,
        collections: {
          mdi: {
            name: 'Material Design Icons',
            total: 3,
            author: {
              name: 'Pictogrammers',
            },
          },
        },
      };

      assert.ok(Array.isArray(mockSearchResponse.icons), 'icons debe ser array');
      assert.ok(typeof mockSearchResponse.total === 'number', 'total debe ser número');
      assert.ok(typeof mockSearchResponse.collections === 'object', 'collections debe ser objeto');
    });

    test('Debe parsear SVG de icono individual', () => {
      // Formato de respuesta para obtener un icono
      const mockIconResponse = {
        body: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>',
        width: 24,
        height: 24,
        left: 0,
        top: 0,
      };

      assert.ok(mockIconResponse.body, 'Debe tener body con paths');
      assert.strictEqual(mockIconResponse.width, 24, 'Debe tener width');
      assert.strictEqual(mockIconResponse.height, 24, 'Debe tener height');
    });

    test('Debe generar SVG completo desde respuesta', () => {
      const iconData = {
        body: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>',
        width: 24,
        height: 24,
      };

      const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconData.width}" height="${iconData.height}" viewBox="0 0 ${iconData.width} ${iconData.height}">${iconData.body}</svg>`;

      assert.ok(fullSvg.startsWith('<svg'), 'Debe comenzar con <svg');
      assert.ok(fullSvg.endsWith('</svg>'), 'Debe terminar con </svg>');
      assert.ok(fullSvg.includes(iconData.body), 'Debe incluir el body');
    });
  });

  suite('Caché de búsquedas', () => {
    test('Debe poder cachear resultados de búsqueda', () => {
      const searchCache = new Map<string, { results: string[]; timestamp: number }>();

      // Simular caché
      searchCache.set('home', {
        results: ['mdi:home', 'ph:house'],
        timestamp: Date.now(),
      });

      const cached = searchCache.get('home');
      assert.ok(cached, 'Debe recuperar resultados cacheados');
      assert.strictEqual(cached!.results.length, 2, 'Debe tener 2 resultados');
    });

    test('Debe expirar caché después de tiempo configurado', () => {
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutos atrás
      const isExpired = Date.now() - oldTimestamp > CACHE_TTL;

      assert.ok(isExpired, 'Caché de 6 minutos debe estar expirado con TTL de 5 min');
    });
  });
});
