/**
 * SVG Manipulation Service
 *
 * Handles SVG namespace management, animation embedding, and detection.
 * Refactored to use helper modules for better maintainability.
 */
import { AnimationService, AnimationSettings, DetectedAnimation } from '../animation/AnimationService';
import {
  parseSvg,
  serializeSvg,
  getSvgElement,
  createSvgElement,
  insertAtSvgStart,
  insertAfterSvgTag,
} from '../helpers/SvgDomParser';
import {
  buildDrawAnimation,
  buildDrawLoopAnimation,
} from '../helpers/DrawAnimationBuilder';
import {
  detectSmilAnimation,
  analyzeCssContent,
} from '../helpers/AnimationDetector';

export { AnimationSettings, DetectedAnimation };

// Animation cleanup patterns
const CLEANUP_PATTERNS = {
  styleById: /<style id="icon-manager-animation">[\s\S]*?<\/style>/gi,
  scriptById: /<script id="icon-manager-script">[\s\S]*?<\/script>/gi,
  animWrapper: /<g class="icon-anim-\d+">([\s\S]*?)<\/g>/gi,
  legacyKeyframes: /<style>@keyframes[\s\S]*?svg\s*\{\s*animation:[\s\S]*?\}[\s\S]*?<\/style>/gi,
  classKeyframes: /<style>@keyframes[\s\S]*?\.icon-anim-\d+\s*\{[\s\S]*?\}[\s\S]*?<\/style>/gi,
  animClassStyles: /<style[^>]*>[\s\S]*?\.icon-anim-\d+[\s\S]*?<\/style>/gi,
  legacyScript: /<script>\s*\(function\(\)\s*\{\s*var svg = document\.currentScript\.parentElement;[\s\S]*?\}\)\(\);\s*<\/script>/gi,
};

export class SvgManipulationService {
  /**
   * Ensure SVG has the required xmlns namespace
   */
  public static ensureSvgNamespace(svg: string): string {
    const result = parseSvg(svg);
    if (!result) return this.ensureSvgNamespaceRegex(svg);

    const svgElement = getSvgElement(result.doc);
    if (!svgElement) return this.ensureSvgNamespaceRegex(svg);

    if (!svgElement.hasAttribute('xmlns')) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return serializeSvg(result.doc);
    }

