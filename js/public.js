import { supabase, escudo, fmtFecha, ETIQUETAS_FASE } from './lib.js';
import { renderBracket } from './bracket.js';
import { CONFIG } from './config.js';

let config = {};
let equipos = [];
let sesion = null;

const $ = id => document.getElementById(id);

async function init() {
  document.getElementById('footer-anio').textContent = new Date().getFullYear();
  const [cfg, equiposResp, sesionResp] = await Promise.all([
    supabase.from('config').select('*'),
    supabase.from('equipos').select('*').order('nombre'),
    supabase.auth.getSession()
  ]);
  config = Object.fromEntries((cfg.data || []).map(r => [r.clave, r.valor]));
  equipos = equiposResp.data || [];
  sesion = sesionResp.data?.session || null;

  const nombre = config.torneo_nombre || 'Torneo SENA';
  document.title = nombre;
  $('nav-nombre').textContent = nombre;
  $('hero-nombre').textContent = nombre;
  $('footer-nombre').textContent = nombre;
  $('nota-clasificacion').textContent = config.nota_clasificacion || '';

  pintarSesion();
  pintarPosiciones();
  pintarEstadisticas();
  pintarPartidos();
  pintarEliminatoria();
  pintarGaleria();
  pintarReglas();
}

function pintarSesion() {
  const btn = $('btn-sesion');
  if (sesion) {
    btn.textContent = 'Panel';
    btn.href = 'admin.html';
    btn.classList.remove('border-emerald-500/50', 'text-emerald-400');
    btn.classList.add('bg-emerald-600', 'text-white', 'border-transparent', 'hover:bg-emerald-500');
  }
}

// ============ POSICIONES ============
let grupoActivo = 'TODOS';

async function pintarPosiciones() {
  const { data } = await supabase.from('tabla_posiciones').select('*');
  const filas = data || [];
  const grupos = [...new Set(filas.map(f => f.grupo).filter(Boolean))].sort();

  const tabs = $('tabs-grupos');
  if (grupos.length > 1) {
    tabs.innerHTML = '';
    ['TODOS', ...grupos].forEach(g => {
      const btn = document.createElement('button');
      btn.textContent = g === 'TODOS' ? 'Todos los grupos' : `Grupo ${g}`;
      btn.className = 'px-4 py-2 rounded-lg text-sm font-semibold border transition ' +
        (grupoActivo === g
          ? 'bg-emerald-600 text-white border-emerald-500'
          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800');
      btn.addEventListener('click', () => { grupoActivo = g; pintarPosiciones(); });
      tabs.appendChild(btn);
    });
  }

  const visibles = filas
    .filter(f => grupoActivo === 'TODOS' || f.grupo === grupoActivo)
    .sort((a, b) => b.puntos - a.puntos || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));

  const numGrupos = Number(config.num_grupos || 1);
  const clasifican = numGrupos > 1
    ? Math.max(1, Math.floor(Number(config.num_clasificados || 0) / numGrupos))
    : Number(config.num_clasificados || 0);

  $('tbody-posiciones').innerHTML = visibles.map((f, i) => `
    <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 ${i < clasifican ? 'bg-emerald-500/5' : ''}">
      <td class="px-3 py-3 text-slate-500">${i + 1}</td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-2.5">
          ${escudo({ escudo_url: null, nombre: f.nombre })}
          <span class="font-semibold">${f.nombre}</span>
          ${i < clasifican ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Clasifica</span>' : ''}
        </div>
      </td>
      <td class="px-2 py-3 text-center">${f.pj}</td>
      <td class="px-2 py-3 text-center hidden sm:table-cell">${f.pg}</td>
      <td class="px-2 py-3 text-center hidden sm:table-cell">${f.pe}</td>
      <td class="px-2 py-3 text-center hidden sm:table-cell">${f.pp}</td>
      <td class="px-2 py-3 text-center hidden sm:table-cell">${f.gf}</td>
      <td class="px-2 py-3 text-center hidden sm:table-cell">${f.gc}</td>
      <td class="px-2 py-3 text-center ${f.dg > 0 ? 'text-emerald-400' : f.dg < 0 ? 'text-rose-400' : ''}">${f.dg > 0 ? '+' : ''}${f.dg}</td>
      <td class="px-4 py-3 text-center font-black text-emerald-400">${f.puntos}</td>
    </tr>`).join('') || '<tr><td colspan="10" class="px-3 py-8 text-center text-slate-500">Aún no hay equipos registrados.</td></tr>';

  if (grupos.length > 1 && !grupos.includes(grupoActivo)) grupoActivo = 'TODOS';
}

// ============ ESTADISTICAS ============
async function pintarEstadisticas() {
  const { data } = await supabase.from('ranking_jugadores').select('*');
  const jugadores = (data || []).filter(j => j.goles > 0 || j.asistencias > 0);
  const top = (lista, campo, n = 5, icono = '') => {
    const orden = [...lista].sort((a, b) => b[campo] - a[campo]).slice(0, n);
    if (!orden.length) return '<li class="text-slate-600 text-xs">Sin datos aún</li>';
    return orden.map((j, i) => `
      <li class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 min-w-0">
          <span class="text-slate-600 font-bold w-4 shrink-0">${i + 1}</span>
          <span class="truncate">${j.jugador}</span>
          <span class="text-[10px] text-slate-500 truncate">${j.equipo}</span>
        </span>
        <span class="font-black text-emerald-400 shrink-0">${j[campo]}</span>
      </li>`).join('');
  };
  $('top-goleadores').innerHTML = top(jugadores, 'goles');
  $('top-asistencias').innerHTML = top(jugadores, 'asistencias');

  $('totales-torneo').innerHTML = `
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-emerald-400">${jugadores.reduce((a, j) => a + j.goles, 0)}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Goles totales del torneo</p>
    </div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-sky-400">${jugadores.reduce((a, j) => a + j.asistencias, 0)}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Asistencias totales del torneo</p>
    </div>`;
}

