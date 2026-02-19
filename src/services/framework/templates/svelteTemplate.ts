import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera el bloque de script de Svelte
 */
const getSvelteScript = (ts: boolean, size: number | string, color: string): string => {
  const lang = ts ? ' lang="ts"' : '';
  const sizeType = ts ? ': number | string' : '';
  const colorType = ts ? ': string' : '';

  return `<script${lang}>
  export let size${sizeType} = ${size};
  export let color${colorType} = '${color}';
</script>`;
};

export const svelteTemplate = (
  name: string,
  viewBox: string,
  id: string,
  opts: ComponentExportOptions
): string => {
  const {
    typescript = false,
    defaultSize = 24,
    defaultColor = 'currentColor',
    spritePath = 'sprite.svg'
  } = opts;

  const scriptBlock = getSvelteScript(typescript, defaultSize, defaultColor);

  return `${scriptBlock}

<svg
  width={size}
  height={size}
  viewBox="${viewBox}"
  fill={color}
  aria-hidden="true"
  focusable="false"
  {...$$restProps}
>
  <use href="${spritePath}#${id}" />
</svg>`;
};
