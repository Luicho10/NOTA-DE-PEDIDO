import React, { useMemo, useState } from "react";

const CLIENT_KEY="masfertil_clientes_v1", ORDER_KEY="masfertil_pedidos_v1", NEXT_KEY="masfertil_numero_v1";
const blank=()=>({cantidad:"",unidad:"",descripcion:"",precio:""});
const emptyClient={ruc:"",nombre:"",area:"",direccion:"",region:"",telefono:"",correo:"",ciudad:""};
const money=v=>Number(v||0).toLocaleString("es-PY",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=v=>v?new Date(`${v}T00:00:00`).toLocaleDateString("es-PY"):"";
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function key(v){return String(v||"").trim().replace(/\s/g,"")}
function words(n){
 const x=Math.round(Number(n||0));
 if(!x)return "CERO DÓLARES AMERICANOS";
 const u=["CERO","UNO","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE"];
 if(x<10)return `${u[x]} DÓLARES AMERICANOS`;
 return `${x.toLocaleString("es-PY")} DÓLARES AMERICANOS`;
}
export default function App(){
 const [number,setNumber]=useState(()=>Math.max(51,Number(localStorage.getItem(NEXT_KEY)||51)));
 const [date,setDate]=useState(new Date().toISOString().slice(0,10)),[type,setType]=useState("PEDIDO");
 const [client,setClient]=useState(emptyClient),[query,setQuery]=useState("");
 const [items,setItems]=useState(()=>Array.from({length:10},blank)),[obs,setObs]=useState("");
 const [contado,setContado]=useState(false),[plazo,setPlazo]=useState(false),[semilla,setSemilla]=useState(false),[venc,setVenc]=useState(""),[flete,setFlete]=useState("");
 const [msg,setMsg]=useState(""),[history,setHistory]=useState([]),[showHistory,setShowHistory]=useState(false),[showCancel,setShowCancel]=useState(false),[cancelReason,setCancelReason]=useState("");
 const [status,setStatus]=useState("VIGENTE");
 const total=useMemo(()=>items.reduce((s,i)=>s+Number(i.cantidad||0)*Number(i.precio||0),0),[items]);
 const setC=(k,v)=>setClient(c=>({...c,[k]:v}));
 const update=(i,k,v)=>setItems(a=>a.map((x,j)=>j===i?{...x,[k]:v}:x));
 function resetHistory(){setHistory([]);setShowHistory(false)}
 function buscar(){
   const k=key(query), clients=load(CLIENT_KEY,{}), orders=load(ORDER_KEY,[]);
   if(!k){setMsg("Ingrese RUC/C.I.");return}
   if(clients[k]){setClient(clients[k]);setMsg("Cliente encontrado.")}else{setClient({...emptyClient,ruc:query});setMsg("Cliente no encontrado. Puede registrarlo.")}
   const h=orders.filter(o=>key(o.client?.ruc)===k).sort((a,b)=>Number(b.number)-Number(a.number));
   setHistory(h);setShowHistory(h.length>0);
 }
 function saveClient(){if(!client.ruc.trim())return setMsg("Ingrese RUC/C.I.");const c=load(CLIENT_KEY,{});c[key(client.ruc)]=client;localStorage.setItem(CLIENT_KEY,JSON.stringify(c));setMsg("Cliente guardado.")}
 function save(){
   if(status==="ANULADA")return setMsg("Esta nota está anulada y no puede modificarse.");
   if(!client.ruc.trim())return setMsg("Ingrese RUC/C.I.");
   const o=load(ORDER_KEY,[]);
   const record={number,date,type,client:{...client},items:items.filter(i=>i.cantidad||i.unidad||i.descripcion||i.precio),total,obs,contado,plazo,semilla,venc,flete,status:"VIGENTE",createdAt:new Date().toISOString()};
   const existing=o.findIndex(x=>Number(x.number)===Number(number));
   if(existing>=0)o[existing]=record;else o.push(record);
   localStorage.setItem(ORDER_KEY,JSON.stringify(o));
   const c=load(CLIENT_KEY,{});c[key(client.ruc)]=client;localStorage.setItem(CLIENT_KEY,JSON.stringify(c));
   if(existing<0){const next=Math.max(Number(number)+1,Number(localStorage.getItem(NEXT_KEY)||51));localStorage.setItem(NEXT_KEY,next);setNumber(next);}
   setMsg(`Guardada N° ${String(number).padStart(6,"0")}.`);
 }
 function loadOrder(o){
   setNumber(Number(o.number));setDate(o.date||"");setType(o.type||"PEDIDO");setClient(o.client||emptyClient);setQuery(o.client?.ruc||"");setItems([...((o.items||[])),...Array.from({length:Math.max(0,10-(o.items||[]).length)},blank)] .slice(0,10));setObs(o.obs||"");setContado(!!o.contado);setPlazo(!!o.plazo);setSemilla(!!o.semilla);setVenc(o.venc||"");setFlete(o.flete||"");setStatus(o.status||"VIGENTE");setShowHistory(false);setMsg(`Nota N° ${String(o.number).padStart(6,"0")} cargada.`);
 }
 function cancelOrder(){
   if(status==="ANULADA")return setMsg("La nota ya está anulada.");
   if(!cancelReason.trim())return setMsg("Debe indicar el justificativo de la anulación.");
   const o=load(ORDER_KEY,[]),idx=o.findIndex(x=>Number(x.number)===Number(number));
   if(idx<0)return setMsg("Primero guarde la nota para poder anularla.");
   o[idx]={...o[idx],status:"ANULADA",cancelReason:cancelReason.trim(),cancelledAt:new Date().toISOString()};localStorage.setItem(ORDER_KEY,JSON.stringify(o));
   setStatus("ANULADA");setShowCancel(false);setCancelReason("");setMsg(`N° ${String(number).padStart(6,"0")} ANULADA y registrada en el historial.`);
   const h=o.filter(x=>key(x.client?.ruc)===key(client.ruc)).sort((a,b)=>Number(b.number)-Number(a.number));setHistory(h);setShowHistory(true);
 }
 function nuevo(){setNumber(Math.max(51,Number(localStorage.getItem(NEXT_KEY)||51)));setDate(new Date().toISOString().slice(0,10));setType("PEDIDO");setClient(emptyClient);setQuery("");setItems(Array.from({length:10},blank));setObs("");setContado(false);setPlazo(false);setSemilla(false);setVenc("");setFlete("");setStatus("VIGENTE");setMsg("");setHistory([]);setShowHistory(false);setShowCancel(false)}
 return <div className="app">
  <div className="toolbar no-print"><button onClick={save}>GUARDAR NOTA</button><button onClick={saveClient}>GUARDAR CLIENTE</button><button className="danger" onClick={()=>setShowCancel(true)}>ANULAR</button><button onClick={()=>window.print()}>IMPRIMIR</button><button onClick={nuevo}>NUEVA NOTA</button><div className="search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Consultar RUC/C.I."/><button onClick={buscar}>BUSCAR</button></div>{msg&&<span>{msg}</span>}</div>
  {showCancel&&<div className="modal no-print"><div className="modal-card"><h3>Anular Nota de Pedido N° {String(number).padStart(6,"0")}</h3><p>La anulación no elimina la hoja ni reutiliza el número. Quedará registrada en el historial del cliente.</p><textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Justificativo obligatorio de la anulación..."/><div><button className="danger" onClick={cancelOrder}>CONFIRMAR ANULACIÓN</button><button onClick={()=>{setShowCancel(false);setCancelReason("")}}>CANCELAR</button></div></div></div>}
  {showHistory&&<div className="history-panel no-print"><div className="history-head"><b>HISTORIAL DEL CLIENTE — {client.nombre||client.ruc}</b><button onClick={resetHistory}>CERRAR</button></div>{history.map(o=><div className={`history-row ${o.status==="ANULADA"?"annulled":""}`} key={o.number}><span><b>N° {String(o.number).padStart(6,"0")}</b> · {fmtDate(o.date)} · {o.type}</span><span>{o.status}{o.status==="ANULADA"&&o.cancelReason?` — ${o.cancelReason}`:""}</span><span><b>$ {money(o.total)}</b><button onClick={()=>loadOrder(o)}>CONSULTAR</button></span></div>)}</div>}
  <main className={`sheet ${status==="ANULADA"?"sheet-annulled":""}`}><header><div className="brand"><img src="/NOTA-DE-PEDIDO/logo-masfertil.svg" className="logo"/><div>Ruta PY 13 Km 181 CAAGUAZÚ - PARAGUAY<br/>Cel.: (0971) 436 458 / (0971) 406 595<br/>(0984) 854 327</div><strong>DISTRIBUIDOR DE FERTILIZANTES<br/>VENTA DE PRODUCTOS AGROPECUARIOS<br/>COMERCIO AL POR MAYOR<br/>DE PRODUCTOS QUÍMICOS INDUSTRIALES</strong></div><div className="title"><b>R.U.C. 80108603-5</b><b>NOTA DE PEDIDO</b><big>N° {String(number).padStart(6,"0")}</big>{status==="ANULADA"&&<em>ANULADA</em>}</div></header>
  <div className="types">{["RESERVA","PEDIDO","PRESUPUESTO"].map(t=><label key={t}><b>{t}</b><input type="checkbox" checked={type===t} disabled={status==="ANULADA"} onChange={()=>setType(t)}/></label>)}</div>
  <div className="client">{[["Fecha:",date,setDate,"date"],["RUC/C.I.:",client.ruc,v=>{setC("ruc",v);setQuery(v)}],["Señor (es):",client.nombre,v=>setC("nombre",v)],["Área:",client.area,v=>setC("area",v)],["Dirección/ Región:",client.direccion,v=>setC("direccion",v)],["Teléfono:",client.telefono,v=>setC("telefono",v)],["Correo:",client.correo,v=>setC("correo",v)],["Ciudad:",client.ciudad,v=>setC("ciudad",v)]].map(([l,v,on,t])=><label key={l}><b>{l}</b><input disabled={status==="ANULADA"} type={t||"text"} value={v} onChange={e=>on(e.target.value)}/></label>)}</div>
  <section className="table"><div className="thead"><b>Cantidad</b><b>Unidad</b><b>Descripción de mercadería</b><b>Precio Unitario</b><b>Sub-total</b></div>{items.map((it,i)=><div className="tr" key={i}><input disabled={status==="ANULADA"} value={it.cantidad} onChange={e=>update(i,"cantidad",e.target.value)}/><input disabled={status==="ANULADA"} value={it.unidad} onChange={e=>update(i,"unidad",e.target.value)}/><input disabled={status==="ANULADA"} value={it.descripcion} onChange={e=>update(i,"descripcion",e.target.value)}/><input disabled={status==="ANULADA"} value={it.precio} onChange={e=>update(i,"precio",e.target.value)}/><span>$ {money(Number(it.cantidad||0)*Number(it.precio||0))}</span></div>)}<div className="total"><b>Total de Dólares americanos (U$)</b><strong>$ {money(total)}</strong></div><div className="letters"><b>Total en<br/>letras (U$):</b><span>{words(total)}</span></div></section>
  <section className="obs"><b>OBSERVACIONES:</b><textarea disabled={status==="ANULADA"} value={obs} onChange={e=>setObs(e.target.value)}/></section><section className="conditions"><label><input disabled={status==="ANULADA"} type="checkbox" checked={contado} onChange={e=>setContado(e.target.checked)}/> PAGO AL CONTADO</label><label><input disabled={status==="ANULADA"} type="checkbox" checked={semilla} onChange={e=>setSemilla(e.target.checked)}/> TRATAMIENTO DE SEMILLA</label><label><input disabled={status==="ANULADA"} type="checkbox" checked={plazo} onChange={e=>setPlazo(e.target.checked)}/> PAGO A PLAZO</label><label>Vencimiento: <input disabled={status==="ANULADA"} type="date" value={venc} onChange={e=>setVenc(e.target.value)}/></label></section><section className="flete"><b>MODALIDAD DEL FLETE</b><label><input disabled={status==="ANULADA"} type="checkbox" checked={flete==="cliente"} onChange={()=>setFlete("cliente")}/> ( ) Cliente Retira</label><label><input disabled={status==="ANULADA"} type="checkbox" checked={flete==="masfertil"} onChange={()=>setFlete("masfertil")}/> ( ) MÁSFERTIL S.A.</label></section><footer><div><i></i><b>Firma del Vendedor</b><b>MÁSFERTIL S.A.</b><b>RUC: 80108603-5</b></div><div><i></i><b>Firma del Comprador/ Representante Legal</b></div><div className="seal"><i></i><b>Aclaración y/o Sello</b></div></footer></main>
 </div>
}