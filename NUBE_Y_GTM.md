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
