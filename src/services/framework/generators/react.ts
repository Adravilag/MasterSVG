import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Genera el hook useEffect para manejar la Web Animations API en React
 */
const getReactAnimationHook = (): string => {
  return `  useEffect(() => {
    if (!svgRef.current || !icon) return;
    if (animationRef.current) animationRef.current.cancel();

    const animConfig = animation
      ? { type: animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
      : icon.animation;

    if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
      animationRef.current = svgRef.current.animate(
        ANIMATION_KEYFRAMES[animConfig.type],
        {
          duration: animConfig.duration || 1000,
          easing: animConfig.timing || 'linear',
          iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
        }
      );
    }
    return () => animationRef.current?.cancel();
  }, [name, animation, icon]);`;
};

/**
 * Generador principal del componente React (< 40 líneas)
 */
export function generateReactComponent(componentNameArg: string): string {
  const name = toPascalCase(componentNameArg);
  const animationHook = getReactAnimationHook();

  return `import React, { useEffect, useRef } from 'react';
import { icons } from './svg-data';

interface IconProps {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: keyof typeof ANIMATION_KEYFRAMES;
  className?: string;
  style?: React.CSSProperties;
}

${getAnimationKeyframesString()}

export function ${name}({ name, size = '1em', color = 'currentColor', variant, animation, className, style }: IconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const icon = (icons as Record<string, any>)[name];

${animationHook}

  if (!icon) return null;
  let body = icon.body;

  if (variant && icon.variants?.[variant]) {
    Object.entries(icon.variants[variant]).forEach(([orig, repl]) => {
      const regex = new RegExp(orig.replace(/[.*+?^$\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
      body = body.replace(regex, repl as string);
    });
  }

  const sizeValue = typeof size === 'number' ? \`\${size}px\` : size;

  return (
    <svg
      ref={svgRef}
      viewBox={icon.viewBox}
      width={sizeValue}
      height={sizeValue}
      fill={color}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export default ${name};`;
}
