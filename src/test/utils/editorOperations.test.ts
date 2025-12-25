/**
 * Tests for editorOperations utility module
 */

import {
  // Import Detection
  hasImportForComponent,
  hasImportFromModule,
  findImportInsertLine,
  generateImport,
  generateDefaultImport,
  generateNamedImports,
  getImportEdit,
  // Script Tag Detection
  hasIconsScriptTag,
  findScriptTagInsertPosition,
  generateModuleScriptTag,
  generateScriptTag,
  calculateRelativePath,
  getScriptTagEdit,
  // Language Detection
  isHtmlLanguage,
  supportsImports,
  isJsxLanguage,
  isSfcLanguage,
  // Code Position Utilities
  offsetToPosition,
  positionToOffset,
  getLineContent,
  getLineCount,
  // Text Manipulation
  insertTextAtOffset,
  insertTextAtLine,
  replaceTextRange,
  findAllOccurrences,
  // Import Analysis
  extractImports,
  extractNamedImports,
  extractModulePath,
  addNamedImport,
  // Component Detection
  findComponentUsages,
  findCustomElementUsages,
  containsJsx,
  // Indentation
  detectIndentation,
  getLineIndentation,
  indentText,
} from '../../utils/editorOperations';

describe('editorOperations', () => {
  // ==========================================================================
  // Import Detection Tests
  // ==========================================================================

  describe('hasImportForComponent', () => {
    it('should return true when import exists', () => {
      const content = `import { Icon } from './icons';`;
      expect(hasImportForComponent(content, 'Icon')).toBe(true);
    });

    it('should return false when import does not exist', () => {
      const content = `import { Button } from './components';`;
      expect(hasImportForComponent(content, 'Icon')).toBe(false);
    });

    it('should handle named imports', () => {
      const content = `import { Icon, Button } from './components';`;
      expect(hasImportForComponent(content, 'Icon')).toBe(true);
      expect(hasImportForComponent(content, 'Button')).toBe(true);
    });

    it('should not match partial names', () => {
      const content = `import { IconButton } from './components';`;
      expect(hasImportForComponent(content, 'Icon')).toBe(false);
    });
  });

  describe('hasImportFromModule', () => {
    it('should return true when module is imported', () => {
      const content = `import { something } from './icons';`;
      expect(hasImportFromModule(content, './icons')).toBe(true);
    });

    it('should return false when module is not imported', () => {
      const content = `import { something } from './other';`;
      expect(hasImportFromModule(content, './icons')).toBe(false);
    });

    it('should handle single quotes', () => {
      const content = `import { something } from './icons';`;
      expect(hasImportFromModule(content, './icons')).toBe(true);
    });

    it('should handle double quotes', () => {
      const content = `import { something } from "./icons";`;
      expect(hasImportFromModule(content, './icons')).toBe(true);
    });
  });

  describe('findImportInsertLine', () => {
    it('should return 0 for content without imports', () => {
      const content = `const x = 1;\nconsole.log(x);`;
      expect(findImportInsertLine(content)).toBe(0);
    });

    it('should return line after last import', () => {
      const content = `import { a } from 'a';\nimport { b } from 'b';\n\nconst x = 1;`;
      expect(findImportInsertLine(content)).toBe(2);
    });

    it('should skip comments', () => {
      const content = `// comment\n/* block */\nimport { a } from 'a';\n\ncode`;
      expect(findImportInsertLine(content)).toBe(3);
    });

    it('should handle empty content', () => {
      expect(findImportInsertLine('')).toBe(0);
    });
  });

  describe('generateImport', () => {
    it('should generate named import', () => {
      expect(generateImport('Icon', './icons')).toBe(`import { Icon } from './icons';\n`);
    });
  });

  describe('generateDefaultImport', () => {
    it('should generate default import', () => {
      expect(generateDefaultImport('React', 'react')).toBe(`import React from 'react';\n`);
    });
  });

  describe('generateNamedImports', () => {
    it('should generate multiple named imports', () => {
      expect(generateNamedImports(['Icon', 'Button'], './components'))
        .toBe(`import { Icon, Button } from './components';\n`);
    });

    it('should handle single import', () => {
      expect(generateNamedImports(['Icon'], './icons'))
        .toBe(`import { Icon } from './icons';\n`);
    });
  });

  describe('getImportEdit', () => {
    it('should return edit info for new import', () => {
      const content = `const x = 1;`;
      const edit = getImportEdit(content, 'Icon', './icons');
      expect(edit).not.toBeNull();
      expect(edit?.text).toContain('import { Icon }');
    });

    it('should return null if import exists', () => {
      const content = `import { Icon } from './icons';`;
      expect(getImportEdit(content, 'Icon', './other')).toBeNull();
    });
  });

  // ==========================================================================
  // Script Tag Detection Tests
  // ==========================================================================

  describe('hasIconsScriptTag', () => {
    it('should return true for icon.js', () => {
      expect(hasIconsScriptTag('<script src="icon.js"></script>')).toBe(true);
    });

    it('should return true for icons.js', () => {
      expect(hasIconsScriptTag('<script src="icons.js"></script>')).toBe(true);
    });

    it('should return false for other scripts', () => {
      expect(hasIconsScriptTag('<script src="main.js"></script>')).toBe(false);
    });
  });

  describe('findScriptTagInsertPosition', () => {
    it('should find position before </head>', () => {
      const content = `<html><head></head><body></body></html>`;
      const result = findScriptTagInsertPosition(content);
      expect(result?.beforeHead).toBe(true);
    });

    it('should find position after <body> if no </head>', () => {
      const content = `<html><body></body></html>`;
      const result = findScriptTagInsertPosition(content);
      expect(result?.beforeHead).toBe(false);
    });

    it('should return null if no valid position', () => {
      const content = `<div>content</div>`;
      expect(findScriptTagInsertPosition(content)).toBeNull();
    });
  });

  describe('generateModuleScriptTag', () => {
    it('should generate module script tag', () => {
      expect(generateModuleScriptTag('./icons/icon.js'))
        .toBe(`    <script type="module" src="./icons/icon.js"></script>\n`);
    });

    it('should use custom indent', () => {
      expect(generateModuleScriptTag('./icon.js', '  '))
        .toBe(`  <script type="module" src="./icon.js"></script>\n`);
    });
  });

  describe('generateScriptTag', () => {
    it('should generate regular script tag', () => {
      expect(generateScriptTag('./app.js'))
        .toBe(`    <script src="./app.js"></script>\n`);
    });
  });

  describe('calculateRelativePath', () => {
    it('should calculate relative path in same directory', () => {
      expect(calculateRelativePath('/project/src/page.html', '/project/src/icons/icon.js'))
        .toBe('./icons/icon.js');
    });

    it('should calculate relative path going up', () => {
      expect(calculateRelativePath('/project/src/pages/page.html', '/project/icons/icon.js'))
        .toBe('../../icons/icon.js');
    });

    it('should handle Windows paths', () => {
      expect(calculateRelativePath('C:\\project\\src\\page.html', 'C:\\project\\src\\icons\\icon.js'))
        .toBe('./icons/icon.js');
    });
  });

  describe('getScriptTagEdit', () => {
    it('should return edit info for new script', () => {
      const content = `<html><head></head><body></body></html>`;
      const edit = getScriptTagEdit(content, './icon.js');
      expect(edit).not.toBeNull();
      expect(edit?.text).toContain('script');
    });

    it('should return null if script exists', () => {
      const content = `<script src="icon.js"></script>`;
      expect(getScriptTagEdit(content, './icon.js')).toBeNull();
    });
  });

  // ==========================================================================
  // Language Detection Tests
  // ==========================================================================

  describe('isHtmlLanguage', () => {
    it('should return true for html', () => {
      expect(isHtmlLanguage('html')).toBe(true);
    });

    it('should return true for htm', () => {
      expect(isHtmlLanguage('htm')).toBe(true);
    });

    it('should return false for other languages', () => {
      expect(isHtmlLanguage('javascript')).toBe(false);
    });
  });

  describe('supportsImports', () => {
    it('should return true for JavaScript', () => {
      expect(supportsImports('javascript')).toBe(true);
    });

    it('should return true for TypeScript', () => {
      expect(supportsImports('typescript')).toBe(true);
    });

    it('should return true for JSX', () => {
      expect(supportsImports('javascriptreact')).toBe(true);
    });

    it('should return true for TSX', () => {
      expect(supportsImports('typescriptreact')).toBe(true);
    });

    it('should return true for Vue', () => {
      expect(supportsImports('vue')).toBe(true);
    });

    it('should return true for Svelte', () => {
      expect(supportsImports('svelte')).toBe(true);
    });

    it('should return false for HTML', () => {
      expect(supportsImports('html')).toBe(false);
    });
  });

  describe('isJsxLanguage', () => {
    it('should return true for javascriptreact', () => {
      expect(isJsxLanguage('javascriptreact')).toBe(true);
    });

    it('should return true for typescriptreact', () => {
      expect(isJsxLanguage('typescriptreact')).toBe(true);
    });

    it('should return false for plain javascript', () => {
      expect(isJsxLanguage('javascript')).toBe(false);
    });
  });

  describe('isSfcLanguage', () => {
    it('should return true for Vue', () => {
      expect(isSfcLanguage('vue')).toBe(true);
    });

    it('should return true for Svelte', () => {
      expect(isSfcLanguage('svelte')).toBe(true);
    });

    it('should return true for Astro', () => {
      expect(isSfcLanguage('astro')).toBe(true);
    });

    it('should return false for React', () => {
      expect(isSfcLanguage('javascriptreact')).toBe(false);
    });
  });

  // ==========================================================================
  // Code Position Utilities Tests
  // ==========================================================================

  describe('offsetToPosition', () => {
    it('should convert offset to position', () => {
      const content = 'line1\nline2\nline3';
      expect(offsetToPosition(content, 0)).toEqual({ line: 0, character: 0 });
      expect(offsetToPosition(content, 6)).toEqual({ line: 1, character: 0 });
      expect(offsetToPosition(content, 8)).toEqual({ line: 1, character: 2 });
    });
  });

  describe('positionToOffset', () => {
    it('should convert position to offset', () => {
      const content = 'line1\nline2\nline3';
      expect(positionToOffset(content, 0, 0)).toBe(0);
      expect(positionToOffset(content, 1, 0)).toBe(6);
      expect(positionToOffset(content, 1, 2)).toBe(8);
    });
  });

  describe('getLineContent', () => {
    it('should get line content', () => {
      const content = 'line1\nline2\nline3';
      expect(getLineContent(content, 0)).toBe('line1');
      expect(getLineContent(content, 1)).toBe('line2');
      expect(getLineContent(content, 2)).toBe('line3');
    });

    it('should return empty for out of range', () => {
      expect(getLineContent('test', 5)).toBe('');
    });
  });

  describe('getLineCount', () => {
    it('should count lines', () => {
      expect(getLineCount('line1\nline2\nline3')).toBe(3);
      expect(getLineCount('single')).toBe(1);
      expect(getLineCount('')).toBe(1);
    });
  });

  // ==========================================================================
  // Text Manipulation Tests
  // ==========================================================================

  describe('insertTextAtOffset', () => {
    it('should insert text at offset', () => {
      expect(insertTextAtOffset('hello world', 6, 'beautiful ')).toBe('hello beautiful world');
    });

    it('should insert at beginning', () => {
      expect(insertTextAtOffset('world', 0, 'hello ')).toBe('hello world');
    });

    it('should insert at end', () => {
      expect(insertTextAtOffset('hello', 5, ' world')).toBe('hello world');
    });
  });

  describe('insertTextAtLine', () => {
    it('should insert text at line', () => {
      const content = 'line1\nline3';
      expect(insertTextAtLine(content, 1, 'line2')).toBe('line1\nline2\nline3');
    });

    it('should insert at beginning', () => {
      const content = 'line2\nline3';
      expect(insertTextAtLine(content, 0, 'line1')).toBe('line1\nline2\nline3');
    });
  });

  describe('replaceTextRange', () => {
    it('should replace text range', () => {
      expect(replaceTextRange('hello world', 6, 11, 'universe')).toBe('hello universe');
    });
  });

  describe('findAllOccurrences', () => {
    it('should find all occurrences', () => {
      const content = 'abc abc abc';
      const results = findAllOccurrences(content, /abc/);
      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(4);
      expect(results[2].index).toBe(8);
    });

    it('should return empty array for no matches', () => {
      expect(findAllOccurrences('hello', /xyz/)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Import Analysis Tests
  // ==========================================================================

  describe('extractImports', () => {
    it('should extract all imports', () => {
      const content = `import { a } from 'a';\nimport { b } from 'b';\n\ncode`;
      const imports = extractImports(content);
      expect(imports).toHaveLength(2);
      expect(imports[0].line).toBe(0);
      expect(imports[1].line).toBe(1);
    });

    it('should return empty array for no imports', () => {
      expect(extractImports('const x = 1;')).toHaveLength(0);
    });
  });

  describe('extractNamedImports', () => {
    it('should extract named imports', () => {
      const imports = extractNamedImports(`import { Icon, Button } from './components';`);
      expect(imports).toEqual(['Icon', 'Button']);
    });

    it('should handle single import', () => {
      const imports = extractNamedImports(`import { Icon } from './icons';`);
      expect(imports).toEqual(['Icon']);
    });

    it('should return empty for default import', () => {
      expect(extractNamedImports(`import React from 'react';`)).toEqual([]);
    });
  });

  describe('extractModulePath', () => {
    it('should extract module path', () => {
      expect(extractModulePath(`import { Icon } from './icons';`)).toBe('./icons');
    });

    it('should handle double quotes', () => {
      expect(extractModulePath(`import { Icon } from "./icons";`)).toBe('./icons');
    });

    it('should return null for invalid', () => {
      expect(extractModulePath('const x = 1;')).toBeNull();
    });
  });

  describe('addNamedImport', () => {
    it('should add named import', () => {
      const result = addNamedImport(`import { Icon } from './icons';`, 'Button');
      expect(result).toBe(`import { Icon, Button } from './icons';`);
    });

    it('should not duplicate existing import', () => {
      const result = addNamedImport(`import { Icon } from './icons';`, 'Icon');
      expect(result).toBe(`import { Icon } from './icons';`);
    });
  });

  // ==========================================================================
  // Component Detection Tests
  // ==========================================================================

  describe('findComponentUsages', () => {
    it('should find component usages', () => {
      const content = '<Icon name="home" />\n<Icon name="settings" />';
      const usages = findComponentUsages(content, 'Icon');
      expect(usages).toHaveLength(2);
    });

    it('should handle self-closing and regular tags', () => {
      const content = '<Icon /><Icon></Icon>';
      const usages = findComponentUsages(content, 'Icon');
      expect(usages).toHaveLength(2);
    });
  });

  describe('findCustomElementUsages', () => {
    it('should find custom element usages', () => {
      const content = '<my-icon></my-icon>\n<my-icon />';
      const usages = findCustomElementUsages(content, 'my-icon');
      expect(usages).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const content = '<MY-ICON></MY-ICON>';
      expect(findCustomElementUsages(content, 'my-icon')).toHaveLength(1);
    });
  });

  describe('containsJsx', () => {
    it('should detect JSX component', () => {
      expect(containsJsx('<Component />')).toBe(true);
    });

    it('should detect className attribute', () => {
      expect(containsJsx('<div className="test">')).toBe(true);
    });

    it('should not match HTML', () => {
      expect(containsJsx('<div class="test"></div>')).toBe(false);
    });
  });

  // ==========================================================================
  // Indentation Tests
  // ==========================================================================

  describe('detectIndentation', () => {
    it('should detect 2 spaces', () => {
      const content = 'line\n  indented';
      expect(detectIndentation(content)).toEqual({ char: ' ', size: 2 });
    });

    it('should detect 4 spaces', () => {
      const content = 'line\n    indented';
      expect(detectIndentation(content)).toEqual({ char: ' ', size: 4 });
    });

    it('should detect tabs', () => {
      const content = 'line\n\tindented';
      expect(detectIndentation(content)).toEqual({ char: '\t', size: 1 });
    });

    it('should default to 2 spaces', () => {
      expect(detectIndentation('no indent')).toEqual({ char: '  ', size: 2 });
    });
  });

  describe('getLineIndentation', () => {
    it('should get indentation', () => {
      const content = 'line1\n    indented\nline3';
      expect(getLineIndentation(content, 1)).toBe('    ');
    });

    it('should return empty for no indentation', () => {
      expect(getLineIndentation('no indent', 0)).toBe('');
    });
  });

  describe('indentText', () => {
    it('should indent each line', () => {
      const text = 'line1\nline2\nline3';
      expect(indentText(text, '  ')).toBe('  line1\n  line2\n  line3');
    });

    it('should not indent empty lines', () => {
      const text = 'line1\n\nline3';
      expect(indentText(text, '  ')).toBe('  line1\n\n  line3');
    });
  });
});
