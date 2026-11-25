# Nube (Supabase) y módulos GTM

## Qué cambia
- **Sin variables de Supabase, nada cambia**: el CRM sigue guardando en el navegador como siempre.
- **Con Supabase**: hay inicio de sesión, los datos se guardan en tu proyecto y localStorage queda como caché local. Solo se envían las filas que cambian.
- **Cuentas (TAM)**: importa `crm_cuentas_colegios.csv` (3.418 centros). Por código de centro: reimportar actualiza y no duplica. Las cuentas no ocupan el Tablero hasta que pulsas «Trabajar» (o marcas «crear oportunidad para Tier 1»).
- **Señales**: el radar (GitHub Actions) escribe en la tabla `senales`. «Aprobar» añade una nota en la ficha y fija el próximo paso para mañana.

## Puesta en marcha (una vez)
1. Crea un proyecto en Supabase (región `eu-west-3`, París).
2. SQL Editor → pega y ejecuta `supabase/migrations/20261122000000_crm_gtm.sql`.
3. Authentication → Users → **Add user** (tu email + contraseña). Después, Authentication → Sign In / Providers → desactiva «Allow new users to sign up».
4. Vercel → Settings → Environment Variables, **solo en Preview**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = publishable/anon key
5. Abre la URL de preview del PR, entra y:
   - En producción: Copia de seguridad → Exportar JSON.
   - En la preview: «Importar una copia JSON primero» → «Subir estos datos a la nube».
6. Cuando lo hayas probado, añade las mismas variables en Production y fusiona el PR. En producción el CRM detecta que la nube ya tiene datos y los carga (la copia local se conserva en una clave `_antes_de_nube_`).

## Seguridad
- RLS: cada usuario solo ve sus filas (`owner = auth.uid()`).
- La `anon key` es pública por diseño. La `service_role` va **solo** en los secretos del radar, nunca en Vercel.
- Si falla la red, los cambios siguen en memoria y en localStorage y se reintenta cada 15 s. Al cerrar la pestaña con cambios pendientes, el navegador avisa.
- Varios dispositivos a la vez: gana la última escritura por registro.

## Formulario web → CRM (v2)
Página: `https://ventas-crm-two.vercel.app/formulario.html?perfil=PERFIL&utm_campaign=CAMPAÑA`

- **Perfiles:** `docente`, `colegio`, `red_grupo`, `universidad`, `editorial`, `plataforma`, `formacion_fp`, `formacion_empresa`. Cada uno muestra sus campos.
- **Campañas:** `utm_campaign` (o `campana`) con los códigos de la tabla `campanas` (C1-colegios-andalucia … C7-fp). Se guardan también utm_source/medium/content/term, la landing, el referrer y el idioma.
- **Opcionales:** `embed=1` (fondo transparente) y `privacidad=URL` (enlace a la política de privacidad).
- **Qué hace:**
  - Si el email no existe, crea centro, contacto y oportunidad en Detectado, con estado «Nuevo · landing» y próximo paso «Responder en 24 h laborables».
  - Si el email ya existe, no duplica: añade la actividad «Nuevo formulario desde [landing]» a su ficha y rellena solo los campos vacíos.
  - Los archivos (máx. 15 MB) se guardan en el bucket privado `lead-uploads`, con un enlace firmado en la ficha.
- **Correos:** al visitante (texto según su perfil) y aviso a Rafa. Se activan al poner `RESEND_API_KEY` en Supabase → Edge Functions → Secrets. Opcionales: `NOTIFY_EMAIL`, `MAIL_FROM`, `EJEMPLO_MUNDO_URL`, `DOSSIER_SEGURIDAD_URL`.
- **Incrustarlo en una landing (altura automática y aviso de envío):**

```html
<div id="eonesia-form"></div>
<script>
  (function () {
    var perfil = 'colegio';                       // cambia según la landing
    var f = document.createElement('iframe');
    f.src = 'https://ventas-crm-two.vercel.app/formulario.html?embed=1&perfil=' + perfil +
            (location.search ? '&' + location.search.slice(1) : '');   // pasa los utm_* de la landing
    f.style.cssText = 'width:100%;border:0;height:900px';
    f.title = 'Formulario Eonesia';
    document.getElementById('eonesia-form').appendChild(f);
    addEventListener('message', function (e) {
      if (!e.data || e.origin !== 'https://ventas-crm-two.vercel.app') return;
      if (e.data.tipo === 'eonesia-form-altura') f.style.height = e.data.altura + 'px';
      if (e.data.tipo === 'eonesia-form-enviado') { /* p. ej. gtag('event', 'generate_lead') */ }
    });
  })();
</script>
```
- **Antispam:** campo trampa, máximo 5 envíos por IP y hora, y 60 en total por hora. Los envíos quedan registrados en `leads_formulario`.
- **Pendiente legal:** razón social y CIF de Eonesia, y la URL de la política de privacidad.

## Radar
Ver `radar/LEEME.md`.
