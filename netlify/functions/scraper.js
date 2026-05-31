const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FUENTES_ARG = [
  { nombre: 'Clarín', url: 'https://www.clarin.com', tipo: 'argentina' },
  { nombre: 'La Nación', url: 'https://www.lanacion.com.ar', tipo: 'argentina' },
  { nombre: 'Infobae', url: 'https://www.infobae.com', tipo: 'argentina' },
  { nombre: 'Página 12', url: 'https://www.pagina12.com.ar', tipo: 'argentina' },
  { nombre: 'Ámbito', url: 'https://www.ambito.com', tipo: 'argentina' },
];

const FUENTES_INTL = [
  { nombre: 'BBC News', url: 'https://www.bbc.com/news', tipo: 'internacional' },
  { nombre: 'The New York Times', url: 'https://www.nytimes.com', tipo: 'internacional' },
  { nombre: 'El País', url: 'https://elpais.com', tipo: 'internacional' },
  { nombre: 'Le Monde', url: 'https://www.lemonde.fr', tipo: 'internacional' },
];

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NotiSnack/1.0)' }
  });
  return res.text();
}

function extraerTitulares(html) {
  const titulos = [];
  const h2Regex = /<h2[^>]*>([^<]{20,200})<\/h2>/gi;
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    const texto = match[1].replace(/<[^>]+>/g, '').trim();
    if (texto.length > 20) titulos.push(texto);
    if (titulos.length >= 8) break;
  }
  const ogImageRegex = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i;
  const imgMatch = ogImageRegex.exec(html);
  const imagen = imgMatch ? imgMatch[1] : null;
  return { titulos, imagen };
}

async function procesarConGemini(titulos, fuente) {
  const prompt = `Sos un periodista argentino. Te doy titulares del diario "${fuente}".
Para cada uno generá un copete de máximo 2 oraciones en español argentino, descontracturado y claro.
Respondé SOLO con JSON válido, sin texto extra, sin markdown.
Formato: [{"titulo": "...", "copete": "...", "texto_audio": "..."}]
El texto_audio debe empezar con "${fuente} informa. " y resumir la noticia.

Titulares:
${titulos.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
      })
    }
  );

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  const clean = texto.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function scrapeYGuardar(fuente) {
  try {
    console.log(`Scrapeando ${fuente.nombre}...`);
    const html = await fetchHTML(fuente.url);
    const { titulos, imagen } = extraerTitulares(html);

    if (!titulos.length) {
      console.log(`Sin titulares para ${fuente.nombre}`);
      return;
    }

    const noticias = await procesarConGemini(titulos, fuente.nombre);

    const rows = noticias.map(n => ({
      titulo: n.titulo,
      copete: n.copete,
      texto_audio: n.texto_audio,
      fuente: fuente.nombre,
      imagen: imagen,
      tipo: fuente.tipo,
      es_twitter: false,
      tiempo: 'hace unos minutos',
      created_at: new Date().toISOString()
    }));

    await supabase.from('noticias').delete().eq('fuente', fuente.nombre);
    const { error } = await supabase.from('noticias').insert(rows);
    if (error) throw error;
    console.log(`✓ ${fuente.nombre}: ${rows.length} noticias guardadas`);
  } catch (e) {
    console.error(`Error con ${fuente.nombre}:`, e.message);
  }
}

exports.handler = async (event, context) => {
  try {
    console.log('Iniciando scraping...');
    for (const fuente of [...FUENTES_ARG, ...FUENTES_INTL]) {
      await scrapeYGuardar(fuente);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, mensaje: 'Scraping completado' })
    };
  } catch (e) {
    console.error('Error general:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};