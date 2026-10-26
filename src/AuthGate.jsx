import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { hydrateLocalStorage, installCloudStorageSync } from "./cloudStorage";
import App from "./App";

export default function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("login");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError("No se pudo comprobar la sesión. Verifique su conexión e inténtelo nuevamente.");
      setSession(data?.session || null);
      setLoading(false);
    }).catch(() => {
      if (mounted) {
        setError("No se pudo conectar con el servicio de acceso. Inténtelo nuevamente en unos minutos.");
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setNotice("Enlace verificado. Ingrese su nueva contraseña.");
        setError("");
      }
      setSession(next);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || mode === "update") { setCloudReady(false); return; }
    setCloudReady(false);
    (async () => {
      try {
        await supabase.rpc("provisionar_vendedor");
        await hydrateLocalStorage();
        installCloudStorageSync();
        setCloudReady(true);
      } catch (e) {
        console.error("Sincronización inicial:", e);
        setCloudReady(true);
        installCloudStorageSync();
      }
    })();
  }, [session, mode]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const redirectTo = window.location.origin + import.meta.env.BASE_URL;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (resetError) throw resetError;
        setNotice("Si existe una cuenta con ese correo, recibirá un enlace para restablecer la contraseña. Revise también Spam o Correo no deseado.");
        return;
      }

      if (mode === "update") {
        if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setSession(null);
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        setNotice("Contraseña actualizada. Ya puede ingresar con su nueva contraseña.");
        return;
      }

      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setNotice("Cuenta creada. Revise su correo para confirmar el acceso.");
      }
    } catch (err) {
      console.error("Error de autenticación:", err);
      const message = err?.message || "";
      if (/failed to fetch|network|fetch/i.test(message)) {
        setError("No se pudo conectar con el servidor. Espere unos minutos y vuelva a intentarlo.");
      } else if (/invalid login credentials/i.test(message)) {
        setError("Correo o contraseña incorrectos. Si olvidó la contraseña, use «OLVIDÉ MI CONTRASEÑA».");
      } else {
        setError(message || "No fue posible completar la operación.");
      }
    }
  }

  if (loading) return <div className="auth-screen"><div className="auth-card"><h2>MÁSFERTIL S.A.</h2><p>Preparando sistema de Nota de Pedido...</p></div></div>;
  if (session && mode !== "update" && !error && !cloudReady) return <div className="auth-screen"><div className="auth-card"><h2>MÁSFERTIL S.A.</h2><p>Sincronizando pedidos y clientes...</p></div></div>;
  if (session && mode !== "update" && !error) return <App />;

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isUpdate = mode === "update";

  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <h2>MÁSFERTIL S.A.</h2><h3>NOTA DE PEDIDO</h3>
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico" autoComplete="email" required />
    {!isForgot && <>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={isUpdate ? "Nueva contraseña" : "Contraseña"} autoComplete={isUpdate ? "new-password" : isSignup ? "new-password" : "current-password"} minLength={6} required />
      {isUpdate && <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirmar nueva contraseña" autoComplete="new-password" minLength={6} required />}
    </>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    {notice && <div className="auth-notice" role="status">{notice}</div>}
    <button type="submit">{isForgot ? "ENVIAR ENLACE" : isUpdate ? "GUARDAR NUEVA CONTRASEÑA" : isLogin ? "INGRESAR" : "CREAR CUENTA"}</button>
    {!isUpdate && <button type="button" className="secondary" onClick={() => {
      setError(""); setNotice(""); setPassword(""); setConfirmPassword("");
      setMode(isForgot ? "login" : isLogin ? "signup" : "login");
    }}>{isForgot ? "VOLVER A INGRESAR" : isLogin ? "CREAR USUARIO" : "VOLVER A INGRESAR"}</button>}
    {isLogin && <button type="button" className="secondary" onClick={() => { setMode("forgot"); setError(""); setNotice(""); setPassword(""); }}>OLVIDÉ MI CONTRASEÑA</button>}
    {isSignup && <button type="button" className="secondary" onClick={() => { setMode("forgot"); setError(""); setNotice(""); setPassword(""); }}>RECUPERAR CONTRASEÑA</button>}
  </form></div>;
}
