// lead-intake: recibe los formularios de las landings, guarda el archivo (opcional),
// da de alta el lead con crear_lead_v2 y envía los correos (si hay RESEND_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_OK = new Set([
  "application/pdf", "image/jpeg", "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const CALENDLY = "https://calendly.com/rafa-dorado-x_a/tranformar-la-educacion";
const FIRMA = "\n\nRafa Dorado\nEonesia · 661 26 62 32";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function correoVisitante(perfil: string, nombre: string, d: Record<string, string>, campana: string): { asunto: string; texto: string } | null {
  const cal = CALENDLY + (campana ? `?utm_campaign=${encodeURIComponent(campana)}` : "");
  const ejemplo = Deno.env.get("EJEMPLO_MUNDO_URL");
  const dossier = Deno.env.get("DOSSIER_SEGURIDAD_URL");
  switch (perfil) {
    case "docente":
      return { asunto: "Tu mundo de Eonesia está en marcha",
        texto: `Hola, ${nombre}: ya tenemos tu petición. Tu mundo sobre ${d.tema || "el tema que nos has indicado"} estará listo en 24 horas laborables y te llegará a este correo con su ficha y la guía de soluciones.` +
          (ejemplo ? ` Mientras tanto, puedes probar este: ${ejemplo}` : "") + FIRMA };
    case "colegio":
      return { asunto: "Vuestro mundo gratis de Eonesia",
        texto: `Hola, ${nombre}: gracias. En menos de 24 horas laborables os escribo para concretar la unidad con la que haremos vuestro mundo gratis. Si preferís verlo antes en directo, reservad aquí 10 minutos: ${cal}` + FIRMA };
    case "red_grupo":
      return { asunto: "Piloto de Eonesia para vuestro grupo",
        texto: `Gracias, ${nombre}. Os escribo en 24 horas laborables para una reunión de 30 minutos en la que elegimos los 2 colegios del piloto.` +
          (dossier ? ` Aquí tenéis el dossier de seguridad y protección de datos: ${dossier}` : "") + FIRMA };
    case "universidad":
      return { asunto: "Convertimos un tema de tu asignatura en directo",
        texto: `Gracias, ${nombre}. Reserva aquí tus 30 minutos ${cal} y trae un tema de ${d.asignatura || "tu asignatura"}: lo convertimos en directo.` + FIRMA };
    case "editorial":
    case "plataforma":
      return { asunto: "Demo de 20 minutos con vuestro catálogo",
        texto: `Gracias, ${nombre}. Os propongo una demo de 20 minutos con un tema de vuestro catálogo: ${cal}` + FIRMA };
    case "formacion_fp":
      return { asunto: "Sesión gratuita de Eonesia",
        texto: `Gracias, ${nombre}. Te escribo en 24 horas laborables para fijar la sesión gratuita con un grupo de ${d.ciclo || "tu ciclo"}.` + FIRMA };
    default:
      return { asunto: "Hemos recibido tu solicitud", texto: `Gracias, ${nombre}. Te escribo en 24 horas laborables.` + FIRMA };
  }
}

async function enviarCorreo(to: string, asunto: string, texto: string, replyTo?: string) {
  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) return "sin_clave";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM") || "Rafa Dorado <rafa.dorado@eonesia.com>",
      to: [to], subject: asunto, text: texto, ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  return r.ok ? "enviado" : `error ${r.status}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    let p: Record<string, unknown>;
    let archivo: File | null = null;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      p = JSON.parse(String(fd.get("datos") || "{}"));
      const f = fd.get("archivo");
      if (f instanceof File && f.size > 0) archivo = f;
    } else {
      p = await req.json();
    }
    if (p.web_trampa) return json({ ok: true });
    delete p.archivo_path; delete p.archivo_url; // solo los pone esta función
    if (p.consentimiento !== true) return json({ error: "Falta el consentimiento" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(p.email || "").trim())) return json({ error: "Email no válido" }, 400);
    if (String(p.nombre || "").trim().length < 2 || !String(p.organizacion || "").trim()) return json({ error: "Faltan datos obligatorios" }, 400);
    p._ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();

    if (archivo) {
      if (archivo.size > MAX_BYTES) return json({ error: "El archivo supera 15 MB" }, 400);
      if (!TIPOS_OK.has(archivo.type)) return json({ error: "Formato no admitido (PDF, DOCX, PPTX, JPG o PNG)" }, 400);
      const limpio = archivo.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);
      const ruta = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${limpio}`;
      const up = await admin.storage.from("lead-uploads").upload(ruta, archivo, { contentType: archivo.type });
      if (up.error) return json({ error: "No se pudo guardar el archivo" }, 500);
      const firmado = await admin.storage.from("lead-uploads").createSignedUrl(ruta, 60 * 60 * 24 * 365);
      p.archivo_path = ruta;
      p.archivo_url = firmado.data?.signedUrl || "";
    }

    const { data, error } = await admin.rpc("crear_lead_v2", { p });
    if (error) return json({ error: error.message }, 400);
    if (data?.ignorado) return json({ ok: true });

    const nombre = String(p.nombre || "").trim().split(" ")[0] || "";
    const datos = (p.datos_perfil || {}) as Record<string, string>;
    const campana = String(p.campana || (p.utm as Record<string, string>)?.utm_campaign || "");
    const perfil = String(data?.perfil || p.perfil || "colegio");
    const correo = correoVisitante(perfil, nombre, datos, campana);
    const resultados: Record<string, string> = {};
    if (correo) resultados.visitante = await enviarCorreo(String(p.email), correo.asunto, correo.texto, "rafa.dorado@eonesia.com");
    const aviso = Deno.env.get("NOTIFY_EMAIL") || "rafa.dorado@eonesia.com";
    resultados.aviso = await enviarCorreo(aviso,
      `${data?.duplicado ? "Repite" : "Nuevo lead"} · ${perfil} · ${p.organizacion}`,
      [`Nombre: ${p.nombre}`, `Email: ${p.email}`, `Teléfono: ${p.telefono || "-"}`, `Organización: ${p.organizacion}`,
       `Cargo: ${p.cargo || "-"}`, `Perfil: ${perfil}`, `Campaña: ${campana || "-"}`, `Landing: ${p.landing || "-"}`,
       `Datos: ${JSON.stringify(datos)}`, `Mensaje: ${p.mensaje || "-"}`, p.archivo_url ? `Archivo: ${p.archivo_url}` : "",
       `Contacto ya conocido: ${data?.duplicado ? "sí" : "no"}`, "", "Ya está en el CRM (Detectado)."].filter(Boolean).join("\n"),
      String(p.email));
    console.log("lead", data?.oportunidad_id, resultados);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "No se pudo procesar el envío" }, 500);
  }
});
