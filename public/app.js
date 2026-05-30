// ============================================
// NOTISNACK - app.js
// ============================================

// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://qfkbzgrbhibecwoisein.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mv6hm861sC_JAq9QBsE02w_vpSZT4RA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let noticias = [];
let noticiasIntl = [];
let asignaciones = [];
let introLocutor = 0;
let isPlayingAll = false;
let voices = [];

// --- VOCES ---
const locutores = [
  { nombre: 'Joaco', genero: 'male',   pitch: 0.88, avatarId: 'avatar-joaco' },
  { nombre: 'Sofi',  genero: 'female', pitch: 1.18, avatarId: 'avatar-sofi'  }
];

function getSaludo() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13)  return ['Buen día',     'un lindo día'];
  if (h >= 13 && h < 20) return ['Buenas tardes', 'una linda tarde'];
  return                        ['Buenas noches', 'una linda noche'];
}

function loadVoices() { voices = window.speechSynthesis.getVoices(); }
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

function getVoice(genero) {
  let pool = voices.filter(v => v.lang.startsWith('es'));
  if (!pool.length) pool = voices;
  let byG = pool.filter(v => {
    const n = v.name.toLowerCase();
    return genero === 'female'
      ? (n.includes('female') || n.includes('paulina') || n.includes('monica') || n.includes('elena'))
      : (n.includes('male')   || n.includes('jorge')   || n.includes('carlos')  || n.includes('diego'));
  });
  if (byG.length) return byG[0];
  return pool[genero === 'female' ? Math.min(1, pool.length-1) : 0] || null;
}

function hablar(texto, locutorIdx, onEnd) {
  const loc = locutores[locutorIdx];
  const utt = new SpeechSynthesisUtterance(texto);
  utt.lang = 'es-AR';
  utt.rate = 0.93;
  utt.pitch = loc.pitch;
  const v = getVoice(loc.genero);
  if (v) utt.voice = v;
  setAvatarSpeaking(locutorIdx);
  utt.onend = () => { setAvatarSpeaking(-1); if (onEnd) onEnd(); };
  window.speechSynthesis.speak(utt);
}

function setAvatarSpeaking(idx) {
  locutores.forEach((l, i) => {
    const el = document.getElementById(l.avatarId);
    if (el) el.classList.toggle('speaking', i === idx);
  });
}

function setActiveCard(idx) {
  document.querySelectorAll('.ns-card').forEach((c, i) => {
    c.classList.toggle('active-reading', i === idx);
  });
}

// --- LEER TODO ---
let secuencia = [];

function buildSecuencia() {
  const [saludo, despedida] = getSaludo();
  introLocutor = Math.random() < 0.5 ? 0 : 1;
  asignaciones = noticias.map((_, i) => (introLocutor + 1 + i) % 2);
  secuencia = [];
  secuencia.push({
    texto: `${saludo}. Desde NotiSnack te facilitamos las noticias más importantes hasta ahora.`,
    locutorIdx: introLocutor, cardIdx: -1,
    label: `${locutores[introLocutor].nombre} · Intro`
  });
  noticias.forEach((n, i) => {
    secuencia.push({
      texto: n.texto_audio || n.titulo,
      locutorIdx: asignaciones[i], cardIdx: i,
      label: `${locutores[asignaciones[i]].nombre} · ${n.fuente}`
    });
  });
  secuencia.push({
    texto: `Escuchaste todas las noticias que tenemos para vos. Gracias, ahora estamos un poco más informados. Si te interesó alguna noticia en particular, buscala en su fuente original. ¡Que tengas ${despedida}!`,
    locutorIdx: introLocutor, cardIdx: -1,
    label: `${locutores[introLocutor].nombre} · Cierre`
  });
}

function leerSecuencia(idx) {
  if (!isPlayingAll || idx >= secuencia.length) { stopAll(); return; }
  const s = secuencia[idx];
  setActiveCard(s.cardIdx);
  document.getElementById('now-reading-text').textContent = s.label;
  hablar(s.texto, s.locutorIdx, () => { if (isPlayingAll) leerSecuencia(idx + 1); });
}

function stopAll() {
  isPlayingAll = false;
  window.speechSynthesis.cancel();
  setActiveCard(-1);
  setAvatarSpeaking(-1);
  document.getElementById('now-reading-bar').classList.remove('visible');
  document.getElementById('leer-todo-sub').style.display = '';
  const btn = document.getElementById('btn-leer-todo');
  if (btn) { btn.classList.remove('playing'); btn.textContent = '▶ Leer todo'; }
}

function toggleLeerTodo() {
  if (isPlayingAll) { stopAll();