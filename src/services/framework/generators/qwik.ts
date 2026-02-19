import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Genera el cuerpo de la tarea visible (ejecución en cliente)
 */
const getQwikTaskLogic = () => `
  useVisibleTask$(({ track }) => {
    track(() => props.animation);
    if (!svgRef.value || !icon.value) return;
    const config = props.animation ? { type: props.animation, duration: 1000 } : icon.value.animation;
    if (config && ANIMATION_KEYFRAMES[config.type]) {
      svgRef.value.animate(ANIMATION_KEYFRAMES[config.type], {
        duration: config.duration || 1000,
        iterations: Infinity
      });
    }
  });`;

export function generateQwikComponent(nameArg: string): string {
  const name = toPascalCase(nameArg);
  const dol = '$';
  const open = '{';
  const close = '}';

  return `import { component$, useVisibleTask$, useComputed$, useSignal } from '@builder.io/qwik';
import { icons } from './svg-data';

${getAnimationKeyframesString()}

export const ${name} = component$((props: any) => {
  const svgRef = useSignal<Element>();
  const icon = useComputed$(() => (icons as any)[props.name]);

  ${getQwikTaskLogic()}

  return (
    <svg
      ref={svgRef}
      viewBox=${dol}${open}icon.value?.viewBox${close}
      width=${dol}${open}typeof props.size === 'number' ? \`\${dol}${open}props.size${close}px\` : props.size || '1em'${close}
      height=${dol}${open}typeof props.size === 'number' ? \`\${dol}${open}props.size${close}px\` : props.size || '1em'${close}
      fill=${dol}${open}props.color || 'currentColor'${close}
      class=${dol}${open}props.class${close}
      dangerouslySetInnerHTML=${dol}${open}icon.value?.body${close}
    />
  );
});

export default ${name};`;
}
