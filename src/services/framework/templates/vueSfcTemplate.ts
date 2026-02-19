import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera el bloque de script usando Options API para Vue SFC
 */
const getVueSfcScript = (name: string, ts: boolean, size: number | string, color: string): string => {
  const lang = ts ? ' lang="ts"' : '';

  return `<script${lang}>
export default {
  name: '${name}',
  props: {
    size: {
      type: [Number, String],
      default: ${typeof size === 'string' ? `'${size}'` : size}
    },
    color: {
      type: String,
      default: '${color}'
    }
  }
}
</script>`;
};

export const vueSfcTemplate = (
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

  const scriptBlock = getVueSfcScript(name, typescript, defaultSize, defaultColor);

  return `<template>
  <svg :width="size" :height="size" viewBox="${viewBox}" :fill="color" aria-hidden="true" focusable="false" v-bind="$attrs">
    <use :href="\`${spritePath}#${id}\`" />
  </svg>
</template>

${scriptBlock}\n`;
};
