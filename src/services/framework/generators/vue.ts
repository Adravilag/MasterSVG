import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Genera el bloque de script setup para el componente Vue
 */
const getVueScriptLogic = () => `
const svgRef = ref<SVGSVGElement | null>(null);
const icon = computed(() => (icons as any)[props.name]);
const sizeValue = computed(() => typeof props.size === 'number' ? \`\${props.size}px\` : props.size);

const bodyWithVariant = computed(() => {
  if (!icon.value) return '';
  let body = icon.value.body;
  if (props.variant && icon.value.variants?.[props.variant]) {
    Object.entries(icon.value.variants[props.variant]).forEach(([orig, repl]) => {
      const escaped = orig.replace(/[.*+?^$\${}()|[\\]\\\\]/g, '\\\\$&');
      body = body.replace(new RegExp(escaped, 'gi'), repl as string);
    });
  }
  return body;
});

const applyAnimation = () => {
  if (!svgRef.value || !icon.value) return;
  const config = props.animation ? { type: props.animation, duration: 1000 } : icon.value.animation;
  if (config && ANIMATION_KEYFRAMES[config.type]) {
    svgRef.value.animate(ANIMATION_KEYFRAMES[config.type], {
      duration: config.duration || 1000,
      iterations: Infinity
    });
  }
};

onMounted(applyAnimation);
watch(() => [props.name, props.animation], applyAnimation);`;

export function generateVueComponent(nameArg: string): string {
  const dol = '$';
  const open = '{';
  const close = '}';

  return `<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { icons } from './svg-data';

interface Props {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: keyof typeof ANIMATION_KEYFRAMES;
  class?: string;
  style?: any;
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor'
});

${getAnimationKeyframesString()}
${getVueScriptLogic()}
</script>

<template>
  <svg v-if="icon"
    ref="svgRef"
    :viewBox="icon.viewBox"
    :width="sizeValue"
    :height="sizeValue"
    :fill="color"
    :class="props.class"
    :style="props.style"
    v-html="bodyWithVariant"
  />
</template>`;
}
