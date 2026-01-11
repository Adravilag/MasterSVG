import * as fs from 'fs';
import * as path from 'path';
import { FrameworkType } from '../utils/configHelper';

/**
 * Service for generating framework-specific icon wrapper components
 */
export class FrameworkWrapperService {
  private static instance: FrameworkWrapperService;

  private constructor() {}

  public static getInstance(): FrameworkWrapperService {
    if (!FrameworkWrapperService.instance) {
      FrameworkWrapperService.instance = new FrameworkWrapperService();
    }
    return FrameworkWrapperService.instance;
  }

  /**
   * Generate and write a framework-specific icon wrapper component.
   *
   * Creates the appropriate component file based on the target framework,
   * with proper imports, props handling, and styling.
   *
   * @param outputPath - Directory where the component file will be created
   * @param framework - Target framework ('react', 'vue', 'svelte', etc.)
   * @param componentName - Name for the generated component
   * @throws Error if unable to write to the output path
   * @example
   * ```typescript
   * service.generateWrapper('/workspace/icons', 'react', 'SvgIcon');
   * // Creates: /workspace/icons/SvgIcon.tsx
   * ```
   */
  public generateWrapper(outputPath: string, framework: FrameworkType, componentName: string): void {
    const generators: Record<FrameworkType, () => string> = {
      html: () => this.generateWebComponent(componentName),
      react: () => this.generateReactComponent(componentName),
      vue: () => this.generateVueComponent(componentName),
      angular: () => this.generateAngularComponent(componentName),
      svelte: () => this.generateSvelteComponent(componentName),
      astro: () => this.generateAstroComponent(componentName),
      solid: () => this.generateSolidComponent(componentName),
      qwik: () => this.generateQwikComponent(componentName),
    };

    const content = generators[framework]();
    const filename = this.getWrapperFilename(framework, componentName);
    const filePath = path.join(outputPath, filename);

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Get the appropriate filename for a wrapper component.
   *
   * Returns framework-specific filename with correct extension and casing:
   * - React/Solid/Qwik: PascalCase.tsx
   * - Vue: PascalCase.vue
   * - Svelte: PascalCase.svelte
   * - Angular: kebab-case.component.ts
   * - HTML: svg-element.js
   *
   * @param framework - Target framework
   * @param componentName - Base component name
   * @returns Filename with appropriate extension
   * @example
   * ```typescript
   * service.getWrapperFilename('react', 'SvgIcon');  // 'SvgIcon.tsx'
   * service.getWrapperFilename('angular', 'SvgIcon'); // 'svg-icon.component.ts'
   * ```
   */
  public getWrapperFilename(framework: FrameworkType, componentName: string): string {
    // Convert to PascalCase for frameworks that use it (React, Vue, Svelte, Astro, Solid, Qwik)
    const pascalName = this.toPascalCase(componentName);
    switch (framework) {
      case 'html':
        return 'svg-element.js';
      case 'react':
        return `${pascalName}.tsx`;
      case 'vue':
        return `${pascalName}.vue`;
      case 'angular':
        return `${this.toKebabCase(componentName)}.component.ts`;
      case 'svelte':
        return `${pascalName}.svelte`;
      case 'astro':
        return `${pascalName}.astro`;
      case 'solid':
        return `${pascalName}.tsx`;
      case 'qwik':
        return `${pascalName}.tsx`;
      default:
        return 'svg-element.js';
    }
  }

  /**
   * Get the recommended default component name for a framework.
   *
   * Web Components (HTML) and Angular require hyphenated names,
   * while other frameworks use PascalCase.
   *
   * @param framework - Target framework
   * @returns Default component name ('SvgIcon' or 'svg-icon')
   * @example
   * ```typescript
   * service.getDefaultComponentName('react');   // 'SvgIcon'
   * service.getDefaultComponentName('html');    // 'svg-icon'
   * service.getDefaultComponentName('angular'); // 'svg-icon'
   * ```
   */
  public getDefaultComponentName(framework: FrameworkType): string {
    switch (framework) {
      case 'html':
        return 'svg-icon';
      case 'angular':
        return 'svg-icon';
      default:
        return 'SvgIcon';
    }
  }

  /**
   * Get a usage example for the generated component.
   *
   * Returns JSX-style self-closing tags for most frameworks,
   * or explicit closing tags for HTML/Angular.
   *
   * @param framework - Target framework
   * @param componentName - Component name to use in example
   * @returns HTML/JSX code snippet demonstrating component usage
   * @example
   * ```typescript
   * service.getUsageExample('react', 'SvgIcon');  // '<SvgIcon name="home" />'
   * service.getUsageExample('html', 'svg-icon');  // '<svg-icon name="home"></svg-icon>'
   * ```
   */
  public getUsageExample(framework: FrameworkType, componentName: string): string {
    switch (framework) {
      case 'html':
        return `<${componentName} name="home"></${componentName}>`;
      case 'angular':
        return `<${componentName} name="home"></${componentName}>`;
      default:
        return `<${componentName} name="home" />`;
    }
  }

  /**
   * Check if the framework requires hyphenated component names.
   *
   * Web Components specification requires custom elements to have a hyphen
   * in their tag name. Angular also uses this convention.
   *
   * @param framework - Target framework to check
   * @returns True if component name must contain a hyphen
   * @example
   * ```typescript
   * service.requiresHyphen('html');   // true
   * service.requiresHyphen('angular'); // true
   * service.requiresHyphen('react');   // false
   * ```
   */
  public requiresHyphen(framework: FrameworkType): boolean {
    return framework === 'html' || framework === 'angular';
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateWebComponent(tagName: string): string {
    return `// Auto-generated by MasterSVG
// Web Component wrapper for icons

import { icons } from './svg-data.js';

const ANIMATION_KEYFRAMES = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

class SvgIcon extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'size', 'color', 'variant', 'animation'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._currentAnimation = null;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const name = this.getAttribute('name');
    const size = this.getAttribute('size') || '1em';
    const color = this.getAttribute('color') || 'currentColor';
    const variant = this.getAttribute('variant');
    const animationAttr = this.getAttribute('animation');

    const icon = icons[name];
    if (!icon) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    let body = icon.body;

    // Apply variant colors if specified
    if (variant && icon.variants && icon.variants[variant]) {
      const variantColors = icon.variants[variant];
      Object.entries(variantColors).forEach(([original, replacement]) => {
        const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
        body = body.replace(regex, replacement);
      });
    }

    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        svg {
          width: \${size};
          height: \${size};
          fill: \${color};
        }
      </style>
      <svg viewBox="\${icon.viewBox}" xmlns="http://www.w3.org/2000/svg">
        \${body}
      </svg>
    \`;

    // Handle animation
    const svg = this.shadowRoot.querySelector('svg');
    if (svg) {
      // Stop any existing animation
      if (this._currentAnimation) {
        this._currentAnimation.cancel();
        this._currentAnimation = null;
      }

      // Determine animation config
      const animConfig = animationAttr
        ? { type: animationAttr, duration: 1000, timing: 'linear', iteration: 'infinite' }
        : icon.animation;

      if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
        this._currentAnimation = svg.animate(
          ANIMATION_KEYFRAMES[animConfig.type],
          {
            duration: animConfig.duration || 1000,
            easing: animConfig.timing || 'linear',
            iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
            delay: animConfig.delay || 0,
            direction: animConfig.direction || 'normal',
          }
        );
      }
    }
  }
}

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', SvgIcon);
}

export { SvgIcon };
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateReactComponent(componentName: string): string {
    // Ensure PascalCase for React component
    const name = this.toPascalCase(componentName);
    return `// Auto-generated by MasterSVG
// React wrapper component for icons

import React, { useEffect, useRef } from 'react';
import { icons } from './svg-data';

interface IconProps {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';
  className?: string;
  style?: React.CSSProperties;
}

const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

export function ${name}({ name, size = '1em', color = 'currentColor', variant, animation, className, style }: IconProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<Animation | null>(null);

  const icon = (icons as Record<string, any>)[name];

  useEffect(() => {
    if (!svgRef.current || !icon) return;

    // Cancel existing animation
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }

    // Determine animation config
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
          delay: animConfig.delay || 0,
          direction: animConfig.direction || 'normal',
        }
      );
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
      }
    };
  }, [name, animation, icon]);

  if (!icon) return null;

  let body = icon.body;

  // Apply variant colors
  if (variant && icon.variants?.[variant]) {
    Object.entries(icon.variants[variant]).forEach(([original, replacement]) => {
      const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
      body = body.replace(regex, replacement as string);
    });
  }

  const sizeValue = typeof size === 'number' ? \`\${size}px\` : size;

  return (
    <svg
      ref={svgRef}
      viewBox={icon.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      width={sizeValue}
      height={sizeValue}
      fill={color}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export default ${name};
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateVueComponent(_componentName: string): string {
    return `<!-- Auto-generated by MasterSVG -->
