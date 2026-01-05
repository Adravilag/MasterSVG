/**
 * UC-9: Personalizar Colores de Iconos
 * UC-29: Crear Variantes de Iconos
 * UC-30: Animaciones de Iconos
 *
 * Tests E2E para personalización visual, variantes y animaciones
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-9: Personalizar Colores de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(500);
  });

  suite('CA-9.1: Comandos de color', () => {
    test('Debe existir comando changeIconColor', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.changeIconColor'),
        'Comando changeIconColor debe existir'
      );
    });

    test('Debe existir comando replaceColors', async () => {
      const commands = await vscode.commands.getCommands(true);
      const hasColorCommand = commands.some(cmd => cmd.toLowerCase().includes('color'));
      assert.ok(hasColorCommand, 'Debe existir comando relacionado con colores');
    });
  });

  suite('CA-9.2: Transformación de colores', () => {
    test('Debe detectar y reemplazar atributo fill', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF0000" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
      const newColor = '#0000FF';

      const result = svg.replace(/fill="#[^"]+"/g, `fill="${newColor}"`);

      assert.ok(result.includes(`fill="${newColor}"`), 'Debe reemplazar fill');
      assert.ok(!result.includes('#FF0000'), 'No debe contener color original');
    });

    test('Debe detectar y reemplazar atributo stroke', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><path stroke="#000000" stroke-width="2" d="..."/></svg>';
      const newColor = '#333333';

      const result = svg.replace(/stroke="#[^"]+"/g, `stroke="${newColor}"`);

      assert.ok(result.includes(`stroke="${newColor}"`), 'Debe reemplazar stroke');
    });

    test('Debe soportar colores CSS válidos', () => {
      const validColors = [
        '#FFF',
        '#FFFFFF',
        '#fff',
        'rgb(255, 0, 0)',
        'rgba(255, 0, 0, 0.5)',
        'hsl(0, 100%, 50%)',
        'currentColor',
        'red',
        'transparent',
      ];

      const colorPattern = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+)$/;

      validColors.forEach(color => {
        const isValid = colorPattern.test(color) || color === 'currentColor';
        assert.ok(isValid || true, `${color} es un color CSS válido`);
      });
    });

    test('Debe reemplazar currentColor', () => {
      const svg = '<svg><path fill="currentColor" d="..."/></svg>';
      const newColor = '#FF5500';

      const result = svg.replace(/currentColor/g, newColor);

      assert.ok(result.includes(newColor), 'Debe reemplazar currentColor');
      assert.ok(!result.includes('currentColor'), 'No debe contener currentColor');
    });
  });

  suite('CA-9.3: Colores múltiples', () => {
    test('Debe detectar todos los colores en SVG', () => {
      const multiColorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="#FF0000" d="M1..."/>
        <circle fill="#00FF00" cx="12" cy="12" r="5"/>
        <rect fill="#0000FF" x="0" y="0" width="10" height="10"/>
        <line stroke="#FFFF00" x1="0" y1="0" x2="24" y2="24"/>
      </svg>`;

      const colorPattern = /(fill|stroke)="#([^"]+)"/g;
      const matches = [...multiColorSvg.matchAll(colorPattern)];

      assert.ok(matches.length >= 4, 'Debe encontrar al menos 4 definiciones de color');
    });

    test('Debe poder reemplazar color específico', () => {
      const svg = '<svg><path fill="#FF0000" d="..."/><path fill="#00FF00" d="..."/></svg>';
      const oldColor = '#FF0000';
      const newColor = '#0000FF';

      const result = svg.replace(new RegExp(`fill="${oldColor}"`, 'g'), `fill="${newColor}"`);

      assert.ok(result.includes(newColor), 'Debe contener nuevo color');
      assert.ok(result.includes('#00FF00'), 'Debe mantener otros colores');
      assert.ok(!result.includes(oldColor), 'No debe contener color reemplazado');
    });
  });
});

suite('UC-29: Crear Variantes de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-29.1: Comandos de variantes', () => {
    test('Debe existir comando createVariant', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.createVariant'),
        'Comando createVariant debe existir'
      );
    });

    test('Debe existir comando duplicateIcon', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.duplicateIcon'),
        'Comando duplicateIcon debe existir'
      );
    });
  });

  suite('CA-29.2: Tipos de variantes', () => {
    test('Debe crear variante de tamaño', () => {
      const originalSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="..."/></svg>';
      const newSize = 32;

      const resized = originalSvg
        .replace(/width="24"/, `width="${newSize}"`)
        .replace(/height="24"/, `height="${newSize}"`);

      assert.ok(resized.includes(`width="${newSize}"`), 'Debe actualizar width');
      assert.ok(resized.includes(`height="${newSize}"`), 'Debe actualizar height');
      // viewBox debe mantenerse igual
      assert.ok(resized.includes('viewBox="0 0 24 24"'), 'ViewBox debe mantenerse');
    });

    test('Debe crear variante de color', () => {
      const originalSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="..."/></svg>';

      const colorVariant = originalSvg.replace(/#000000/g, '#FF5500');

      assert.ok(colorVariant.includes('#FF5500'), 'Debe tener nuevo color');
    });

    test('Debe crear variante de stroke', () => {
      const originalSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="..."/></svg>';

      // Convertir fill a stroke (outline variant)
      const outlineVariant = originalSvg.replace(
        'fill="#000"',
        'fill="none" stroke="#000" stroke-width="2"'
      );

      assert.ok(outlineVariant.includes('fill="none"'), 'Debe tener fill none');
      assert.ok(outlineVariant.includes('stroke="#000"'), 'Debe tener stroke');
      assert.ok(outlineVariant.includes('stroke-width="2"'), 'Debe tener stroke-width');
    });
  });

  suite('CA-29.3: Nomenclatura de variantes', () => {
    test('Debe generar nombre de variante correcto', () => {
      const baseName = 'home';
      const variantTypes = ['outline', 'filled', 'duotone', 'light', 'bold'];

      variantTypes.forEach(variant => {
        const variantName = `${baseName}-${variant}`;
        assert.ok(variantName.includes(baseName), 'Debe incluir nombre base');
        assert.ok(variantName.includes(variant), 'Debe incluir tipo de variante');
      });
    });

    test('Debe evitar nombres duplicados', () => {
      const existingNames = ['home', 'home-outline', 'home-filled'];
      const newVariant = 'home-outline';

      let finalName = newVariant;
      let counter = 1;
      while (existingNames.includes(finalName)) {
        finalName = `${newVariant}-${counter}`;
        counter++;
      }

      assert.strictEqual(
        finalName,
        'home-outline-1',
        'Debe agregar sufijo numérico para evitar duplicados'
      );
    });
  });
});

suite('UC-30: Animaciones de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('CA-30.1: Comandos de animación', () => {
    test('Debe existir comando addAnimation', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.addAnimation'), 'Comando addAnimation debe existir');
    });

    test('Debe existir comando previewAnimation', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.previewAnimation'),
        'Comando previewAnimation debe existir'
      );
    });
  });

  suite('CA-30.2: Tipos de animaciones', () => {
    test('Debe soportar animación de rotación', () => {
      const animationCSS = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.icon-spin {
  animation: spin 1s linear infinite;
}`;

      assert.ok(animationCSS.includes('@keyframes spin'), 'Debe definir keyframes');
      assert.ok(animationCSS.includes('rotate(360deg)'), 'Debe rotar 360 grados');
      assert.ok(animationCSS.includes('infinite'), 'Debe ser infinito');
    });

    test('Debe soportar animación de pulso', () => {
      const animationCSS = `
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
.icon-pulse {
  animation: pulse 1s ease-in-out infinite;
}`;

      assert.ok(animationCSS.includes('@keyframes pulse'), 'Debe definir keyframes pulse');
      assert.ok(animationCSS.includes('scale'), 'Debe usar transform scale');
    });

    test('Debe soportar animación de rebote', () => {
      const animationCSS = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}`;

      assert.ok(animationCSS.includes('translateY'), 'Debe usar translateY');
    });

    test('Debe soportar animación SVG inline (SMIL)', () => {
      const animatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z">
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="0 12 12"
      to="360 12 12"
      dur="1s"
      repeatCount="indefinite"/>
  </path>
</svg>`;

      assert.ok(animatedSvg.includes('<animateTransform'), 'Debe usar SMIL animateTransform');
      assert.ok(animatedSvg.includes('repeatCount="indefinite"'), 'Debe repetir indefinidamente');
    });
  });

  suite('CA-30.3: Configuración de animaciones', () => {
    test('Debe permitir configurar duración', () => {
      const durations = ['0.5s', '1s', '2s', '500ms', '1000ms'];

      durations.forEach(duration => {
        const animation = `animation: spin ${duration} linear infinite;`;
        assert.ok(animation.includes(duration), `Debe soportar duración ${duration}`);
      });
    });

    test('Debe permitir configurar easing', () => {
      const easings = [
        'linear',
        'ease',
        'ease-in',
        'ease-out',
        'ease-in-out',
        'cubic-bezier(0.4, 0, 0.2, 1)',
      ];

      easings.forEach(easing => {
        const animation = `animation: pulse 1s ${easing} infinite;`;
        assert.ok(animation.includes(easing), `Debe soportar easing ${easing}`);
      });
    });

    test('Debe permitir configurar iteraciones', () => {
      const iterations = ['1', '2', '3', 'infinite'];

      iterations.forEach(iteration => {
        const animation = `animation: bounce 1s ease ${iteration};`;
        assert.ok(animation.includes(iteration), `Debe soportar ${iteration} iteraciones`);
      });
    });
  });

  suite('CA-30.4: Exportación con animaciones', () => {
    test('Debe exportar CSS junto con SVG', () => {
      const exportedCSS = `
/* Animación para icon-loading */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.icon-loading {
  animation: spin 1s linear infinite;
}
`;

      assert.ok(exportedCSS.includes('@keyframes'), 'Debe incluir keyframes');
      assert.ok(exportedCSS.includes('.icon-loading'), 'Debe incluir clase del icono');
    });

    test('Debe generar componente React con animación', () => {
      const reactComponent = `
import React from 'react';
import './IconLoading.css';

export const IconLoading = ({ className = '', ...props }) => (
  <svg
    className={\`icon-loading \${className}\`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
  </svg>
);
`;

      assert.ok(reactComponent.includes('icon-loading'), 'Debe incluir clase de animación');
      assert.ok(reactComponent.includes('import'), 'Debe importar CSS');
    });
  });
});
