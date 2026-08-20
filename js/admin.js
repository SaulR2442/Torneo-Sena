import { supabase, toast, confirmar, subirArchivo, subirEscudo, esVideo, cargando, escudo, esc, fmtFecha, ETIQUETAS_FASE, ORDEN_ELIMINATORIA, opcionesSelect } from './lib.js?v=1.0.1';
import { renderBracket } from './bracket.js?v=1.0.1';
import { CONFIG } from './config.js?v=1.0.1';

// Respeta los saltos de línea sencillos del Markdown del reglamento
marked.setOptions({ breaks: true });

const $ = id => document.getElementById(id);
const state = { equipos: [], jugadores: [], partidos: [], config: {} };

// ============================================================
// SEGURIDAD: solo sesión iniciada
// ============================================================
const { data: sesion } = await supabase.auth.getSession();
if (!sesion.session) {
  location.href = 'login.html';
  throw new Error('Sin sesión');
}
const usuario = sesion.session.user;
$('usuario-correo').textContent = usuario.email;

$('btn-cerrar-sesion').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.href = 'login.html';
});

// ============================================================
// TABS
// ============================================================
function activarTab(nombre) {
  document.querySelectorAll('.pestana').forEach(s => s.classList.toggle('activa', s.id === `sec-${nombre}`));
  document.querySelectorAll('.tab-btn').forEach(b => {
    const activo = b.dataset.tab === nombre;
    b.className = `tab-btn px-4 py-2.5 rounded-lg text-left whitespace-nowrap font-semibold transition ${
      activo ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`;
  });
  if (nombre === 'resumen') renderResumen();
  if (nombre === 'equipos') renderEquipos();
  if (nombre === 'jugadores') renderJugadores();
  if (nombre === 'partidos') renderPartidos();
  if (nombre === 'fixture') renderFixture();
  if (nombre === 'eliminatoria') renderEliminatoria();
  if (nombre === 'estadisticas') renderEstadisticas();
  if (nombre === 'finanzas') renderFinanzas();
  if (nombre === 'reglas') cargarReglas();
  if (nombre === 'galeria') renderGaleriaAdmin();
}
document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => activarTab(b.dataset.tab)));
activarTab('resumen');

// ============================================================
// CARGA BASE
// ============================================================
async function cargarBase() {
  const [e, j, p, c] = await Promise.all([
    supabase.from('equipos').select('*').order('nombre'),
    supabase.from('jugadores').select('*').order('nombre'),
    supabase.from('partidos').select('*').order('fecha', { ascending: false }),
    supabase.from('config').select('*')
  ]);
  state.equipos = e.data || [];
  state.jugadores = j.data || [];
  state.partidos = p.data || [];
  state.config = Object.fromEntries((c.data || []).map(r => [r.clave, r.valor]));
}

// ============================================================
// RESUMEN
// ============================================================
async function renderResumen() {
  await cargarBase();
  const jugados = state.partidos.filter(p => p.jugado).length;
  const pendientes = state.partidos.filter(p => !p.jugado).length;
  $('resumen-grid').innerHTML = `
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><p class="text-3xl font-black text-emerald-400">${state.equipos.length}</p><p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Equipos</p></div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><p class="text-3xl font-black text-emerald-400">${state.jugadores.length}</p><p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Jugadores</p></div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><p class="text-3xl font-black text-emerald-400">${jugados}</p><p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Partidos jugados · ${pendientes} pendientes</p></div>`;
}

// ============================================================
// EQUIPOS
// ============================================================
async function renderEquipos() {
  const { data } = await supabase.from('equipos').select('*').order('nombre');
  state.equipos = data || [];
  const grid = $('grid-equipos');
  if (!state.equipos.length) {
    grid.innerHTML = '<p class="text-slate-500 text-sm col-span-full">No hay equipos registrados. Usa el formulario para crear el primero.</p>';
    return;
  }
  grid.innerHTML = state.equipos.map(e => `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div class="flex items-center gap-3 mb-3">
        ${escudo(e, 'w-12 h-12')}
        <div class="min-w-0">
          <p class="font-bold truncate">${esc(e.nombre)}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button data-editar="${e.id}" class="ml-auto text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700">Editar</button>
        <button data-eliminar="${e.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-rose-600/10 text-rose-400 hover:bg-rose-600/20">Eliminar</button>
      </div>
    </div>`).join('');

  grid.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarEquipo(b.dataset.editar)));
  grid.querySelectorAll('[data-eliminar]').forEach(b => b.addEventListener('click', async () => {
    const e = state.equipos.find(x => x.id === b.dataset.eliminar);
    if (!(await confirmar(`Se eliminará el equipo "${e.nombre}" con todos sus jugadores y estadísticas. ¿Continuar?`))) return;
    await supabase.from('equipos').delete().eq('id', e.id);
    toast('Equipo eliminado');
    renderEquipos();
  }));
}

function editarEquipo(id) {
  const e = state.equipos.find(x => x.id === id);
  $('eq-id').value = e.id;
  $('eq-nombre').value = e.nombre;
  $('eq-escudo').value = '';
  $('btn-cancelar-equipo').classList.remove('hidden');
}

$('form-equipo').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('eq-id').value || null;
  const file = $('eq-escudo').files[0];
  let escudo_url = null;
  if (file) {
    try {
      // Se guarda la ruta relativa ("escudos/xxxx.jpg"); el renderizado
      // genera la URL pública con urlPublico()/getPublicUrl().
      escudo_url = await subirEscudo(file);
    } catch {
      toast('No se pudo subir el escudo', 'error');
      return;
    }
  }
  const datos = {
    nombre: $('eq-nombre').value.trim()
  };
  if (escudo_url) datos.escudo_url = escudo_url;
  const { error } = id
    ? await supabase.from('equipos').update(datos).eq('id', id)
    : await supabase.from('equipos').insert(datos);
  if (error) { toast('Error al guardar el equipo: ' + error.message, 'error'); return; }
  toast(id ? 'Equipo actualizado' : 'Equipo creado');
  e.target.reset();
  $('eq-id').value = '';
  $('btn-cancelar-equipo').classList.add('hidden');
  renderEquipos();
});

$('btn-cancelar-equipo').addEventListener('click', () => {
  $('form-equipo').reset();
  $('eq-id').value = '';
  $('btn-cancelar-equipo').classList.add('hidden');
});

