import { supabase } from "./supabase";

export const CLIENT_KEY = "masfertil_clientes_v1";
export const ORDER_KEY = "masfertil_pedidos_v1";
const NEXT_KEY = "masfertil_numero_v1";

const clean = (v) => String(v || "").trim().replace(/\s/g, "");
const n = (v) => Number(v || 0);

async function activeUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Sesión no iniciada.");
  return session.user;
}

function mapClient(c = {}) {
  return {
    ruc: c.ruc_ci || "", nombre: c.nombre || "", area: c.area || "",
    direccion: c.direccion || "", region: c.region || "", telefono: c.telefono || "",
    correo: c.correo || "", ciudad: c.ciudad || ""
  };
}

function mapOrder(o, client, itemRows = []) {
  return {
    number: o.numero,
    date: o.fecha,
    type: o.tipo || "PEDIDO",
    client: client || mapClient(o.clientes),
    items: itemRows
      .sort((a, b) => n(a.orden) - n(b.orden))
      .map(i => ({
        cantidad: i.cantidad ?? "",
        unidad: i.unidad || "",
        descripcion: i.descripcion || "",
        precio: i.precio ?? ""
      })),
    total: n(o.total),
    obs: o.observaciones || "",
    contado: !!o.contado,
    plazo: !!o.plazo,
    semilla: !!o.tratamiento_semilla,
    venc: o.vencimiento || "",
    flete: o.flete || "",
    status: o.estado || "VIGENTE",
    currency: o.moneda || "PYG",
    cancelReason: o.justificativo_anulacion || "",
    cancelledAt: o.fecha_anulacion || ""
  };
}

export async function hydrateLocalStorage() {
  await activeUser();

  const { data: clients, error: ce } = await supabase
    .from("clientes")
    .select("*")
    .order("ruc_ci");
  if (ce) throw ce;

  const clientMap = {};
  for (const c of clients || []) {
    clientMap[clean(c.ruc_ci)] = mapClient(c);
  }

  // Se consultan pedidos e ítems por separado para evitar que una relación
  // anidada bloquee la carga completa en celulares.
  const { data: orders, error: oe } = await supabase
    .from("pedidos")
    .select("*")
    .order("numero", { ascending: true });
  if (oe) throw oe;

  const ids = (orders || []).map(o => o.id).filter(Boolean);
  let itemRows = [];
  if (ids.length) {
    const { data: rows, error: ie } = await supabase
      .from("pedido_items")
      .select("*")
      .in("pedido_id", ids);
    if (ie) throw ie;
    itemRows = rows || [];
  }

  const clientIds = [...new Set((orders || []).map(o => o.cliente_id).filter(Boolean))];
  let orderClients = [];
  if (clientIds.length) {
    const { data: rows, error: ice } = await supabase
      .from("clientes")
      .select("*")
      .in("id", clientIds);
    if (ice) throw ice;
    orderClients = rows || [];
  }

  const clientById = Object.fromEntries(orderClients.map(c => [c.id, mapClient(c)]));

  const localOrders = (orders || []).map(o =>
    mapOrder(
      o,
      clientById[o.cliente_id] || clientMap[clean(o.clientes?.ruc_ci)] || mapClient(o.clientes),
      itemRows.filter(i => i.pedido_id === o.id)
    )
  );

  localStorage.setItem(CLIENT_KEY, JSON.stringify(clientMap));
  localStorage.setItem(ORDER_KEY, JSON.stringify(localOrders));

  const next = localOrders.reduce((m, o) => Math.max(m, n(o.number) + 1), 51);
  localStorage.setItem(NEXT_KEY, String(next));
}

