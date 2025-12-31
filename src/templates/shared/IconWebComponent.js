// Auto-generated Web Component by Icon Studio
// Usage: <${TAG_NAME} name="icon-name"></${TAG_NAME}>
// With variant: <${TAG_NAME} name="icon-name" variant="dark-theme"></${TAG_NAME}>
// With animation: <${TAG_NAME} name="icon-name" animation="spin"></${TAG_NAME}>
// With light/dark colors: <${TAG_NAME} name="icon-name" light-color="#333" dark-color="#fff"></${TAG_NAME}>
// Import this file in your HTML: <script type="module" src="./path/to/icon.js"></script>

import { icons } from './icons.js';

// Optional imports - these files may not exist
let Variants = {};
let defaultVariants = {};
let colorMappings = {};

try {
  const VariantsModule = await import('./variants.js');
  Variants = VariantsModule.Variants || {};
  defaultVariants = VariantsModule.defaultVariants || {};
  colorMappings = VariantsModule.colorMappings || {};
} catch (e) {
  // variants.js not found, continue without Variants
}

// Animation CSS styles using individual transform properties (2024+)
// Benefits: Better performance, easier to combine multiple animations
const animationStyles = `
  /* Entry animation with @starting-style (2024) */
  @starting-style {
    ${TAG_NAME} svg {
      opacity: 0;
      scale: 0.8;
    }
  }

  ${TAG_NAME} svg {
    transition: opacity 0.3s ease, scale 0.3s ease;
  }

  /* Basic animations */
  @keyframes icon-spin {
    from { rotate: 0deg; }
    to { rotate: 360deg; }
  }
  @keyframes icon-spin-reverse {
    from { rotate: 360deg; }
    to { rotate: 0deg; }
  }
  @keyframes icon-pulse {
    0%, 100% { scale: 1; opacity: 1; }
    50% { scale: 1.1; opacity: 0.8; }
  }
  @keyframes icon-pulse-grow {
    0%, 100% { scale: 1; }
    50% { scale: 1.3; }
  }
  @keyframes icon-bounce {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -8px; }
  }
  @keyframes icon-bounce-horizontal {
    0%, 100% { translate: 0 0; }
    50% { translate: 8px 0; }
  }
  @keyframes icon-shake {
    0%, 100% { translate: 0 0; }
    25% { translate: -4px 0; }
    75% { translate: 4px 0; }
  }
  @keyframes icon-shake-vertical {
    0%, 100% { translate: 0 0; }
    25% { translate: 0 -4px; }
    75% { translate: 0 4px; }
  }
  @keyframes icon-fade {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes icon-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes icon-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes icon-float {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -6px; }
  }
  @keyframes icon-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes icon-glow {
    0%, 100% { filter: drop-shadow(0 0 2px currentColor); }
    50% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor); }
  }

  /* Attention seekers */
  @keyframes icon-swing {
    0%, 100% { rotate: 0deg; transform-origin: top center; }
    25% { rotate: 15deg; }
    75% { rotate: -15deg; }
  }
  @keyframes icon-wobble {
    0%, 100% { translate: 0 0; rotate: 0deg; }
    15% { translate: -6px 0; rotate: -5deg; }
    30% { translate: 5px 0; rotate: 3deg; }
    45% { translate: -4px 0; rotate: -3deg; }
    60% { translate: 3px 0; rotate: 2deg; }
    75% { translate: -2px 0; rotate: -1deg; }
  }
  @keyframes icon-rubber-band {
    0%, 100% { scale: 1 1; }
    30% { scale: 1.25 0.75; }
    40% { scale: 0.75 1.25; }
    50% { scale: 1.15 0.85; }
    65% { scale: 0.95 1.05; }
    75% { scale: 1.05 0.95; }
  }
  @keyframes icon-jello {
    0%, 11.1%, 100% { transform: skewX(0) skewY(0); }
    22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); }
    33.3% { transform: skewX(6.25deg) skewY(6.25deg); }
    44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); }
    55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); }
  }
  @keyframes icon-heartbeat {
    0%, 100% { scale: 1; }
    14% { scale: 1.15; }
    28% { scale: 1; }
    42% { scale: 1.15; }
    70% { scale: 1; }
  }
  @keyframes icon-tada {
    0%, 100% { scale: 1; rotate: 0deg; }
    10%, 20% { scale: 0.9; rotate: -3deg; }
    30%, 50%, 70%, 90% { scale: 1.1; rotate: 3deg; }
    40%, 60%, 80% { scale: 1.1; rotate: -3deg; }
  }

  /* Entrance/Exit animations */
  @keyframes icon-zoom-in {
    from { scale: 0; opacity: 0; }
    to { scale: 1; opacity: 1; }
  }
  @keyframes icon-zoom-out {
    from { scale: 1; opacity: 1; }
    to { scale: 0; opacity: 0; }
  }
  @keyframes icon-slide-in-up {
    from { translate: 0 100%; opacity: 0; }
    to { translate: 0 0; opacity: 1; }
  }
  @keyframes icon-slide-in-down {
    from { translate: 0 -100%; opacity: 0; }
    to { translate: 0 0; opacity: 1; }
  }
  @keyframes icon-slide-in-left {
    from { translate: -100% 0; opacity: 0; }
    to { translate: 0 0; opacity: 1; }
  }
  @keyframes icon-slide-in-right {
    from { translate: 100% 0; opacity: 0; }
    to { translate: 0 0; opacity: 1; }
  }
  @keyframes icon-flip {
    0% { transform: perspective(400px) rotateY(0); }
    100% { transform: perspective(400px) rotateY(360deg); }
  }
  @keyframes icon-flip-x {
    0% { transform: perspective(400px) rotateX(0); }
    100% { transform: perspective(400px) rotateX(360deg); }
  }

  /* Draw animations (for stroke-based SVGs) */
  @keyframes icon-draw {
    from { stroke-dashoffset: var(--path-length, 1000); }
    to { stroke-dashoffset: 0; }
  }
  @keyframes icon-draw-reverse {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: var(--path-length, 1000); }
  }
  @keyframes icon-draw-loop {
    0% { stroke-dashoffset: var(--path-length, 1000); }
    45% { stroke-dashoffset: 0; }
    55% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: var(--path-length, 1000); }
  }

  /* Legacy aliases */
  @keyframes icon-wiggle {
    0%, 100% { rotate: 0deg; }
    25% { rotate: -10deg; }
    75% { rotate: 10deg; }
  }
  @keyframes icon-bounce-in {
    0% { scale: 0; opacity: 0; }
    50% { scale: 1.2; }
    100% { scale: 1; opacity: 1; }
  }

  /* Combined animations - using individual properties allows this! */
  .icon-combo-spin-pulse svg {
    animation: icon-spin 2s linear infinite, icon-pulse 1s ease infinite;
  }
  .icon-combo-bounce-fade svg {
    animation: icon-bounce 0.5s ease infinite, icon-fade 2s ease infinite;
  }
`;

