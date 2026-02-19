import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera la definición del componente Qwik por separado para reducir el conteo de líneas
 */
const getQwikBody = (name: string, viewBox: string, id: string, opts: ComponentExportOptions) => {
  const { typescript: ts, defaultSize: sz = 24, defaultColor: cl = 'currentColor', spritePath: sp = 'sprite.svg' } = opts;

  const propsType = ts ? `<${name}Props>` : '';
  const useTag = `<use href={\`${sp}#${id}\`} />`;

  return `
export const ${name} = component$${propsType}(({ size = ${sz}, color = '${cl}' }) => {
  return (
    <svg width={size} height={size} viewBox="${viewBox}" fill={color} aria-hidden="true" focusable="false">
      ${useTag}
    </svg>
  );
});`;
};

export const qwikTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const { typescript: ts } = opts;

  const imports = `import { component$${ts ? ', type QwikIntrinsicElements' : ''} } from '@builder.io/qwik';`;
  const types = ts ? `\ninterface ${name}Props { size?: number | string; color?: string }\n` : '';
  const body = getQwikBody(name, viewBox, id, opts);

  return `${imports}\n${types}${body}\n`;
};