// ============================================================
// JUGADORES
// ============================================================
async function renderJugadores() {
  await cargarBase();
  $('jug-equipo').innerHTML = opcionesSelect(state.equipos, $('jug-equipo').value || '', 'Selecciona un equipo…');
  const equipoId = $('jug-equipo').value;
  const lista = $('lista-jugadores');
  if (!equipoId) {
    lista.innerHTML = '<p class="text-slate-500 text-sm">Selecciona un equipo para ver sus jugadores.</p>';
    return;
  }
  const jugadores = state.jugadores.filter(j => j.equipo_id === equipoId);
  const equipo = state.equipos.find(x => x.id === equipoId);
  if (!jugadores.length) {
    lista.innerHTML = `<p class="text-slate-500 text-sm">${esc(equipo?.nombre)} aún no tiene jugadores registrados.</p>`;
    return;
  }
  lista.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
      <table class="w-full text-sm tabla-admin">
        <thead><tr class="text-left text-slate-400 uppercase text-xs border-b border-slate-800">
          <th class="px-3 py-3">Jugador</th><th class="px-3 py-3">Posición</th><th class="px-3 py-3 text-center">Nº</th><th class="px-3 py-3 text-right">Acciones</th>
        </tr></thead>
        <tbody>${jugadores.map(j => `
          <tr class="border-b border-slate-800/50">
            <td class="px-3 py-2.5"><div class="flex items-center gap-2.5">${escudo({ escudo_url: j.foto_url, nombre: j.nombre }, 'w-8 h-8')}<span class="font-semibold">${esc(j.nombre)}</span></div></td>
            <td class="px-3 py-2.5 text-slate-400">${esc(j.posicion || '—')}</td>
            <td class="px-3 py-2.5 text-center">${j.numero || '—'}</td>
            <td class="px-3 py-2.5 text-right">
              <button data-editar="${j.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700">Editar</button>
              <button data-eliminar="${j.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 ml-1">Eliminar</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
  lista.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarJugador(b.dataset.editar)));
  lista.querySelectorAll('[data-eliminar]').forEach(b => b.addEventListener('click', async () => {
    const j = state.jugadores.find(x => x.id === b.dataset.eliminar);
    if (!(await confirmar(`¿Eliminar al jugador "${j.nombre}"?`))) return;
    await supabase.from('jugadores').delete().eq('id', j.id);
    toast('Jugador eliminado');
    await cargarBase();
    renderJugadores();
  }));
}

function editarJugador(id) {
  const j = state.jugadores.find(x => x.id === id);
  $('jug-id').value = j.id;
  $('jug-nombre').value = j.nombre;
  $('jug-posicion').value = j.posicion || 'Arquero';
  $('jug-numero').value = j.numero || '';
  $('jug-foto').value = '';
  $('jug-foto-existente').value = j.foto_url || '';
  $('btn-cancelar-jugador').classList.remove('hidden');
}

$('form-jugador').addEventListener('submit', async e => {
  e.preventDefault();
  const equipoId = $('jug-equipo').value;
  if (!equipoId) { toast('Primero selecciona un equipo', 'error'); return; }
  const id = $('jug-id').value || null;
  const file = $('jug-foto').files[0];
  let foto_url = $('jug-foto-existente').value || null;
  if (file) {
    try { foto_url = await subirArchivo(file, 'jugadores'); }
    catch { toast('No se pudo subir la foto', 'error'); return; }
  }
  const datos = {
    equipo_id: equipoId,
    nombre: $('jug-nombre').value.trim(),
    posicion: $('jug-posicion').value,
    numero: Number($('jug-numero').value) || null,
    foto_url
  };
  const { error } = id
    ? await supabase.from('jugadores').update(datos).eq('id', id)
    : await supabase.from('jugadores').insert(datos);
  if (error) { toast('Error al guardar jugador: ' + error.message, 'error'); return; }
  toast(id ? 'Jugador actualizado' : 'Jugador registrado');
  e.target.reset();
  $('jug-id').value = '';
  $('jug-foto-existente').value = '';
  $('btn-cancelar-jugador').classList.add('hidden');
  await cargarBase();
  renderJugadores();
});

$('btn-cancelar-jugador').addEventListener('click', () => {
  $('form-jugador').reset();
  $('jug-id').value = '';
  $('jug-foto-existente').value = '';
  $('btn-cancelar-jugador').classList.add('hidden');
});

$('jug-equipo').addEventListener('change', renderJugadores);

// ============================================================
// PARTIDOS
// ============================================================
let goleadoresSel = [];
let arbitrajeEstado = {};

const equipoNombre = id => state.equipos.find(e => e.id === id)?.nombre ?? '';

const ESTADOS_PARTIDO = ['PENDIENTE', 'EN JUEGO', 'FINALIZADO'];

// Convierte la fecha ISO a "yyyy-mm-dd" en la zona local del navegador.
// (No se usa slice(0,10) porque las horas cercanas a medianoche
// desplazarían el día en la representación UTC.)
function fechaLocalDeISO(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Devuelve "HH:MM" de la fecha guardada; vacío si no tiene hora.
// Las fechas antiguas se guardaban a las 12:00 como "hora por definir".
function horaDeFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  const hhmm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return hhmm === '12:00' ? '' : hhmm;
}

function fechaHoraLocal(iso) {
  if (!iso) return 'Por definir';
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const hora = horaDeFecha(iso);
  return hora ? `${fecha} · ${hora}` : fecha;
}

function estadoBadge(estado) {
  const cls = estado === 'FINALIZADO'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
    : estado === 'EN JUEGO'
      ? 'bg-sky-500/15 text-sky-400 border-sky-500/40'
      : 'bg-slate-700/40 text-slate-400 border-slate-600/40';
  return `<span class="text-[9px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${cls}">${esc(estado || 'PENDIENTE')}</span>`;
}

function fechaHoy() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function jugadoresDelPartido() {
  const local = $('par-local').value, visitante = $('par-visitante').value;
  return state.jugadores.filter(j => j.equipo_id === local || j.equipo_id === visitante);
}

function actualizarMarcador() {
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e.nombre]));
  const l = $('par-local').value, v = $('par-visitante').value;
  $('marc-equipo1').textContent = l ? porId[l] : 'Equipo 1';
  $('marc-equipo2').textContent = v ? porId[v] : 'Equipo 2';
}

function renderListaGoleadores() {
  const porJugador = Object.fromEntries(state.jugadores.map(j => [j.id, j]));
  const ul = $('lista-goleadores');
  if (!goleadoresSel.length) {
    ul.innerHTML = '<li class="text-slate-500 text-xs">Sin goleadores registrados.</li>';
    return;
  }
  ul.innerHTML = goleadoresSel.map((g, i) => {
    const j = porJugador[g.jugador_id];
    const detalle = [
      g.goles ? `<span class="text-emerald-400">⚽ ${g.goles}</span>` : '',
      g.autogoles ? `<span class="text-rose-400" title="Autogol">🥅 ${g.autogoles} autogol${g.autogoles !== 1 ? 'es' : ''}</span>` : ''
    ].filter(Boolean).join(' · ');
    return `
      <li class="flex items-center gap-2">
        <span class="text-emerald-400 font-black">${g.autogoles && !g.goles ? '🥅' : '⚽'}</span>
        <span class="font-semibold">${esc(j?.nombre ?? '?')}</span>
        <span class="text-slate-500 text-xs truncate">${esc(equipoNombre(j?.equipo_id))}</span>
        <span class="ml-auto font-black text-sm">${detalle}</span>
        <button type="button" data-quitar="${i}" class="text-xs px-2 py-1 rounded bg-rose-600/10 text-rose-400 hover:bg-rose-600/20">Quitar</button>
      </li>`;
  }).join('');
  ul.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    const g = goleadoresSel[Number(b.dataset.quitar)];
    if (g) restarGolesMarcador(g.jugador_id, g.autogoles, g.goles);
    goleadoresSel.splice(Number(b.dataset.quitar), 1);
    actualizarGoleadores();
  }));
}

// Suma N goles al marcador del equipo que corresponde según el jugador
// y si el gol fue autogol (autogol del local suma al visitante y viceversa).
function sumarGolesMarcador(jugadorId, autogol, n) {
  const jugador = state.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return;
  const esLocal = jugador.equipo_id === $('par-local').value;
  const esVisitante = jugador.equipo_id === $('par-visitante').value;
  let golLocal = Number($('par-goles-local').value || 0);
  let golVisit = Number($('par-goles-visitante').value || 0);
  if (autogol) {
    if (esLocal) golVisit += n;
    else if (esVisitante) golLocal += n;
  } else {
    if (esLocal) golLocal += n;
    else if (esVisitante) golVisit += n;
  }
  $('par-goles-local').value = golLocal;
  $('par-goles-visitante').value = golVisit;
}

// Resta del marcador (sin dejar negativos) los goles y autogoles
// registrados para un jugador. Primero los autogoles y luego los normales.
function restarGolesMarcador(jugadorId, autogoles, goles) {
  const jugador = state.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return;
  const esLocal = jugador.equipo_id === $('par-local').value;
  const esVisitante = jugador.equipo_id === $('par-visitante').value;
  let golLocal = Number($('par-goles-local').value || 0);
  let golVisit = Number($('par-goles-visitante').value || 0);
  if (autogoles > 0) {
    if (esLocal) golVisit = Math.max(0, golVisit - autogoles);
    else if (esVisitante) golLocal = Math.max(0, golLocal - autogoles);
  }
  if (goles > 0) {
    if (esLocal) golLocal = Math.max(0, golLocal - goles);
    else if (esVisitante) golVisit = Math.max(0, golVisit - goles);
  }
  $('par-goles-local').value = golLocal;
  $('par-goles-visitante').value = golVisit;
}

function actualizarGoleadores() {
  const jugadores = jugadoresDelPartido();
  $('gol-jugador').innerHTML = jugadores.length
    ? `<option value="">Elige jugador…</option>` + jugadores
        .map(j => {
          const g = goleadoresSel.find(x => x.jugador_id === j.id);
          const ya = g ? ` · lleva ${g.goles}⚽${g.autogoles ? ` ${g.autogoles}🥅` : ''}` : '';
          return `<option value="${j.id}">${j.nombre} (${equipoNombre(j.equipo_id)})${ya}</option>`;
        })
        .join('')
    : '<option value="">Selecciona los equipos primero</option>';
  renderListaGoleadores();
}

function renderArbitraje() {
  const caja = $('lista-arbitraje');
  const jugadores = jugadoresDelPartido();
  if (!jugadores.length) {
    caja.innerHTML = '<p class="text-slate-500 text-xs">Selecciona los equipos primero.</p>';
    return;
  }
  caja.innerHTML = jugadores.map(j => `
    <label class="flex items-center gap-2 text-sm rounded-lg bg-slate-900/60 border border-slate-700/60 px-3 py-2 cursor-pointer hover:bg-slate-800/60 transition">
      <input type="checkbox" data-arb="${j.id}" ${arbitrajeEstado[j.id] ? 'checked' : ''} class="accent-emerald-500 w-4 h-4 shrink-0">
      <span class="truncate">${j.nombre}</span>
      <span class="text-[10px] text-slate-500 truncate">${equipoNombre(j.equipo_id)}</span>
    </label>`).join('');
  caja.querySelectorAll('[data-arb]').forEach(cb => cb.addEventListener('change', () => {
    arbitrajeEstado[cb.dataset.arb] = cb.checked;
    sincronizarCuotas();
  }));
}

// Jugadores de los equipos actualmente seleccionados en el formulario
function jugadoresPorLado() {
  const local = $('par-local').value, visitante = $('par-visitante').value;
  return {
    local: state.jugadores.filter(j => j.equipo_id === local),
    visitante: state.jugadores.filter(j => j.equipo_id === visitante)
  };
}

// Marca/desmarca todos los checkboxes de jugadores de un equipo
function marcarJugadoresDeEquipo(equipoId, marcado) {
  document.querySelectorAll('#lista-arbitraje [data-arb]').forEach(cb => {
    if (equipoId && state.jugadores.find(j => j.id === cb.dataset.arb)?.equipo_id !== equipoId) return;
    cb.checked = marcado;
    arbitrajeEstado[cb.dataset.arb] = marcado;
  });
}

// Reglas reactivas entre jugadores, cuotas de equipo y arbitraje:
//  - Todos los jugadores de un equipo pagados  => cuota del equipo marcada
//  - Cualquier jugador sin pagar                => cuota del equipo desmarcada
//  - Ambas cuotas marcadas                      => "Arbitraje del encuentro pagado"
//  - Alguna cuota sin marcar                    => "Arbitraje del encuentro" desmarcado
function sincronizarCuotas() {
  const { local, visitante } = jugadoresPorLado();
  if (local.length) $('par-pago-local').checked = local.every(j => arbitrajeEstado[j.id]);
  if (visitante.length) $('par-pago-visitante').checked = visitante.every(j => arbitrajeEstado[j.id]);
  $('par-arbitraje-pagado').checked = $('par-pago-local').checked && $('par-pago-visitante').checked;
}

// Cuota del equipo local marcada => pago de todos sus jugadores
$('par-pago-local').addEventListener('change', () => {
  const { local } = jugadoresPorLado();
  if (local.length) {
    marcarJugadoresDeEquipo(local[0].equipo_id, $('par-pago-local').checked);
    sincronizarCuotas();
  }
});

// Cuota del equipo visitante marcada => pago de todos sus jugadores
$('par-pago-visitante').addEventListener('change', () => {
  const { visitante } = jugadoresPorLado();
  if (visitante.length) {
    marcarJugadoresDeEquipo(visitante[0].equipo_id, $('par-pago-visitante').checked);
    sincronizarCuotas();
  }
});

// "Arbitraje del encuentro pagado" => pago de TODOS los jugadores y cuotas
$('par-arbitraje-pagado').addEventListener('change', () => {
  const marcado = $('par-arbitraje-pagado').checked;
  marcarJugadoresDeEquipo(null, marcado);
  $('par-pago-local').checked = marcado;
  $('par-pago-visitante').checked = marcado;
});

function equiposCambiados() {
  goleadoresSel = [];
  arbitrajeEstado = {};
  $('par-pago-local').checked = false;
  $('par-pago-visitante').checked = false;
  $('par-arbitraje-pagado').checked = false;
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
}

function resetFormPartido() {
  $('form-partido').reset();
  $('par-id').value = '';
  $('par-jornada').value = '';
  $('par-fecha').value = fechaHoy();
  $('par-hora').value = '';
  $('par-estado').value = 'PENDIENTE';
  $('par-sede').value = 'SENA';
  $('par-jugado').checked = false;
  goleadoresSel = [];
  arbitrajeEstado = {};
  $('par-pago-local').checked = false;
  $('par-pago-visitante').checked = false;
  $('par-arbitraje-pagado').checked = false;
  actualizarEtiquetasCuotas();
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
  $('btn-cancelar-partido').classList.add('hidden');
}

async function cargarEstadisticasPartido(partidoId) {
  goleadoresSel = [];
  if (!partidoId) return;
  const { data } = await supabase.from('estadisticas')
    .select('jugador_id, goles, autogoles')
    .eq('partido_id', partidoId);
  (data || []).forEach(r => {
    if ((r.goles || 0) > 0 || (r.autogoles || 0) > 0) {
      goleadoresSel.push({ jugador_id: r.jugador_id, goles: r.goles || 0, autogoles: r.autogoles || 0 });
    }
  });
}

async function cargarArbitraje(partidoId) {
  arbitrajeEstado = {};
  if (!partidoId) return;
  if (!(await arbitrajePartidosDisponible())) return;
  try {
    const { data } = await supabase.from('arbitraje_partidos').select('jugador_id, pagado').eq('partido_id', partidoId);
    (data || []).forEach(r => { arbitrajeEstado[r.jugador_id] = r.pagado; });
  } catch {
    // Sin la tabla el detalle queda vacío; el pago global se
    // restaura desde partidos.pago_local / pago_visitante.
  }
}

// Traduce errores de Supabase en mensajes accionables. Si el problema
// es una columna inexistente (autogoles/es_autogol), la solución es
// ejecutar sql/fix_schema.sql en el SQL Editor.
function avisoErrorSupabase(error, contexto) {
  const msg = error?.message || String(error);
  if (/column .* does not exist|undefined_column|42703/i.test(msg)) {
    toast(`${contexto}: falta una columna en la tabla "estadisticas" (autogoles/es_autogol). Ejecuta sql/fix_schema.sql en Supabase y vuelve a guardar.`, 'error');
  } else {
    toast(`${contexto}: ${msg}`, 'error');
  }
}

// Detecta UNA sola vez si la columna "es_autogol" existe en la base.
// La app funciona con o sin ella (el ranking usa "autogoles" como
// contador), así que solo se envía cuando la columna está disponible.
let soportaEsAutogol = null;
async function estadisticasSoportanEsAutogol() {
  if (soportaEsAutogol !== null) return soportaEsAutogol;
  try {
    await supabase.from('estadisticas').select('es_autogol').limit(1);
    soportaEsAutogol = true;
  } catch {
    soportaEsAutogol = false;
  }
  return soportaEsAutogol;
}

// Guarda en una sola pasada las estadísticas del partido (goles y
// autogoles) leyendo SOLO la lista de la ficha del encuentro: no hay
// ingreso manual por duplicado. Si el partido no está jugado, la
// lista se pasa vacía y se limpian los contadores.
// Mapeo explícito a Supabase: { partido_id, jugador_id, equipo_id,
// goles, autogoles, es_autogol }.
async function guardarEstadisticas(partidoId, jugado) {
  try {
    const idsEquipos = [$('par-local').value, $('par-visitante').value].filter(Boolean);
    if (!idsEquipos.length) return;
    const goleadores = jugado ? goleadoresSel : [];
    const enviarEsAutogol = await estadisticasSoportanEsAutogol();
    const filas = [];
    goleadores.forEach(g => {
      const jugador = state.jugadores.find(j => j.id === g.jugador_id);
      if (!jugador) return;
      const fila = {
        partido_id: partidoId,
        jugador_id: g.jugador_id,
        equipo_id: jugador.equipo_id,
        goles: g.goles || 0,
        autogoles: g.autogoles || 0
      };
      if (enviarEsAutogol) fila.es_autogol = (g.autogoles || 0) > 0;
      filas.push(fila);
    });
    if (filas.length) {
      const { error } = await supabase.from('estadisticas').upsert(filas, { onConflict: 'partido_id,jugador_id' });
      if (error) { avisoErrorSupabase(error, 'No se pudieron guardar las estadísticas'); return; }
    }
    // Limpieza: jugadores que ya no están en la lista vuelven a 0
    const { data: existentes } = await supabase.from('estadisticas')
      .select('jugador_id, goles, autogoles')
      .eq('partido_id', partidoId);
    if (existentes) {
      const enGoles = new Set(goleadores.map(g => g.jugador_id));
      const limpiezas = [];
      existentes.forEach(r => {
        const parche = {};
        if (((r.goles || 0) > 0 || (r.autogoles || 0) > 0) && !enGoles.has(r.jugador_id)) {
          parche.goles = 0;
          parche.autogoles = 0;
        }
        if (Object.keys(parche).length) {
          limpiezas.push(supabase.from('estadisticas').update(parche).eq('partido_id', partidoId).eq('jugador_id', r.jugador_id));
        }
      });
      if (limpiezas.length) {
        const resultados = await Promise.all(limpiezas);
        const fallidos = resultados.filter(r => r.error);
        if (fallidos.length) avisoErrorSupabase(fallidos[0].error, 'No se pudo limpiar una estadística');
      }
    }
  } catch (err) {
    avisoErrorSupabase(err, 'No se pudieron guardar las estadísticas');
  }
}

// Detecta UNA sola vez si la tabla "arbitraje_partidos" (con su
// columna jugador_id) existe y responde en la API. El pago del
// arbitraje ya queda respaldado en partidos.pago_local /
// pago_visitante / arbitraje_pagado, así que si la tabla no está
// disponible el detalle por jugador simplemente se omite SIN
// mostrar avisos ni bloquear el guardado del partido.
let soportaArbitrajePartidos = null;
async function arbitrajePartidosDisponible() {
  if (soportaArbitrajePartidos !== null) return soportaArbitrajePartidos;
  try {
    await supabase.from('arbitraje_partidos').select('jugador_id').limit(1);
    soportaArbitrajePartidos = true;
  } catch {
    soportaArbitrajePartidos = false;
  }
  return soportaArbitrajePartidos;
}

// Guarda el estado de pago del arbitraje. El respaldo principal es
// partidos.pago_local / pago_visitante / arbitraje_pagado (siempre
// disponibles y guardados junto al partido); el detalle por jugador
// de arbitraje_partidos se sincroniza si la tabla existe, pero sus
// errores JAMÁS bloquean el guardado del partido.
async function guardarArbitraje(partidoId) {
  const jugadores = jugadoresDelPartido();
  if (!jugadores.length) return;
  if (!(await arbitrajePartidosDisponible())) return;
  try {
    const filas = jugadores.map(j => ({
      partido_id: partidoId,
      jugador_id: j.id,
      pagado: !!arbitrajeEstado[j.id]
    }));
    const { error } = await supabase.from('arbitraje_partidos').upsert(filas, { onConflict: 'partido_id,jugador_id' });
    if (error) {
      // El pago ya quedó guardado en partidos: no es fatal ni se avisa.
    }
  } catch {
    // La tabla arbitraje_partidos puede no existir o tener RLS
    // cerrada: el pago ya quedó guardado en partidos, no es fatal.
  }
}

async function renderPartidos() {
  await cargarBase();
  resetFormPartido();
  $('par-local').innerHTML = opcionesSelect(state.equipos);
  $('par-visitante').innerHTML = opcionesSelect(state.equipos);
  const filtro = $('filtro-partidos');
  const filtroActual = filtro.value;
  // Opciones por jornada (orden numérico: Fecha 1, Fecha 2, ...) más una
  // agrupación para los partidos sin jornada (fase eliminatoria).
  const jornadas = [...new Set(state.partidos.map(p => p.jornada).filter(Boolean))].sort((a, b) => {
    const na = Number((String(a).match(/\d+/) || [9999])[0]);
    const nb = Number((String(b).match(/\d+/) || [9999])[0]);
    return na - nb;
  });
  const haySinJornada = state.partidos.some(p => !p.jornada);
  filtro.innerHTML = '<option value="">Todas</option>' +
    jornadas.map(j => `<option value="${esc(j)}">${esc(j)}</option>`).join('') +
    (haySinJornada ? '<option value="__sin_jornada__">Fase eliminatoria / Sin jornada</option>' : '');
  if (filtroActual) filtro.value = filtroActual;
  const lista = $('lista-partidos');
  const visibles = state.partidos.filter(p => {
    if (!filtroActual) return true;
    if (filtroActual === '__sin_jornada__') return !p.jornada;
    return p.jornada === filtroActual;
  });
  if (!visibles.length) {
    lista.innerHTML = '<p class="text-slate-500 text-sm">No hay partidos registrados.</p>';
    return;
  }
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  lista.innerHTML = visibles.map(p => `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center gap-3">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">${ETIQUETAS_FASE[p.fase] ?? p.fase}${p.jornada ? ` · ${esc(p.jornada)}` : ''} · ${fechaHoraLocal(p.fecha)}</p>
        <p class="text-sm font-semibold mt-0.5">
          ${esc(porId[p.equipo_local_id]?.nombre ?? 'Pendiente')} <span class="text-slate-500">vs</span> ${esc(porId[p.equipo_visitante_id]?.nombre ?? 'Pendiente')}
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span class="font-black ${p.jugado ? 'text-emerald-400' : 'text-slate-500'}">${p.jugado ? `${p.goles_local} - ${p.goles_visitante}` : 'Pendiente'}</span>
        ${estadoBadge(p.jugado ? 'FINALIZADO' : (p.estado || 'PENDIENTE'))}
        <button data-editar="${p.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700">✏️ Editar</button>
        <button data-eliminar="${p.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-rose-600/10 text-rose-400 hover:bg-rose-600/20">Eliminar</button>
      </div>
    </div>`).join('');
  lista.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarPartido(b.dataset.editar)));
  lista.querySelectorAll('[data-eliminar]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar este partido? Se borrarán sus estadísticas.'))) return;
    await supabase.from('partidos').delete().eq('id', b.dataset.eliminar);
    toast('Partido eliminado');
    renderPartidos();
  }));
}

$('filtro-partidos').addEventListener('change', renderPartidos);

async function editarPartido(id) {
  const p = state.partidos.find(x => x.id === id);
  $('par-id').value = p.id;
  $('par-fase').value = p.fase;
  $('par-jornada').value = p.jornada || '';
  $('par-fecha').value = fechaLocalDeISO(p.fecha);
  $('par-hora').value = horaDeFecha(p.fecha);
  $('par-sede').value = p.sede || 'SENA';
  const estado = p.jugado
    ? 'FINALIZADO'
    : (p.estado && ESTADOS_PARTIDO.includes(p.estado) ? p.estado : 'PENDIENTE');
  $('par-estado').value = estado;
  $('par-jugado').checked = estado === 'FINALIZADO';
  $('par-local').value = p.equipo_local_id || '';
  $('par-visitante').value = p.equipo_visitante_id || '';
  $('par-goles-local').value = p.goles_local ?? 0;
  $('par-goles-visitante').value = p.goles_visitante ?? 0;
  await cargarEstadisticasPartido(p.id);
  await cargarArbitraje(p.id);
  $('par-pago-local').checked = !!p.pago_local;
  $('par-pago-visitante').checked = !!p.pago_visitante;
  $('par-arbitraje-pagado').checked = !!p.arbitraje_pagado;
  actualizarEtiquetasCuotas();
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
  $('btn-cancelar-partido').classList.remove('hidden');
}

$('form-partido').addEventListener('submit', async e => {
  e.preventDefault();
  const btnGuardar = $('btn-guardar-partido');
  const id = $('par-id').value || null;
  const estado = $('par-estado').value;
  const jugado = estado === 'FINALIZADO';
  const localId = $('par-local').value || null;
  const visitanteId = $('par-visitante').value || null;
  if (localId && localId === visitanteId) {
    toast('Un equipo no puede jugar contra sí mismo', 'error');
    return;
  }
  // Control anti-duplicados: un mismo partido (equipos + fase + jornada)
  // no se puede registrar dos veces para evitar doble puntuación.
  if (!id) {
    const { data: duplicado } = await supabase.from('partidos')
      .select('id')
      .eq('fase', $('par-fase').value)
      .eq('equipo_local_id', localId)
      .eq('equipo_visitante_id', visitanteId)
      .eq('jornada', $('par-jornada').value.trim() || null)
      .maybeSingle();
    if (duplicado) {
      toast('Este partido ya está registrado. Búscalo en la lista y edítalo allí.', 'error');
      return;
    }
  }
  const fechaVal = $('par-fecha').value;
  const horaVal = $('par-hora').value;
  const datos = {
    fase: $('par-fase').value,
    jornada: $('par-jornada').value.trim() || null,
    fecha: fechaVal ? new Date(`${fechaVal}T${horaVal || '12:00:00'}`).toISOString() : null,
    sede: $('par-sede').value.trim() || 'SENA',
    equipo_local_id: localId,
    equipo_visitante_id: visitanteId,
    goles_local: Number($('par-goles-local').value || 0),
    goles_visitante: Number($('par-goles-visitante').value || 0),
    estado,
    jugado,
    pago_local: $('par-pago-local').checked,
    pago_visitante: $('par-pago-visitante').checked,
    arbitraje_pagado: $('par-arbitraje-pagado').checked
  };
  if (jugado) {
    const gl = datos.goles_local, gv = datos.goles_visitante;
    datos.ganador_id = gl > gv ? datos.equipo_local_id : gv > gl ? datos.equipo_visitante_id : null;
  } else {
    datos.ganador_id = null;
  }
  // Evita el doble envío accidental (doble clic = doble partido)
  btnGuardar.disabled = true;
  try {
    let partidoId = id;
    if (id) {
      const { error } = await supabase.from('partidos').update(datos).eq('id', id);
      if (error) { avisoErrorSupabase(error, 'No se pudo actualizar el partido'); return; }
    } else {
      const { data, error } = await supabase.from('partidos').insert(datos).select().single();
      if (error) {
        if (error.code === '23505') toast('Este partido ya está registrado (mismos equipos y jornada).', 'error');
        else avisoErrorSupabase(error, 'No se pudo registrar el partido');
        return;
      }
      partidoId = data.id;
    }
    // Las estadísticas (goles y autogoles) se calculan solas desde la
    // ficha del encuentro; si se desmarcó "jugado" se limpian para no
    // inflar el ranking. Cada petición está protegida por try/catch:
    // si Supabase rechaza los datos (ej. columna faltante), se avisa
    // con el error real en lugar de fallar en silencio.
    await guardarEstadisticas(partidoId, jugado);
    await guardarArbitraje(partidoId);
    toast(id ? 'Partido actualizado' : 'Partido registrado');
    resetFormPartido();
    renderPartidos();
    // Sincronización local inmediata: recarga el ranking de
    // estadísticas del panel. La vista pública se entera sola vía
    // Realtime (js/public.js) o con su refresco periódico.
    renderEstadisticas();
  } catch (err) {
    avisoErrorSupabase(err, 'No se pudo guardar el partido');
  } finally {
    btnGuardar.disabled = false;
  }
});

$('btn-cancelar-partido').addEventListener('click', resetFormPartido);

$('btn-agregar-gol').addEventListener('click', () => {
  const jid = $('gol-jugador').value;
  const n = Number($('gol-cantidad').value || 1);
  const autogol = $('gol-autogol').checked;
  if (!jid) { toast('Selecciona un jugador', 'error'); return; }
  const idx = goleadoresSel.findIndex(g => g.jugador_id === jid);
  if (idx >= 0) {
    if (autogol) goleadoresSel[idx].autogoles += n;
    else goleadoresSel[idx].goles += n;
  } else {
    goleadoresSel.push({ jugador_id: jid, goles: autogol ? 0 : n, autogoles: autogol ? n : 0 });
  }
  sumarGolesMarcador(jid, autogol, n);
  $('gol-cantidad').value = 1;
  $('gol-autogol').checked = false;
  actualizarGoleadores();
});

$('par-local').addEventListener('change', equiposCambiados);
$('par-visitante').addEventListener('change', equiposCambiados);

// Estado del partido y casilla "jugado" se mantienen sincronizados:
// FINALIZADO => partido jugado; cualquier otro estado => no jugado.
$('par-estado').addEventListener('change', () => {
  $('par-jugado').checked = $('par-estado').value === 'FINALIZADO';
});
$('par-jugado').addEventListener('change', () => {
  $('par-estado').value = $('par-jugado').checked ? 'FINALIZADO' : 'PENDIENTE';
});

// ============================================================
// TODOS CONTRA TODOS (FIXTURE AUTOMÁTICO - ROUND ROBIN)
// ============================================================
const DESCANS = { id: null, nombre: 'DESCANSA' };
let fixtureActual = null;

// Algoritmo Round-Robin (método de la circunferencia): genera las
// jornadas de ida y vuelta de todos contra todos. Con un número par
// de equipos cada banda juega en su fecha; si son impares se agrega
// el comodín "DESCANSA" para que nadie quede sin rival.
function generarRoundRobin(equipos) {
  let lista = equipos.map(e => ({ ...e }));
  if (lista.length % 2 === 1) lista.push(DESCANS);
  const n = lista.length;
  const jornadas = [];
  for (let r = 0; r < n - 1; r++) {
    const partidos = [];
    for (let i = 0; i < n / 2; i++) {
      partidos.push({ local: lista[i], visitante: lista[n - 1 - i] });
    }
    jornadas.push({ partidos });
    // Rotación clásica: fija al primero y rota el resto
    const fijo = lista[0];
    const rotados = lista.slice(1);
    rotados.unshift(rotados.pop());
    lista = [fijo, ...rotados];
  }
  return jornadas;
}

function actualizarBtnGuardar(activo) {
  $('btn-guardar-fixture').classList.toggle('btn-desactivado', !activo);
  $('btn-guardar-fixture').disabled = !activo;
}

async function renderFixture() {
  await cargarBase();
  const total = state.equipos.length;
  const fechas = total >= 2 ? (total % 2 === 1 ? total : total - 1) : 0;
  const partidos = total >= 2 ? (total * (total - 1)) / 2 : 0;
  $('info-fixture').textContent = total >= 2
    ? `${total} equipos · ${fechas} fechas · ${partidos} partidos${total % 2 === 1 ? ' · un equipo descansa por jornada' : ''}`
    : 'Registra al menos 2 equipos para generar el calendario.';
  // Si cambiaron los equipos, el fixture pendiente queda obsoleto
  if (fixtureActual && fixtureActual.nEquipos !== total) fixtureActual = null;
  if (!fixtureActual) {
    $('fixture-preview').innerHTML = '<p class="text-slate-500 text-sm">Aún no hay calendario generado. Pulsa "Generar Calendario Todos contra Todos".</p>';
    actualizarBtnGuardar(false);
    return;
  }
  pintarFixture();
}

$('btn-generar-fixture').addEventListener('click', () => {
  if (state.equipos.length < 2) { toast('Se necesitan al menos 2 equipos para generar el fixture', 'error'); return; }
  fixtureActual = {
    nEquipos: state.equipos.length,
    jornadas: generarRoundRobin(state.equipos)
  };
  pintarFixture();
  toast(`Calendario generado: ${fixtureActual.jornadas.length} fechas`);
});

function pintarFixture() {
  const caja = $('fixture-preview');
  const fila = (equipo) => `
    <span class="flex items-center gap-2 min-w-0">${escudo(equipo, 'w-6 h-6')}<span class="font-semibold text-sm truncate">${esc(equipo.nombre)}</span></span>`;
  const opcionesMovimiento = (actual) => `
    <option value="">—</option>` + fixtureActual.jornadas
      .map((_, f) => f === actual ? '' : `<option value="${f}">Fecha ${f + 1}</option>`)
      .join('');
  const partidoCard = (p, i, k) => `
    <div class="rounded-lg bg-slate-950/60 border border-slate-700/60 px-3 py-2">
      <div class="flex items-center gap-1.5">
        <div class="flex items-center justify-between gap-2 flex-1 min-w-0">
          ${fila(p.local)}
          <span class="text-xs font-black text-slate-500 shrink-0 whitespace-nowrap">vs</span>
          ${fila(p.visitante)}
        </div>
        <button type="button" data-intercambiar="${i}-${k}" title="Intercambiar localía" class="text-sm text-slate-400 hover:text-gold px-1.5 py-1 rounded-md border border-transparent hover:border-yellow-500/50 transition shrink-0">⟳</button>
        <button type="button" data-editar-fixture="${i}-${k}" title="Editar partido" class="text-sm text-slate-400 hover:text-gold px-1.5 py-1 rounded-md border border-transparent hover:border-yellow-500/50 transition shrink-0">✏️</button>
        <button type="button" data-quitar-partido="${i}-${k}" title="Eliminar de la fecha" class="text-sm text-rose-400/80 hover:text-rose-400 px-1.5 py-1 rounded-md border border-transparent hover:border-rose-500/50 transition shrink-0">🗑️</button>
      </div>
      <div class="mt-1.5 pl-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <span>📍 ${esc(p.sede || 'SENA')}</span>
        ${estadoBadge(p.estado || 'PENDIENTE')}
        <label class="ml-auto flex items-center gap-1 cursor-pointer">
          <span class="uppercase tracking-wider font-bold shrink-0">Mover a</span>
          <select data-mover-partido="${i}-${k}" title="Mover partido a otra fecha" class="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300">
            ${opcionesMovimiento(i)}
          </select>
        </label>
      </div>
    </div>`;
  const totalFechas = fixtureActual.jornadas.length;
  caja.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${fixtureActual.jornadas.map((j, i) => {
        const reales = j.partidos.filter(p => p.local?.id && p.visitante?.id).length;
        const descansa = j.partidos.length - reales;
        return `
        <div class="rounded-xl border bg-slate-900/60 overflow-hidden">
          <div class="px-4 py-3 border-b border-yellow-500/30">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-gold font-black uppercase tracking-wider text-sm">📅 Fecha ${i + 1}</p>
              <div class="flex items-center gap-1.5">
                <button type="button" data-fecha-arriba="${i}" ${i === 0 ? 'disabled' : ''} title="Mover arriba" class="w-8 h-8 grid place-items-center rounded-lg border border-yellow-500/40 text-gold hover:bg-yellow-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">⬆️</button>
                <button type="button" data-fecha-abajo="${i}" ${i === totalFechas - 1 ? 'disabled' : ''} title="Mover abajo" class="w-8 h-8 grid place-items-center rounded-lg border border-yellow-500/40 text-gold hover:bg-yellow-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">⬇️</button>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="text-xs text-slate-500">${reales} partido${reales !== 1 ? 's' : ''}${descansa ? ' · 1 descansa' : ''}</span>
              <button type="button" data-agregar-partido="${i}" title="Agregar enfrentamiento manual a esta fecha" class="ml-auto text-[10px] px-2.5 py-1 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold whitespace-nowrap transition">➕ Agregar partido</button>
            </div>
          </div>
          <div class="p-3 space-y-2">
            ${j.partidos.map((p, k) => {
              if (!p.local?.id || !p.visitante?.id) {
                const activo = p.local?.id ? p.local : p.visitante;
                return `
                <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 border border-slate-700/60 px-3 py-2">
                  ${fila(activo)}
                  <span class="descansa-chip">Descansa</span>
                </div>`;
              }
              return partidoCard(p, i, k);
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  caja.querySelectorAll('[data-editar-fixture]').forEach(b => b.addEventListener('click', () => {
    const [i, k] = b.dataset.editarFixture.split('-').map(Number);
    abrirModalPartidoFixture(i, k);
  }));
  caja.querySelectorAll('[data-intercambiar]').forEach(b => b.addEventListener('click', () => {
    const [i, k] = b.dataset.intercambiar.split('-').map(Number);
    intercambiarLocalia(i, k);
  }));
  caja.querySelectorAll('[data-quitar-partido]').forEach(b => b.addEventListener('click', async () => {
    const [i, k] = b.dataset.quitarPartido.split('-').map(Number);
    await quitarPartidoFixture(i, k);
  }));
  caja.querySelectorAll('[data-mover-partido]').forEach(sel => sel.addEventListener('change', () => {
    const [i, k] = sel.dataset.moverPartido.split('-').map(Number);
    const destino = Number(sel.value);
    sel.value = '';
    if (Number.isInteger(destino) && destino !== i) moverPartido(i, k, destino);
  }));
  caja.querySelectorAll('[data-fecha-arriba]').forEach(b => b.addEventListener('click', () => {
    moverFecha(Number(b.dataset.fechaArriba), -1);
  }));
  caja.querySelectorAll('[data-fecha-abajo]').forEach(b => b.addEventListener('click', () => {
    moverFecha(Number(b.dataset.fechaAbajo), 1);
  }));
  caja.querySelectorAll('[data-agregar-partido]').forEach(b => b.addEventListener('click', () => {
    abrirModalPartidoManual(Number(b.dataset.agregarPartido));
  }));
  const publicados = fixtureActual.guardado || 0;
  $('btn-guardar-fixture').textContent = publicados
    ? `Guardar y Publicar Fixture · ${publicados} publicado${publicados !== 1 ? 's' : ''}`
    : 'Guardar y Publicar Fixture';
  actualizarBtnGuardar(true);
}

// Intercambia la posición de dos jornadas enteras: todos los partidos
// de la fecha "i" pasan a la posición de la fecha "j" (y viceversa).
// Al repintar, cada partido toma automáticamente el número de su nueva
// fecha, y si el fixture ya estaba publicado se sincroniza Supabase.
async function moverFecha(i, dir) {
  const j = i + dir;
  if (!fixtureActual || j < 0 || j >= fixtureActual.jornadas.length) return;
  [fixtureActual.jornadas[i], fixtureActual.jornadas[j]] = [fixtureActual.jornadas[j], fixtureActual.jornadas[i]];
  pintarFixture();
  if (fixtureActual.guardado) {
    await sincronizarFixturePublicado();
    toast(`La Fecha ${i + 1} y la Fecha ${j + 1} intercambiaron posición (publicado)`);
  } else {
    toast(`La Fecha ${i + 1} y la Fecha ${j + 1} intercambiaron posición`);
  }
}

// Mueve un partido individual hacia otra jornada, conservando el
// enfrentamiento tal cual (local y visitante).
async function moverPartido(i, k, destino) {
  const [partido] = fixtureActual.jornadas[i].partidos.splice(k, 1);
  if (!partido) return;
  fixtureActual.jornadas[destino].partidos.push(partido);
  pintarFixture();
  if (fixtureActual.guardado) {
    await sincronizarFixturePublicado();
    toast(`Partido movido a la Fecha ${destino + 1} (publicado)`);
  } else {
    toast(`Partido movido a la Fecha ${destino + 1}`);
  }
}

// Invierte rápidamente la localía del partido: Local ↔ Visitante.
async function intercambiarLocalia(i, k) {
  const partido = fixtureActual.jornadas[i]?.partidos[k];
  if (!partido?.local?.id || !partido?.visitante?.id) return;
  [partido.local, partido.visitante] = [partido.visitante, partido.local];
  pintarFixture();
  if (fixtureActual.guardado) {
    await sincronizarFixturePublicado();
    toast('Localía intercambiada (publicado)');
  } else {
    toast('Localía intercambiada');
  }
}

// Elimina un partido de la jornada; si el fixture ya está publicado,
// la sincronización retira también el registro de la base de datos.
async function quitarPartidoFixture(i, k) {
  const partido = fixtureActual.jornadas[i]?.partidos[k];
  if (!partido) return;
  if (!(await confirmar(`¿Eliminar ${partido.local?.nombre ?? '…'} vs ${partido.visitante?.nombre ?? '…'} de la Fecha ${i + 1}?`))) return;
  fixtureActual.jornadas[i].partidos.splice(k, 1);
  pintarFixture();
  if (fixtureActual.guardado) {
    await sincronizarFixturePublicado();
    toast('Partido eliminado de la fecha (publicado)');
  } else {
    toast('Partido eliminado de la fecha');
  }
}

$('btn-guardar-fixture').addEventListener('click', async () => {
  if (!fixtureActual) { toast('Primero genera el calendario', 'error'); return; }
  const filas = fixtureActual.jornadas.flatMap((j, i) =>
    j.partidos
      .filter(p => p.local?.id && p.visitante?.id)
      .map(p => ({
        fase: 'grupos',
        jornada: `Fecha ${i + 1}`,
        fecha: p.fecha || null,
        estado: p.estado || 'PENDIENTE',
        equipo_local_id: p.local.id,
        equipo_visitante_id: p.visitante.id,
        goles_local: 0,
        goles_visitante: 0,
        jugado: false,
        sede: 'SENA'
      }))
  );
  if (!filas.length) { toast('No hay partidos para guardar', 'error'); return; }
  const msg = fixtureActual.guardado
    ? `Ya hay ${fixtureActual.guardado} partidos de liga publicados. Al guardar se reemplazarán por los ${filas.length} nuevos. ¿Continuar?`
    : `Se publicarán ${filas.length} partidos de la fase "Todos contra Todos" (${fixtureActual.jornadas.length} fechas) y aparecerán en la vista pública. ¿Continuar?`;
  if (!(await confirmar(msg, 'Guardar y publicar fixture'))) return;
  // Reemplaza únicamente los partidos de liga generados por el fixture
  const { error } = await supabase.from('partidos')
    .delete()
    .or('fase.eq.grupos,jornada.not.is.null');
  if (error) { toast('Error al limpiar el fixture anterior: ' + error.message, 'error'); return; }
  const { error: errInsert } = await supabase.from('partidos').insert(filas);
  if (errInsert) { toast('Error al guardar el fixture: ' + errInsert.message, 'error'); return; }
  fixtureActual.guardado = filas.length;
  toast(`Fixture publicado: ${filas.length} partidos en ${fixtureActual.jornadas.length} fechas`);
  pintarFixture();
});

// ============================================================
// EDICIÓN DE PARTIDOS / FECHAS DEL FIXTURE (modales)
// Antes de publicar actúan sobre el estado local (fixtureActual);
// si el fixture ya se publicó, además sincronizan Supabase para
// reflejar los cambios de inmediato en la vista pública.
// ============================================================

function abrirModalFixture(titulo, cuerpoHtml, onsubmit) {
  $('modal-fixture-titulo').textContent = titulo;
  const form = $('modal-fixture-form');
  form.innerHTML = cuerpoHtml;
  form.onsubmit = e => { e.preventDefault(); onsubmit(); };
  $('modal-fixture').classList.remove('hidden');
  $('modal-fixture').classList.add('flex');
  $('mx-cancelar')?.addEventListener('click', cerrarModalFixture);
}

function cerrarModalFixture() {
  const m = $('modal-fixture');
  m.classList.add('hidden');
  m.classList.remove('flex');
}

$('modal-fixture-cerrar').addEventListener('click', cerrarModalFixture);
$('modal-fixture').addEventListener('click', e => {
  if (e.target === $('modal-fixture')) cerrarModalFixture();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModalFixture();
});

function opcionesEquipos(seleccionado) {
  return '<option value="">Seleccionar…</option>' + state.equipos.map(e =>
    `<option value="${e.id}" ${e.id === seleccionado ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('');
}

const campoFixture = (label, id, inner, extraCls = '') => `
  <div class="${extraCls}">
    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">${label}</label>
    ${inner}
  </div>`;

function abrirModalPartidoFixture(i, k) {
  const partido = fixtureActual.jornadas[i].partidos[k];
  if (!partido.local?.id || !partido.visitante?.id) return;
  abrirModalFixture(`✏️ Partido · Fecha ${i + 1}`, `
    ${campoFixture('Equipo Local', 'mx-local', `<select id="mx-local" class="campo w-full">${opcionesEquipos(partido.local.id)}</select>`)}
    ${campoFixture('Equipo Visitante', 'mx-visitante', `<select id="mx-visitante" class="campo w-full">${opcionesEquipos(partido.visitante.id)}</select>`)}
    ${campoFixture('Estado del partido', 'mx-estado', `
      <select id="mx-estado" class="campo w-full">
        ${ESTADOS_PARTIDO.map(e => `<option value="${e}" ${(partido.estado || 'PENDIENTE') === e ? 'selected' : ''}>${e}</option>`).join('')}
      </select>`)}
    <div class="flex items-center justify-end gap-2 pt-2">
      <button type="button" id="mx-cancelar" class="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">Cancelar</button>
      <button type="submit" class="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-sm">Guardar cambios</button>
    </div>`, async () => {
    const localId = $('mx-local').value;
    const visitId = $('mx-visitante').value;
    if (!localId || !visitId) { toast('Selecciona ambos equipos', 'error'); return; }
    if (localId === visitId) { toast('Un equipo no puede jugar contra sí mismo', 'error'); return; }
    fixtureActual.jornadas[i].partidos[k] = {
      ...partido,
      local: state.equipos.find(e => e.id === localId),
      visitante: state.equipos.find(e => e.id === visitId),
      estado: $('mx-estado').value
    };
    cerrarModalFixture();
    pintarFixture();
    if (fixtureActual.guardado) {
      await sincronizarFixturePublicado();
      toast('Partido actualizado (publicado)');
    } else {
      toast('Partido actualizado');
    }
  });
}

// Agrega un enfrentamiento manual a la jornada indicada (por ejemplo
// para sustituir un descanso o un partido eliminado).
function abrirModalPartidoManual(i) {
  abrirModalFixture(`➕ Partido manual · Fecha ${i + 1}`, `
    <p class="text-xs text-slate-400">Agrega un enfrentamiento adicional a esta fecha. Se publicará con el resto del fixture.</p>
    ${campoFixture('Equipo Local', 'mx-local', `<select id="mx-local" class="campo w-full">${opcionesEquipos('')}</select>`)}
    ${campoFixture('Equipo Visitante', 'mx-visitante', `<select id="mx-visitante" class="campo w-full">${opcionesEquipos('')}</select>`)}
    <div class="flex items-center justify-end gap-2 pt-2">
      <button type="button" id="mx-cancelar" class="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">Cancelar</button>
      <button type="submit" class="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-sm">Agregar partido</button>
    </div>`, async () => {
    const localId = $('mx-local').value;
    const visitId = $('mx-visitante').value;
    if (!localId || !visitId) { toast('Selecciona ambos equipos', 'error'); return; }
    if (localId === visitId) { toast('Un equipo no puede jugar contra sí mismo', 'error'); return; }
    fixtureActual.jornadas[i].partidos.push({
      local: state.equipos.find(e => e.id === localId),
      visitante: state.equipos.find(e => e.id === visitId),
      fecha: null,
      estado: 'PENDIENTE',
      sede: 'SENA'
    });
    cerrarModalFixture();
    pintarFixture();
    if (fixtureActual.guardado) {
      await sincronizarFixturePublicado();
      toast('Partido agregado a la fecha (publicado)');
    } else {
      toast('Partido agregado a la fecha');
    }
  });
}

// Si el fixture ya fue publicado, replica en Supabase el estado local
// para que la vista pública refleje de inmediato cualquier cambio:
// reordenamiento de fechas, movimientos de partidos, localías, altas y
// bajas. Empareja cada partido local con su registro buscándolo por
// pares de equipos en TODAS las jornadas (no solo en la suya), porque
// al intercambiar fechas los partidos cambian de número de jornada.
async function sincronizarFixturePublicado() {
  if (!fixtureActual?.guardado) return;
  const { data } = await supabase.from('partidos').select('*').eq('fase', 'grupos').not('jornada', 'is', null);
  const restantes = (data || []).slice();
  const operaciones = [];
  const llave = p => [p.equipo_local_id, p.equipo_visitante_id].sort().join('-');
  fixtureActual.jornadas.forEach((j, i) => {
    const jornada = `Fecha ${i + 1}`;
    j.partidos.filter(p => p.local?.id && p.visitante?.id).forEach(p => {
      const idx = restantes.findIndex(d => llave(d) === llave(p));
      const d = idx >= 0 ? restantes.splice(idx, 1)[0] : restantes.shift();
      const datos = {
        equipo_local_id: p.local.id,
        equipo_visitante_id: p.visitante.id,
        fecha: p.fecha || null,
        estado: p.estado || 'PENDIENTE',
        jornada
      };
      if (d) {
        operaciones.push(supabase.from('partidos').update(datos).eq('id', d.id));
      } else {
        operaciones.push(supabase.from('partidos').insert({ ...datos, fase: 'grupos', goles_local: 0, goles_visitante: 0, jugado: false, ganador_id: null, sede: 'SENA' }));
      }
    });
  });
  // Los registros que quedaron sin correspondencia (partidos eliminados
  // en la vista previa o de un fixture anterior) se retiran.
  restantes.forEach(d => operaciones.push(supabase.from('partidos').delete().eq('id', d.id)));
  if (operaciones.length) {
    const resultados = await Promise.all(operaciones);
    if (resultados.some(r => r.error)) toast('No se pudieron sincronizar todos los cambios', 'error');
  }
}

// ============================================================
// ELIMINATORIA
// Formato del torneo:
//   1º y 2º -> directos a Semifinales (SF1 y SF2)
//   3º-6º   -> Cuartos de Final (3º vs 6º y 4º vs 5º)
//   7º      -> eliminado
// ============================================================
let elimArmado = null;

async function renderEliminatoria() {
  await cargarBase();
  const opciones = opcionesSelect(state.equipos, '', 'Elige equipo…');
  for (let i = 1; i <= 6; i++) $(`elim-pos${i}`).innerHTML = opciones;
  if (elimArmado) {
    // Mantiene la selección previa del administrador
    for (let i = 1; i <= 6; i++) $(`elim-pos${i}`).value = elimArmado[`pos${i}`] || '';
  } else {
    // Pre-carga con la tabla de posiciones actual como punto de partida
    const { data: tabla } = await supabase.from('tabla_posiciones').select('*');
    const orden = (tabla || [])
      .sort((a, b) => b.puntos - a.puntos || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));
    orden.slice(0, 6).forEach((f, i) => { $(`elim-pos${i + 1}`).value = f.equipo_id || ''; });
  }
  actualizarBtnGuardarElim();
  pintarElimPreview();

  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  const conEquipos = state.partidos.map(p => ({ ...p, equipo_local: porId[p.equipo_local_id] || null, equipo_visitante: porId[p.equipo_visitante_id] || null }));
  renderBracket($('bracket-admin'), conEquipos, {
    editable: true,
    equipos: state.equipos,
    onSave: guardarEliminatoria
  });
}

function actualizarBtnGuardarElim() {
  const activo = !!elimArmado;
  $('btn-guardar-eliminatorias').classList.toggle('btn-desactivado', !activo);
  $('btn-guardar-eliminatorias').disabled = !activo;
  $('btn-guardar-eliminatorias').textContent = activo && elimArmado.guardado
    ? 'Guardar y Publicar Eliminatorias · Actualizada'
    : 'Guardar y Publicar Eliminatorias';
}

$('btn-armar-cuartos').addEventListener('click', () => {
  const pos = {};
  for (let i = 1; i <= 6; i++) pos[i] = $(`elim-pos${i}`).value;
  const faltantes = [1, 2, 3, 4, 5, 6].filter(n => !pos[n]);
  if (faltantes.length) {
    toast(`Faltan equipos en la posición ${faltantes[0]}${faltantes.length > 1 ? ` y ${faltantes.length - 1} más` : ''}`, 'error');
    return;
  }
  if (new Set(Object.values(pos)).size !== 6) {
    toast('Cada equipo debe ocupar una sola posición', 'error');
    return;
  }
  elimArmado = {
    pos1: pos[1], pos2: pos[2], pos3: pos[3], pos4: pos[4], pos5: pos[5], pos6: pos[6],
    cuartos: [
      { fase: 'cuartos', posicion_bracket: 1, local: pos[3], visitante: pos[6] },
      { fase: 'cuartos', posicion_bracket: 2, local: pos[4], visitante: pos[5] }
    ],
    semifinales: [
      // El directo (1º/2º) queda a la espera del ganador de su cuartos
      { fase: 'semifinal', posicion_bracket: 1, local: pos[1], visitante: null },
      { fase: 'semifinal', posicion_bracket: 2, local: pos[2], visitante: null }
    ],
    guardado: false
  };
  actualizarBtnGuardarElim();
  pintarElimPreview();
  toast('Cruces de cuartos armados. Revisa y publica.');
});

function pintarElimPreview() {
  const caja = $('elim-preview');
  if (!elimArmado) { caja.innerHTML = ''; return; }
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  const eq = id => porId[id] || null;
  const filaEquipo = (t) => t
    ? `<span class="flex items-center gap-2 min-w-0">${escudo(t, 'w-6 h-6')}<span class="font-semibold text-sm truncate">${esc(t.nombre)}</span></span>`
    : '<span class="text-xs text-slate-500 italic shrink-0">Ganador por definir</span>';
  const cruce = (titulo, local, visitante) => `
    <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 border border-slate-700/60 px-3 py-2">
      <span class="text-11 uppercase tracking-wider text-slate-500 font-bold shrink-0 w-10">${titulo}</span>
      ${filaEquipo(local)}
      <span class="text-xs font-black text-slate-500 shrink-0 whitespace-nowrap">vs</span>
      ${filaEquipo(visitante)}
    </div>`;
  const [c1, c2] = elimArmado.cuartos;
  const [s1, s2] = elimArmado.semifinales;
  caja.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border bg-slate-900/60 overflow-hidden">
        <div class="px-4 py-3 border-b border-yellow-500/30 flex items-center justify-between gap-2">
          <p class="text-gold font-black uppercase tracking-wider text-sm">⚔️ Cuartos de Final</p>
          <span class="text-xs text-slate-500 whitespace-nowrap">2 cruces</span>
        </div>
        <div class="p-3 space-y-2">
          ${cruce('3º vs 6º', eq(c1.local), eq(c1.visitante))}
          ${cruce('4º vs 5º', eq(c2.local), eq(c2.visitante))}
        </div>
      </div>
      <div class="rounded-xl border bg-slate-900/60 overflow-hidden">
        <div class="px-4 py-3 border-b border-yellow-500/30 flex items-center justify-between gap-2">
          <p class="text-gold font-black uppercase tracking-wider text-sm">⭐ Semifinales</p>
          <span class="text-xs text-slate-500 whitespace-nowrap">1º y 2º esperan</span>
        </div>
        <div class="p-3 space-y-2">
          ${cruce('SF 1', eq(s1.local), eq(s1.visitante))}
          ${cruce('SF 2', eq(s2.local), eq(s2.visitante))}
        </div>
      </div>
    </div>`;
}

async function guardarEliminatorias() {
  if (!elimArmado) { toast('Primero arma los cuartos de final', 'error'); return; }
  const msg = elimArmado.guardado
    ? 'Ya hay eliminatorias publicadas. Al guardar se reemplazarán por la nueva configuración. ¿Continuar?'
    : 'Se publicarán 2 cruces de Cuartos de Final y las llaves de Semifinales con el 1º y 2º a la espera de sus rivales. ¿Continuar?';
  if (!(await confirmar(msg, 'Guardar y publicar eliminatorias'))) return;
  const { error } = await supabase.from('partidos').delete().or('fase.neq.grupos,fase.is.null');
  if (error) { toast('Error al limpiar eliminatorias: ' + error.message, 'error'); return; }
  const base = { goles_local: 0, goles_visitante: 0, jugado: false, ganador_id: null, sede: 'SENA', estado: 'PENDIENTE' };
  const filas = [
    ...elimArmado.cuartos.map(c => ({ fase: c.fase, posicion_bracket: c.posicion_bracket, equipo_local_id: c.local, equipo_visitante_id: c.visitante, ...base })),
    ...elimArmado.semifinales.map(s => ({ fase: s.fase, posicion_bracket: s.posicion_bracket, equipo_local_id: s.local, equipo_visitante_id: s.visitante, ...base })),
    { fase: 'final', posicion_bracket: 1, equipo_local_id: null, equipo_visitante_id: null, ...base },
    { fase: 'tercer_lugar', posicion_bracket: 1, equipo_local_id: null, equipo_visitante_id: null, ...base }
  ];
  const { error: errInsert } = await supabase.from('partidos').insert(filas);
  if (errInsert) { toast('Error al publicar eliminatorias: ' + errInsert.message, 'error'); return; }
  elimArmado.guardado = true;
  toast('Eliminatorias publicadas: 2 cuartos + 2 semifinales');
  renderEliminatoria();
}

$('btn-guardar-eliminatorias').addEventListener('click', guardarEliminatorias);

async function guardarEliminatoria(id, datos) {
  if (datos.equipo_local_id && datos.equipo_local_id === datos.equipo_visitante_id) {
    toast('Un equipo no puede jugar contra sí mismo', 'error');
    return;
  }
  const { data: partido, error } = await supabase.from('partidos').update(datos).eq('id', id).select().single();
  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  if (!datos.jugado || !datos.equipo_local_id || !datos.equipo_visitante_id) {
    toast('Cuadro actualizado');
    renderEliminatoria();
    return;
  }
  const gl = datos.goles_local, gv = datos.goles_visitante;
  const ganador = gl > gv ? datos.equipo_local_id : gv > gl ? datos.equipo_visitante_id : null;
  const perdedor = ganador === datos.equipo_local_id ? datos.equipo_visitante_id : ganador === datos.equipo_visitante_id ? datos.equipo_local_id : null;
  if (!ganador) { toast('Empate: no se puede avanzar en eliminatoria. Define un ganador.', 'error'); return; }
  await supabase.from('partidos').update({ ganador_id: ganador }).eq('id', id);

  // Cuartos: el ganador espera en la llave de su semifinal (visitante,
  // pues el 1º/2º ya ocupa el local)
  if (partido.fase === 'cuartos') {
    const { data: sig } = await supabase.from('partidos').select('*').eq('fase', 'semifinal').eq('posicion_bracket', partido.posicion_bracket);
    if (sig?.length) {
      await supabase.from('partidos').update({ equipo_visitante_id: ganador }).eq('id', sig[0].id);
    }
    toast('Resultado guardado: el ganador avanza a su semifinal');
    renderEliminatoria();
    return;
  }

  const idx = ORDEN_ELIMINATORIA.indexOf(partido.fase);
  if (idx >= 0 && idx + 1 < ORDEN_ELIMINATORIA.length) {
    const sigFase = ORDEN_ELIMINATORIA[idx + 1];
    const posSig = Math.ceil(partido.posicion_bracket / 2);
    const { data: sig } = await supabase.from('partidos').select('*').eq('fase', sigFase).eq('posicion_bracket', posSig);
    if (sig?.length) {
      const campo = partido.posicion_bracket % 2 === 1 ? 'equipo_local_id' : 'equipo_visitante_id';
      await supabase.from('partidos').update({ [campo]: ganador }).eq('id', sig[0].id);
    }
  }
  if (partido.fase === 'semifinal' && perdedor) {
    await actualizarTercerLugar();
  }
  toast('Resultado guardado y avance actualizado automáticamente');
  renderEliminatoria();
}

async function actualizarTercerLugar() {
  const { data: semis } = await supabase.from('partidos').select('*').eq('fase', 'semifinal').eq('jugado', true);
  const perdedores = [];
  (semis || []).forEach(s => {
    const ganador = s.goles_local > s.goles_visitante ? s.equipo_local_id : s.goles_visitante > s.goles_local ? s.equipo_visitante_id : null;
    const perdedor = ganador === s.equipo_local_id ? s.equipo_visitante_id : ganador === s.equipo_visitante_id ? s.equipo_local_id : null;
    if (perdedor) perdedores.push(perdedor);
  });
  if (perdedores.length === 2) {
    const { data: tercer } = await supabase.from('partidos').select('*').eq('fase', 'tercer_lugar').limit(1);
    if (tercer?.length) {
      await supabase.from('partidos').update({ equipo_local_id: perdedores[0], equipo_visitante_id: perdedores[1] }).eq('id', tercer[0].id);
    }
  }
}

// ============================================================
// ESTADISTICAS AUTOMATICAS DEL TORNEO
// Ranking calculado en el cliente con la MISMA lógica de la vista
// pública: suma goles registrados en la ficha de cada partido
// FINALIZADO (jugado o estado 'FINALIZADO'). Los autogoles viven en
// su columna y nunca suman al jugador. No hay ingreso manual: los
// datos vienen del formulario de partidos.
// ============================================================
const partidoTerminado = p => !!p.jugado || p.estado === 'FINALIZADO';

async function renderEstadisticas() {
  await cargarBase();
  const { data: stats } = await supabase.from('estadisticas').select('*');
  const terminados = new Set(state.partidos.filter(partidoTerminado).map(p => p.id));
  const porJugador = {};
  (stats || []).forEach(s => {
    if (!terminados.has(s.partido_id)) return;
    const fila = porJugador[s.jugador_id] ||= { goles: 0, autogoles: 0 };
    fila.goles += s.goles || 0;
    fila.autogoles += s.autogoles || 0;
  });
  const infoJugador = Object.fromEntries(state.jugadores.map(j => [j.id, j]));
  const infoEquipo = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  const ranking = Object.entries(porJugador).map(([jugadorId, f]) => {
    const j = infoJugador[jugadorId];
    return {
      jugador: j?.nombre || 'Jugador',
      numero: j?.numero,
      equipo: (j && infoEquipo[j.equipo_id]?.nombre) || '',
      goles: f.goles,
      autogoles: f.autogoles
    };
  }).filter(j => j.goles > 0)
    .sort((a, b) => b.goles - a.goles || a.jugador.localeCompare(b.jugador));

  const totalGoles = ranking.reduce((a, j) => a + j.goles, 0);
  $('est-totales').innerHTML = `
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-emerald-400">${totalGoles}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">⚽ Goles totales del torneo</p>
    </div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
      <p class="text-3xl font-black text-gold">${ranking.length}</p>
      <p class="text-slate-500 text-xs uppercase tracking-wider mt-1">Jugadores con registro</p>
    </div>`;

  $('tabla-ranking').innerHTML = ranking.map(j => `
      <tr class="border-b border-slate-800/50">
        <td class="px-3 py-2.5 font-semibold">${esc(j.jugador)} ${j.numero ? `<span class="text-slate-500 text-xs">#${j.numero}</span>` : ''}</td>
        <td class="px-3 py-2.5 text-slate-400">${esc(j.equipo)}</td>
        <td class="px-3 py-2.5 text-center font-bold text-emerald-400">${j.goles}</td>
      </tr>`).join('') || `
      <tr>
        <td colspan="3" class="px-3 py-10">
          <div class="empty-estado">
            <span class="empty-icono">⚽</span>
            <p class="empty-titulo">Aún no hay goles registrados</p>
            <p class="empty-sub">El ranking se llena automáticamente al guardar un partido con goleadores.</p>
          </div>
        </td>
      </tr>`;
}

// ============================================================
// REGLAS
// ============================================================
async function cargarReglas() {
  const { data } = await supabase.from('reglas').select('*').limit(1);
  const contenido = data?.[0]?.contenido || '';
  $('reglas-contenido').value = contenido;
  actualizarPreview();
}

$('reglas-contenido').addEventListener('input', actualizarPreview);

function actualizarPreview() {
  $('reglas-preview').innerHTML = marked.parse($('reglas-contenido').value || '*Sin contenido todavía.*');
}

$('btn-guardar-reglas').addEventListener('click', async () => {
  const contenido = $('reglas-contenido').value;
  const { data } = await supabase.from('reglas').select('*').limit(1);
  const { error } = data?.length
    ? await supabase.from('reglas').update({ contenido, actualizado_en: new Date().toISOString() }).eq('id', data[0].id)
    : await supabase.from('reglas').insert({ contenido });
  if (error) { toast('Error al guardar reglamento: ' + error.message, 'error'); return; }
  toast('Reglamento publicado');
});

// ============================================================
// GALERIA
// ============================================================
async function renderGaleriaAdmin() {
  await cargarBase();
  const porId = Object.fromEntries(state.partidos.map(p => [p.id, p]));
  const equipoId = Object.fromEntries(state.equipos.map(e => [e.id, e.nombre]));
  $('gal-partido').innerHTML = '<option value="">Ninguno</option>' + state.partidos
    .map(p => `<option value="${p.id}">${esc(equipoId[p.equipo_local_id] ?? '?')} vs ${esc(equipoId[p.equipo_visitante_id] ?? '?')} · ${ETIQUETAS_FASE[p.fase] ?? ''}</option>`)
    .join('');
  const { data } = await supabase.from('galeria').select('*').order('creado_en', { ascending: false });
  const items = data || [];
  const grid = $('galeria-admin');
  if (!items.length) {
    grid.innerHTML = '<p class="text-slate-500 text-sm col-span-full">Aún no hay archivos subidos.</p>';
    return;
  }
  grid.innerHTML = items.map(i => `
    <div class="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
      ${i.tipo === 'video'
        ? `<video src="${esc(i.archivo_url)}" controls preload="metadata" class="w-full aspect-video object-cover bg-black"></video>`
        : `<img src="${esc(i.archivo_url)}" loading="lazy" class="w-full aspect-square object-cover">`}
      <div class="p-2.5 flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold truncate">${esc(i.titulo || 'Sin título')}</p>
          <p class="text-[10px] text-slate-500 truncate">${porId[i.partido_id] ? (ETIQUETAS_FASE[porId[i.partido_id].fase] ?? '') : 'General'}</p>
        </div>
        <button data-eliminar="${i.id}" class="text-[10px] px-2 py-1 rounded bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 shrink-0">Eliminar</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-eliminar]').forEach(b => b.addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar este archivo de la galería?'))) return;
    await supabase.from('galeria').delete().eq('id', b.dataset.eliminar);
    toast('Archivo eliminado');
    renderGaleriaAdmin();
  }));
}

