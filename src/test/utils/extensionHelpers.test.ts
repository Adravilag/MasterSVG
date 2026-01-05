/**
 * Tests para extensionHelpers.ts
 *
 * Funciones utilitarias extraídas de extension.ts
 */

import {
  getOutputFormat,
  generateIconSnippet,
  toVariableName,
  toIconName,
  toCustomElementName,
  findImportInsertPosition,
  hasImport,
  generateImportStatement,
  generateIconEntry,
  generateIconsFileContent,
  generateVariantsFileContent,
  generateAnimationsFileContent,
  generateSvgSymbol,
  generateSpriteFileContent,
  generateScriptTag,
  parseIconifySearchResults,
  iconExistsInFile,
  replaceIconInFile,
  addIconToFile,
  symbolExistsInSprite,
  replaceSymbolInSprite,
  addSymbolToSprite,
} from '../../utils/extensionHelpers';

describe('extensionHelpers', () => {
  // =====================================================
  // getOutputFormat
  // =====================================================
  describe('getOutputFormat', () => {
    test('debe retornar jsx para javascriptreact', () => {
      expect(getOutputFormat('javascriptreact')).toBe('jsx');
    });

    test('debe retornar jsx para typescriptreact', () => {
      expect(getOutputFormat('typescriptreact')).toBe('jsx');
    });

    test('debe retornar vue para vue', () => {
      expect(getOutputFormat('vue')).toBe('vue');
    });

    test('debe retornar svelte para svelte', () => {
      expect(getOutputFormat('svelte')).toBe('svelte');
    });

    test('debe retornar astro para astro', () => {
      expect(getOutputFormat('astro')).toBe('astro');
    });

    test('debe retornar html para html', () => {
      expect(getOutputFormat('html')).toBe('html');
    });

    test('debe retornar jsx por defecto para languageId desconocido', () => {
      expect(getOutputFormat('python')).toBe('jsx');
      expect(getOutputFormat('unknown')).toBe('jsx');
      expect(getOutputFormat('')).toBe('jsx');
    });
  });

  // =====================================================
  // generateIconSnippet
  // =====================================================
  describe('generateIconSnippet', () => {
    test('debe generar snippet JSX por defecto', () => {
      const result = generateIconSnippet('arrow-right', 'Icon', 'name', 'jsx');
      expect(result).toContain('<Icon name="arrow-right"');
      expect(result).toContain('size={${2:24}}');
    });

    test('debe generar snippet Vue', () => {
      const result = generateIconSnippet('home', 'SgIcon', 'name', 'vue');
      expect(result).toContain('<SgIcon name="home"');
      expect(result).toContain(':size="${2:24}"');
    });

    test('debe generar snippet Svelte', () => {
      const result = generateIconSnippet('user', 'Icon', 'icon', 'svelte');
      expect(result).toContain('<Icon icon="user"');
      expect(result).toContain('size={${2:24}}');
    });

    test('debe generar snippet Astro', () => {
      const result = generateIconSnippet('star', 'Icon', 'name', 'astro');
      expect(result).toContain('<Icon name="star"');
    });

    test('debe generar snippet HTML con tag de cierre', () => {
      const result = generateIconSnippet('menu', 'svg-icon', 'name', 'html');
      expect(result).toContain('<svg-icon name="menu"');
      expect(result).toContain('</svg-icon>');
    });
  });

  // =====================================================
  // toVariableName
  // =====================================================
  describe('toVariableName', () => {
    test('debe convertir kebab-case a camelCase', () => {
      expect(toVariableName('arrow-right')).toBe('arrowRight');
      expect(toVariableName('chevron-down-small')).toBe('chevronDownSmall');
    });

    test('debe manejar nombres con prefijo de colección', () => {
      expect(toVariableName('lucide:arrow-left')).toBe('lucideArrowLeft');
      expect(toVariableName('heroicons:home')).toBe('heroiconsHome');
    });

    test('debe mantener nombres sin guiones', () => {
      expect(toVariableName('home')).toBe('home');
      expect(toVariableName('star')).toBe('star');
    });

    test('debe manejar múltiples guiones', () => {
      expect(toVariableName('arrow-up-right-from-square')).toBe('arrowUpRightFromSquare');
    });
  });

  // =====================================================
  // toIconName
  // =====================================================
  describe('toIconName', () => {
    test('debe convertir camelCase a kebab-case', () => {
      expect(toIconName('arrowRight')).toBe('arrow-right');
      expect(toIconName('chevronDownSmall')).toBe('chevron-down-small');
    });

    test('debe convertir PascalCase a kebab-case', () => {
      expect(toIconName('ArrowRight')).toBe('arrow-right');
      expect(toIconName('HomeIcon')).toBe('home-icon');
    });

    test('debe eliminar caracteres especiales', () => {
      expect(toIconName('arrow_right')).toBe('arrow-right');
      expect(toIconName('icon@2x')).toBe('icon-2x');
      expect(toIconName('file.svg')).toBe('file-svg');
    });

    test('debe eliminar guiones al inicio y final', () => {
      expect(toIconName('-arrow-')).toBe('arrow');
      expect(toIconName('--home--')).toBe('home');
    });

    test('debe manejar nombres ya en kebab-case', () => {
      expect(toIconName('arrow-right')).toBe('arrow-right');
    });
  });

  // =====================================================
  // toCustomElementName
  // =====================================================
  describe('toCustomElementName', () => {
    test('debe convertir a kebab-case', () => {
      expect(toCustomElementName('SgIcon')).toBe('sg-icon');
      expect(toCustomElementName('IconComponent')).toBe('icon-component');
    });

    test('debe añadir -icon si no tiene guión', () => {
      expect(toCustomElementName('icon')).toBe('icon-icon');
      expect(toCustomElementName('svg')).toBe('svg-icon');
    });

    test('debe mantener nombres ya con guión', () => {
      expect(toCustomElementName('my-icon')).toBe('my-icon');
      expect(toCustomElementName('svg-icon')).toBe('svg-icon');
    });
  });

  // =====================================================
  // findImportInsertPosition
  // =====================================================
  describe('findImportInsertPosition', () => {
    test('debe retornar 0 para archivo sin imports', () => {
      const text = `const x = 1;
function foo() {}`;
      expect(findImportInsertPosition(text)).toBe(0);
    });

    test('debe retornar línea después del último import', () => {
      const text = `import React from 'react';
import { useState } from 'react';

const App = () => {};`;
      expect(findImportInsertPosition(text)).toBe(2);
    });

    test('debe ignorar comentarios al inicio', () => {
      const text = `// Comment
/* Block comment */
import React from 'react';

const x = 1;`;
      expect(findImportInsertPosition(text)).toBe(3);
    });

    test('debe manejar archivo vacío', () => {
      expect(findImportInsertPosition('')).toBe(0);
    });
  });

  // =====================================================
  // hasImport
  // =====================================================
  describe('hasImport', () => {
    test('debe detectar import existente', () => {
      const text = `import { Icon } from '@/components';`;
      expect(hasImport(text, 'Icon')).toBe(true);
    });

    test('debe detectar import con alias', () => {
      const text = `import { Icon as MyIcon } from '@/components';`;
      expect(hasImport(text, 'Icon')).toBe(true);
    });

    test('debe retornar false si no existe', () => {
      const text = `import { Button } from '@/components';`;
      expect(hasImport(text, 'Icon')).toBe(false);
    });

    test('debe retornar false para archivo vacío', () => {
      expect(hasImport('', 'Icon')).toBe(false);
    });
  });

  // =====================================================
  // generateImportStatement
  // =====================================================
  describe('generateImportStatement', () => {
    test('debe generar import statement correcto', () => {
      const result = generateImportStatement('Icon', '@/components/ui/Icon');
      expect(result).toBe("import { Icon } from '@/components/ui/Icon';\n");
    });

    test('debe manejar paths relativos', () => {
      const result = generateImportStatement('Button', './Button');
      expect(result).toBe("import { Button } from './Button';\n");
    });
  });

  // =====================================================
  // generateIconEntry
  // =====================================================
  describe('generateIconEntry', () => {
    test('debe generar entrada de icono correcta', () => {
      const result = generateIconEntry(
        'arrowRight',
        'arrow-right',
        '<path d="M5 12h14"/>',
        '0 0 24 24'
      );

      expect(result).toContain('export const arrowRight');
      expect(result).toContain("name: 'arrow-right'");
      expect(result).toContain('body: `<path d="M5 12h14"/>`');
      expect(result).toContain("viewBox: '0 0 24 24'");
    });
  });

  // =====================================================
  // generateIconsFileContent
  // =====================================================
  describe('generateIconsFileContent', () => {
    test('debe generar contenido de archivo icons.js', () => {
      const entry = 'export const home = { name: "home", body: `<path/>`, viewBox: "0 0 24 24" };';
      const result = generateIconsFileContent(entry, 'home');

      expect(result).toContain('// Auto-generated by MasterSVG');
      expect(result).toContain('// Do not edit manually');
      expect(result).toContain(entry);
      expect(result).toContain('export const icons = {');
      expect(result).toContain('home');
    });
  });

  // =====================================================
  // generateVariantsFileContent
  // =====================================================
  describe('generateVariantsFileContent', () => {
    test('debe generar contenido de variants.js', () => {
      const result = generateVariantsFileContent();

      expect(result).toContain('// Auto-generated by MasterSVG');
      expect(result).toContain('export const defaultVariants');
      expect(result).toContain('export const Variants');
    });
  });

  // =====================================================
  // generateAnimationsFileContent
  // =====================================================
  describe('generateAnimationsFileContent', () => {
    test('debe generar contenido de animations.js', () => {
      const result = generateAnimationsFileContent();

      expect(result).toContain('// Auto-generated by MasterSVG');
      expect(result).toContain('export const animations');
      expect(result).toContain('spin, pulse, bounce, shake, fade');
    });
  });

  // =====================================================
  // generateSvgSymbol
  // =====================================================
  describe('generateSvgSymbol', () => {
    test('debe generar symbol SVG correcto', () => {
      const result = generateSvgSymbol('arrow', '<path d="M5 12h14"/>', '0 0 24 24');

      expect(result).toContain('<symbol id="arrow"');
      expect(result).toContain('viewBox="0 0 24 24"');
      expect(result).toContain('<path d="M5 12h14"/>');
      expect(result).toContain('</symbol>');
    });
  });

  // =====================================================
  // generateSpriteFileContent
  // =====================================================
  describe('generateSpriteFileContent', () => {
    test('debe generar contenido de sprite.svg', () => {
      const symbol = '  <symbol id="home" viewBox="0 0 24 24"><path/></symbol>';
      const result = generateSpriteFileContent(symbol);

      expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('style="display: none;"');
      expect(result).toContain(symbol);
      expect(result).toContain('</svg>');
    });
  });

  // =====================================================
  // generateScriptTag
  // =====================================================
  describe('generateScriptTag', () => {
    test('debe generar script tag correcto', () => {
      const result = generateScriptTag('./icons/icon.js');

      expect(result).toContain('<script type="module"');
      expect(result).toContain('src="./icons/icon.js"');
      expect(result).toContain('</script>');
    });
  });

  // =====================================================
  // parseIconifySearchResults
  // =====================================================
  describe('parseIconifySearchResults', () => {
    test('debe parsear resultados de Iconify', () => {
      const data = {
        icons: ['lucide:arrow-right', 'heroicons:home', 'tabler:star'],
      };

      const result = parseIconifySearchResults(data);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ prefix: 'lucide', name: 'arrow-right' });
      expect(result[1]).toEqual({ prefix: 'heroicons', name: 'home' });
      expect(result[2]).toEqual({ prefix: 'tabler', name: 'star' });
    });

    test('debe manejar data vacía', () => {
      expect(parseIconifySearchResults({})).toEqual([]);
      expect(parseIconifySearchResults({ icons: [] })).toEqual([]);
    });

    test('debe ignorar iconos sin formato correcto', () => {
      const data = {
        icons: ['lucide:arrow', 'invalid', ':noprefix', 'noname:'],
      };

      const result = parseIconifySearchResults(data);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ prefix: 'lucide', name: 'arrow' });
    });
  });

  // =====================================================
  // iconExistsInFile
  // =====================================================
  describe('iconExistsInFile', () => {
    test('debe detectar icono existente', () => {
      const content = `export const arrowRight = { name: 'arrow-right' };`;
      expect(iconExistsInFile(content, 'arrowRight')).toBe(true);
    });

    test('debe retornar false si no existe', () => {
      const content = `export const home = { name: 'home' };`;
      expect(iconExistsInFile(content, 'arrowRight')).toBe(false);
    });
  });

  // =====================================================
  // replaceIconInFile
  // =====================================================
  describe('replaceIconInFile', () => {
    test('debe reemplazar icono existente', () => {
      const content = `export const arrowRight = {
  name: 'arrow-right',
  body: \`<path/>\`,
  viewBox: '0 0 24 24'
};

export const icons = { arrowRight };`;

      const newEntry = `export const arrowRight = {
  name: 'arrow-right',
  body: \`<path d="M5 12h14"/>\`,
  viewBox: '0 0 24 24'
};`;

      const result = replaceIconInFile(content, 'arrowRight', newEntry);

      expect(result).toContain('<path d="M5 12h14"/>');
      expect(result).not.toContain('<path/>');
    });
  });

  // =====================================================
  // addIconToFile
  // =====================================================
  describe('addIconToFile', () => {
    test('debe añadir icono antes del objeto icons', () => {
      const content = `// Header
export const home = { name: 'home' };

export const icons = {
  home
};`;

      const newEntry = `export const star = { name: 'star' };`;
      const result = addIconToFile(content, 'star', newEntry);

      expect(result).toContain(newEntry);
      expect(result).toContain('star');
    });

    test('debe añadir al final si no hay objeto icons', () => {
      const content = `export const home = { name: 'home' };`;
      const newEntry = `export const star = { name: 'star' };`;

      const result = addIconToFile(content, 'star', newEntry);

      expect(result).toContain(newEntry);
    });
  });

  // =====================================================
  // symbolExistsInSprite
  // =====================================================
  describe('symbolExistsInSprite', () => {
    test('debe detectar symbol existente', () => {
      const content = `<svg><symbol id="arrow" viewBox="0 0 24 24"></symbol></svg>`;
      expect(symbolExistsInSprite(content, 'arrow')).toBe(true);
    });

    test('debe retornar false si no existe', () => {
      const content = `<svg><symbol id="home" viewBox="0 0 24 24"></symbol></svg>`;
      expect(symbolExistsInSprite(content, 'arrow')).toBe(false);
    });

    test('debe manejar comillas simples y dobles', () => {
      const content1 = `<svg><symbol id="arrow"></symbol></svg>`;
      const content2 = `<svg><symbol id='arrow'></symbol></svg>`;

      expect(symbolExistsInSprite(content1, 'arrow')).toBe(true);
      expect(symbolExistsInSprite(content2, 'arrow')).toBe(true);
    });
  });

  // =====================================================
  // replaceSymbolInSprite
  // =====================================================
  describe('replaceSymbolInSprite', () => {
    test('debe reemplazar symbol existente', () => {
      const content = `<svg>
  <symbol id="arrow" viewBox="0 0 24 24"><path/></symbol>
</svg>`;

      const newSymbol = `  <symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>`;
      const result = replaceSymbolInSprite(content, 'arrow', newSymbol);

      expect(result).toContain('<path d="M5 12h14"/>');
      expect(result).not.toContain('<path/>');
    });
  });

  // =====================================================
  // addSymbolToSprite
  // =====================================================
  describe('addSymbolToSprite', () => {
    test('debe añadir symbol antes de </svg>', () => {
      const content = `<svg>
  <symbol id="home"></symbol>
</svg>`;

      const newSymbol = `  <symbol id="star"></symbol>`;
      const result = addSymbolToSprite(content, newSymbol);

      expect(result).toContain('<symbol id="star">');
      expect(result).toContain('</svg>');
      expect(result.indexOf('<symbol id="star">')).toBeLessThan(result.indexOf('</svg>'));
    });
  });
});
