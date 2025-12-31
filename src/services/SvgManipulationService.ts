import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { AnimationService, AnimationSettings, DetectedAnimation } from './AnimationService';

export { AnimationSettings, DetectedAnimation };

export class SvgManipulationService {
  public static ensureSvgNamespace(svg: string): string {
    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');

      // Check for parsing errors
      const parserError = doc.getElementsByTagName('parsererror');
      if (hasError || parserError.length > 0) {
        // Fallback to regex if parsing fails
        return this.ensureSvgNamespaceRegex(svg);
      }

      const svgElement = doc.documentElement;
      if (!svgElement || svgElement.tagName !== 'svg') {
        return this.ensureSvgNamespaceRegex(svg);
      }

      if (!svgElement.hasAttribute('xmlns')) {
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return new XMLSerializer().serializeToString(doc);
      }

      return svg;
    } catch (_e) {
      return this.ensureSvgNamespaceRegex(svg);
    }
  }

  private static ensureSvgNamespaceRegex(svg: string): string {
    // Robust check for namespace (single or double quotes)
    const nsPattern = /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi;
    const matches = svg.match(nsPattern);

    // If multiple namespaces found (corruption), remove all and add one back
    if (matches && matches.length > 1) {
      svg = svg.replace(nsPattern, '');
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // If no namespace found, add it
    if (!matches || matches.length === 0) {
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return svg;
  }

  public static cleanAnimationFromSvg(svg: string): string {
    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');

      const parserError = doc.getElementsByTagName('parsererror');
      if (hasError || parserError.length > 0) return this.cleanAnimationFromSvgRegex(svg);

      let modified = false;

      // Remove ALL elements with our specific IDs (not just the first one)
      const idsToRemove = ['icon-manager-animation', 'icon-manager-script'];
      for (const id of idsToRemove) {
        // Use querySelectorAll equivalent - getElementsByTagName and filter
        const allStyles = doc.getElementsByTagName('style');
        const allScripts = doc.getElementsByTagName('script');

        // Remove styles with matching ID
        for (let i = allStyles.length - 1; i >= 0; i--) {
          const el = allStyles[i];
          if (el.getAttribute('id') === id && el.parentNode) {
            el.parentNode.removeChild(el);
            modified = true;
          }
        }

        // Remove scripts with matching ID
        for (let i = allScripts.length - 1; i >= 0; i--) {
          const el = allScripts[i];
          if (el.getAttribute('id') === id && el.parentNode) {
            el.parentNode.removeChild(el);
            modified = true;
          }
        }
      }

      // Remove animation wrapper groups (class="icon-anim-...")
      const svgElement = doc.documentElement;
      const groups = svgElement.getElementsByTagName('g');
      for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i];
        const className = g.getAttribute('class') || '';
        if (className.startsWith('icon-anim-')) {
          // Unwrap: move children up to parent
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

      // Also remove any styles containing our animation classes
      const styles = doc.getElementsByTagName('style');
      for (let i = styles.length - 1; i >= 0; i--) {
        const style = styles[i];
        const content = style.textContent || '';
        // Remove styles that contain our animation patterns
        if (
          content.includes('.icon-anim-') ||
          (content.includes('@keyframes') && content.includes('animation:'))
        ) {
          if (style.parentNode) {
            style.parentNode.removeChild(style);
            modified = true;
          }
        }
      }

      // Legacy script cleanup
      const scripts = doc.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i--) {
        const script = scripts[i];
        if (
          script.textContent &&
          script.textContent.includes('document.currentScript.parentElement')
        ) {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
            modified = true;
          }
        }
      }

      if (modified) {
        return new XMLSerializer().serializeToString(doc);
      }
      return svg;
    } catch (_e) {
      return this.cleanAnimationFromSvgRegex(svg);
    }
  }

  private static cleanAnimationFromSvgRegex(svg: string): string {
    // Remove ALL styles with our specific ID (regex with 'g' flag already replaces all matches)
    svg = svg.replace(/<style id="icon-manager-animation">[\s\S]*?<\/style>/gi, '');
    // Remove scripts with our specific ID
    svg = svg.replace(/<script id="icon-manager-script">[\s\S]*?<\/script>/gi, '');

    // Remove animation wrapper groups and unwrap content
    svg = svg.replace(/<g class="icon-anim-\d+">([\s\S]*?)<\/g>/gi, '$1');

    // Legacy cleanup: Remove styles that look like ours (containing keyframes and svg animation)
    svg = svg.replace(
      /<style>@keyframes[\s\S]*?svg\s*\{\s*animation:[\s\S]*?\}[\s\S]*?<\/style>/gi,
      ''
    );
    // Also handle the new class-based animation styles
    svg = svg.replace(
      /<style>@keyframes[\s\S]*?\.icon-anim-\d+\s*\{[\s\S]*?\}[\s\S]*?<\/style>/gi,
      ''
    );
    // Also handle styles with our animation class patterns
    svg = svg.replace(/<style[^>]*>[\s\S]*?\.icon-anim-\d+[\s\S]*?<\/style>/gi, '');

    // Legacy cleanup for draw animations (script tag)
    svg = svg.replace(
      /<script>\s*\(function\(\)\s*\{\s*var svg = document\.currentScript\.parentElement;[\s\S]*?\}\)\(\);\s*<\/script>/gi,
      ''
    );

    return svg;
  }

  public static embedAnimationInSvg(
    svg: string,
    animation: string,
    settings: AnimationSettings
  ): string {
    // Clean up previous animations first
    svg = this.cleanAnimationFromSvg(svg);
    svg = this.ensureSvgNamespace(svg);

    // Handle draw animation specially - it needs path length calculation
    if (animation === 'draw') {
      return this.embedDrawAnimation(svg, settings);
    }
    if (animation === 'draw-reverse') {
      return this.embedDrawAnimation(svg, settings, true);
    }
    if (animation === 'draw-loop') {
      return this.embedDrawLoopAnimation(svg, settings);
    }

    const keyframe = AnimationService.getKeyframe(animation);
    if (!keyframe) return svg;

    const duration = settings.duration || 1;
    const timing = settings.timing || 'ease';
    const iteration = settings.iteration || 'infinite';
    const direction = settings.direction || 'normal';
    const delay = settings.delay || 0;

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    // Use a unique class for the animation to avoid conflicts in sprites
    const animClass = `icon-anim-${Date.now()}`;
    const cssContent = `${keyframe} .${animClass} { animation: ${animation} ${duration}s ${timing}${delayStr} ${iteration} ${direction}; transform-origin: center center; }`;

    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (hasError || parserError.length > 0) throw new Error('XML Parse Error');

      const svgElement = doc.documentElement;

      // Create wrapper group with animation class
      const wrapper = doc.createElement('g');
      wrapper.setAttribute('class', animClass);

      // Move all children to wrapper
      while (svgElement.firstChild) {
        wrapper.appendChild(svgElement.firstChild);
      }

      // Create style element
      const style = doc.createElement('style');
      style.setAttribute('id', 'icon-manager-animation');
      style.textContent = cssContent;

      // Add style and wrapper to svg
      svgElement.appendChild(style);
      svgElement.appendChild(wrapper);

      return new XMLSerializer().serializeToString(doc);
    } catch (_e) {
      // Fallback to regex injection - wrap content in animated group
      const cssStyle = `<style id="icon-manager-animation">${cssContent}</style>`;
      const svgTagMatch = svg.match(/<svg[^>]*>/i);
      const svgCloseMatch = svg.match(/<\/svg>/i);
      if (svgTagMatch && svgCloseMatch) {
        const afterOpenTag = svgTagMatch.index! + svgTagMatch[0].length;
        const beforeCloseTag = svgCloseMatch.index!;
        const innerContent = svg.slice(afterOpenTag, beforeCloseTag);
        return (
          svg.slice(0, afterOpenTag) +
          cssStyle +
          `<g class="${animClass}">` +
          innerContent +
          '</g>' +
          svg.slice(beforeCloseTag)
        );
      }
      return svg;
    }
  }

  // Special animation: Draw paths as if being drawn
  private static embedDrawAnimation(
    svg: string,
    settings: AnimationSettings,
    reverse: boolean = false
  ): string {
    const duration = settings.duration || 2;
    const timing = settings.timing || 'ease-in-out';
    const delay = settings.delay || 0;

    // Create CSS for stroke animation on all path/line/polyline/polygon/circle/ellipse/rect elements
    const animName = reverse ? 'undraw' : 'draw';
    const drawKeyframes = reverse
      ? `@keyframes undraw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: var(--path-length); } }`
      : `@keyframes draw { from { stroke-dashoffset: var(--path-length); } to { stroke-dashoffset: 0; } }`;

    const fillKeyframes = reverse
      ? `@keyframes fill-out { 0%, 80% { fill-opacity: 1; } 100% { fill-opacity: 0; } }`
      : `@keyframes fill-in { 0%, 80% { fill-opacity: 0; } 100% { fill-opacity: 1; } }`;

    const fillAnimName = reverse ? 'fill-out' : 'fill-in';

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    const cssContent = `
      ${drawKeyframes}
      ${fillKeyframes}
      svg path, svg line, svg polyline, svg polygon, svg circle, svg ellipse, svg rect {
        stroke-dasharray: var(--path-length, 100);
        stroke-dashoffset: ${reverse ? '0' : 'var(--path-length, 100)'};
        animation: ${animName} ${duration}s ${timing}${delayStr} forwards;
        fill-opacity: ${reverse ? '1' : '0'};
      }
      svg path[fill], svg circle[fill], svg ellipse[fill], svg rect[fill], svg polygon[fill] {
        animation: ${animName} ${duration}s ${timing}${delayStr} forwards, ${fillAnimName} ${duration * 1.2}s ${timing}${delayStr} forwards;
      }
    `;

    const scriptContent = `
      (function() {
        var svg = document.currentScript.parentElement;
        var elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
        elements.forEach(function(el) {
          try {
            var len = el.getTotalLength ? el.getTotalLength() : 100;
            el.style.setProperty('--path-length', len);
          } catch(e) { el.style.setProperty('--path-length', '100'); }
        });
      })();
    `;

    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (hasError || parserError.length > 0) throw new Error('XML Parse Error');

      const style = doc.createElement('style');
      style.setAttribute('id', 'icon-manager-animation');
      style.textContent = cssContent;

      const script = doc.createElement('script');
      script.setAttribute('id', 'icon-manager-script');
      script.textContent = scriptContent;

      const svgElement = doc.documentElement;
      if (svgElement.firstChild) {
        svgElement.insertBefore(script, svgElement.firstChild);
        svgElement.insertBefore(style, svgElement.firstChild);
      } else {
        svgElement.appendChild(style);
        svgElement.appendChild(script);
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (_e) {
      // Fallback
      const cssStyle = `<style id="icon-manager-animation">${cssContent}</style>
    <script id="icon-manager-script">${scriptContent}</script>`;
      const svgTagMatch = svg.match(/<svg[^>]*>/i);
      if (svgTagMatch) {
        const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
        return svg.slice(0, insertPos) + cssStyle + svg.slice(insertPos);
      }
      return svg;
    }
  }

  // Special animation: Draw loop (draw then undraw)
  private static embedDrawLoopAnimation(svg: string, settings: AnimationSettings): string {
    const duration = settings.duration || 2;
    const timing = settings.timing || 'ease-in-out';
    const iteration = settings.iteration || 'infinite';
    const delay = settings.delay || 0;

    const drawKeyframes = `@keyframes draw-loop {
      0% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
      45% { stroke-dashoffset: 0; fill-opacity: 1; }
      55% { stroke-dashoffset: 0; fill-opacity: 1; }
      100% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
    }`;

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    const cssContent = `
      ${drawKeyframes}
      svg path, svg line, svg polyline, svg polygon, svg circle, svg ellipse, svg rect {
        stroke-dasharray: var(--path-length, 100);
        stroke-dashoffset: var(--path-length, 100);
        fill-opacity: 0;
        animation: draw-loop ${duration}s ${timing}${delayStr} ${iteration};
      }
    `;

    const scriptContent = `
      (function() {
        var svg = document.currentScript.parentElement;
        var elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
        elements.forEach(function(el) {
          try {
            var len = el.getTotalLength ? el.getTotalLength() : 100;
            el.style.setProperty('--path-length', len);
          } catch(e) { el.style.setProperty('--path-length', '100'); }
        });
      })();
    `;

    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (hasError || parserError.length > 0) throw new Error('XML Parse Error');

      const style = doc.createElement('style');
      style.setAttribute('id', 'icon-manager-animation');
      style.textContent = cssContent;

      const script = doc.createElement('script');
      script.setAttribute('id', 'icon-manager-script');
      script.textContent = scriptContent;

      const svgElement = doc.documentElement;
      if (svgElement.firstChild) {
        svgElement.insertBefore(script, svgElement.firstChild);
        svgElement.insertBefore(style, svgElement.firstChild);
      } else {
        svgElement.appendChild(style);
        svgElement.appendChild(script);
      }

      return new XMLSerializer().serializeToString(doc);
    } catch (_e) {
      // Fallback
      const cssStyle = `<style id="icon-manager-animation">${cssContent}</style>
    <script id="icon-manager-script">${scriptContent}</script>`;
      const svgTagMatch = svg.match(/<svg[^>]*>/i);
      if (svgTagMatch) {
        const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
        return svg.slice(0, insertPos) + cssStyle + svg.slice(insertPos);
      }
      return svg;
    }
  }

  public static detectAnimationFromSvg(svg: string): DetectedAnimation | null {
    // Try DOM parsing first
    try {
      let hasError = false;
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {
            hasError = true;
          },
          fatalError: () => {
            hasError = true;
          },
        },
      });
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const parserError = doc.getElementsByTagName('parsererror');
      if (!hasError && parserError.length === 0) {
        const styles = doc.getElementsByTagName('style');
        for (let i = 0; i < styles.length; i++) {
          const content = styles[i].textContent || '';
          const result = this.analyzeCssContent(content);
          if (result) return result;
        }
      }
    } catch (_e) {
      // Ignore and fall through to regex
    }

    // Fallback to regex on full string
    return this.analyzeCssContent(svg);
  }

  private static analyzeCssContent(content: string): DetectedAnimation | null {
    // Check for draw animations first (they are special)
    if (content.includes('@keyframes draw-loop')) {
      return {
        type: 'draw-loop',
        settings: {
          duration: 2,
          timing: 'ease-in-out',
          iteration: 'infinite',
          delay: 0,
          direction: 'normal',
        },
      };
    }
    if (content.includes('@keyframes draw-reverse') || content.includes('@keyframes undraw')) {
      return {
        type: 'draw-reverse',
        settings: {
          duration: 2,
          timing: 'ease-in-out',
          iteration: '1',
          delay: 0,
          direction: 'normal',
        },
      };
    }
    if (content.includes('@keyframes draw')) {
      return {
        type: 'draw',
        settings: {
          duration: 2,
          timing: 'ease-in-out',
          iteration: '1',
          delay: 0,
          direction: 'normal',
        },
      };
    }

    // Check for standard animations (both old "svg {" format and new ".icon-anim-xxx {" format)
    // Try to find animation name first
    const nameMatch = content.match(/animation:\s*([\w-]+)/);
    if (!nameMatch) return null;

    const type = nameMatch[1];

    // Try to parse full settings: name duration timing [delay] iteration direction
    // Handle both formats: "svg { animation: ..." and ".icon-anim-xxx { animation: ..."
    const fullMatch = content.match(
      /(?:svg|\.icon-anim-\d+)\s*\{\s*animation:\s*([\w-]+)\s+([\d.]+)s\s+([^\s]+)(?:\s+([\d.]+)s)?\s+([^\s]+)\s+([^\s;}]+)/
    );

    if (fullMatch && fullMatch[1] === type) {
      return {
        type: type,
        settings: {
          duration: parseFloat(fullMatch[2]),
          timing: fullMatch[3],
          delay: fullMatch[4] ? parseFloat(fullMatch[4]) : 0,
          iteration: fullMatch[5],
          direction: fullMatch[6],
        },
      };
    }

    // Fallback: try to find duration at least, use defaults for others
    const durationMatch = content.match(/animation:.*?([\d.]+)s/);

    return {
      type: type,
      settings: {
        duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
        timing: 'ease',
        delay: 0,
        iteration: 'infinite',
        direction: 'normal',
      },
    };
  }

  public static applyCssFilter(svg: string, filter: string): string {
    // Check if style attribute exists
    if (svg.match(/<svg[^>]*style=["'][^"']*["']/i)) {
      return svg.replace(/(<svg[^>]*style=["')([^"']*)(["'])/i, (match, p1, p2, p3) => {
        // Remove existing filter if any
        let style = p2;
        style = style.replace(/filter:[^;]+;?/gi, '');
        if (style && !style.endsWith(';')) style += ';';
        return `${p1}${style} filter: ${filter};${p3}`;
      });
    } else {
      // Add style attribute
      return svg.replace(/<svg/i, `<svg style="filter: ${filter};"`);
    }
  }
}
