import { supabase, escudo, esc, urlPublico, iniciales, fmtFecha, ETIQUETAS_FASE } from './lib.js?v=1.0.1';
import { renderBracket } from './bracket.js?v=1.0.1';
import { CONFIG } from './config.js?v=1.0.1';

// Respeta los saltos de línea sencillos del Markdown del reglamento
marked.setOptions({ breaks: true });

let config = {};
let equipos = [];
let sesion = null;
let cachePartidos = [];
let cacheEstadisticas = [];
let cacheJugadores = [];

const $ = id => document.getElementById(id);

// Un partido cuenta para posiciones/estadísticas si está finalizado:
// jugado = true (criterio clásico) o estado = 'FINALIZADO' (respaldo).
const partidoTerminado = p => !!p.jugado || p.estado === 'FINALIZADO';

// Re-consulta la base y re-renderiza las secciones vivas. Se ejecuta al
// cargar la página, al volver a la pestaña, periódicamente y en tiempo
// real (postgres_changes), para que los cambios guardados desde el
// panel admin se reflejen de inmediato sin recargar la página.
let refrescando = false;
async function refrescarDatosVivos() {
  if (refrescando) return;
  refrescando = true;
  try {
    const [respPartidos, respStats, respJugadores] = await Promise.all([
      supabase.from('partidos').select('*').order('fecha', { ascending: true }),
      supabase.from('estadisticas').select('*'),
      supabase.from('jugadores').select('*')
    ]);
    cachePartidos = respPartidos.data || [];
    cacheEstadisticas = respStats.data || [];
    cacheJugadores = respJugadores.data || [];
    pintarPosiciones();
    pintarEstadisticas();
    pintarPartidos();
    pintarEliminatoria();
  } finally {
    refrescando = false;
  }
}

// Agrupa los avisos de Realtime (un insert masivo de fixture dispara
// varias filas) en un solo refresco rápido.
let refrescoPendiente = false;
function solicitarRefresco() {
  if (refrescoPendiente) return;
  refrescoPendiente = true;
  setTimeout(() => {
    refrescoPendiente = false;
    refrescarDatosVivos();
  }, 300);
}

// Suscripción en tiempo real: partidos y estadísticas publicados
// (publicación "supabase_realtime" configurada en sql/automatizacion.sql).
// Si el proyecto no la tiene, el refresco periódico lo cubre todo.
function suscribirRealtime() {
  try {
    supabase
      .channel('cambios-torneo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidos' }, solicitarRefresco)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estadisticas' }, solicitarRefresco)
      .subscribe();
  } catch {
    // Realtime no disponible: silencioso, el intervalo cubre la sincronización.
  }
}

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
  await refrescarDatosVivos();
  pintarGaleria();
  pintarReglas();
  suscribirRealtime();

  // Refresco automático: al volver a la pestaña o enfocar la ventana y
  // cada 45 segundos en segundo plano para tener el sitio siempre al día.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refrescarDatosVivos();
  });
  window.addEventListener('focus', refrescarDatosVivos);
  setInterval(refrescarDatosVivos, 45000);
}

function fmtFechaHora(iso) {
  if (!iso) return 'Por definir';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  const fecha = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const hhmm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return hhmm === '12:00' ? fecha : `${fecha} · ${hhmm}`;
}

