import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Endpoint de prospección con Gemini API y búsqueda de Google
app.post('/api/prospectar', async (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'La consulta de búsqueda es requerida.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Si no hay API key configurada en secrets, proporcionamos resultados inteligentes simulados basados en la búsqueda
    console.warn('GEMINI_API_KEY no configurada. Devolviendo resultados simulados.');
    const queryLimpia = query.toLowerCase();
    const provinciaMatch = queryLimpia.match(/\b(sevilla|madrid|barcelona|valencia|malaga|cordoba|cadiz|granada|jaen|bilbao|zaragoza)\b/i);
    const prov = provinciaMatch ? provinciaMatch[0].charAt(0).toUpperCase() + provinciaMatch[0].slice(1) : 'Sevilla';

    const mockResultados = [
      {
        nombre: `Centro de Formación Tecnológica ${prov}`,
        tipo: 'FP',
        provincia: prov,
        web: `https://cft-${prov.toLowerCase()}.edu.es`,
        fuente_url: 'https://todofp.es/centros',
      },
      {
        nombre: `Instituto Superior de Innovación ${prov}`,
        tipo: 'FP',
        provincia: prov,
        web: `https://isi-${prov.toLowerCase()}.org`,
        fuente_url: 'https://juntadeandalucia.es/educacion',
      },
      {
        nombre: `Colegio Internacional Santa Águeda`,
        tipo: 'Privado',
        provincia: prov,
        web: `https://santaagueda-${prov.toLowerCase()}.es`,
        fuente_url: 'https://micole.net',
      },
      {
        nombre: `Colegio San Pablo ${prov}`,
        tipo: 'Concertado',
        provincia: prov,
        web: `https://sanpablo${prov.toLowerCase()}.org`,
        fuente_url: 'https://escuelascatolicas.es',
      },
      {
        nombre: `Campus Digital ${prov}`,
        tipo: 'FP',
        provincia: prov,
        web: `https://campusdigital${prov.toLowerCase()}.es`,
        fuente_url: 'https://todofp.es',
      },
    ];

    res.json({
      resultados: mockResultados,
      modoSimulado: true,
      mensaje: 'Modo demostración: para búsquedas en tiempo real en la web, añade tu GEMINI_API_KEY en Settings > Secrets.',
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Eres un motor especializado de prospección comercial B2B para Eonesia (EdTech de espacios educativos inmersivos en navegador).
El usuario quiere buscar organizaciones educativas o corporativas en España:
"${query.trim()}"

REGLAS ESTRICTAS:
1. Máximo 15 resultados.
2. SOLO organizaciones reales (centros de FP, colegios privados, colegios concertados, institutos públicos, universidades, editoriales educativas, agencias de innovación/instituciones).
3. NUNCA nombres de personas, emails personales ni teléfonos. Solo datos corporativos/institucionales.
4. Tipo de centro debe ser estrictamente uno de: "FP", "Privado", "Concertado", "Publico", "Universidad", "Editorial", "Institucional".
5. Si encuentras fuentes o webs oficiales, incluye el dominio en "web" y el enlace de la fuente en "fuente_url".
6. Devuelve ÚNICAMENTE un array JSON válido sin texto adicional ni preámbulos:
[
  {
    "nombre": "Nombre oficial de la organización",
    "tipo": "FP" | "Privado" | "Concertado" | "Publico" | "Universidad" | "Editorial" | "Institucional",
    "provincia": "Provincia en España",
    "web": "https://...",
    "fuente_url": "https://..."
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const texto = response.text || '';
    
    // Extraer URLs de las fuentes de Google Search si existen
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = groundingChunks
      .map((chunk: any) => chunk.web?.uri)
      .filter((uri: any): uri is string => Boolean(uri));

    // Limpiar markdown tipo ```json ... ``` si viniera
    let jsonLimpio = texto.trim();
    if (jsonLimpio.startsWith('```json')) {
      jsonLimpio = jsonLimpio.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonLimpio.startsWith('```')) {
      jsonLimpio = jsonLimpio.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Buscar primer '[' y último ']'
    const inicioArray = jsonLimpio.indexOf('[');
    const finArray = jsonLimpio.lastIndexOf(']');

    if (inicioArray !== -1 && finArray !== -1) {
      jsonLimpio = jsonLimpio.substring(inicioArray, finArray + 1);
    }

    let resultados = [];
    try {
      resultados = JSON.parse(jsonLimpio);
      if (!Array.isArray(resultados)) {
        resultados = [];
      }
    } catch (parseError) {
      console.error('Error parseando JSON de Gemini:', parseError, 'Texto recibido:', texto);
      res.status(502).json({
        error: 'La IA no devolvió un formato JSON válido. Pulsa "Reintentar" para realizar una nueva búsqueda.',
        raw: texto,
      });
      return;
    }

    // Si algún resultado no tiene fuente_url y hay webSources, asignar una fuente
    resultados = resultados.map((item: any, idx: number) => {
      let fuente = item.fuente_url || item.web;
      if (!fuente && webSources.length > 0) {
        fuente = webSources[idx % webSources.length];
      }
      return {
        nombre: item.nombre || 'Centro educativo',
        tipo: ['FP', 'Privado', 'Concertado', 'Publico', 'Universidad', 'Editorial', 'Institucional'].includes(item.tipo)
          ? item.tipo
          : 'FP',
        provincia: item.provincia || 'España',
        web: item.web || '',
        fuente_url: fuente || item.web || '',
      };
    });

    res.json({
      resultados,
      fuentesWeb: webSources,
      modoSimulado: false,
    });
  } catch (error: any) {
    console.error('Error al consultar Gemini API:', error);
    const errorMsg = String(error?.message || '');
    
    // Si es un error de cuota (429) o permisos, ofrecer resultados de demostración realistas para que el usuario pueda seguir probando
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      const provinciaMatch = query.toLowerCase().match(/\b(sevilla|madrid|barcelona|valencia|malaga|cordoba|cadiz|granada|jaen|bilbao|zaragoza)\b/i);
      const prov = provinciaMatch ? provinciaMatch[0].charAt(0).toUpperCase() + provinciaMatch[0].slice(1) : 'Sevilla';

      const fallbackCentros = [
        {
          nombre: `Instituto Tecnológico Superior ${prov}`,
          tipo: 'FP',
          provincia: prov,
          web: `https://its-${prov.toLowerCase()}.edu.es`,
          fuente_url: 'https://todofp.es',
        },
        {
          nombre: `Colegio Internacional San Gabriel`,
          tipo: 'Privado',
          provincia: prov,
          web: `https://sangabriel-${prov.toLowerCase()}.es`,
          fuente_url: 'https://micole.net',
        },
        {
          nombre: `Centro Integrado FP Los Arcos`,
          tipo: 'FP',
          provincia: prov,
          web: `https://cifplosarcos.es`,
          fuente_url: 'https://todofp.es',
        },
        {
          nombre: `Colegio Santa María del Valle`,
          tipo: 'Concertado',
          provincia: prov,
          web: `https://santamariadelvalle.org`,
          fuente_url: 'https://escuelascatolicas.es',
        },
        {
          nombre: `Campus Digital de Innovación ${prov}`,
          tipo: 'FP',
          provincia: prov,
          web: `https://campusdigital${prov.toLowerCase()}.es`,
          fuente_url: 'https://juntadeandalucia.es',
        },
      ];

      res.json({
        resultados: fallbackCentros,
        fuentesWeb: ['https://todofp.es', 'https://micole.net'],
        modoSimulado: true,
        mensaje: 'Límite de cuota alcanzado en la API de Gemini (429). Mostrando resultados de demostración para permitir probar la adición y deduplicación.',
      });
      return;
    }

    res.status(500).json({
      error: `Error al conectar con la IA: ${error.message || 'Error desconocido'}. Puedes pulsar "Reintentar".`,
    });
  }
});

// Configuración de Vite / estáticos
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Eonesia CRM escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer();
