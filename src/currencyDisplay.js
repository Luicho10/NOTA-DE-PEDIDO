// Ajuste de presentación monetaria para la Nota de Pedido.
// Los importes de la nota se expresan en guaraníes paraguayos.

function convertirNodoTexto(node) {
  let text = node.nodeValue;
  const original = text;

  text = text.replace(/Total de Dólares americanos \(US\$\)/gi, "Total de Guaraníes (Gs.)");
  text = text.replace(/Dólares americanos \(US\$\)/gi, "Guaraníes (Gs.)");
  text = text.replace(/DÓLARES AMERICANOS/gi, "GUARANÍES");
  text = text.replace(/Dólares americanos/gi, "Guaraníes");
  text = text.replace(/\$\s*([\d.]+),00\b/g, "Gs. $1");
  text = text.replace(/\$\s*/g, "Gs. ");

  if (text !== original) node.nodeValue = text;
}

function actualizarMoneda() {
  const root = document.querySelector(".sheet") || document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  nodes.forEach(convertirNodoTexto);
}

let programado = false;
function programarActualizacion() {
  if (programado) return;
  programado = true;
  requestAnimationFrame(() => {
    programado = false;
    actualizarMoneda();
  });
}

if (typeof window !== "undefined") {
  const observer = new MutationObserver(programarActualizacion);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("load", actualizarMoneda);
  setTimeout(actualizarMoneda, 0);
}