// Consulta directa a la nube. Es la fuente de verdad para BUSCAR por RUC/C.I.
// y evita depender de que localStorage ya haya terminado de hidratarse.
export async function findOrdersByRuc(ruc) {
  await activeUser();
  const normalized = clean(ruc);
  if (!normalized) return [];

  const { data: clients, error: ce } = await supabase
    .from("clientes")
    .select("*")
    .eq("ruc_ci", normalized)
    .limit(1);
  if (ce) throw ce;

  const clientRow = clients?.[0];
  if (!clientRow) return [];

  const client = mapClient(clientRow);

  const { data: orders, error: oe } = await supabase
    .from("pedidos")
    .select("*")
    .eq("cliente_id", clientRow.id)
    .order("numero", { ascending: false });
  if (oe) throw oe;

  const ids = (orders || []).map(o => o.id).filter(Boolean);
  let itemRows = [];
  if (ids.length) {
    const { data: rows, error: ie } = await supabase
      .from("pedido_items")
      .select("*")
      .in("pedido_id", ids);
    if (ie) throw ie;
    itemRows = rows || [];
  }

  return (orders || []).map(o => mapOrder(o, client, itemRows.filter(i => i.pedido_id === o.id)));
}

async function upsertClient(client) {
  const user = await activeUser();
  const payload = {
    ruc_ci: client.ruc, nombre: client.nombre || "", area: client.area || "", direccion: client.direccion || "",
    region: client.region || "", telefono: client.telefono || "", correo: client.correo || "", ciudad: client.ciudad || ""
  };
  const { data, error } = await supabase.from("clientes").upsert(payload, { onConflict: "ruc_ci" }).select("id").single();
  if (error) throw error;
  return { ...payload, id: data.id, user_id: user.id };
}

async function saveOrder(record) {
  const user = await activeUser();
  const client = await upsertClient(record.client);
  const { data: pedido, error: pe } = await supabase.from("pedidos").upsert({
    numero: n(record.number), fecha: record.date, tipo: record.type || "PEDIDO", moneda: record.currency || "PYG", cliente_id: client.id,
    vendedor_id: user.id, total: n(record.total), observaciones: record.obs || "", contado: !!record.contado,
    plazo: !!record.plazo, tratamiento_semilla: !!record.semilla, vencimiento: record.venc || null, flete: record.flete || "",
    estado: record.status || "VIGENTE", justificativo_anulacion: record.cancelReason || null,
    fecha_anulacion: record.cancelledAt || null, updated_at: new Date().toISOString()
  }, { onConflict: "numero" }).select("id").single();
  if (pe) throw pe;

  const items = (record.items || []).map((i, idx) => ({
    pedido_id: pedido.id, orden: idx + 1, cantidad: n(i.cantidad), unidad: i.unidad || "", descripcion: i.descripcion || "",
    precio: n(i.precio), subtotal: n(i.cantidad) * n(i.precio)
  }));

  const { error: de } = await supabase.from("pedido_items").delete().eq("pedido_id", pedido.id);
  if (de) throw de;
  if (items.length) {
    const { error: ie } = await supabase.from("pedido_items").insert(items);
    if (ie) throw ie;
  }

  await supabase.from("pedido_historial").insert({
    pedido_id: pedido.id,
    usuario_id: user.id,
    accion: record.status === "ANULADA" ? "ANULACION" : "GUARDADO",
    detalle: record.status === "ANULADA" ? (record.cancelReason || "") : `Nota N° ${record.number}`
  });
}

const pendingOrderSaves = new Map();
let cloudQueueRunning = false;

function enqueueOrderSave(order) {
  pendingOrderSaves.set(String(order.number), order);
  if (cloudQueueRunning) return;
  cloudQueueRunning = true;
  (async () => {
    try {
      while (pendingOrderSaves.size) {
        const [number, record] = pendingOrderSaves.entries().next().value;
        pendingOrderSaves.delete(number);
        try {
          await saveOrder(record);
        } catch (e) {
          console.error("Sincronización de pedido:", e);
        }
      }
    } finally {
      cloudQueueRunning = false;
      if (pendingOrderSaves.size) enqueueOrderSave(pendingOrderSaves.values().next().value);
    }
  })();
}

export function installCloudStorageSync() {
  return;
}
export { saveOrder, upsertClient };