// Inject animation styles once
if (!document.getElementById('icon-animation-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'icon-animation-styles';
  styleEl.textContent = animationStyles;
  document.head.appendChild(styleEl);
}

class IconElement extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'size', 'color', 'variant', 'animation', 'light-color', 'dark-color'];
  }

  connectedCallback() {
    this.render();
    // Listen for color scheme changes
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._mediaQuery.addEventListener('change', () => this.render());
  }

  disconnectedCallback() {
    if (this._mediaQuery) {
      this._mediaQuery.removeEventListener('change', () => this.render());
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  // Helper: calculate contrasting color for light/dark auto-detection
  getContrastColor(hex) {
    if (!hex || hex === 'currentColor') return null;
    // Normalize hex
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return null;

    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isLight = luminance > 0.5;

    // Invert: light colors get dark contrast, dark colors get light contrast
    const factor = isLight ? 0.2 : 0.8;
    const nr = Math.round(r + (255 - r) * (isLight ? -0.7 : 0.7));
    const ng = Math.round(g + (255 - g) * (isLight ? -0.7 : 0.7));
    const nb = Math.round(b + (255 - b) * (isLight ? -0.7 : 0.7));

    const clamp = v => Math.max(0, Math.min(255, v));
    return `#${[nr, ng, nb].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;
  }

  // Helper: get luminance of a color (0-1)
  getColorLuminance(hex) {
    if (!hex || hex === 'currentColor') return 0.5;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return 0.5;
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  render() {
    const name = this.getAttribute('name');
    if (!name) return;

    // Convert kebab-case to camelCase for lookup (handles letters and numbers after hyphens)
    const camelName = name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
    const icon = icons[camelName];

    if (!icon) {
      this.innerHTML = '';
      return;
    }

    const size = this.getAttribute('size') || '1em';

    // Light/Dark color support (CSS light-dark() function - 2024)
    let lightColor = this.getAttribute('light-color');
    let darkColor = this.getAttribute('dark-color');
    let color = this.getAttribute('color') || 'currentColor';

    // Auto-generate contrasting color if only one is specified
    if (lightColor && !darkColor) {
      darkColor = this.getContrastColor(lightColor) || lightColor;
    } else if (darkColor && !lightColor) {
      lightColor = this.getContrastColor(darkColor) || darkColor;
    } else if (color !== 'currentColor' && !lightColor && !darkColor) {
      // If just "color" is set, auto-generate light/dark variants
      const contrast = this.getContrastColor(color);
      if (contrast) {
        const luminance = this.getColorLuminance(color);
        lightColor = luminance > 0.5 ? contrast : color;
        darkColor = luminance > 0.5 ? color : contrast;
      }
    }

    // If light/dark colors available, use light-dark() CSS function
    if (lightColor && darkColor) {
      color = `light-dark(${lightColor}, ${darkColor})`;
    }

    // Use specified variant, or fall back to default Variant for this icon
    // Try both kebab-case (attribute name) and icon's stored name
    const variantName = this.getAttribute('variant') || defaultVariants[name] || defaultVariants[icon.name] || null;
    // Use specified animation, or fall back to icon's default animation (stored in icons.js)
    const animAttr = this.getAttribute('animation');
    const animName = (animAttr && animAttr.trim()) ? animAttr.trim() : (icon.animation?.type) || null;
    const animConfig = icon.animation || { duration: 1, timing: 'ease', iteration: 'infinite' };

    // Get body with variant colors applied if variant is specified
    let body = icon.body;

    // Apply color mappings first (custom color changes)
    // Try both kebab-case and stored name for color mappings lookup
    const iconColorMappings = colorMappings[name] || colorMappings[icon.name] || {};
    for (const [originalColor, newColor] of Object.entries(iconColorMappings)) {
      const regex = new RegExp(originalColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      body = body.replace(regex, newColor);
    }

    // Then apply variant colors if specified
    // Try both kebab-case and stored name for variants lookup
    const iconVariants = Variants[name] || Variants[icon.name] || {};
    if (variantName && iconVariants[variantName]) {
      const originalColors = iconVariants['_original'] || [];
      const variantColors = iconVariants[variantName];

      // Direct replacement: use _original colors to find and replace
      if (originalColors.length > 0) {
        for (let i = 0; i < Math.min(originalColors.length, variantColors.length); i++) {
          const regex = new RegExp(originalColors[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          body = body.replace(regex, variantColors[i]);
        }
      } else {
        // Fallback: Extract colors from body (fill, stroke, stop-color, style)
        const colorPatterns = [
          /(fill|stroke)=["']([^"']+)["']/gi,
          /stop-color\s*:\s*([#\w]+)/gi,
          /stop-color\s*=\s*["']([^"']+)["']/gi
        ];

        const foundColors = new Set();
        for (const pattern of colorPatterns) {
          const matches = [...body.matchAll(pattern)];
          matches.forEach(m => {
            const color = m[2] || m[1];
            if (color && color !== 'none' && color !== 'currentColor' && !color.startsWith('url(')) {
              foundColors.add(color);
            }
          });
        }

        const uniqueColors = [...foundColors];
        for (let i = 0; i < Math.min(uniqueColors.length, variantColors.length); i++) {
          const regex = new RegExp(uniqueColors[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          body = body.replace(regex, variantColors[i]);
        }
      }
    }

    // Build animation style using individual transform properties
    let animStyle = '';
    if (animName && animName !== 'none') {
      const duration = animConfig.duration || 1;
      const timing = animConfig.timing || 'ease';
      const iteration = animConfig.iteration || 'infinite';
      animStyle = `animation: icon-${animName} ${duration}s ${timing} ${iteration};`;
    }

    this.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="${icon.viewBox}"
        width="${size}"
        height="${size}"
        fill="${color}"
        style="display: inline-block; vertical-align: middle; color-scheme: light dark; ${animStyle}"
      >
        ${body}
      </svg>
    `;
  }
}

// Register the custom element
if (!customElements.get('${TAG_NAME}')) {
  customElements.define('${TAG_NAME}', IconElement);
}

export { IconElement };