async function pintarSesion() {
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

// Calcula la tabla de posiciones en el cliente leyendo SOLO partidos
// finalizados (jugado o estado FINALIZADO) de la fase "grupos":
// victoria +3, empate +1, derrota +0. PJ, PG, PE, PP, GF, GC, DG y
// PTS se recalculan con cada refresco sin depender de vistas SQL.
function calcularPosiciones(partidos) {
  const filas = equipos.map(e => ({
    equipo_id: e.id,
    nombre: e.nombre,
    escudo_url: e.escudo_url,
    grupo: e.grupo,
    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, puntos: 0, dg: 0
  }));
  const porId = Object.fromEntries(filas.map(f => [f.equipo_id, f]));
  partidos.forEach(p => {
    if (!partidoTerminado(p) || p.fase !== 'grupos') return;
    const local = porId[p.equipo_local_id];
    const visitante = porId[p.equipo_visitante_id];
    if (!local || !visitante) return;
    const gl = p.goles_local ?? 0;
    const gv = p.goles_visitante ?? 0;
    local.pj++; visitante.pj++;
    local.gf += gl; local.gc += gv;
    visitante.gf += gv; visitante.gc += gl;
    if (gl > gv) { local.pg++; visitante.pp++; }
    else if (gv > gl) { visitante.pg++; local.pp++; }
    else { local.pe++; visitante.pe++; }
  });
  filas.forEach(f => { f.puntos = f.pg * 3 + f.pe; f.dg = f.gf - f.gc; });
  return filas;
}

function pintarPosiciones() {
  const filas = calcularPosiciones(cachePartidos);
  // Misma fuente de datos que el panel admin: la tabla "equipos"
  // (contiene siempre escudo_url) para mostrar los escudos.
  const porId = Object.fromEntries(equipos.map(e => [e.id, e]));
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

  if (grupos.length > 1 && !grupos.includes(grupoActivo)) grupoActivo = 'TODOS';

  const visibles = filas
    .filter(f => grupoActivo === 'TODOS' || f.grupo === grupoActivo)
    .sort((a, b) => b.puntos - a.puntos || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));

  $('tbody-posiciones').innerHTML = visibles.map((f, i) => {
    // Se pasa el objeto del equipo completo (con escudo_url), igual que
    // admin.js renderEquipos. Si no está en "equipos", usa la fila de la
    // vista como respaldo.
    const equipo = porId[f.equipo_id] || f;
    // Etiqueta de clasificación según la posición (#) de la tabla:
    //   1º-2º -> Semifinales directas
    //   3º-6º -> Cuartos de Final (repechaje)
    //   7º+   -> Eliminado
    const pos = i + 1;
    const badge = pos <= 2
      ? '<span class="pos-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Semis directo</span>'
      : pos <= 6
        ? '<span class="pos-badge bg-blue-500/20 text-blue-400 border border-blue-500/40">Cuartos de final</span>'
        : '<span class="pos-badge bg-red-500/20 text-red-400 border border-red-500/40">Eliminado</span>';
    return `
    <tr class="fila-equipo border-b border-slate-800/60 hover:bg-slate-800/30 ${pos <= 6 ? 'bg-emerald-500/5' : ''}" data-equipo-id="${esc(f.equipo_id)}">
      <td class="px-3 py-3 text-slate-500">${pos}</td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-2.5">
          ${escudo(equipo, 'w-8 h-8')}
          <div class="flex items-center gap-2 flex-wrap min-w-0">
            <span class="font-semibold">${esc(equipo.nombre ?? f.nombre)}</span>
            ${badge}
            <span class="ver-plantilla" title="Ver plantilla">👁️<span class="ver-plantilla-texto"> Ver plantilla</span></span>
          </div>
        </div>
      </td>
      <td class="px-2 py-3 text-center">${f.pj}</td>
      <td class="px-2 py-3 text-center">${f.pg}</td>
      <td class="px-2 py-3 text-center">${f.pe}</td>
      <td class="px-2 py-3 text-center">${f.pp}</td>
      <td class="px-2 py-3 text-center">${f.gf}</td>
      <td class="px-2 py-3 text-center">${f.gc}</td>
      <td class="px-2 py-3 text-center ${f.dg > 0 ? 'text-emerald-400' : f.dg < 0 ? 'text-rose-400' : ''}">${f.dg > 0 ? '+' : ''}${f.dg}</td>
      <td class="px-4 py-3 text-center font-black text-emerald-400">${f.puntos}</td>
    </tr>`;
  }).join('') || `
    <tr>
      <td colspan="10" class="px-3 py-10">
        <div class="empty-estado">
          <span class="empty-icono">🛡️</span>
          <p class="empty-titulo">Aún no hay equipos registrados</p>
          <p class="empty-sub">La tabla de posiciones se calcula automáticamente con los partidos finalizados.</p>
        </div>
      </td>
    </tr>`;
}

$('tbody-posiciones').addEventListener('click', e => {
  const fila = e.target.closest('tr.fila-equipo');
  if (fila) verPlantillaEquipo(fila.dataset.equipoId);
});

