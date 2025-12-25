/**
 * Módulo de integración con la API de Iconify
 * 
 * Proporciona funciones para buscar y obtener iconos de Iconify.
 */

/**
 * Resultado de búsqueda de Iconify
 */
export interface IconifySearchResult {
  prefix: string;
  name: string;
}

/**
 * Parsea los resultados de búsqueda de Iconify
 * @param data Datos JSON de la API de Iconify
 * @returns Array de resultados parseados
 */
export function parseIconifySearchResults(data: any): IconifySearchResult[] {
  const icons: IconifySearchResult[] = [];
  
  if (!data || !data.icons || !Array.isArray(data.icons)) {
    return icons;
  }
  
  for (const iconId of data.icons) {
    if (typeof iconId !== 'string') continue;
    const parts = iconId.split(':');
    if (parts.length === 2 && parts[0] && parts[1]) {
      icons.push({ prefix: parts[0], name: parts[1] });
    }
  }
  
  return icons;
}

/**
 * Construye la URL de búsqueda de Iconify
 * @param query Término de búsqueda
 * @param limit Límite de resultados (por defecto 50)
 * @returns URL completa para la API de búsqueda
 */
export function buildSearchUrl(query: string, limit: number = 50): string {
  return `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${limit}`;
}

/**
 * Construye la URL para obtener un SVG de Iconify
 * @param prefix Prefijo de la colección (ej: "lucide", "heroicons")
 * @param name Nombre del icono
 * @param color Color opcional para iconos monocromáticos
 * @returns URL completa para obtener el SVG
 */
export function buildSvgUrl(prefix: string, name: string, color?: string): string {
  let url = `https://api.iconify.design/${prefix}/${name}.svg`;
  if (color) {
    url += `?color=${encodeURIComponent(color)}`;
  }
  return url;
}

/**
 * Construye la URL para preview de un icono
 * @param prefix Prefijo de la colección
 * @param name Nombre del icono
 * @param color Color para el preview
 * @returns URL completa para la imagen de preview
 */
export function buildPreviewUrl(prefix: string, name: string, color: string = '#ffffff'): string {
  return `https://api.iconify.design/${prefix}/${name}.svg?color=${encodeURIComponent(color)}`;
}

/**
 * Valida si una respuesta SVG es válida
 * @param data Datos de respuesta
 * @param statusCode Código de estado HTTP
 * @returns true si el SVG es válido
 */
export function isValidSvgResponse(data: string, statusCode: number): boolean {
  return statusCode === 200 && data.includes('<svg');
}

/**
 * Busca iconos en Iconify usando la API
 * @param query Término de búsqueda
 * @returns Promise con los resultados de búsqueda
 */
export async function searchIconify(query: string): Promise<IconifySearchResult[]> {
  const https = await import('https');
  
  return new Promise((resolve, reject) => {
    const url = buildSearchUrl(query);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(parseIconifySearchResults(result));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Obtiene el SVG de un icono de Iconify
 * @param prefix Prefijo de la colección
 * @param name Nombre del icono
 * @param color Color opcional para iconos monocromáticos
 * @returns Promise con el SVG o null si no se encontró
 */
export async function fetchIconSvg(prefix: string, name: string, color?: string): Promise<string | null> {
  const https = await import('https');
  
  return new Promise((resolve, reject) => {
    const url = buildSvgUrl(prefix, name, color);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (isValidSvgResponse(data, res.statusCode || 0)) {
          resolve(data);
        } else {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Obtiene múltiples iconos en paralelo
 * @param icons Array de iconos a obtener
 * @param color Color opcional
 * @returns Promise con un Map de nombre completo -> SVG
 */
export async function fetchMultipleIcons(
  icons: IconifySearchResult[],
  color?: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  const promises = icons.map(async (icon) => {
    const svg = await fetchIconSvg(icon.prefix, icon.name, color);
    if (svg) {
      results.set(`${icon.prefix}:${icon.name}`, svg);
    }
  });
  
  await Promise.all(promises);
  return results;
}
