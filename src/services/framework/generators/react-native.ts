import { toPascalCase } from '../utils/componentHelpers';

export function generateReactNativeComponent(nameArg: string): string {
  const name = toPascalCase(nameArg);
  return `import React from 'react';
import { Svg, G } from 'react-native-svg';
import { icons } from './svg-data';

export const ${name} = ({ name, size = 24, color = 'black', style }: any) => {
  const icon = (icons as any)[name];
  if (!icon) return null;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      style={style}
    >
      <G fill={color}>
        {/* Aquí el body debe estar pre-procesado para RN */}
        {icon.rnBody}
      </G>
    </Svg>
  );
};`;
}