// ============ ESTADISTICAS ============
// Ranking calculado en el cliente: suma goles/asistencias de los
// partidos FINALIZADOS (jugado o estado FINALIZADO). Los autogoles
// se guardan aparte (columna autogoles) y nunca suman al jugador.
function calcularRanking() {
  const terminados = new Set(cachePartidos.filter(partidoTerminado).map(p => p.id));
  const porJugador = {};
  cacheEstadisticas.forEach(s => {
    if (!terminados.has(s.partido_id)) return;
    const fila = porJugador[s.jugador_id] ||= { goles: 0, asistencias: 0 };
    fila.goles += s.goles || 0;
    fila.asistencias += s.asistencias || 0;
  });
  const infoJugador = Object.fromEntries(cacheJugadores.map(j => [j.id, j]));
  const infoEquipo = Object.fromEntries(equipos.map(e => [e.id, e]));
  return Object.entries(porJugador).map(([jugadorId, f]) => {
    const j = infoJugador[jugadorId];
    return {
      jugador: j?.nombre || 'Jugador',
      equipo: (j && infoEquipo[j.equipo_id]?.nombre) || '',
      goles: f.goles,
      asistencias: f.asistencias
    };
  }).filter(j => j.goles > 0 || j.asistencias > 0);
}

function pintarEstadisticas() {
  const jugadores = calcularRanking();
  const porGoles = jugadores.filter(j => j.goles > 0)
    .sort((a, b) => b.goles - a.goles || b.asistencias - a.asistencias || a.jugador.localeCompare(b.jugador));
  const porAsistencias = jugadores.filter(j => j.asistencias > 0)
    .sort((a, b) => b.asistencias - a.asistencias || b.goles - a.goles || a.jugador.localeCompare(b.jugador));
  const totalGoles = jugadores.reduce((a, j) => a + j.goles, 0);
  const totalAsistencias = jugadores.reduce((a, j) => a + j.asistencias, 0);

  const fila = (j, i, campo, color) => `
    <li class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-2 min-w-0">
        <span class="text-slate-600 font-bold w-4 shrink-0">${i + 1}</span>
        <span class="truncate">${esc(j.jugador)}</span>
        <span class="text-[10px] text-slate-500 truncate">${esc(j.equipo)}</span>
      </span>
      <span class="font-black ${color} shrink-0">${j[campo]}</span>
    </li>`;

  // Tarjeta de ranking: TOP 5 visible + botón "Ver lista completa 🔻"
  // que expande suavemente el resto de jugadores con registro.
  const card = (lista, campo, color, icono, textoVacio) => {
    const vacio = `
      <div class="empty-estado">
        <span class="empty-icono">${icono}</span>
        <p class="empty-titulo">${textoVacio}</p>
        <p class="empty-sub">Se publicarán automáticamente al guardar un partido.</p>
      </div>`;
    if (!lista.length) return vacio;
    const top = lista.slice(0, 5).map((j, i) => fila(j, i, campo, color)).join('');
    const extras = lista.slice(5);
    return `
      <ol class="space-y-2 text-sm">${top}</ol>
      ${extras.length ? `
        <div class="top-expandible" id="expandible-${campo}">
          <div class="top-expandible-inner">
            <ol class="space-y-2 text-sm pt-3 border-t border-slate-800/60">${extras.map((j, i) => fila(j, i + 5, campo, color)).join('')}</ol>
          </div>
        </div>
        <button type="button" data-expandir="${campo}" aria-expanded="false" class="btn-ver-todos">Ver lista completa 🔻</button>` : ''}`;
  };

  $('top-goleadores').innerHTML = card(porGoles, 'goles', 'text-emerald-400', '⚽', 'Aún no hay goles registrados');
  $('top-asistencias').innerHTML = card(porAsistencias, 'asistencias', 'text-sky-400', '🎯', 'Aún no hay asistencias registradas');

  $('top-goleadores').querySelectorAll('[data-expandir]').forEach(b => b.addEventListener('click', () => alternarListaCompleta(b, 'goles')));
  $('top-asistencias').querySelectorAll('[data-expandir]').forEach(b => b.addEventListener('click', () => alternarListaCompleta(b, 'asistencias')));

  // Contadores del torneo en tiempo real (sumados automáticamente).
  $('totales-torneo').innerHTML = (totalGoles || totalAsistencias)
    ? `
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-emerald-400">${totalGoles}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">⚽ Goles totales del torneo</p>
    </div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-sky-400">${totalAsistencias}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">🎯 Asistencias totales del torneo</p>
    </div>`
    : `
    <div class="col-span-full rounded-xl bg-slate-900/60 border border-slate-800">
      <div class="empty-estado">
        <span class="empty-icono">⚽</span>
        <p class="empty-titulo">Aún no hay goles registrados</p>
        <p class="empty-sub">Los totales del torneo se suman solos con cada partido guardado desde el panel.</p>
      </div>
    </div>`;
}