<!-- Vue wrapper component for icons -->

<template>
  <svg
    v-if="icon"
    ref="svgRef"
    :viewBox="icon.viewBox"
    xmlns="http://www.w3.org/2000/svg"
    :width="sizeValue"
    :height="sizeValue"
    :fill="color"
    :class="className"
    :style="style"
    v-html="bodyWithVariant"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { icons } from './svg-data';

interface Props {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';
  className?: string;
  style?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor',
});

const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

const svgRef = ref<SVGSVGElement | null>(null);
let currentAnimation: Animation | null = null;

const icon = computed(() => (icons as Record<string, any>)[props.name]);

const sizeValue = computed(() =>
  typeof props.size === 'number' ? \`\${props.size}px\` : props.size
);

const bodyWithVariant = computed(() => {
  if (!icon.value) return '';
  let body = icon.value.body;

  if (props.variant && icon.value.variants?.[props.variant]) {
    Object.entries(icon.value.variants[props.variant]).forEach(([original, replacement]) => {
      const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
      body = body.replace(regex, replacement as string);
    });
  }

  return body;
});

function applyAnimation() {
  if (!svgRef.value || !icon.value) return;

  if (currentAnimation) {
    currentAnimation.cancel();
    currentAnimation = null;
  }

  const animConfig = props.animation
    ? { type: props.animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
    : icon.value.animation;

  if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
    currentAnimation = svgRef.value.animate(
      ANIMATION_KEYFRAMES[animConfig.type],
      {
        duration: animConfig.duration || 1000,
        easing: animConfig.timing || 'linear',
        iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
        delay: animConfig.delay || 0,
        direction: animConfig.direction || 'normal',
      }
    );
  }
}

watch([() => props.name, () => props.animation], applyAnimation);

onMounted(() => {
  applyAnimation();
});

onUnmounted(() => {
  if (currentAnimation) {
    currentAnimation.cancel();
  }
});
</script>
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateAngularComponent(selector: string): string {
    const className = this.toPascalCase(selector) + 'Component';
    return `// Auto-generated by MasterSVG
// Angular wrapper component for icons

import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { icons } from './svg-data';

const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

@Component({
  selector: '${selector}',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <svg
      #svgElement
      *ngIf="icon"
      [attr.viewBox]="icon.viewBox"
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="sizeValue"
      [attr.height]="sizeValue"
      [attr.fill]="color"
      [innerHTML]="bodyWithVariant"
    ></svg>
  \`,
  styles: [\`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  \`]
})
export class ${className} implements AfterViewInit, OnChanges, OnDestroy {
  @Input() name!: string;
  @Input() size: string | number = '1em';
  @Input() color: string = 'currentColor';
  @Input() variant?: string;
  @Input() animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';

  @ViewChild('svgElement') svgElement?: ElementRef<SVGSVGElement>;

  private currentAnimation: Animation | null = null;

  get icon(): any {
    return (icons as Record<string, any>)[this.name];
  }

  get sizeValue(): string {
    return typeof this.size === 'number' ? \`\${this.size}px\` : this.size;
  }

  get bodyWithVariant(): string {
    if (!this.icon) return '';
    let body = this.icon.body;

    if (this.variant && this.icon.variants?.[this.variant]) {
      Object.entries(this.icon.variants[this.variant]).forEach(([original, replacement]) => {
        const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
        body = body.replace(regex, replacement as string);
      });
    }

    return body;
  }

  ngAfterViewInit(): void {
    this.applyAnimation();
  }

  ngOnChanges(): void {
    this.applyAnimation();
  }

  ngOnDestroy(): void {
    if (this.currentAnimation) {
      this.currentAnimation.cancel();
    }
  }

  private applyAnimation(): void {
    if (!this.svgElement?.nativeElement || !this.icon) return;

    if (this.currentAnimation) {
      this.currentAnimation.cancel();
      this.currentAnimation = null;
    }

    const animConfig = this.animation
      ? { type: this.animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
      : this.icon.animation;

    if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
      this.currentAnimation = this.svgElement.nativeElement.animate(
        ANIMATION_KEYFRAMES[animConfig.type],
        {
          duration: animConfig.duration || 1000,
          easing: animConfig.timing || 'linear',
          iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
          delay: animConfig.delay || 0,
          direction: animConfig.direction || 'normal',
        }
      );
    }
  }
}
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateSvelteComponent(_componentName: string): string {
    return `<!-- Auto-generated by MasterSVG -->
<!-- Svelte wrapper component for icons -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { icons } from './svg-data';

  export let name: string;
  export let size: string | number = '1em';
  export let color: string = 'currentColor';
  export let variant: string | undefined = undefined;
  export let animation: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink' | undefined = undefined;
  let className: string = '';
  export { className as class };

  const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
    spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
    pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
    bounce: [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-25%)' },
      { transform: 'translateY(0)' },
    ],
    shake: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10%)' },
      { transform: 'translateX(10%)' },
      { transform: 'translateX(0)' },
    ],
    ping: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.5)', opacity: 0 },
    ],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
  };

  let svgElement: SVGSVGElement;
  let currentAnimation: Animation | null = null;

  $: icon = (icons as Record<string, any>)[name];
  $: sizeValue = typeof size === 'number' ? \`\${size}px\` : size;
  $: bodyWithVariant = getBodyWithVariant(icon, variant);

  function getBodyWithVariant(icon: any, variant: string | undefined): string {
    if (!icon) return '';
    let body = icon.body;

    if (variant && icon.variants?.[variant]) {
      Object.entries(icon.variants[variant]).forEach(([original, replacement]) => {
        const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
        body = body.replace(regex, replacement as string);
      });
    }

    return body;
  }

  function applyAnimation() {
    if (!svgElement || !icon) return;

    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }

    const animConfig = animation
      ? { type: animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
      : icon.animation;

    if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
      currentAnimation = svgElement.animate(
        ANIMATION_KEYFRAMES[animConfig.type],
        {
          duration: animConfig.duration || 1000,
          easing: animConfig.timing || 'linear',
          iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
          delay: animConfig.delay || 0,
          direction: animConfig.direction || 'normal',
        }
      );
    }
  }

  $: if (svgElement && icon) {
    applyAnimation();
  }

  onDestroy(() => {
    if (currentAnimation) {
      currentAnimation.cancel();
    }
  });
</script>

{#if icon}
  <svg
    bind:this={svgElement}
    viewBox={icon.viewBox}
    xmlns="http://www.w3.org/2000/svg"
    width={sizeValue}
    height={sizeValue}
    fill={color}
    class={className}
  >
    {@html bodyWithVariant}
  </svg>
{/if}
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateAstroComponent(_componentName: string): string {
    return `---
