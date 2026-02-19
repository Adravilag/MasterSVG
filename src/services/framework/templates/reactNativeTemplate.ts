import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera la firma del componente y sus tipos para React Native
 */
const getReactNativeHeader = (name: string, ts: boolean, sz: number, cl: string): string => {
  const interfaceDef = ts ? `interface ${name}Props { size?: number; color?: string; }\n\n` : '';
  const signature = ts
    ? `const ${name}: React.FC<${name}Props> = ({ size = ${sz}, color = '${cl}' }) => (`
    : `const ${name} = ({ size = ${sz}, color = '${cl}' }) => (`;

  return `${interfaceDef}${signature}`;
};

export const reactNativeTemplate = (
  name: string,
  viewBox: string,
  id: string,
  body: string,
  opts: ComponentExportOptions
): string => {
  const { typescript: ts, defaultSize: sz = 24, defaultColor: cl = 'currentColor' } = opts;

  const imports = `import React from 'react';\nimport Svg, { Path, Circle, Rect, Line, Polyline, Polygon, G } from 'react-native-svg';`;
  const header = getReactNativeHeader(name, ts, sz, cl);

  return `${imports}

${header}
  <Svg width={size} height={size} viewBox="${viewBox}" fill="none">
    ${body}
  </Svg>
);

export default ${name};`;
};
