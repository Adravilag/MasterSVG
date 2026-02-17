/**
 * Jest transform for template files (HTML, CSS, JS)
 *
 * Converts file content into a CommonJS module that exports the raw text.
 * Used so that static imports of template files work in Jest tests
 * the same way they work via esbuild's text loader in production.
 */
module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};