// Auto-generated by MasterSVG
// Astro wrapper component for icons

import { icons } from './svg-data';

interface Props {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';
  class?: string;
}

const { name, size = '1em', color = 'currentColor', variant, animation, class: className } = Astro.props;

const icon = (icons as Record<string, any>)[name];
const sizeValue = typeof size === 'number' ? \`\${size}px\` : size;

let body = icon?.body || '';

if (variant && icon?.variants?.[variant]) {
  Object.entries(icon.variants[variant]).forEach(([original, replacement]) => {
    const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
    body = body.replace(regex, replacement as string);
  });
}

const animConfig = animation
  ? { type: animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
  : icon?.animation;
---

{icon && (
  <svg
    viewBox={icon.viewBox}
    xmlns="http://www.w3.org/2000/svg"
    width={sizeValue}
    height={sizeValue}
    fill={color}
    class={className}
    data-animation={animConfig?.type}
    data-animation-duration={animConfig?.duration}
    data-animation-timing={animConfig?.timing}
    data-animation-iteration={animConfig?.iteration}
    set:html={body}
  />
)}

<script>
  const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
    spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
    pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
    bounce: [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-25%)' },
      { transform: 'translateY(0)' },
    ],
    shake: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10%)' },
      { transform: 'translateX(10%)' },
      { transform: 'translateX(0)' },
    ],
    ping: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.5)', opacity: 0 },
    ],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
  };

  document.querySelectorAll('svg[data-animation]').forEach((svg) => {
    const type = svg.getAttribute('data-animation');
    if (!type || !ANIMATION_KEYFRAMES[type]) return;

    const duration = parseInt(svg.getAttribute('data-animation-duration') || '1000');
    const timing = svg.getAttribute('data-animation-timing') || 'linear';
    const iteration = svg.getAttribute('data-animation-iteration') || 'infinite';

    svg.animate(ANIMATION_KEYFRAMES[type], {
      duration,
      easing: timing,
      iterations: iteration === 'infinite' ? Infinity : parseInt(iteration),
    });
  });
</script>
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateSolidComponent(componentName: string): string {
    // Ensure PascalCase for SolidJS component
    const name = this.toPascalCase(componentName);
    return `// Auto-generated by MasterSVG