$('form-galeria').addEventListener('submit', async e => {
  e.preventDefault();
  const files = [...$('gal-files').files];
  if (!files.length) { toast('Selecciona al menos un archivo', 'error'); return; }
  const titulo = $('gal-titulo').value.trim();
  const descripcion = $('gal-desc').value.trim();
  const partidoId = $('gal-partido').value || null;
  const barra = $('gal-progreso');
  const relleno = barra.querySelector('div');
  barra.classList.remove('hidden');
  relleno.style.width = '0%';
  let ok = 0, fallidos = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    relleno.style.width = `${Math.round((i / files.length) * 100)}%`;
    try {
      const url = await subirArchivo(file, 'galeria');
      await supabase.from('galeria').insert({
        titulo: titulo || file.name,
        descripcion,
        archivo_url: url,
        tipo: esVideo(file) ? 'video' : 'foto',
        partido_id: partidoId
      });
      ok++;
    } catch {
      fallidos++;
    }
  }
  relleno.style.width = '100%';
  setTimeout(() => barra.classList.add('hidden'), 700);
  toast(`${ok} archivo(s) subido(s)${fallidos ? ` · ${fallidos} fallaron` : ''}`);
  e.target.reset();
  renderGaleriaAdmin();
});

// ============================================================
// FINANZAS: RECAUDO Y CARTERA (panel de tesorería)
// Cada participación de equipo en un partido genera una cuota
// (cuota_partido, por defecto $8.000 = 4 jugadores × $2.000). El
// detalle de quién pagó vive en "arbitraje_partidos" (pago individual
// por jugador); el recaudo global es la suma de $cuota_jugador por
// cada jugador con el arbitraje activo. La cuota de equipo
// (pago_local / pago_visitante) es solo un resumen derivado de ese
// detalle y NUNCA se suma aparte, para no duplicar el recaudo.
// Si la tabla no existe, el pago se respalda en los booleanos de
// "partidos".
// NOTA: los parámetros vienen de la tabla "config" (se sembró con el
// script sql/schema.sql); si la fila no existe se usan estos valores
// por defecto para que el panel nunca se rompa.
// ============================================================
const fmtDinero = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n || 0);

