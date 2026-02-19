import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera la definición de tipos para SolidJS
 */
const getSolidTypes = (name: string, ts: boolean): string => {
  if (!ts) return '';
  return `interface ${name}Props extends JSX.SvgSVGAttributes<SVGSVGElement> {
  size?: number | string;
  color?: string;
}\n`;
};

/**
 * Construye el cuerpo funcional del componente Solid
 */
const getSolidBody = (name: string, viewBox: string, id: string, opts: ComponentExportOptions): string => {
  const { typescript: ts = false, defaultSize: sz = 24, defaultColor: cl = 'currentColor', spritePath: sp = 'sprite.svg' } = opts;
  const signature = `const ${name}${ts ? `: Component<${name}Props>` : ''} = (props) => {`;

  return `
${signature}
  const merged = mergeProps({ size: ${sz}, color: '${cl}' }, props);
  const [local, others] = splitProps(merged, ['size', 'color']);

  return (
    <svg width={local.size} height={local.size} viewBox="${viewBox}" fill={local.color} aria-hidden="true" focusable="false" {...others}>
      <use href={\`${sp}#${id}\`} />
    </svg>
  );
};`;
};

export const solidTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const { typescript = false } = opts;

  const imports = `import { splitProps, mergeProps${typescript ? ', Component' : ''} } from 'solid-js';`;
  const types = getSolidTypes(name, typescript);
  const body = getSolidBody(name, viewBox, id, opts);

  return `${imports}\n\n${types}${body}\n\nexport default ${name};\n`;
};
