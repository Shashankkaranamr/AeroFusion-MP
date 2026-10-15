/** el('div', 'a b', { 'aria-hidden': 'true' }, child, 'text') */
export function el(tag, className = '', attrs = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}
