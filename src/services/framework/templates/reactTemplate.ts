import { ComponentExportOptions } from '../../types/mastersvgTypes';

const getReactTypes = (ts: boolean): string => {
  if (!ts) return '';
  return `\ninterface IconProps extends React.SVGProps<SVGSVGElement> {\n  size?: number | string;\n  color?: string;\n}`;
};

const getReactSignature = (name: string, ts: boolean, ref: boolean): string => {
  if (ref) {
    if (ts) return `const ${name} = React.forwardRef<SVGSVGElement, IconProps>(function ${name}(props, ref) {`;
    return `const ${name} = React.forwardRef(function ${name}(props, ref) {`;
  }

  if (ts) return `const ${name}: React.FC<IconProps> = (props) => {`;
  return `const ${name} = (props) => {`;
};

export const reactTemplate = (name: string, viewBox: string, id: string, opts: ComponentExportOptions, innerContent?: string): string => {
  const { typescript = false, forwardRef = false, memo = false, spritePath = 'sprite.svg', exportType = 'named' } = opts;

  const signature = getReactSignature(name, typescript, forwardRef);

  // Usar innerContent si está disponible para parity (inline paths), o <use> con sprite
  const svgBody = innerContent && innerContent.trim()
    ? innerContent.trim()
    : '<use href={`' + spritePath + '#' + id + '`} />';

  // Normalizar cierre autocontenido a estilo del sample (espacio antes de '/>')
  const normalizedSvgBody = svgBody.replace(/([^\s])\/>/g, '$1 />');

  // Generar tipos (paridad con sample: no size/color en la interfaz)
  const types = typescript ? getReactTypes(true) : '';

  // Cerrar la definición según si usamos forwardRef o no
  const closeSuffix = forwardRef ? '});' : '};';

  // Usar normalizedSvgBody siempre para evitar diferencias de formato
  const body = `
${signature}
  return (
    <svg width="24" height="24" viewBox="${viewBox}" ${forwardRef ? 'ref={ref} ' : ''}{...props}>
      ${normalizedSvgBody}
    </svg>
  );
${closeSuffix}
`;

  // Handle memoization: create an exported alias so export { Name } is valid
  const memoBlock = memo
    ? `
const _Memo${name} = React.memo(${name});
export { _Memo${name} as ${name} };
`
    : `
export { ${name} };
`;

  const defaultExport = exportType === 'default' ? `
export default ${memo ? `_Memo${name}` : name};
` : '';

  return `import React from 'react';${types}
${body}${memo ? '' : ''}${memoBlock}${defaultExport}`;
};