// ============ PARTIDOS ============
async function pintarPartidos() {
  const { data } = await supabase.from('partidos').select('*').order('fecha', { ascending: false });
  const porId = Object.fromEntries(equipos.map(e => [e.id, e]));
  const tarjeta = p => {
    const local = porId[p.equipo_local_id];
    const visitante = porId[p.equipo_visitante_id];
    let ganador = null;
    if (p.jugado && local && visitante) {
      if (p.goles_local > p.goles_visitante) ganador = 'L';
      else if (p.goles_visitante > p.goles_local) ganador = 'V';
    }
    const fila = (equipo, goles, g) => `
      <div class="flex items-center justify-between gap-2 py-1.5 ${g ? 'font-bold text-emerald-300' : ''}">
        <span class="flex items-center gap-2 min-w-0">${escudo(equipo, 'w-6 h-6')}<span class="truncate">${equipo?.nombre ?? 'Pendiente'}</span>${g ? ' ✓' : ''}</span>
        <span class="font-black">${equipo ? (goles ?? 0) : ''}</span>
      </div>`;
    return `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          <span>${ETIQUETAS_FASE[p.fase] ?? p.fase}${p.grupo ? ` · Grupo ${p.grupo}` : ''}</span>
          <span>${fmtFecha(p.fecha)}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4">
          <div>${fila(local, p.goles_local, ganador === 'L')}</div>
          <div>${fila(visitante, p.goles_visitante, ganador === 'V')}</div>
        </div>
        ${p.sede ? `<p class="text-[11px] text-slate-500 mt-1">📍 ${p.sede}</p>` : ''}
      </div>`;
  };
  const jugados = (data || []).filter(p => p.jugado);
  const pendientes = (data || []).filter(p => !p.jugado);
  $('lista-resultados').innerHTML = jugados.map(tarjeta).join('') || '<p class="text-slate-600 text-sm">Aún no hay resultados.</p>';
  $('lista-proximos').innerHTML = pendientes.map(tarjeta).join('') || '<p class="text-slate-600 text-sm">No hay partidos programados.</p>';
}

// ============ ELIMINATORIA ============
async function pintarEliminatoria() {
  const { data } = await supabase.from('partidos').select('*');
  const porId = Object.fromEntries(equipos.map(e => [e.id, e]));
  const conEquipos = (data || []).map(p => ({ ...p, equipo_local: porId[p.equipo_local_id] || null, equipo_visitante: porId[p.equipo_visitante_id] || null }));
  renderBracket($('bracket-publico'), conEquipos);
}

// ============ GALERIA ============
async function pintarGaleria() {
  const [respGaleria, respPartidos] = await Promise.all([
    supabase.from('galeria').select('*').order('creado_en', { ascending: false }),
    supabase.from('partidos').select('*')
  ]);
  const items = respGaleria.data || [];
  if (!items.length) {
    $('galeria-grid').innerHTML = '<p class="text-slate-600 text-sm col-span-full">Aún no hay contenido multimedia.</p>';
    return;
  }
  const etiquetaPartido = {};
  (respPartidos.data || []).forEach(p => { etiquetaPartido[p.id] = ETIQUETAS_FASE[p.fase] ?? p.fase; });
  $('galeria-grid').innerHTML = items.map(i => {
    const pie = `<div class="p-2">
        ${i.titulo ? `<p class="text-xs font-semibold truncate">${i.titulo}</p>` : ''}
        ${i.partido_id && etiquetaPartido[i.partido_id] ? `<p class="text-[10px] text-slate-500 truncate">${etiquetaPartido[i.partido_id]}</p>` : ''}
      </div>`;
    if (i.tipo === 'video') {
      return `<figure class="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
        <video src="${i.archivo_url}" controls preload="metadata" class="w-full aspect-video object-cover bg-black"></video>
        ${pie}
      </figure>`;
    }
    return `<figure class="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 cursor-zoom-in group">
        <div class="aspect-square overflow-hidden">
          <img src="${i.archivo_url}" alt="${i.titulo || 'Foto del torneo'}" loading="lazy"
               class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
               data-lightbox="${i.archivo_url}">
        </div>
        ${pie}
      </figure>`;
  }).join('');
  document.querySelectorAll('[data-lightbox]').forEach(img => {
    img.addEventListener('click', () => abrirLightbox(img.dataset.lightbox));
  });
}

function abrirLightbox(url) {
  const lb = $('lightbox');
  $('lightbox-img').src = url;
  lb.classList.remove('hidden');
  lb.classList.add('flex');
}
$('lightbox')?.addEventListener('click', () => {
  const lb = $('lightbox');
  lb.classList.add('hidden');
  lb.classList.remove('flex');
});

// ============ REGLAS ============
async function pintarReglas() {
  const { data } = await supabase.from('reglas').select('*').limit(1);
  const contenido = data?.[0]?.contenido;
  $('reglas-contenido').innerHTML = contenido
    ? marked.parse(contenido)
    : '<p class="text-slate-600">El reglamento aún no ha sido publicado. Pronto estará disponible.</p>';
  $('reglas-contenido').querySelectorAll('a').forEach(a => a.classList.add('text-emerald-400'));
  $('reglas-contenido').querySelectorAll('h1,h2,h3').forEach(h => h.classList.add('text-white', 'font-bold'));
  $('reglas-contenido').querySelectorAll('p,li').forEach(el => el.classList.add('text-slate-300', 'text-sm', 'mb-2'));
}

init();
