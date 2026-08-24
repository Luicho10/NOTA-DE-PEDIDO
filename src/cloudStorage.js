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

export async function hydrateLocalStorage() {
  await activeUser();
  const { data: clients, error: ce } = await supabase.from("clientes").select("*").order("ruc_ci");
  if (ce) throw ce;
  const clientMap = {};
  for (const c of clients || []) {
    clientMap[clean(c.ruc_ci)] = {
      ruc: c.ruc_ci || "", nombre: c.nombre || "", area: c.area || "",
      direccion: c.direccion || "", region: c.region || "", telefono: c.telefono || "",
      correo: c.correo || "", ciudad: c.ciudad || ""
    };
  }
  const { data: orders, error: oe } = await supabase.from("pedidos").select("*, clientes(*), pedido_items(*)").order("numero", { ascending: true });
  if (oe) throw oe;
  const localOrders = (orders || []).map(o => ({
    number: o.numero, date: o.fecha, type: o.tipo || "PEDIDO",
    client: clientMap[clean(o.clientes?.ruc_ci)] || {
      ruc: o.clientes?.ruc_ci || "", nombre: o.clientes?.nombre || "", area: o.clientes?.area || "",
      direccion: o.clientes?.direccion || "", region: o.clientes?.region || "", telefono: o.clientes?.telefono || "",
      correo: o.clientes?.correo || "", ciudad: o.clientes?.ciudad || ""
    },
    items: (o.pedido_items || []).sort((a,b) => n(a.orden)-n(b.orden)).map(i => ({
      cantidad: i.cantidad ?? "", unidad: i.unidad || "", descripcion: i.descripcion || "", precio: i.precio ?? ""
    })),
    total: n(o.total), obs: o.observaciones || "", contado: !!o.contado, plazo: !!o.plazo,
    semilla: !!o.tratamiento_semilla, venc: o.vencimiento || "", flete: o.flete || "",
    status: o.estado || "VIGENTE", cancelReason: o.justificativo_anulacion || "", cancelledAt: o.fecha_anulacion || ""
  }));
  localStorage.setItem(CLIENT_KEY, JSON.stringify(clientMap));
  localStorage.setItem(ORDER_KEY, JSON.stringify(localOrders));
  const next = localOrders.reduce((m, o) => Math.max(m, n(o.number) + 1), 51);
  localStorage.setItem(NEXT_KEY, String(next));
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
    numero: n(record.number), fecha: record.date, tipo: record.type || "PEDIDO", cliente_id: client.id,
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
  await supabase.from("pedido_historial").insert({ pedido_id: pedido.id, usuario_id: user.id, accion: record.status === "ANULADA" ? "ANULACION" : "GUARDADO", detalle: record.status === "ANULADA" ? (record.cancelReason || "") : `Nota N° ${record.number}` });
}

export function installCloudStorageSync() {
  const original = Storage.prototype.setItem;
  if (Storage.prototype.__masfertilCloudSync) return;
  Storage.prototype.__masfertilCloudSync = true;
  Storage.prototype.setItem = function(key, value) {
    original.call(this, key, value);
    if (key === CLIENT_KEY) {
      try {
        const map = JSON.parse(value || "{}");
        Promise.all(Object.values(map).filter(c => c?.ruc).map(upsertClient)).catch(console.error);
      } catch (e) { console.error(e); }
    }
    if (key === ORDER_KEY) {
      try {
        const orders = JSON.parse(value || "[]");
        const previous = window.__masfertilCloudOrders || [];
        const changed = orders.filter(o => {
          const old = previous.find(x => n(x.number) === n(o.number));
          return !old || JSON.stringify(old) !== JSON.stringify(o);
        });
        window.__masfertilCloudOrders = orders;
        changed.forEach(o => saveOrder(o).catch(console.error));
      } catch (e) { console.error(e); }
    }
  };
}
