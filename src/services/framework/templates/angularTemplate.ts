import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera el bloque decorador @Component separado para reducir líneas
 */
const getAngularDecorator = (selector: string, viewBox: string, spritePath: string, id: string): string => `
@Component({
  selector: '${selector}',
  standalone: true,
  template: \`
    <svg [attr.width]="size" [attr.height]="size" viewBox="${viewBox}" [attr.fill]="color" aria-hidden="true" focusable="false">
      <svg:use [attr.xlink:href]="'${spritePath}#' + id" />
    </svg>
  \`
})`;

export const angularTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const { defaultSize: sz = 24, defaultColor: cl = 'currentColor', spritePath: sp = 'sprite.svg' } = opts;

  // Lógica de transformación
  const selector = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-icon';
  const decorator = getAngularDecorator(selector, viewBox, sp, id);

  const imports = `import { Component, Input } from '@angular/core';`;

  const classBody = `
export class ${name}IconComponent {
  @Input() size: number | string = ${sz};
  @Input() color: string = '${cl}';
  readonly id = '${id}';
}`;

  return `${imports}\n${decorator}\n${classBody}`;
};
