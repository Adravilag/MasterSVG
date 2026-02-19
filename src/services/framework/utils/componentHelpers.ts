/**
 * Convierte cualquier string (kebab-case, snake_case, etc) a PascalCase.
 * Filtra valores vacíos para evitar errores de índice.
 */
export const toPascalCase = (str: string): string => {
  if (!str) return '';
  return str
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

/**
 * Datos maestros de animaciones utilizando la Web Animations API.
 */
export const ANIMATION_DATA = {
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
    { transform: 'scale(1.5)', opacity: 0 }
  ],
  fade: [{ opacity: 0 }, { opacity: 1 }],
  blink: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }]
};

/**
 * Genera el string de la constante ANIMATION_KEYFRAMES.
 * Se incluye una firma de índice para evitar errores de tipado al acceder dinámicamente.
 */
export const getAnimationKeyframesString = (): string => {
  const data = JSON.stringify(ANIMATION_DATA, null, 2);
  return `const ANIMATION_KEYFRAMES: Record<string, Keyframe[]> = ${data};`;
};