// SolidJS wrapper component for icons

import { Component, createEffect, onCleanup } from 'solid-js';
import { icons } from './svg-data';

interface IconProps {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';
  class?: string;
}

const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

export const ${name}: Component<IconProps> = (props) => {
  let svgRef: SVGSVGElement | undefined;
  let currentAnimation: Animation | null = null;

  const icon = () => (icons as Record<string, any>)[props.name];

  const sizeValue = () => typeof props.size === 'number' ? \`\${props.size}px\` : (props.size || '1em');

  const bodyWithVariant = () => {
    const iconData = icon();
    if (!iconData) return '';
    let body = iconData.body;

    if (props.variant && iconData.variants?.[props.variant]) {
      Object.entries(iconData.variants[props.variant]).forEach(([original, replacement]) => {
        const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
        body = body.replace(regex, replacement as string);
      });
    }

    return body;
  };

  createEffect(() => {
    if (!svgRef || !icon()) return;

    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }

    const animConfig = props.animation
      ? { type: props.animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
      : icon().animation;

    if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
      currentAnimation = svgRef.animate(
        ANIMATION_KEYFRAMES[animConfig.type],
        {
          duration: animConfig.duration || 1000,
          easing: animConfig.timing || 'linear',
          iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
          delay: animConfig.delay || 0,
          direction: animConfig.direction || 'normal',
        }
      );
    }
  });

  onCleanup(() => {
    if (currentAnimation) {
      currentAnimation.cancel();
    }
  });

  return (
    <>
      {icon() && (
        <svg
          ref={svgRef}
          viewBox={icon().viewBox}
          xmlns="http://www.w3.org/2000/svg"
          width={sizeValue()}
          height={sizeValue()}
          fill={props.color || 'currentColor'}
          class={props.class}
          innerHTML={bodyWithVariant()}
        />
      )}
    </>
  );
};

export default ${name};
`;
  }

  // eslint-disable-next-line max-lines-per-function -- Template method that generates complete component code
  private generateQwikComponent(componentName: string): string {
    // Ensure PascalCase for Qwik component
    const name = this.toPascalCase(componentName);
    return `// Auto-generated by MasterSVG
// Qwik wrapper component for icons

import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { icons } from './svg-data';

interface IconProps {
  name: string;
  size?: string | number;
  color?: string;
  variant?: string;
  animation?: 'spin' | 'pulse' | 'bounce' | 'shake' | 'ping' | 'fade' | 'blink';
  class?: string;
}

const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = {
  spin: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
  pulse: [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }],
  bounce: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-25%)' },
    { transform: 'translateY(0)' },
  ],
  shake: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-10%)' },
    { transform: 'translateX(10%)' },
    { transform: 'translateX(0)' },
  ],
  ping: [
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }],
};

export const ${name} = component$<IconProps>((props) => {
  const svgRef = useSignal<SVGSVGElement>();

  const icon = (icons as Record<string, any>)[props.name];
  const sizeValue = typeof props.size === 'number' ? \`\${props.size}px\` : (props.size || '1em');

  let body = icon?.body || '';

  if (props.variant && icon?.variants?.[props.variant]) {
    Object.entries(icon.variants[props.variant]).forEach(([original, replacement]) => {
      const regex = new RegExp(original.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi');
      body = body.replace(regex, replacement as string);
    });
  }

  useVisibleTask$(({ cleanup }) => {
    if (!svgRef.value || !icon) return;

    const animConfig = props.animation
      ? { type: props.animation, duration: 1000, timing: 'linear', iteration: 'infinite' }
      : icon.animation;

    let currentAnimation: Animation | null = null;

    if (animConfig && ANIMATION_KEYFRAMES[animConfig.type]) {
      currentAnimation = svgRef.value.animate(
        ANIMATION_KEYFRAMES[animConfig.type],
        {
          duration: animConfig.duration || 1000,
          easing: animConfig.timing || 'linear',
          iterations: animConfig.iteration === 'infinite' ? Infinity : parseInt(animConfig.iteration) || 1,
          delay: animConfig.delay || 0,
          direction: animConfig.direction || 'normal',
        }
      );
    }

    cleanup(() => {
      if (currentAnimation) {
        currentAnimation.cancel();
      }
    });
  });

  if (!icon) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={icon.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      width={sizeValue}
      height={sizeValue}
      fill={props.color || 'currentColor'}
      class={props.class}
      dangerouslySetInnerHTML={body}
    />
  );
});

export default ${name};
`;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
