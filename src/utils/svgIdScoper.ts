export function scopeSvgIds(svg: string, suffix: string): string {
  if (!svg) return svg;

  // Collect ids
  const idRegex = /id=(['"])([^'"\s>]+)\1/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(svg)) !== null) {
    ids.push(m[2]);
  }

  if (ids.length === 0) return svg;

  let scoped = svg;
  for (const id of ids) {
    const newId = `${id}__${suffix}`;

    // Replace id attribute
    const idAttrRegex = new RegExp(`(id=(['"]))${id}\\2`, 'g');
    scoped = scoped.replace(idAttrRegex, `$1${newId}$2`);

    // Replace url(#id) references
    const urlRefRegex = new RegExp(`url\\(#${id}\\)`, 'g');
    scoped = scoped.replace(urlRefRegex, `url(#${newId})`);

    // Replace href="#id" and xlink:href="#id"
    const hrefRegex = new RegExp(`href=(['"])#${id}\\1`, 'g');
    scoped = scoped.replace(hrefRegex, `href=$1#${newId}$1`);
    const xlinkHrefRegex = new RegExp(`xlink:href=(['"])#${id}\\1`, 'g');
    scoped = scoped.replace(xlinkHrefRegex, `xlink:href=$1#${newId}$1`);

    // Generic #id references (safe-ish replacement with word boundary)
    const hashRefRegex = new RegExp(`#${id}\b`, 'g');
    scoped = scoped.replace(hashRefRegex, `#${newId}`);
  }

  return scoped;
}
