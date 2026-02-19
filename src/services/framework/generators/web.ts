import { getAnimationKeyframesString } from '../utils/componentHelpers';

export function generateWebComponent(tagName: string): string {
  // 1. Agrupamos los caracteres conflictivos
  const esc = { d: '$', o: '{', c: '}' };

  // 2. Extraemos los métodos para reducir el tamaño de la función principal
  const methods = `
  static get observedAttributes() { return ['name', 'size', 'color', 'variant', 'animation']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._currentAnimation = null;
  }

  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }

  render() {
    const name = this.getAttribute('name');
    const size = this.getAttribute('size') || '1em';
    const color = this.getAttribute('color') || 'currentColor';
    const icon = icons[name];
    if (!icon) return;

    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: inline-flex; align-items: center; }
        svg { width: ${esc.d}${esc.o}size${esc.c}; height: ${esc.d}${esc.o}size${esc.c}; fill: ${esc.d}${esc.o}color${esc.c}; }
      </style>
      <svg viewBox="${esc.d}${esc.o}icon.viewBox${esc.c}">${esc.d}${esc.o}icon.body${esc.c}</svg>\`;

    this.applyAnimation(icon);
  }

  applyAnimation(icon) {
    const svg = this.shadowRoot.querySelector('svg');
    const anim = this.getAttribute('animation') || icon.animation?.type;
    if (this._currentAnimation) this._currentAnimation.cancel();
    if (svg && ANIMATION_KEYFRAMES[anim]) {
      this._currentAnimation = svg.animate(ANIMATION_KEYFRAMES[anim], { duration: 1000, iterations: Infinity });
    }
  }`;

  // 3. Ensamblado final
  return `import { icons } from './svg-data.js';
${getAnimationKeyframesString()}
class SvgIcon extends HTMLElement { ${methods} }
if (!customElements.get('${tagName}')) customElements.define('${tagName}', SvgIcon);
export { SvgIcon };`;
}
