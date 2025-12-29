// Auto-generated Web Component by Icon Manager
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

  /* Animations using individual transform properties */
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
    50% { translate: 0 -4px; } 
  }
  @keyframes icon-bounce-in {
    0% { scale: 0; opacity: 0; }
    50% { scale: 1.2; }
    100% { scale: 1; opacity: 1; }
  }
  @keyframes icon-shake { 
    0%, 100% { translate: 0 0; } 
    25% { translate: -2px 0; } 
    75% { translate: 2px 0; } 
  }
  @keyframes icon-fade { 
    0%, 100% { opacity: 1; } 
    50% { opacity: 0.3; } 
  }
  @keyframes icon-float {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -6px; }
  }
  @keyframes icon-wiggle {
    0%, 100% { rotate: 0deg; }
    25% { rotate: -10deg; }
    75% { rotate: 10deg; }
  }
  @keyframes icon-heartbeat {
    0%, 100% { scale: 1; }
    14% { scale: 1.3; }
    28% { scale: 1; }
    42% { scale: 1.3; }
    70% { scale: 1; }
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
      console.warn(`[Icon] Icon "${name}" not found in icons.js`);
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
    const variantName = this.getAttribute('variant') || defaultVariants[icon.name] || null;
    // Use specified animation, or fall back to icon's default animation (stored in icons.js)
    const animName = this.getAttribute('animation') || (icon.animation?.type) || null;
    const animConfig = icon.animation || { duration: 1, timing: 'ease', iteration: 'infinite' };
    
    // Get body with variant colors applied if variant is specified
    let body = icon.body;
    
    // Apply color mappings first (custom color changes)
    const iconColorMappings = colorMappings[icon.name] || {};
    for (const [originalColor, newColor] of Object.entries(iconColorMappings)) {
      const regex = new RegExp(originalColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      body = body.replace(regex, newColor);
    }
    
    // Then apply variant colors if specified
    const iconVariants = Variants[icon.name] || {};
    if (variantName && iconVariants[variantName]) {
      const variantColors = iconVariants[variantName];
      // Extract current colors from body and replace with variant colors
      const colorPattern = /(fill|stroke)=["']([^"']+)["']/gi;
      const matches = [...body.matchAll(colorPattern)];
      const uniqueColors = [...new Set(matches.map(m => m[2]).filter(c => c !== 'none' && c !== 'currentColor'))];
      
      for (let i = 0; i < Math.min(uniqueColors.length, variantColors.length); i++) {
        const regex = new RegExp(uniqueColors[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        body = body.replace(regex, variantColors[i]);
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
