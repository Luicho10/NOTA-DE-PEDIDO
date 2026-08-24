import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { hydrateLocalStorage, installCloudStorageSync } from "./cloudStorage";
import App from "./App";

export default function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        setBooting(true);
        await supabase.rpc("provisionar_vendedor");
        await hydrateLocalStorage();
        installCloudStorageSync();
      } catch (e) {
        setError(e.message || "No fue posible preparar la sesión.");
      } finally { setBooting(false); }
    })();
  }, [session]);

  async function submit(e) {
    e.preventDefault(); setError(""); setBooting(true);
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) setError("Cuenta creada. Revise su correo para confirmar el acceso.");
    } catch (err) { setError(err.message || "No fue posible acceder."); }
    finally { setBooting(false); }
  }

  if (loading || (session && booting)) return <div className="auth-screen"><div className="auth-card"><h2>MÁSFERTIL S.A.</h2><p>Preparando sistema de Nota de Pedido...</p></div></div>;
  if (session && !error) return <App />;

  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <h2>MÁSFERTIL S.A.</h2><h3>NOTA DE PEDIDO</h3>
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico" required />
    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" minLength={6} required />
    {error && <div className="auth-error">{error}</div>}
    <button type="submit">{mode === "login" ? "INGRESAR" : "CREAR CUENTA"}</button>
    <button type="button" className="secondary" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setError("")}}>{mode === "login" ? "CREAR USUARIO" : "VOLVER A INGRESAR"}</button>
  </form></div>;
}