function parametrosFinancieros() {
  return {
    cuotaPartido: Number(state.config.cuota_partido || 8000),
    cuotaJugador: Number(state.config.cuota_jugador || 2000),
    premioPct: Number(state.config.bolsa_premio_pct || 100)
  };
}

// Etiquetas del formulario de partido: "$8.000 / $2.000 por jugador"
function actualizarEtiquetasCuotas() {
  const { cuotaPartido, cuotaJugador } = parametrosFinancieros();
  const lbl = ` ($${Number(cuotaPartido).toLocaleString('es-CO')} / $${Number(cuotaJugador).toLocaleString('es-CO')} por jugador)`;
  const l = $('lbl-pago-local');
  const v = $('lbl-pago-visitante');
  if (l) l.textContent = `Equipo local pagó cuota${lbl}`;
  if (v) v.textContent = `Equipo visitante pagó cuota${lbl}`;
}

// Pago individual por jugador (tabla "arbitraje_partidos"). Devuelve
// null si el detalle no está disponible (tabla ausente o RLS cerrada);
// en ese caso el recaudo se respalda en los booleanos de "partidos".
async function cargarPagosArbitraje() {
  if (!(await arbitrajePartidosDisponible())) return null;
  try {
    const { data } = await supabase.from('arbitraje_partidos').select('partido_id, jugador_id, pagado');
    return data || [];
  } catch {
    return null;
  }
}

