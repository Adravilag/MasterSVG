import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Genera el bloque de lógica interna de la clase Lit para evitar funciones largas
 */
const getLitClassLogic = (): string => `
  @query('svg') svgElement!: SVGSVGElement;
  private _anim: Animation | null = null;

  updated(changed: Map<string, any>) {
    if (changed.has('animation') || changed.has('name')) this.applyAnimation();
  }

  private applyAnimation() {
    const icon = (icons as any)[this.name];
    if (this._anim) this._anim.cancel();
    const config = this.animation ? { type: this.animation, duration: 1000 } : icon?.animation;
    if (this.svgElement && config && ANIMATION_KEYFRAMES[config.type]) {
      this._anim = this.svgElement.animate(ANIMATION_KEYFRAMES[config.type], {
        duration: config.duration || 1000,
        iterations: Infinity
      });
    }
  }`;

export function generateLitComponent(nameArg: string): string {
  const name = toPascalCase(nameArg);
  const tagName = nameArg.toLowerCase().replace(/_/g, '-');

  // Usamos variables para inyectar los símbolos conflictivos de Lit
  const dol = '$';
  const open = '{';
  const close = '}';

  return `import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { icons } from './svg-data';

${getAnimationKeyframesString()}

@customElement('${tagName}')
export class ${name} extends LitElement {
  @property() name = '';
  @property() size: string | number = '1em';
  @property() color = 'currentColor';
  @property() animation = '';

  static styles = css\`:host { display: inline-block; vertical-align: middle; }\`;

${getLitClassLogic()}

  render() {
    const icon = (icons as any)[this.name];
    if (!icon) return html\`\`;
    const s = typeof this.size === 'number' ? \`\${this.size}px\` : this.size;

    return html\`
      <svg
        viewBox="\${dol}${open}icon.viewBox${close}"
        width="\${dol}${open}s${close}"
        height="\${dol}${open}s${close}"
        fill="\${dol}${open}this.color${close}">
        \${dol}${open}unsafeHTML(icon.body)${close}
      </svg>\`;
  }
}`;
}
