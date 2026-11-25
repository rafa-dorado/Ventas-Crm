# Radar de señales

Cada día laborable, a las 07:17, GitHub Actions lee los blogs y las noticias de los colegios de `radar/centros.csv`. Las publicaciones que contienen palabras clave (STEAM, paisajes de aprendizaje, realidad virtual, Código Escuela 4.0…) llegan a la pestaña **Señales** del CRM.

- **Añadir colegios:** una fila más en `radar/centros.csv` (`codigo_centro` = código de la Junta, el mismo de Cuentas; `blog_rss` = una o varias URL separadas por ` | `).
- **Ver qué blogs funcionan:** GitHub → Actions → «Radar de señales» → Run workflow → modo `comprobar`.
- **Resúmenes con IA (opcional):** añade el secreto `GEMINI_API_KEY` en Settings → Secrets and variables → Actions. Sin él, el radar filtra solo por palabras clave.
- **Seguridad:** el radar no usa la service_role key. Escribe mediante la función `registrar_senales`, protegida con el secreto `RADAR_TOKEN`.