// Total recaudado: $cuota_jugador × cada jugador con el arbitraje
// activo. La cuota global de equipo (pago_local / pago_visitante) es
// un resumen derivado del detalle por jugador y NUNCA se suma aparte,
// de modo que el total global refleja exactamente $2.000 por cada
// checkbox de arbitraje marcado (sin duplicar la cuota del equipo).
function calcularTotalRecaudado(porEquipo) {
  const { cuotaJugador } = parametrosFinancieros();
  let jugadoresPagados = 0;
  Object.values(porEquipo).forEach(lados => {
    lados.forEach(l => { jugadoresPagados += l.pagados; });
  });
  return jugadoresPagados * cuotaJugador;
}

async function renderFinanzas() {
  await cargarBase();
  actualizarEtiquetasCuotas();
  const { cuotaPartido, cuotaJugador, premioPct } = parametrosFinancieros();
  const partidos = state.partidos.filter(p => p.equipo_local_id && p.equipo_visitante_id);

  // Detalle de pago por jugador: partido_id -> (jugador_id -> pagado)
  const pagosDetalle = await cargarPagosArbitraje();
  const pagosPorPartido = new Map();
  (pagosDetalle || []).forEach(r => {
    if (!pagosPorPartido.has(r.partido_id)) pagosPorPartido.set(r.partido_id, new Map());
    pagosPorPartido.get(r.partido_id).set(r.jugador_id, !!r.pagado);
  });

  // Recuento de pago de un equipo en un partido ("participación").
  // Cada jugador pagado abona $cuota_jugador a la cuota de equipo
  // ($cuota_partido); lo que no quede cubierto sigue como deuda. Así
  // un abono parcial (ej. 3 de 4 jugadores = $6.000) deja una deuda
  // proporcional ($2.000) en lugar de la cuota completa.
  const infoLado = (partido, equipoId) => {
    const jugadores = state.jugadores.filter(j => j.equipo_id === equipoId);
    const detalle = pagosPorPartido.get(partido.id);
    let pagados;
    if (detalle) {
      pagados = jugadores.filter(j => detalle.get(j.id)).length;
    } else {
      // Sin detalle individual: el pago global cubre a todo el equipo
      const global = partido.equipo_local_id === equipoId ? partido.pago_local : partido.pago_visitante;
      pagados = global ? jugadores.length : 0;
    }
    const abonado = pagados * cuotaJugador;
    return { partido, pagados, abonado, deuda: Math.max(0, cuotaPartido - abonado) };
  };

  // Recorrido por equipo: cada partido suma una participación por lado
  const porEquipo = {};
  partidos.forEach(p => {
    [p.equipo_local_id, p.equipo_visitante_id].forEach(eid => {
      if (!eid) return;
      (porEquipo[eid] ||= []).push(infoLado(p, eid));
    });
  });

  let totalParticipaciones = 0;
  let jugadoresPagados = 0;
  let participacionesConDeuda = 0;
  Object.values(porEquipo).forEach(lados => {
    lados.forEach(l => {
      totalParticipaciones++;
      jugadoresPagados += l.pagados;
      if (l.deuda > 0) participacionesConDeuda++;
    });
  });
  const recaudado = calcularTotalRecaudado(porEquipo);
  const pendiente = Math.max(0, totalParticipaciones * cuotaPartido - recaudado);
  const bolsa = Math.round(recaudado * premioPct / 100);

  $('finanzas-resumen').innerHTML = `
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Total recaudado</p>
      <p class="text-2xl font-black text-emerald-400 truncate">${fmtDinero(recaudado)}</p>
      <p class="text-[11px] text-slate-500 mt-1">${jugadoresPagados} jugador(es) pagado(s) · ${fmtDinero(cuotaJugador)} c/u</p>
    </div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Total pendiente / deudas</p>
      <p class="text-2xl font-black text-rose-400 truncate">${fmtDinero(pendiente)}</p>
      <p class="text-[11px] text-slate-500 mt-1">${participacionesConDeuda} participación(es) por cobrar</p>
    </div>
    <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">🏆 Bolsa del premio final</p>
      <p class="text-2xl font-black text-gold truncate">${fmtDinero(bolsa)}</p>
      <p class="text-[11px] text-slate-500 mt-1">${premioPct}% del recaudado</p>
    </div>`;

  const nombreDe = id => state.equipos.find(e => e.id === id)?.nombre ?? 'Equipo';
  $('finanzas-tabla').innerHTML = state.equipos.map(e => {
    const lados = porEquipo[e.id] || [];
    const pagados = lados.filter(l => l.deuda === 0).length;
    const pendientes = lados.filter(l => l.deuda > 0).length;
    const deudaTotal = lados.reduce((a, l) => a + l.deuda, 0);
    const badge = lados.length === 0
      ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-700 text-slate-500">Sin partidos</span>'
      : deudaTotal === 0
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">✓ Al día</span>'
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-500/40 bg-rose-500/15 text-rose-400">Debe ${fmtDinero(deudaTotal)}</span>`;
    const desglose = lados.length
      ? `<button type="button" data-desglose="${e.id}" class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition">Ver detalle</button>`
      : '<span class="text-slate-600 text-xs">—</span>';
    return `
      <tr class="border-b border-slate-800/60" data-equipo="${e.id}">
        <td class="px-3 py-3">
          <div class="flex items-center gap-2.5 min-w-0">
            ${escudo(e, 'w-8 h-8')}
            <span class="font-semibold truncate">${esc(e.nombre)}</span>
          </div>
        </td>
        <td class="px-3 py-3 text-center text-emerald-400 font-bold">${pagados}</td>
        <td class="px-3 py-3 text-center ${pendientes ? 'text-rose-400 font-bold' : 'text-slate-500'}">${pendientes}</td>
        <td class="px-3 py-3 text-center">${badge}</td>
        <td class="px-3 py-3 text-right">${desglose}</td>
      </tr>
      <tr class="hidden" data-desglose-fila="${e.id}">
        <td colspan="5" class="px-3 py-0">
          <div class="rounded-lg border border-slate-700/60 bg-slate-950/60 p-3 mb-3 space-y-1.5"></div>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="px-3 py-8 text-center text-slate-500">Registra equipos para ver la cartera.</td></tr>';

  state.equipos.forEach(e => {
    const lados = porEquipo[e.id] || [];
    const fila = document.querySelector(`[data-desglose-fila="${e.id}"]`);
    if (!fila) return;
    const detalle = lados.map(l => {
      const p = l.partido;
      const rivalId = p.equipo_local_id === e.id ? p.equipo_visitante_id : p.equipo_local_id;
      const chip = l.deuda === 0
        ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">✓ Pagado · ${l.pagados} jugador(es) abonaron ${fmtDinero(l.abonado)}</span>`
        : l.pagados === 0
          ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-rose-500/40 bg-rose-500/15 text-rose-400">Sin pago · Debe ${fmtDinero(l.deuda)}</span>`
          : `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-rose-500/40 bg-rose-500/15 text-rose-400">Parcial · ${l.pagados} jugador(es) abonaron ${fmtDinero(l.abonado)} · Debe ${fmtDinero(l.deuda)}</span>`;
      return `
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="text-slate-400 shrink-0">${p.jornada ? esc(p.jornada) : esc(ETIQUETAS_FASE[p.fase] ?? p.fase)}</span>
          <span class="text-slate-600">·</span>
          <span class="min-w-0 truncate">${esc(nombreDe(e.id))} vs ${esc(nombreDe(rivalId))}</span>
          <span class="text-slate-600">·</span>
          <span class="text-slate-500 shrink-0">${fechaHoraLocal(p.fecha)}</span>
          ${chip}
        </div>`;
    }).join('');
    fila.querySelector('div').innerHTML = detalle || '<p class="text-xs text-slate-600">Sin partidos registrados.</p>';
  });

  $('finanzas-tabla').querySelectorAll('[data-desglose]').forEach(btn => btn.addEventListener('click', () => {
    const fila = document.querySelector(`[data-desglose-fila="${btn.dataset.desglose}"]`);
    if (fila) fila.classList.toggle('hidden');
  }));
}
