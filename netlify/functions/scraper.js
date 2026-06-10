const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FUENTES = [
  { nombre: 'Clarín', rss: 'https://www.clarin.com/rss/lo-ultimo/', tipo: 'argentina' },
  { nombre: 'La Nación', rss: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', tipo: 'argentina' },
  { nombre: 'Infobae', rss: 'https://www.infobae.com/feeds/rss/', tipo: 'argentina' },
  { nombre: 'Página 12', rss: 'https://www.pagina12.com.ar/rss/portada', tipo: 'argentina' },
  { nombre: 'Ámbito', rss: 'https://www.ambito.com/rss/home.xml', tipo: 'argentina' },
  { nombre: 'BBC News', rss: 'https://feeds.bbci.co.uk/news/rss.xml', tipo: 'internacional' },
  { nombre: 'The New York Times', rss: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', tipo: 'internacional' },
  { nombre: 'El País', rss: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', tipo: 'internacional' },
  { nombre: 'Le Monde', rss: 'https://www.lemonde.fr/rss/une.xml', tipo: 'internacional' },
];

function extraerTexto(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

function extraerImagen(item) {
  const mediaContent = item.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  if (mediaContent) return mediaContent[1];
  const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
  if (enclosure) return enclosure[1];
  const imgTag = item.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (imgTag) return imgTag[1];
  return null;
}

async function procesarFuente(fuente) {
  try {
    console.log(`Procesando ${fuente.nombre}...`);
    const res = await fetch(fuente.rss, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NotiSnack/1.0)' }
    });
    const xml = await res.text();

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      items.push(match[1]);
      if (items.length >= 6) break;
    }

    if (!items.length) {
      console.log(`Sin items para ${fuente.nombre}`);
      return;
    }

    const rows = items.map(item => {
      const tituloMatch = item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([\s\S]*?)<\/title>/i);
      const copeteMatch = item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description[^>]*>([\s\S]*?)<\/description>/i);

      const titulo = extraerTexto(tituloMatch ? (tituloMatch[1] || tituloMatch[2]) : '');
      const copete = extraerTexto(copeteMatch ? (copeteMatch[1] || copeteMatch[2]) : '').substring(0, 300);
      const imagen = extraerImagen(item);

      if (!titulo) return null;

      return {
        titulo,
        copete: copete || titulo,
        texto_audio: `${fuente.nombre} informa. ${titulo}. ${copete}`.substring(0, 500),
        fuente: fuente.nombre,
        imagen,
        tipo: fuente.tipo,
        es_twitter: false,
        tiempo: 'hace unos minutos',
        created_at: new Date().toISOString()
      };
    }).filter(Boolean);

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
    console.log('Iniciando scraping por RSS...');
    for (const fuente of FUENTES) {
      await procesarFuente(fuente);
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