function alternarListaCompleta(btn, campo) {
  const caja = $(`expandible-${campo}`);
  if (!caja) return;
  const abierta = caja.classList.toggle('abierta');
  btn.textContent = abierta ? 'Ver menos 🔺' : 'Ver lista completa 🔻';
  btn.setAttribute('aria-expanded', String(abierta));
  if (abierta) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============ PARTIDOS / FIXTURE ============
let fechaPartidosActiva = 'TODAS';
let gruposFixture = [];

function pintarPartidos() {
  gruposFixture = agruparPorFecha(cachePartidos);
  pintarTabsFechas();
  pintarGridFechas();
}

// Agrupa los partidos por jornada ("Fecha 1", ...) y por fase cuando la
// jornada no aplica (eliminatoria). Calcula además qué equipos de la fase
// de grupos descansan en cada fecha (los que juegan en todas las demás).
function agruparPorFecha(partidos) {
  const ORDEN_FASE = ['grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer_lugar', 'final'];
  const mapa = new Map();
  partidos.forEach(p => {
    // Los byes de la eliminatoria (equipo libre) no son enfrentamientos
    if (!p.equipo_local_id || !p.equipo_visitante_id) return;
    const clave = p.jornada || ETIQUETAS_FASE[p.fase] || 'Otros';
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(p);
  });
  const numeroDe = (clave, fase) => {
    const m = /fecha\s*(\d+)/i.exec(clave);
    if (m) return Number(m[1]);
    const i = ORDEN_FASE.indexOf(fase);
    return 1000 + (i >= 0 ? i : 999);
  };
  // Equipos presentes en la fase de grupos (base para calcular descansos)
  const equiposDeLiga = new Set(
    partidos.filter(p => p.fase === 'grupos').flatMap(p => [p.equipo_local_id, p.equipo_visitante_id])
  );
  return [...mapa.entries()].map(([clave, lista]) => {
    const esFecha = /fecha\s*\d+/i.test(clave);
    const partidos = [...lista].sort((a, b) => {
      const fa = a.fecha ? new Date(a.fecha).getTime() : Infinity;
      const fb = b.fecha ? new Date(b.fecha).getTime() : Infinity;
      return fa - fb;
    });
    const descansan = esFecha
      ? [...equiposDeLiga].filter(id => !partidos.some(p => p.equipo_local_id === id || p.equipo_visitante_id === id))
      : [];
    return {
      clave,
      esFecha,
      etiqueta: esFecha ? clave.toUpperCase() : (ETIQUETAS_FASE[lista[0].fase] ?? clave).toUpperCase(),
      numero: numeroDe(clave, lista[0].fase),
      partidos,
      descansan
    };
  }).sort((a, b) => a.numero - b.numero);
}

function pintarTabsFechas() {
  const tabs = $('tabs-fechas');
  if (!gruposFixture.length) { tabs.innerHTML = ''; return; }
  tabs.innerHTML = [null, ...gruposFixture.map(g => g.clave)].map(clave => {
    const activa = fechaPartidosActiva === (clave ?? 'TODAS');
    const etiqueta = clave ? gruposFixture.find(g => g.clave === clave).etiqueta : 'Todas las fechas';
    return `<button type="button" data-fecha-tab="${esc(clave ?? 'TODAS')}" class="fixture-tab${activa ? ' activo' : ''}">${esc(etiqueta)}</button>`;
  }).join('');
  tabs.querySelectorAll('[data-fecha-tab]').forEach(btn => btn.addEventListener('click', () => {
    fechaPartidosActiva = btn.dataset.fechaTab;
    pintarTabsFechas();
    pintarGridFechas();
  }));
}

function pintarGridFechas() {
  const caja = $('grid-fechas');
  const visibles = fechaPartidosActiva === 'TODAS'
    ? gruposFixture
    : gruposFixture.filter(g => g.clave === fechaPartidosActiva);
  if (!visibles.length) {
    caja.innerHTML = `
      <div class="empty-estado rounded-xl border border-slate-800 bg-slate-900/60">
        <span class="empty-icono">📅</span>
        <p class="empty-titulo">Aún no hay partidos publicados</p>
        <p class="empty-sub">El fixture del torneo aparecerá aquí cuando el administrador lo publique.</p>
      </div>`;
    return;
  }
  const porId = Object.fromEntries(equipos.map(e => [e.id, e]));
  caja.innerHTML = `<div class="fixture-grid">${visibles.map(g => tarjetaFecha(g, porId)).join('')}</div>`;
}

function tarjetaFecha(g, porId) {
  const total = g.partidos.length;
  const descansan = g.descansan.filter(id => porId[id]);
  const info = `${total} partido${total === 1 ? '' : 's'}${descansan.length ? ` · ${descansan.length} descansa${descansan.length > 1 ? 'n' : ''}` : ''}`;
  return `
    <article class="fecha-card">
      <header class="fecha-card-header">
        <h3 class="fecha-titulo">📅 ${esc(g.etiqueta)}</h3>
        <span class="fecha-badge">${esc(info)}</span>
      </header>
      <div class="fecha-cuerpo">
        ${g.partidos.map(p => tarjetaPartido(p, porId)).join('')}
        ${descansan.map(id => tarjetaDescansa(porId[id])).join('')}
      </div>
    </article>`;
}

function tarjetaPartido(p, porId) {
  const local = porId[p.equipo_local_id];
  const visitante = porId[p.equipo_visitante_id];
  let ganador = null;
  if (p.jugado && local && visitante) {
    if (p.goles_local > p.goles_visitante) ganador = 'L';
    else if (p.goles_visitante > p.goles_local) ganador = 'V';
  }
  const lateral = (equipo, lado, gana) => `
    <div class="partido-equipo ${lado === 'L' ? 'partido-local' : 'partido-visitante'}">
      ${escudo(equipo, 'w-7 h-7')}
      <span class="partido-nombre ${gana ? 'partido-ganador' : ''}">${esc(equipo?.nombre ?? 'Pendiente')}</span>
      ${gana ? '<span class="partido-cheque">✓</span>' : ''}
    </div>`;
  const centro = p.jugado
    ? `<span class="partido-marcador${ganador ? ' partido-marcador-definido' : ''}">${p.goles_local} - ${p.goles_visitante}</span>`
    : '<span class="partido-vs">VS</span>';
  const vivo = p.estado === 'EN JUEGO' ? '<span class="partido-vivo">● En vivo</span>' : '';
  return `
    <div class="partido-fila">
      <div class="partido-linea">
        ${lateral(local, 'L', ganador === 'L')}
        ${centro}
        ${lateral(visitante, 'V', ganador === 'V')}
      </div>
      <div class="partido-meta">
        <span>📍 ${esc(p.sede || 'SENA')}</span>
        <span>${fmtFechaHora(p.fecha)}</span>
        ${vivo}
      </div>
    </div>`;
}

function tarjetaDescansa(equipo) {
  return `
    <div class="descansa-fila">
      ${escudo(equipo, 'w-7 h-7')}
      <span class="descansa-nombre">${esc(equipo.nombre)}</span>
      <span class="descansa-chip">Descansa</span>
    </div>`;
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
    $('galeria-grid').innerHTML = `
      <div class="col-span-full">
        <div class="empty-estado rounded-xl border border-slate-800 bg-slate-900/60">
          <span class="empty-icono">📸</span>
          <p class="empty-titulo">Aún no hay contenido multimedia</p>
          <p class="empty-sub">Las fotos y videos del torneo se publicarán desde el panel de administración.</p>
        </div>
      </div>`;
    return;
  }
  const etiquetaPartido = {};
  (respPartidos.data || []).forEach(p => { etiquetaPartido[p.id] = ETIQUETAS_FASE[p.fase] ?? p.fase; });
  $('galeria-grid').innerHTML = items.map(i => {
    const pie = `<div class="p-2">
        ${i.titulo ? `<p class="text-xs font-semibold truncate">${esc(i.titulo)}</p>` : ''}
        ${i.partido_id && etiquetaPartido[i.partido_id] ? `<p class="text-[10px] text-slate-500 truncate">${esc(etiquetaPartido[i.partido_id])}</p>` : ''}
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

// ============ PLANTILLA DE SELECCIÓN (MODAL) ============
const POS_CLS = {
  Arquero: 'pos-arq',
  Defensa: 'pos-def',
  Centrocampista: 'pos-med',
  Delantero: 'pos-del'
};

function tarjetaJugador(j) {
  const foto = j.foto_url
    ? `<img class="jugador-foto" src="${esc(urlPublico(j.foto_url))}" alt="${esc(j.nombre)}" loading="lazy">`
    : `<span class="jugador-foto">${esc(iniciales(j.nombre))}</span>`;
  return `
    <div class="jugador-card">
      <span class="jugador-numero">${j.numero ?? '—'}</span>
      ${foto}
      <p class="jugador-nombre">${esc(j.nombre)}</p>
      <p class="jugador-posicion ${POS_CLS[j.posicion] || 'pos-med'}">${esc(j.posicion || 'Jugador de campo')}</p>
    </div>`;
}

async function verPlantillaEquipo(equipoId) {
  const equipo = equipos.find(x => x.id === equipoId) || { nombre: 'Selección' };
  const contenido = $('modal-equipo-contenido');
  contenido.innerHTML = '<div class="modal-vacio">Cargando plantilla…</div>';
  abrirModalEquipo();

  const { data } = await supabase
    .from('jugadores')
    .select('*')
    .eq('equipo_id', equipoId)
    .order('numero');

  const jugadores = data || [];

  if (!jugadores.length) {
    contenido.innerHTML = `
      <div class="modal-vacio">
        <p class="modal-vacio-icono">⚽</p>
        <p class="modal-vacio-titulo">Plantilla en preparación para el torneo</p>
        <p class="modal-vacio-sub">Los jugadores de esta selección se estarán registrando muy pronto.</p>
      </div>`;
    return;
  }

  contenido.innerHTML = `
    <header class="modal-cabecera">
      <div class="mh-escudo">${escudo(equipo)}</div>
      <div class="min-w-0">
        <p class="modal-kicker">Selección oficial</p>
        <h2 class="modal-titulo">${esc(equipo.nombre ?? 'Equipo')}</h2>
        <p class="modal-sub">${jugadores.length} jugador${jugadores.length === 1 ? '' : 'es'} registrados</p>
      </div>
    </header>
    <div class="grid-jugadores">
      ${jugadores.map(tarjetaJugador).join('')}
    </div>`;
}

function abrirModalEquipo() {
  const capa = $('modal-equipo');
  capa.classList.add('abierto');
  capa.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-abierto');
}

function cerrarModalEquipo() {
  const capa = $('modal-equipo');
  capa.classList.remove('abierto');
  capa.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-abierto');
}

$('modal-equipo-cerrar')?.addEventListener('click', cerrarModalEquipo);
$('modal-equipo')?.addEventListener('click', e => {
  if (e.target === $('modal-equipo')) cerrarModalEquipo();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModalEquipo();
});
async function pintarReglas() {
  const { data } = await supabase.from('reglas').select('*').limit(1);
  const contenido = data?.[0]?.contenido;
  const caja = $('reglas-contenido');
  caja.classList.add('reglas-md');
  caja.innerHTML = contenido
    ? marked.parse(contenido)
    : '<p>El reglamento aún no ha sido publicado. Pronto estará disponible.</p>';
}

init();
