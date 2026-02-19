import { ComponentExportOptions } from '../../types/mastersvgTypes';

// Extraemos el bloque de estilos y la lógica del render para reducir el conteo de líneas
const getLitComponentBody = (name: string, tagName: string, viewBox: string, id: string, spritePath: string, size: number | string, color: string) => `
@customElement('${tagName}')
export class ${name}Icon extends LitElement {
  @property({ type: Number }) size = ${size};
  @property({ type: String }) color = '${color}';

  static styles = css\`
    :host { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; }
    svg { display: block; }
  \`;

  render() {
    return html\`
      <svg width="\${'${'this.size'}'}" height="\${'${'this.size'}'}" viewBox="${viewBox}" fill="\${'${'this.color'}'}" aria-hidden="true" focusable="false">
        <use href="${spritePath}#${id}"></use>
      </svg>\`;
  }
}`;

export const litTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const { defaultSize: sz = 24, defaultColor: cl = 'currentColor', spritePath: sp = 'sprite.svg' } = opts;
  const tagName = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-icon';

  const imports = `import { LitElement, html, css } from 'lit';\nimport { customElement, property } from 'lit/decorators.js';`;
  const body = getLitComponentBody(name, tagName, viewBox, id, sp, sz, cl);
  const declaration = `declare global { interface HTMLElementTagNameMap { '${tagName}': ${name}Icon; } }`;

  return `${imports}\n${body}\n\n${declaration}`;
};
