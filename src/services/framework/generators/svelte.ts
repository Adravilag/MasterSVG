import { getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Genera el bloque de lógica reactiva ($:) de Svelte para evitar funciones largas
 */
const getSvelteReactiveLogic = (): string => `
  $: icon = (icons as any)[name];
  $: sizeValue = typeof size === 'number' ? \`\${size}px\` : size;

  $: body = (() => {
    if (!icon) return '';
    let b = icon.body;
    if (variant && icon.variants?.[variant]) {
      Object.entries(icon.variants[variant]).forEach(([orig, repl]) => {
        b = b.replace(new RegExp(orig.replace(/[.*+?^$\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi'), repl as string);
      });
    }
    return b;
  })();

  $: if (svgRef && (name || animation)) {
    const config = animation ? { type: animation, duration: 1000 } : icon?.animation;
    if (config && ANIMATION_KEYFRAMES[config.type]) {
      svgRef.animate(ANIMATION_KEYFRAMES[config.type], {
        duration: config.duration || 1000,
        iterations: Infinity
      });
    }
  }`;

export function generateSvelteComponent(): string {
  // Constantes de escape para proteger el parseo de ESLint
  const dol = '$';
  const open = '{';
  const close = '}';

  return `<script lang="ts">
  import { icons } from './svg-data';
  export let name: string;
  export let size: string | number = '1em';
  export let color: string = 'currentColor';
  export let variant: string | undefined = undefined;
  export let animation: string | undefined = undefined;
  let className: string = '';
  export { className as class };

  ${getAnimationKeyframesString()}

  let svgRef: SVGSVGElement;

  ${getSvelteReactiveLogic()}
</script>

${dol}${open}#if icon${close}
  <svg
    bind:this=${dol}${open}svgRef${close}
    viewBox=${dol}${open}icon.viewBox${close}
    width=${dol}${open}sizeValue${close}
    height=${dol}${open}sizeValue${close}
    fill=${dol}${open}color${close}
    class=${dol}${open}className${close}
    xmlns="http://www.w3.org/2000/svg"
  >
    ${dol}${open}@html body${close}
  </svg>
${dol}${open}/if${close}`;
}
