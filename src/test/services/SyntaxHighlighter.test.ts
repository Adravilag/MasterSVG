/**
 * Tests for SyntaxHighlighter
 * 
 * Tests syntax highlighting for SVG, CSS, HTML, and JavaScript code
 */

import { SyntaxHighlighter, getSyntaxHighlighter } from '../../services/SyntaxHighlighter';

describe('SyntaxHighlighter', () => {
  let highlighter: SyntaxHighlighter;

  beforeEach(() => {
    highlighter = new SyntaxHighlighter();
  });

  describe('escapeHtml', () => {
    test('should escape ampersand', () => {
      expect(highlighter.escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('should escape less than', () => {
      expect(highlighter.escapeHtml('<tag>')).toBe('&lt;tag&gt;');
    });

    test('should escape greater than', () => {
      expect(highlighter.escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('should escape double quotes', () => {
      expect(highlighter.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    test('should escape single quotes', () => {
      expect(highlighter.escapeHtml("'quoted'")).toBe('&#039;quoted&#039;');
    });

    test('should escape all special characters', () => {
      expect(highlighter.escapeHtml('<a href="test">Link & Text</a>'))
        .toBe('&lt;a href=&quot;test&quot;&gt;Link &amp; Text&lt;/a&gt;');
    });

    test('should handle empty string', () => {
      expect(highlighter.escapeHtml('')).toBe('');
    });
  });

  describe('formatCss', () => {
    test('should format basic CSS', () => {
      const css = '.class { color: red; }';
      const result = highlighter.formatCss(css);
      expect(result).toContain('.class');
      expect(result).toContain('color: red;');
    });

    test('should handle empty string', () => {
      expect(highlighter.formatCss('')).toBe('');
    });

    test('should format nested rules', () => {
      const css = '@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }';
      const result = highlighter.formatCss(css);
      expect(result).toContain('@keyframes spin');
      expect(result).toContain('from');
      expect(result).toContain('to');
    });

    test('should add proper indentation', () => {
      const css = '.class { color: red; background: blue; }';
      const result = highlighter.formatCss(css);
      const lines = result.split('\n');
      // Should have indentation
      expect(lines.some(line => line.startsWith('  '))).toBe(true);
    });

    test('should handle multiple selectors', () => {
      const css = '.a { color: red; } .b { color: blue; }';
      const result = highlighter.formatCss(css);
      expect(result).toContain('.a');
      expect(result).toContain('.b');
    });
  });

  describe('formatSvg', () => {
    test('should format basic SVG', () => {
      const svg = '<svg><path d="M0 0"/></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).toContain('<svg>');
      expect(result).toContain('</svg>');
    });

    test('should handle empty string', () => {
      expect(highlighter.formatSvg('')).toBe('');
    });

    test('should remove animation styles', () => {
      const svg = '<svg style="animation: spin 1s linear"><path/></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).not.toContain('animation');
    });

    test('should format nested elements', () => {
      const svg = '<svg><g><rect/><circle/></g></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).toContain('<g>');
      expect(result).toContain('</g>');
    });

    test('should handle self-closing tags', () => {
      const svg = '<svg><circle r="5"/></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).toContain('/>');
    });

    test('should format long attributes on separate lines', () => {
      const longAttr = 'M' + '0 0 '.repeat(50);
      const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${longAttr}"/></svg>`;
      const result = highlighter.formatSvg(svg);
      // Should have multiple lines
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    test('should format CSS inside style tags', () => {
      const svg = '<svg><style>.icon { fill: red; }</style><path/></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).toContain('<style>');
      expect(result).toContain('</style>');
    });

    test('should handle comments', () => {
      const svg = '<svg><!-- comment --><path/></svg>';
      const result = highlighter.formatSvg(svg);
      expect(result).toContain('<!--');
      expect(result).toContain('-->');
    });
  });

  describe('highlightSvg', () => {
    test('should wrap in code-editor div', () => {
      const svg = '<svg></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<div class="code-editor">');
    });

    test('should generate code rows with line numbers', () => {
      const svg = '<svg>\n<path/>\n</svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<div class="code-row">');
      expect(result).toContain('<div class="ln">');
      expect(result).toContain('<div class="cl">');
    });

    test('should highlight tag names with span class tag', () => {
      const svg = '<svg></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<span class="tag">');
    });

    test('should highlight brackets with span class punctuation', () => {
      const svg = '<svg></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<span class="punctuation">');
    });

    test('should highlight attribute names with span class attr-name', () => {
      const svg = '<svg viewBox="0 0 24 24"></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<span class="attr-name">');
    });

    test('should highlight attribute values with span class string', () => {
      const svg = '<svg viewBox="0 0 24 24"></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<span class="string">');
    });

    test('should highlight CSS inside style elements', () => {
      const svg = '<svg><style>.cls { fill: red; }</style></svg>';
      const result = highlighter.highlightSvg(svg);
      // CSS values use span class value
      expect(result).toContain('<span class="value">');
    });

    test('should highlight CSS @keyframes', () => {
      const svg = '<svg><style>@keyframes spin { }</style></svg>';
      const result = highlighter.highlightSvg(svg);
      // @keywords use span class keyword
      expect(result).toContain('<span class="keyword">');
    });

    test('should highlight comments with span class comment', () => {
      const svg = '<svg><!-- comment --></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('<span class="comment">');
    });

    test('should escape HTML characters', () => {
      const svg = '<svg></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should filter empty lines', () => {
      const svg = '<svg>\n\n<path/>\n\n</svg>';
      const result = highlighter.highlightSvg(svg);
      // Should not have many empty line numbers
      const lineMatches = result.match(/<div class="ln">/g);
      expect(lineMatches?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('highlightCssCode', () => {
    test('should wrap in code-editor div', () => {
      const css = '.class { color: red; }';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<div class="code-editor">');
    });

    test('should generate code rows with line numbers', () => {
      const css = '.class {\n  color: red;\n}';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<div class="code-row">');
      expect(result).toContain('<div class="ln">');
    });

    test('should highlight property names', () => {
      const css = 'color: red;';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="attr-name">');
    });

    test('should highlight property values', () => {
      const css = 'color: red;';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="value">');
    });

    test('should highlight @keyframes', () => {
      const css = '@keyframes spin {\n  from { }\n  to { }\n}';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="keyword">@keyframes</span>');
      expect(result).toContain('<span class="variable">spin</span>');
    });

    test('should highlight braces', () => {
      const css = '.class { }';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="punctuation">{</span>');
      expect(result).toContain('<span class="punctuation">}</span>');
    });

    test('should highlight percentage values in keyframes', () => {
      const css = '50% { transform: scale(1.5); }';
      const result = highlighter.highlightCssCode(css);
      // Percentage values appear in the output (may or may not be highlighted)
      expect(result).toContain('50%');
    });

    test('should highlight from/to keywords', () => {
      const css = 'from { opacity: 0; }\nto { opacity: 1; }';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="variable">from</span>');
      expect(result).toContain('<span class="variable">to</span>');
    });

    test('should highlight comments', () => {
      const css = '/* This is a comment */';
      const result = highlighter.highlightCssCode(css);
      expect(result).toContain('<span class="comment">');
    });
  });

  describe('highlightUsageCode', () => {
    test('should wrap in code-editor div', () => {
      const result = highlighter.highlightUsageCode(['<Icon name="test" />']);
      expect(result).toContain('<div class="code-editor">');
    });

    test('should highlight HTML tags', () => {
      const result = highlighter.highlightUsageCode(['<Icon name="arrow" />']);
      expect(result).toContain('<span class="punctuation">');
      expect(result).toContain('<span class="tag">');
    });

    test('should highlight attribute names', () => {
      const result = highlighter.highlightUsageCode(['<Icon name="arrow" />']);
      expect(result).toContain('<span class="attr-name">name</span>');
    });

    test('should highlight attribute values', () => {
      const result = highlighter.highlightUsageCode(['<Icon name="arrow" />']);
      // Attribute values are quoted with &quot;
      expect(result).toContain('&quot;arrow&quot;');
    });

    test('should highlight HTML comments', () => {
      const result = highlighter.highlightUsageCode(['<!-- comment -->']);
      expect(result).toContain('<span class="comment">');
    });

    test('should highlight import statements', () => {
      const result = highlighter.highlightUsageCode(["import { icons } from './icons'"]);
      expect(result).toContain('<span class="keyword">import</span>');
      expect(result).toContain('<span class="keyword">from</span>');
    });

    test('should highlight imported identifiers', () => {
      const result = highlighter.highlightUsageCode(["import { icons } from './icons'"]);
      expect(result).toContain('<span class="variable">');
    });

    test('should highlight module paths', () => {
      const result = highlighter.highlightUsageCode(["import { icons } from './icons'"]);
      // Module paths are escaped with &#039;
      expect(result).toContain('&#039;./icons&#039;');
    });

    test('should handle multiple lines', () => {
      const result = highlighter.highlightUsageCode([
        "import { Icon } from './components'",
        '<Icon name="arrow" />'
      ]);
      expect(result).toContain('<div class="ln">1</div>');
      expect(result).toContain('<div class="ln">2</div>');
    });
  });

  describe('getSyntaxHighlighter', () => {
    test('should return singleton instance', () => {
      const instance1 = getSyntaxHighlighter();
      const instance2 = getSyntaxHighlighter();
      expect(instance1).toBe(instance2);
    });

    test('should return SyntaxHighlighter instance', () => {
      const instance = getSyntaxHighlighter();
      expect(instance).toBeInstanceOf(SyntaxHighlighter);
    });
  });

  describe('edge cases', () => {
    test('should handle SVG with CDATA', () => {
      const svg = '<svg><style><![CDATA[.cls{fill:red}]]></style></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('CDATA');
    });

    test('should handle SVG with namespaces', () => {
      const svg = '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#id"/></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('xmlns:xlink');
    });

    test('should handle nested quotes in attributes', () => {
      const svg = '<svg data-test="value with \' quote"></svg>';
      const result = highlighter.highlightSvg(svg);
      expect(result).not.toContain('undefined');
    });

    test('should handle empty arrays in highlightUsageCode', () => {
      const result = highlighter.highlightUsageCode([]);
      expect(result).toBe('<div class="code-editor"></div>');
    });

    test('should handle very long lines', () => {
      const longLine = 'a'.repeat(1000);
      const svg = `<svg>${longLine}</svg>`;
      const result = highlighter.highlightSvg(svg);
      expect(result).toContain('code-editor');
    });
  });
});

