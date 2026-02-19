import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

export function generatePreactComponent(nameArg: string): string {
  const name = toPascalCase(nameArg);
  return `import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { icons } from './svg-data';

${getAnimationKeyframesString()}

export function ${name}({ name, size = '1em', color = 'currentColor', variant, animation, class: className, style }: any) {
  const svgRef = useRef<SVGSVGElement>(null);
  const icon = (icons as any)[name];

  useEffect(() => {
    if (!svgRef.current || !icon) return;
    const config = animation ? { type: animation, duration: 1000 } : icon.animation;
    if (config && ANIMATION_KEYFRAMES[config.type]) {
      svgRef.current.animate(ANIMATION_KEYFRAMES[config.type], { duration: 1000, iterations: Infinity });
    }
  }, [name, animation, icon]);

  if (!icon) return null;
  const sizeVal = typeof size === 'number' ? \`\${size}px\` : size;

  return h('svg', {
    ref: svgRef,
    viewBox: icon.viewBox,
    width: sizeVal,
    height: sizeVal,
    fill: color,
    class: className,
    style: style,
    dangerouslySetInnerHTML: { __html: icon.body }
  });
}`;
}
