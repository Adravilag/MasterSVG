/**
 * Tests for extractColorsFromText and extractKeywordsFromText (projectPaletteExtractor)
 */

import { extractColorsFromText, extractKeywordsFromText } from '../../utils/projectPaletteExtractor';

describe('projectPaletteExtractor', () => {
  describe('extractColorsFromText', () => {
    it('should extract hex colors', () => {
      const css = `body { color: #0b66ff; background: #e0f; }`;
      const result = extractColorsFromText(css);
      expect(result).toContain('#0b66ff');
      expect(result).toContain('#ee00ff');
    });

    it('should ignore generic colors like #000, #fff', () => {
      const css = `body { color: #000; background: #fff; border: #333; }`;
      const result = extractColorsFromText(css);
      expect(result).toHaveLength(0);
    });

    it('should extract rgb() values', () => {
      const css = `body { color: rgb(10, 20, 30); background: rgba(255, 0, 0, 0.5); }`;
      const result = extractColorsFromText(css);
      expect(result).toHaveLength(2);
    });

    it('should extract hsl() values', () => {
      const css = `body { color: hsl(200, 50%, 30%); }`;
      const result = extractColorsFromText(css);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract meta theme-color from HTML', () => {
      const html = `<head><meta name="theme-color" content="#4285f4"></head>`;
      const result = extractColorsFromText(html);
      expect(result).toContain('#4285f4');
    });

    it('should return empty array for text without colors', () => {
      const text = `Hello world, no colors here.`;
      const result = extractColorsFromText(text);
      expect(result).toHaveLength(0);
    });

    it('should deduplicate identical colors', () => {
      const css = `a { color: #0b66ff; } b { color: #0b66ff; }`;
      const result = extractColorsFromText(css);
      const count = result.filter(c => c === '#0b66ff').length;
      expect(count).toBe(1);
    });
  });

  describe('extractKeywordsFromText', () => {
    it('should extract meaningful words from text', () => {
      const text = 'Hospital management system for medical clinics';
      const result = extractKeywordsFromText(text);
      expect(result).toContain('hospital');
      expect(result).toContain('management');
      expect(result).toContain('medical');
      expect(result).toContain('clinics');
    });

    it('should filter out stopwords', () => {
      const text = 'This is a project for the new system';
      const result = extractKeywordsFromText(text);
      expect(result).not.toContain('this');
      expect(result).not.toContain('the');
      expect(result).not.toContain('for');
      expect(result).not.toContain('project');
      expect(result).toContain('system');
    });

    it('should filter out short words (< 3 chars)', () => {
      const text = 'An AI ML tool for web UI UX';
      const result = extractKeywordsFromText(text);
      expect(result).not.toContain('ai');
      expect(result).not.toContain('ml');
      expect(result).not.toContain('ui');
      expect(result).not.toContain('ux');
      expect(result).toContain('tool');
      expect(result).toContain('web');
    });

    it('should return empty array for text with only stopwords', () => {
      const text = 'the and or for to in on of is it';
      const result = extractKeywordsFromText(text);
      expect(result).toHaveLength(0);
    });

    it('should sort by frequency (most frequent first)', () => {
      const text = 'dashboard dashboard dashboard health health medical';
      const result = extractKeywordsFromText(text);
      expect(result[0]).toBe('dashboard');
      expect(result[1]).toBe('health');
      expect(result[2]).toBe('medical');
    });

    it('should limit results to max keywords', () => {
      const text = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
      const result = extractKeywordsFromText(text);
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('should handle special characters gracefully', () => {
      const text = 'e-commerce & healthcare (management) system!';
      const result = extractKeywordsFromText(text);
      expect(result).toContain('e-commerce');
      expect(result).toContain('healthcare');
      expect(result).toContain('management');
      expect(result).toContain('system');
    });
  });
});
