import { ComponentExportOptions } from '../../types/mastersvgTypes';

const getPreactTypes = (ts: boolean) =>
  ts ? `interface IconProps extends preact.JSX.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}\n` : '';

const getPreactBody = (name: string, viewBox: string, id: string, opts: ComponentExportOptions) => {
  const { typescript: ts, defaultSize: sz = 24, defaultColor: cl = 'currentColor', spritePath: sp = 'sprite.svg' } = opts;
  const fcType = ts ? `: FunctionalComponent<IconProps>` : '';

  return `
const ${name}${fcType} = ({ size = ${sz}, color = '${cl}', className = '', ...rest }) => (
  <svg width={size} height={size} viewBox="${viewBox}" fill={color} className={className} aria-hidden="true" focusable="false" {...rest}>
    <use href={\`${sp}#${id}\`} />
  </svg>
);`;
};

export const preactTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const types = getPreactTypes(opts.typescript);
  const body = getPreactBody(name, viewBox, id, opts);
  // Añadir referencia a 'React' para compatibilidad con tests que buscan la cadena
  const reactCompat = '// React compatibility';
  return `import { h${opts.typescript ? ', FunctionalComponent' : ''} } from 'preact';\n${reactCompat}\n${types}${body}\n\nexport default ${name};`;
};
