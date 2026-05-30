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

async function fetch