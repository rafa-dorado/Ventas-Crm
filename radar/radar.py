"""
Radar de señales Eonesia: blogs y noticias de los centros -> palabras clave -> IA (opcional) -> bandeja «Señales» del CRM.

Uso:
  python radar/radar.py radar/centros.csv              # modo normal
  python radar/radar.py radar/centros.csv --comprobar  # solo comprueba qué feeds responden

Entrada: CSV con codigo_centro, nombre, blog_rss (varias URL separadas por « | »).
Variables de entorno:
  SUPABASE_URL, SUPABASE_ANON_KEY, RADAR_TOKEN  -> envía las señales al CRM (función registrar_senales)
  GEMINI_API_KEY (opcional)                     -> resume cada señal y propone una primera frase
Solo se envía a la IA texto público de los blogs, nunca datos personales.
"""
import sys, os, json, re, unicodedata, pathlib, urllib.request, datetime as dt
import feedparser, pandas as pd

PALABRAS = ["paisaje de aprendizaje", "paisajes de aprendizaje", "steam", "gamificacion",
            "situacion de aprendizaje", "situaciones de aprendizaje", "plan de actuacion digital",
            "codigo escuela 4.0", "realidad virtual", "realidad aumentada", "escape room",
            "aula del futuro", "innovacion educativa", "transformacion digital", "inteligencia artificial",
            "erasmus", "premio", "aprendizaje basado en proyectos", "competencia digital"]
DIAS = 30
MODELO = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
INSTRUCCIONES = (
    "Analizas publicaciones de blogs y noticias de centros educativos para Eonesia Worlds, que convierte temas "
    "en mundos navegables (paisajes de aprendizaje inmersivos) con ficha docente, soluciones e informe por alumno. "
    "Devuelve SOLO un JSON con: relevante (true/false), tema (texto corto), resumen (2 líneas), "
    "primera_frase (frase de contacto para la coordinación TDE basada SOLO en el texto; vacía si no es relevante), "
    "evidencia (cita literal breve). No inventes datos ni nombres.")
UA = {"User-Agent": "Mozilla/5.0 (radar Eonesia; +https://eonesia.com)"}


def norm(s):
    return unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()


def limpiar(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def feeds_de(celda):
    return [u.strip() for u in str(celda).split("|") if re.match(r"^https?://", u.strip())]


def leer(url):
    return feedparser.parse(url, request_headers=UA, agent=UA["User-Agent"])


def comprobar(centros):
    print("| Centro | Feed | Estado | Entradas | Última | Título del canal |\n|---|---|---|---|---|---|")
    for c in centros.itertuples():
        for url in feeds_de(c.blog_rss):
            f = leer(url)
            ok = bool(f.entries)
            fechas = [e.get("published_parsed") or e.get("updated_parsed") for e in f.entries]
            fechas = [dt.date(*x[:3]).isoformat() for x in fechas if x]
            titulo = (f.feed.get("title") or "").replace("|", "/")[:60]
            print(f"| {c.nombre} ({c.codigo_centro}) | {url} | {'OK' if ok else 'NO'} | {len(f.entries)} | {max(fechas) if fechas else '-'} | {titulo} |")


def detectar(centros, vistos):
    limite = dt.datetime.now() - dt.timedelta(days=DIAS)
    filas = []
    for c in centros.itertuples():
        for url in feeds_de(c.blog_rss):
            feed = leer(url)
            if not feed.entries:
                print(f"Aviso: sin entradas en {url}")
                continue
            for e in feed.entries:
                link = e.get("link", "")
                fecha = e.get("published_parsed") or e.get("updated_parsed")
                if not link or link in vistos or not fecha or dt.datetime(*fecha[:6]) < limite:
                    continue
                texto = limpiar(e.get("title", "") + ". " + e.get("summary", ""))
                claves = [p for p in PALABRAS if p in norm(texto)]
                if claves:
                    vistos.add(link)
                    filas.append({"fecha_senal": dt.date(*fecha[:3]).isoformat(), "codigo_centro": c.codigo_centro,
                                  "centro": c.nombre, "titulo": e.get("title", "")[:300], "enlace": link,
                                  "palabras": ", ".join(claves), "texto": texto[:1500]})
    return filas


def gemini(texto):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent"
    cuerpo = {"contents": [{"parts": [{"text": INSTRUCCIONES + "\n\nPublicación:\n" + texto}]}],
              "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}
    req = urllib.request.Request(url, data=json.dumps(cuerpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = json.load(r)
    return json.loads(datos["candidates"][0]["content"]["parts"][0]["text"])


def analizar(filas):
    if not os.environ.get("GEMINI_API_KEY"):
        return filas
    for f in filas:
        try:
            res = gemini(f["texto"])
        except Exception as e:
            res = {"resumen": f"(IA no disponible: {str(e)[:120]})"}
        for k in ["relevante", "tema", "resumen", "primera_frase", "evidencia"]:
            f[k] = str(res.get(k, "")) if res.get(k) is not None else ""
    return filas


def rpc(nombre, cuerpo):
    url = os.environ["SUPABASE_URL"].rstrip("/") + f"/rest/v1/rpc/{nombre}"
    clave = os.environ["SUPABASE_ANON_KEY"]
    req = urllib.request.Request(url, method="POST", data=json.dumps(cuerpo, ensure_ascii=False).encode(),
                                 headers={"Content-Type": "application/json", "apikey": clave, "Authorization": f"Bearer {clave}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    centros = pd.read_csv(sys.argv[1], dtype=str).fillna("")
    if "--comprobar" in sys.argv:
        return comprobar(centros)
    hay_crm = all(os.environ.get(k) for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "RADAR_TOKEN"))
    vistos = set(rpc("enlaces_vistos", {"token": os.environ["RADAR_TOKEN"]})) if hay_crm else set()
    filas = analizar(detectar(centros, vistos))
    pathlib.Path("senales").mkdir(exist_ok=True)
    pd.DataFrame(filas).drop(columns=["texto"], errors="ignore").to_csv(
        pathlib.Path("senales") / f"{dt.date.today().isoformat()}.csv", index=False, encoding="utf-8-sig")
    print(f"{len(filas)} señales nuevas (IA: {'gemini' if os.environ.get('GEMINI_API_KEY') else 'ninguna'})")
    if hay_crm and filas:
        enviar = [{k: v for k, v in f.items() if k != "texto"} for f in filas]
        n = rpc("registrar_senales", {"token": os.environ["RADAR_TOKEN"], "filas": enviar})
        print(f"{n} señales enviadas a la bandeja «Señales» del CRM")


if __name__ == "__main__":
    main()
