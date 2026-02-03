/**
 * SVG DOM Parser Helper
 *
 * Centralized XML/SVG parsing with error handling.
 * Extracted from SvgManipulationService to reduce duplication (DRY).
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export interface ParseResult {
  doc: Document;
  hasError: boolean;
}

/**
 * Create a DOMParser with silent error handling
 */
export function createSilentParser(): { parser: DOMParser; hasError: () => boolean } {
  let errorOccurred = false;

  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => { errorOccurred = true; },
      fatalError: () => { errorOccurred = true; },
    },
  });

  return {
    parser,
    hasError: () => errorOccurred,
  };
}

/**
 * Parse SVG string to Document with error detection
 */
export function parseSvg(svg: string): ParseResult | null {
  const { parser, hasError } = createSilentParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');

  const parserError = doc.getElementsByTagName('parsererror');
  if (hasError() || parserError.length > 0) {
    return null;
  }

  return { doc, hasError: hasError() };
}

/**
 * Serialize Document back to string
 */
export function serializeSvg(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Get SVG root element from document
 */
export function getSvgElement(doc: Document): Element | null {
  const svgElement = doc.documentElement;
  if (!svgElement || svgElement.tagName !== 'svg') {
    return null;
  }
  return svgElement;
}

/**
 * Create and append an element to SVG
 */
export function createSvgElement(
  doc: Document,
  tagName: string,
  attributes: Record<string, string> = {},
  content?: string
): Element {
  const element = doc.createElement(tagName);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }

  if (content !== undefined) {
    element.textContent = content;
  }

  return element;
}

/**
 * Insert style and script elements at the beginning of SVG
 */
export function insertAtSvgStart(
  svgElement: Element,
  ...elements: Element[]
): void {
  const firstChild = svgElement.firstChild;
  for (const element of elements.reverse()) {
    if (firstChild) {
      svgElement.insertBefore(element, firstChild);
    } else {
      svgElement.appendChild(element);
    }
  }
}

/**
 * Regex fallback: Insert content after SVG opening tag
 */
export function insertAfterSvgTag(svg: string, content: string): string {
  const svgTagMatch = svg.match(/<svg[^>]*>/i);
  if (svgTagMatch) {
    const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
    return svg.slice(0, insertPos) + content + svg.slice(insertPos);
  }
  return svg;
}