    return svg;
  }

  private static ensureSvgNamespaceRegex(svg: string): string {
    const nsPattern = /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi;
    const matches = svg.match(nsPattern);

    // Multiple namespaces (corruption) - remove all and add one
    if (matches && matches.length > 1) {
      svg = svg.replace(nsPattern, '');
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // No namespace - add it
    if (!matches || matches.length === 0) {
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return svg;
  }

  /**
   * Remove all animation-related elements from SVG
   */
  public static cleanAnimationFromSvg(svg: string): string {
    const result = parseSvg(svg);
    if (!result) return this.cleanAnimationFromSvgRegex(svg);

    let modified = false;
    modified = this.removeElementsById(result.doc, ['icon-manager-animation', 'icon-manager-script']) || modified;
    modified = this.unwrapAnimationGroups(result.doc) || modified;
    modified = this.removeAnimationStyles(result.doc) || modified;
    modified = this.removeLegacyScripts(result.doc) || modified;

    return modified ? serializeSvg(result.doc) : svg;
  }

  private static removeElementsById(doc: Document, ids: string[]): boolean {
    let modified = false;

    for (const id of ids) {
      for (const tagName of ['style', 'script']) {
        const elements = doc.getElementsByTagName(tagName);
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i];
          if (el.getAttribute('id') === id && el.parentNode) {
            el.parentNode.removeChild(el);
            modified = true;
          }
        }
      }
    }

    return modified;
  }

  private static unwrapAnimationGroups(doc: Document): boolean {
    let modified = false;
    const svgElement = doc.documentElement;
    const groups = svgElement.getElementsByTagName('g');

    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      const className = g.getAttribute('class') || '';

      if (className.startsWith('icon-anim-')) {
        const parent = g.parentNode;
        if (parent) {
          while (g.firstChild) {
            parent.insertBefore(g.firstChild, g);
          }
          parent.removeChild(g);
          modified = true;
        }
      }
    }

    return modified;
  }

  private static removeAnimationStyles(doc: Document): boolean {
    let modified = false;
    const styles = doc.getElementsByTagName('style');

    for (let i = styles.length - 1; i >= 0; i--) {
      const style = styles[i];
      const content = style.textContent || '';

      if (content.includes('.icon-anim-') ||
          (content.includes('@keyframes') && content.includes('animation:'))) {
        if (style.parentNode) {
          style.parentNode.removeChild(style);
          modified = true;
        }
      }
    }

    return modified;
  }

  private static removeLegacyScripts(doc: Document): boolean {
    let modified = false;
    const scripts = doc.getElementsByTagName('script');

    for (let i = scripts.length - 1; i >= 0; i--) {
      const script = scripts[i];
      if (script.textContent?.includes('document.currentScript.parentElement')) {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
          modified = true;
        }
      }
    }

    return modified;
  }

  private static cleanAnimationFromSvgRegex(svg: string): string {
    let result = svg;

    result = result.replace(CLEANUP_PATTERNS.styleById, '');
    result = result.replace(CLEANUP_PATTERNS.scriptById, '');
    result = result.replace(CLEANUP_PATTERNS.animWrapper, '$1');
    result = result.replace(CLEANUP_PATTERNS.legacyKeyframes, '');
    result = result.replace(CLEANUP_PATTERNS.classKeyframes, '');
    result = result.replace(CLEANUP_PATTERNS.animClassStyles, '');
    result = result.replace(CLEANUP_PATTERNS.legacyScript, '');

    return result;
  }

  /**
   * Embed animation CSS into SVG
   */
  public static embedAnimationInSvg(
    svg: string,
    animation: string,
    settings: AnimationSettings
  ): string {
    svg = this.cleanAnimationFromSvg(svg);
    svg = this.ensureSvgNamespace(svg);

    // Handle draw animations specially
    if (animation === 'draw') return this.embedDrawAnimation(svg, settings, false);
    if (animation === 'draw-reverse') return this.embedDrawAnimation(svg, settings, true);
    if (animation === 'draw-loop') return this.embedDrawLoopAnimation(svg, settings);

    return this.embedStandardAnimation(svg, animation, settings);
  }

  private static embedStandardAnimation(
    svg: string,
    animation: string,
    settings: AnimationSettings
  ): string {
    const keyframe = AnimationService.getKeyframe(animation);
    if (!keyframe) return svg;

    const animClass = `icon-anim-${Date.now()}`;
    const cssContent = this.buildAnimationCss(keyframe, animClass, animation, settings);

    const result = parseSvg(svg);
    if (!result) return this.embedAnimationRegex(svg, cssContent, animClass);

    const svgElement = getSvgElement(result.doc);
    if (!svgElement) return this.embedAnimationRegex(svg, cssContent, animClass);

    // Create wrapper and style
    const wrapper = result.doc.createElement('g');
    wrapper.setAttribute('class', animClass);

    while (svgElement.firstChild) {
      wrapper.appendChild(svgElement.firstChild);
    }

    const style = createSvgElement(result.doc, 'style', { id: 'icon-manager-animation' }, cssContent);

    svgElement.appendChild(style);
    svgElement.appendChild(wrapper);

    return serializeSvg(result.doc);
  }

  private static buildAnimationCss(
    keyframe: string,
    animClass: string,
    animation: string,
    settings: AnimationSettings
  ): string {
    const { duration = 1, timing = 'ease', iteration = 'infinite', direction = 'normal', delay = 0 } = settings;
    const delayStr = delay > 0 ? ` ${delay}s` : '';

    return `${keyframe} .${animClass} { animation: ${animation} ${duration}s ${timing}${delayStr} ${iteration} ${direction}; transform-origin: center center; }`;
  }

  private static embedAnimationRegex(svg: string, cssContent: string, animClass: string): string {
    const cssStyle = `<style id="icon-manager-animation">${cssContent}</style>`;
    const svgTagMatch = svg.match(/<svg[^>]*>/i);
    const svgCloseMatch = svg.match(/<\/svg>/i);

    if (svgTagMatch && svgCloseMatch) {
      const afterOpenTag = svgTagMatch.index! + svgTagMatch[0].length;
      const beforeCloseTag = svgCloseMatch.index!;
      const innerContent = svg.slice(afterOpenTag, beforeCloseTag);

      return svg.slice(0, afterOpenTag) +
        cssStyle +
        `<g class="${animClass}">` +
        innerContent +
        '</g>' +
        svg.slice(beforeCloseTag);
    }

    return svg;
  }

  private static embedDrawAnimation(svg: string, settings: AnimationSettings, reverse: boolean): string {
    const { css, script } = buildDrawAnimation(settings, reverse);
    return this.insertStyleAndScript(svg, css, script);
  }

  private static embedDrawLoopAnimation(svg: string, settings: AnimationSettings): string {
    const { css, script } = buildDrawLoopAnimation(settings);
    return this.insertStyleAndScript(svg, css, script);
  }

  private static insertStyleAndScript(svg: string, css: string, script: string): string {
    const result = parseSvg(svg);

    if (result) {
      const svgElement = getSvgElement(result.doc);
      if (svgElement) {
        const styleEl = createSvgElement(result.doc, 'style', { id: 'icon-manager-animation' }, css);
        const scriptEl = createSvgElement(result.doc, 'script', { id: 'icon-manager-script' }, script);

        insertAtSvgStart(svgElement, styleEl, scriptEl);
        return serializeSvg(result.doc);
      }
    }

    // Fallback to regex
    const content = `<style id="icon-manager-animation">${css}</style><script id="icon-manager-script">${script}</script>`;
    return insertAfterSvgTag(svg, content);
  }

  /**
   * Detect animation embedded in SVG
   */
  public static detectAnimationFromSvg(svg: string): DetectedAnimation | null {
    // Check SMIL animations first
    const smilAnimation = detectSmilAnimation(svg);
    if (smilAnimation) return smilAnimation;

    // Try DOM parsing for CSS animations
    const result = parseSvg(svg);
    if (result) {
      const styles = result.doc.getElementsByTagName('style');
      for (let i = 0; i < styles.length; i++) {
        const content = styles[i].textContent || '';
        const detected = analyzeCssContent(content);
        if (detected) return detected;
      }
    }

    // Fallback to regex on full string
    return analyzeCssContent(svg);
  }

  /**
   * Apply CSS filter to SVG
   */
  public static applyCssFilter(svg: string, filter: string): string {
    if (svg.match(/<svg[^>]*style=["'][^"']*["']/i)) {
      return svg.replace(/(<svg[^>]*style=["'])([^"']*)(["'])/i, (_, p1, p2, p3) => {
        let style = p2.replace(/filter:[^;]+;?/gi, '');
        if (style && !style.endsWith(';')) style += ';';
        return `${p1}${style} filter: ${filter};${p3}`;
      });
    }

    return svg.replace(/<svg/i, `<svg style="filter: ${filter};"`);
  }
}
