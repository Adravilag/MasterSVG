import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

export function generateSolidComponent(nameArg: string): string {
  const name = toPascalCase(nameArg);

  return `import { createMemo, onMount, createEffect } from 'solid-js';
import { icons } from './svg-data';

${getAnimationKeyframesString()}

export function ${name}(props: any) {
  let svgRef: SVGSVGElement | undefined;
  const icon = createMemo(() => (icons as any)[props.name]);

  createEffect(() => {
    if (!svgRef || !icon()) return;
    const config = props.animation ? { type: props.animation, duration: 1000 } : icon().animation;
    if (config && ANIMATION_KEYFRAMES[config.type]) {
      svgRef.animate(ANIMATION_KEYFRAMES[config.type], { duration: 1000, iterations: Infinity });
    }
  });

  const body = createMemo(() => {
    let b = icon().body;
    if (props.variant && icon().variants?.[props.variant]) {
      Object.entries(icon().variants[props.variant]).forEach(([o, r]) => {
        b = b.replace(new RegExp(o, 'gi'), r as string);
      });
    }
    return b;
  });

  return (
    <svg
      ref={svgRef}
      viewBox={icon().viewBox}
      width={typeof props.size === 'number' ? \`\${props.size}px\` : props.size || '1em'}
      height={typeof props.size === 'number' ? \`\${props.size}px\` : props.size || '1em'}
      fill={props.color || 'currentColor'}
      classList={{ [props.class]: !!props.class }}
      style={props.style}
      innerHTML={body()}
    />
  );
}`;
}
