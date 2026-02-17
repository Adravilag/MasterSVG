/**
 * Type declarations for template asset imports.
 *
 * esbuild's templateTextPlugin loads these files as raw text strings,
 * and Jest uses scripts/jest-text-transform.js to do the same in tests.
 */

declare module '*.html' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
