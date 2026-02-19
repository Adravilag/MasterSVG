import { ComponentExportOptions } from '../../types/mastersvgTypes';

/**
 * Genera el bloque de script setup, manejando la lógica de TS vs JS
 */
const getVueScriptSetup = (ts: boolean, size: number | string, color: string): string => {
  const lang = ts ? ' lang="ts"' : '';
  const interfaceDef = ts ? `interface Props {\n  size?: number | string;\n  color?: string;\n}\n\n` : '';
  const propsBody = `{
  size: { type: [Number, String], default: ${typeof size === 'string' ? `'${size}'` : size} },
  color: { type: String, default: '${color}' }
}`;

  return `<script setup${lang}>
${interfaceDef}defineProps${ts ? '<Props>' : ''}(${propsBody});
</script>`;
};

export const vueTemplate = (
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

  const scriptBlock = getVueScriptSetup(typescript, defaultSize, defaultColor);

  return `${scriptBlock}

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="${viewBox}"
    :fill="color"
    aria-hidden="true"
    focusable="false"
    v-bind="$attrs"
  >
    <use :href="\`${spritePath}#${id}\`" />
  </svg>
</template>\n`;
};
