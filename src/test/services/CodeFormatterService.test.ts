/**
 * Tests for CodeFormatterService
 * 
 * Tests code formatting and syntax highlighting functionality
 */

import { CodeFormatterService } from '../../services/CodeFormatterService';

describe('CodeFormatterService', () => {
  let formatter: CodeFormatterService;

  beforeEach(() => {
    formatter = new CodeFormatterService();
  });

  describe('toVariableName', () => {
    test('should convert simple kebab-case to camelCase', () => {
      expect(formatter.toVariableName('my-icon')).toBe('myIcon');
    });

    test('should convert multiple words', () => {
      expect(formatter.toVariableName('my-awesome-icon')).toBe('myAwesomeIcon');
    });

    test('should handle single word', () => {
      expect(formatter.toVariableName('icon')).toBe('icon');
    });

    test('should handle special characters', () => {
      expect(formatter.toVariableName('icon_name')).toBe('iconName');
      expect(formatter.toVariableName('icon.name')).toBe('iconName');
      expect(formatter.toVariableName('icon@name')).toBe('iconName');
    });

    test('should handle multiple consecutive separators', () => {
      expect(formatter.toVariableName('icon--name')).toBe('iconName');
      expect(formatter.toVariableName('icon---name')).toBe('iconName');
    });

    test('should handle leading/trailing separators', () => {
      expect(formatter.toVariableName('-icon-')).toBe('icon');
      expect(formatter.toVariableName('--icon--')).toBe('icon');
    });

    test('should preserve numbers', () => {
      expect(formatter.toVariableName('icon-2')).toBe('icon2');
      expect(formatter.toVariableName('icon-2-blue')).toBe('icon2Blue');
    });

    test('should handle uppercase input', () => {
      expect(formatter.toVariableName('MY-ICON')).toBe('myIcon');
      expect(formatter.toVariableName('ICON')).toBe('icon');
    });

    test('should handle mixed case', () => {
      expect(formatter.toVariableName('MyIcon')).toBe('myicon');
    });

    test('should handle empty string', () => {
      expect(formatter.toVariableName('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    test('should escape ampersand', () => {
      expect(formatter.escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('should escape less than', () => {
      expect(formatter.escapeHtml('<tag>')).toBe('&lt;tag&gt;');
    });

    test('should escape greater than', () => {
      expect(formatter.escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('should escape double quotes', () => {
      expect(formatter.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    test('should escape single quotes', () => {
      expect(formatter.escapeHtml("'quoted'")).toBe('&#039;quoted&#039;');
    });

    test('should escape multiple characters', () => {
      expect(formatter.escapeHtml('<a href="test.html">Link & Text</a>'))
        .toBe('&lt;a href=&quot;test.html&quot;&gt;Link &amp; Text&lt;/a&gt;');
    });

    test('should handle empty string', () => {
      expect(formatter.escapeHtml('')).toBe('');
    });

    test('should handle string without special chars', () => {
      expect(formatter.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('formatSvgPretty', () => {
    test('should format basic SVG', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('<svg>');
      expect(result).toContain('<path');
      expect(result).toContain('</svg>');
    });

    test('should handle empty input', () => {
      expect(formatter.formatSvgPretty('')).toBe('');
    });

    test('should handle whitespace-only input', () => {
      expect(formatter.formatSvgPretty('   ')).toBe('');
    });

    test('should preserve self-closing tags', () => {
      const svg = '<svg><circle r="5"/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('/>');
    });

    test('should handle nested elements', () => {
      const svg = '<svg><g><rect/><circle/></g></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('<g>');
      expect(result).toContain('</g>');
    });

    test('should remove animation styles from preview', () => {
      const svg = '<svg style="animation: spin 1s linear infinite"><path/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).not.toContain('animation');
    });

    test('should handle SVG with comments', () => {
      const svg = '<svg><!-- comment --><path/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('<!--');
      expect(result).toContain('-->');
    });

    test('should handle SVG with style element', () => {
      const svg = '<svg><style>.cls{fill:red}</style><path class="cls"/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('<style>');
      expect(result).toContain('</style>');
    });
  });

  describe('highlightSvgCode', () => {
    test('should wrap code in code-editor div', () => {
      const svg = '<svg></svg>';
      const result = formatter.highlightSvgCode(svg);
      expect(result).toContain('<div class="code-editor">');
      expect(result).toContain('</div>');
    });

    test('should generate code rows with line numbers', () => {
      const svg = '<svg>\n<path/>\n</svg>';
      const result = formatter.highlightSvgCode(svg);
      expect(result).toContain('<div class="code-row">');
      expect(result).toContain('<div class="ln">');
      expect(result).toContain('<div class="cl">');
    });

    test('should escape HTML special characters', () => {
      const svg = '<svg viewBox="0 0 24 24"></svg>';
      const result = formatter.highlightSvgCode(svg);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should highlight tag names', () => {
      const svg = '<svg></svg>';
      const result = formatter.highlightSvgCode(svg);
      // Tags use <b> for brackets and <i> for tag names
      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
    });

    test('should highlight attribute names', () => {
      const svg = '<svg viewBox="0 0 24 24"></svg>';
      const result = formatter.highlightSvgCode(svg);
      // Attribute names use <u>
      expect(result).toContain('<u>');
    });

    test('should highlight attribute values', () => {
      const svg = '<svg viewBox="0 0 24 24"></svg>';
      const result = formatter.highlightSvgCode(svg);
      // Attribute values use <em>
      expect(result).toContain('<em>');
    });

    test('should highlight CSS in style elements', () => {
      const svg = '<svg><style>.cls { fill: red; }</style></svg>';
      const result = formatter.highlightSvgCode(svg);
      // CSS uses various tags for different parts
      expect(result).toContain('<samp>'); // values
    });

    test('should highlight CSS @keyframes', () => {
      const svg = '<svg><style>@keyframes spin { 0% { transform: rotate(0deg); } }</style></svg>';
      const result = formatter.highlightSvgCode(svg);
      // @keywords use <kbd>
      expect(result).toContain('<kbd>');
    });

    test('should handle comments', () => {
      const svg = '<svg><!-- This is a comment --></svg>';
      const result = formatter.highlightSvgCode(svg);
      // Comments use <cite>
      expect(result).toContain('<cite>');
    });

    test('should filter empty lines', () => {
      const svg = '<svg>\n\n<path/>\n\n</svg>';
      const result = formatter.highlightSvgCode(svg);
      // Should not have multiple consecutive line numbers
      const lineMatches = result.match(/<div class="ln">/g);
      expect(lineMatches).toBeTruthy();
    });

    test('should handle complex SVG', () => {
      const svg = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <style>
            .icon { fill: currentColor; }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          </style>
          <g class="icon">
            <path d="M12 2L2 12h10z"/>
            <circle cx="12" cy="12" r="5"/>
          </g>
        </svg>
      `;
      const result = formatter.highlightSvgCode(svg);
      expect(result).toContain('code-editor');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');
    });
  });

  describe('edge cases', () => {
    test('should handle SVG with CDATA', () => {
      const svg = '<svg><style><![CDATA[.cls{fill:red}]]></style></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('CDATA');
    });

    test('should handle SVG with namespaces', () => {
      const svg = '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#id"/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('xmlns:xlink');
      expect(result).toContain('xlink:href');
    });

    test('should handle SVG with data attributes', () => {
      const svg = '<svg data-name="icon"><path data-index="0"/></svg>';
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('data-name');
    });

    test('should handle very long attributes', () => {
      const longPath = 'M' + '0 0 '.repeat(100);
      const svg = `<svg><path d="${longPath}"/></svg>`;
      const result = formatter.formatSvgPretty(svg);
      expect(result).toContain('<path');
    });
  });
});
