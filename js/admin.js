import { supabase, toast, confirmar, subirArchivo, subirEscudo, esVideo, cargando, escudo, esc, fmtFecha, ETIQUETAS_FASE, ORDEN_ELIMINATORIA, opcionesSelect } from './lib.js';
import { renderBracket } from './bracket.js';
import { CONFIG } from './config.js';

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
  if (nombre === 'eliminatoria') renderEliminatoria();
  if (nombre === 'estadisticas') renderEstadisticas();
  if (nombre === 'reglas') cargarReglas();
  if (nombre === 'galeria') renderGaleriaAdmin();
  if (nombre === 'config') cargarConfig();
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
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table class="w-full text-sm">
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
    return `
      <li class="flex items-center gap-2">
        <span class="text-emerald-400 font-black">⚽</span>
        <span class="font-semibold">${esc(j?.nombre ?? '?')}</span>
        <span class="text-slate-500 text-xs truncate">${esc(equipoNombre(j?.equipo_id))}</span>
        <span class="ml-auto font-black text-emerald-400">${g.goles} gol${g.goles !== 1 ? 'es' : ''}</span>
        <button type="button" data-quitar="${i}" class="text-xs px-2 py-1 rounded bg-rose-600/10 text-rose-400 hover:bg-rose-600/20">Quitar</button>
      </li>`;
  }).join('');
  ul.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    goleadoresSel.splice(Number(b.dataset.quitar), 1);
    actualizarGoleadores();
  }));
}

function actualizarGoleadores() {
  const jugadores = jugadoresDelPartido();
  const agregados = new Set(goleadoresSel.map(g => g.jugador_id));
  $('gol-jugador').innerHTML = jugadores.length
    ? `<option value="">Elige jugador…</option>` + jugadores
        .filter(j => !agregados.has(j.id))
        .map(j => `<option value="${j.id}">${j.nombre} (${equipoNombre(j.equipo_id)})</option>`)
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
  }));
}

function equiposCambiados() {
  goleadoresSel = [];
  arbitrajeEstado = {};
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
}

function resetFormPartido() {
  $('form-partido').reset();
  $('par-id').value = '';
  $('par-fecha').value = fechaHoy();
  $('par-sede').value = 'SENA';
  goleadoresSel = [];
  arbitrajeEstado = {};
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
  $('btn-cancelar-partido').classList.add('hidden');
}

async function cargarGoleadores(partidoId) {
  goleadoresSel = [];
  if (!partidoId) return;
  const { data } = await supabase.from('estadisticas').select('jugador_id, goles').eq('partido_id', partidoId).gt('goles', 0);
  goleadoresSel = (data || []).map(r => ({ jugador_id: r.jugador_id, goles: r.goles }));
}

async function cargarArbitraje(partidoId) {
  arbitrajeEstado = {};
  if (!partidoId) return;
  const { data } = await supabase.from('arbitraje_partidos').select('jugador_id, pagado').eq('partido_id', partidoId);
  (data || []).forEach(r => { arbitrajeEstado[r.jugador_id] = r.pagado; });
}

async function guardarGoleadores(partidoId, lista = goleadoresSel) {
  const idsEquipos = [$('par-local').value, $('par-visitante').value].filter(Boolean);
  if (!idsEquipos.length) return;
  const filas = lista.map(g => {
    const jugador = state.jugadores.find(j => j.id === g.jugador_id);
    return {
      partido_id: partidoId,
      jugador_id: g.jugador_id,
      equipo_id: jugador?.equipo_id,
      goles: g.goles
    };
  }).filter(f => f.equipo_id);
  const { error } = await supabase.from('estadisticas').upsert(filas, { onConflict: 'partido_id,jugador_id' });
  if (error) { toast('Error al guardar goleadores: ' + error.message, 'error'); return; }
  const { data: existentes } = await supabase.from('estadisticas').select('jugador_id, goles, equipo_id').eq('partido_id', partidoId);
  const quitar = (existentes || []).filter(r =>
    (r.goles || 0) > 0 &&
    !lista.some(g => g.jugador_id === r.jugador_id)
  );
  if (quitar.length) {
    await supabase.from('estadisticas').update({ goles: 0 })
      .eq('partido_id', partidoId)
      .in('jugador_id', quitar.map(r => r.jugador_id));
  }
}

async function guardarArbitraje(partidoId) {
  const jugadores = jugadoresDelPartido();
  if (!jugadores.length) return;
  const filas = jugadores.map(j => ({
    partido_id: partidoId,
    jugador_id: j.id,
    pagado: !!arbitrajeEstado[j.id]
  }));
  const { error } = await supabase.from('arbitraje_partidos').upsert(filas, { onConflict: 'partido_id,jugador_id' });
  if (error) { toast('Error al guardar arbitraje: ' + error.message, 'error'); return; }
}

async function renderPartidos() {
  await cargarBase();
  resetFormPartido();
  $('par-local').innerHTML = opcionesSelect(state.equipos);
  $('par-visitante').innerHTML = opcionesSelect(state.equipos);
  const filtro = $('filtro-partidos');
  const filtroActual = filtro.value;
  filtro.innerHTML = '<option value="">Todos</option>' +
    Object.entries(ETIQUETAS_FASE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  if (filtroActual) filtro.value = filtroActual;
  const lista = $('lista-partidos');
  const visibles = state.partidos.filter(p => !filtroActual || p.fase === filtroActual);
  if (!visibles.length) {
    lista.innerHTML = '<p class="text-slate-500 text-sm">No hay partidos registrados.</p>';
    return;
  }
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  lista.innerHTML = visibles.map(p => `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center gap-3">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wider text-slate-500">${ETIQUETAS_FASE[p.fase] ?? p.fase} · ${fmtFecha(p.fecha)}</p>
        <p class="text-sm font-semibold mt-0.5">
          ${esc(porId[p.equipo_local_id]?.nombre ?? 'Pendiente')} <span class="text-slate-500">vs</span> ${esc(porId[p.equipo_visitante_id]?.nombre ?? 'Pendiente')}
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <span class="font-black ${p.jugado ? 'text-emerald-400' : 'text-slate-500'}">${p.jugado ? `${p.goles_local} - ${p.goles_visitante}` : 'Pendiente'}</span>
        <button data-editar="${p.id}" class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700">Editar</button>
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
  $('par-fecha').value = p.fecha ? p.fecha.slice(0, 10) : fechaHoy();
  $('par-sede').value = p.sede || 'SENA';
  $('par-local').value = p.equipo_local_id || '';
  $('par-visitante').value = p.equipo_visitante_id || '';
  $('par-goles-local').value = p.goles_local ?? 0;
  $('par-goles-visitante').value = p.goles_visitante ?? 0;
  $('par-jugado').checked = p.jugado;
  await cargarGoleadores(p.id);
  await cargarArbitraje(p.id);
  actualizarMarcador();
  actualizarGoleadores();
  renderArbitraje();
  $('btn-cancelar-partido').classList.remove('hidden');
}

$('form-partido').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('par-id').value || null;
  const jugado = $('par-jugado').checked;
  const localId = $('par-local').value || null;
  const visitanteId = $('par-visitante').value || null;
  if (localId && localId === visitanteId) {
    toast('Un equipo no puede jugar contra sí mismo', 'error');
    return;
  }
  const datos = {
    fase: $('par-fase').value,
    fecha: $('par-fecha').value ? new Date(`${$('par-fecha').value}T12:00:00`).toISOString() : null,
    sede: $('par-sede').value.trim() || 'SENA',
    equipo_local_id: localId,
    equipo_visitante_id: visitanteId,
    goles_local: Number($('par-goles-local').value || 0),
    goles_visitante: Number($('par-goles-visitante').value || 0),
    jugado
  };
  if (jugado) {
    const gl = datos.goles_local, gv = datos.goles_visitante;
    datos.ganador_id = gl > gv ? datos.equipo_local_id : gv > gl ? datos.equipo_visitante_id : null;
  } else {
    datos.ganador_id = null;
  }
  let partidoId = id;
  if (id) {
    const { error } = await supabase.from('partidos').update(datos).eq('id', id);
    if (error) { toast('Error al guardar partido: ' + error.message, 'error'); return; }
  } else {
    const { data, error } = await supabase.from('partidos').insert(datos).select().single();
    if (error) { toast('Error al guardar partido: ' + error.message, 'error'); return; }
    partidoId = data.id;
  }
  // Los goles individuales solo aplican a partidos jugados; si se
  // desmarcó "jugado", se limpian para no inflar el ranking.
  await guardarGoleadores(partidoId, jugado ? goleadoresSel : []);
  await guardarArbitraje(partidoId);
  toast(id ? 'Partido actualizado' : 'Partido registrado');
  resetFormPartido();
  renderPartidos();
});

$('btn-cancelar-partido').addEventListener('click', resetFormPartido);

$('btn-agregar-gol').addEventListener('click', () => {
  const jid = $('gol-jugador').value;
  const n = Number($('gol-cantidad').value || 1);
  if (!jid) { toast('Selecciona un jugador', 'error'); return; }
  const idx = goleadoresSel.findIndex(g => g.jugador_id === jid);
  if (idx >= 0) goleadoresSel[idx].goles += n;
  else goleadoresSel.push({ jugador_id: jid, goles: n });
  $('gol-cantidad').value = 1;
  actualizarGoleadores();
});

$('par-local').addEventListener('change', equiposCambiados);
$('par-visitante').addEventListener('change', equiposCambiados);

// ============================================================
// ELIMINATORIA
// ============================================================
async function renderEliminatoria() {
  await cargarBase();
  $('elim-clasificados').value = String(state.config.num_clasificados || 8);
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  const conEquipos = state.partidos.map(p => ({ ...p, equipo_local: porId[p.equipo_local_id] || null, equipo_visitante: porId[p.equipo_visitante_id] || null }));
  renderBracket($('bracket-admin'), conEquipos, {
    editable: true,
    equipos: state.equipos,
    onSave: guardarEliminatoria
  });
}

$('btn-generar-cuadro').addEventListener('click', async () => {
  const N = Number($('elim-clasificados').value);
  const plantilla = {
    4: [['semifinal', 2], ['final', 1]],
    8: [['cuartos', 4], ['semifinal', 2], ['final', 1]],
    16: [['octavos', 8], ['cuartos', 4], ['semifinal', 2], ['final', 1]],
    32: [['dieciseisavos', 16], ['octavos', 8], ['cuartos', 4], ['semifinal', 2], ['final', 1]]
  }[N];
  if (!plantilla) { toast('Cantidad de clasificados no válida', 'error'); return; }
  if (!(await confirmar(
    `Se generará un cuadro de ${N} equipos. Esto BORRARÁ los partidos de eliminatoria actuales (no toca la fase de Todos contra Todos). ¿Continuar?`,
    'Generar cuadro eliminatorio'
  ))) return;
  const filas = [];
  plantilla.forEach(([fase, n]) => {
    for (let i = 1; i <= n; i++) {
      filas.push({ fase, posicion_bracket: i, goles_local: 0, goles_visitante: 0, jugado: false });
    }
  });
  filas.push({ fase: 'tercer_lugar', posicion_bracket: 1, goles_local: 0, goles_visitante: 0, jugado: false });

  await supabase.from('partidos').delete().or('fase.neq.grupos,fase.is.null');
  await supabase.from('config').update({ valor: String(N) }).eq('clave', 'num_clasificados');
  const { error } = await supabase.from('partidos').insert(filas);
  if (error) { toast('Error al generar el cuadro: ' + error.message, 'error'); return; }
  toast(`Cuadro de ${N} equipos generado. Asigna los equipos a cada cruce.`);
  renderEliminatoria();
});

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
// ESTADISTICAS POR PARTIDO
// ============================================================
async function renderEstadisticas() {
  await cargarBase();
  const porId = Object.fromEntries(state.equipos.map(e => [e.id, e]));
  const seleccion = $('est-partido').value;
  $('est-partido').innerHTML = `<option value="">Selecciona un partido…</option>` + state.partidos
    .filter(p => p.jugado)
    .map(p => `<option value="${p.id}">${esc(porId[p.equipo_local_id]?.nombre ?? '?')} ${p.goles_local}-${p.goles_visitante} ${esc(porId[p.equipo_visitante_id]?.nombre ?? '?')} · ${ETIQUETAS_FASE[p.fase] ?? p.fase}</option>`)
    .join('');
  if (seleccion && state.partidos.some(p => p.id === seleccion)) $('est-partido').value = seleccion;
  cargarEstadisticasPartido();

  const { data: ranking } = await supabase.from('ranking_jugadores').select('*');
  $('tabla-ranking').innerHTML = (ranking || []).filter(j => j.goles > 0 || j.asistencias > 0)
    .sort((a, b) => b.goles - a.goles || b.asistencias - a.asistencias || a.jugador.localeCompare(b.jugador))
    .map(j => `
      <tr class="border-b border-slate-800/50">
        <td class="px-3 py-2.5 font-semibold">${esc(j.jugador)} ${j.numero ? `<span class="text-slate-500 text-xs">#${j.numero}</span>` : ''}</td>
        <td class="px-3 py-2.5 text-slate-400">${esc(j.equipo)}</td>
        <td class="px-3 py-2.5 text-center font-bold text-emerald-400">${j.goles}</td>
        <td class="px-3 py-2.5 text-center">${j.asistencias}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="px-3 py-8 text-center text-slate-500">Sin estadísticas registradas aún.</td></tr>';
}

$('est-partido').addEventListener('change', cargarEstadisticasPartido);

async function cargarEstadisticasPartido() {
  const partidoId = $('est-partido').value;
  const cuerpo = $('est-cuerpo');
  if (!partidoId) { cuerpo.innerHTML = '<p class="text-slate-500 text-sm mt-4">Selecciona un partido jugado.</p>'; return; }
  const partido = state.partidos.find(p => p.id === partidoId);
  const jugadoresEquipo = id => state.jugadores.filter(j => j.equipo_id === id);
  const { data: existentes } = await supabase.from('estadisticas').select('*').eq('partido_id', partidoId);
  const existente = {};
  (existentes || []).forEach(e => { existente[e.jugador_id] = e; });

  const tabla = (titulo, equipoId, lado) => {
    const jugadores = jugadoresEquipo(equipoId);
    if (!jugadores.length) return `<p class="text-slate-500 text-xs">${titulo}: sin jugadores registrados.</p>`;
    return `
      <div class="flex-1 min-w-[280px]">
        <p class="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">${titulo}</p>
        <table class="w-full text-xs">
          <thead><tr class="text-slate-500 uppercase">
            <th class="text-left py-1.5">Jugador</th>
            <th class="text-center py-1.5 w-12">⚽</th>
            <th class="text-center py-1.5 w-12">🎯</th>
          </tr></thead>
          <tbody>${jugadores.map(j => {
            const e = existente[j.id];
            return `<tr data-equipo="${equipoId}" data-jugador="${j.id}">
              <td class="py-1 pr-2 truncate">${j.nombre}</td>
              <td><input data-est="goles" type="number" min="0" value="${e?.goles ?? 0}" class="campo w-11 text-center !px-1 !py-1"></td>
              <td><input data-est="asistencias" type="number" min="0" value="${e?.asistencias ?? 0}" class="campo w-11 text-center !px-1 !py-1"></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  };
  cuerpo.innerHTML = `
    <div class="flex flex-col md:flex-row gap-6 mt-4">
      ${tabla(partido.equipo_local_id ? (state.equipos.find(x => x.id === partido.equipo_local_id)?.nombre ?? 'Local') : 'Local', partido.equipo_local_id, 'L')}
      ${tabla(partido.equipo_visitante_id ? (state.equipos.find(x => x.id === partido.equipo_visitante_id)?.nombre ?? 'Visitante') : 'Visitante', partido.equipo_visitante_id, 'V')}
    </div>`;
}

$('btn-est-guardar').addEventListener('click', async () => {
  const partidoId = $('est-partido').value;
  if (!partidoId) { toast('Selecciona un partido', 'error'); return; }
  const partido = state.partidos.find(p => p.id === partidoId);
  const filas = [];
  document.querySelectorAll('#est-cuerpo tr[data-jugador]').forEach(tr => {
    const lee = campo => Number(tr.querySelector(`[data-est="${campo}"]`).value || 0);
    const goles = lee('goles'), asistencias = lee('asistencias');
    if (goles + asistencias > 0) {
      filas.push({
        partido_id: partidoId,
        jugador_id: tr.dataset.jugador,
        equipo_id: tr.dataset.equipo,
        goles, asistencias
      });
    }
  });
  const { error } = await supabase.from('estadisticas').upsert(filas, { onConflict: 'partido_id,jugador_id' });
  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  toast('Estadísticas guardadas');
  renderEstadisticas();
});

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
// CONFIG
// ============================================================
async function cargarConfig() {
  $('cfg-nombre').value = state.config.torneo_nombre || '';
  $('cfg-clasificados').value = state.config.num_clasificados || '8';
  $('cfg-nota').value = state.config.nota_clasificacion || '';
}

$('form-config').addEventListener('submit', async e => {
  e.preventDefault();
  const valores = {
    torneo_nombre: $('cfg-nombre').value.trim(),
    num_clasificados: $('cfg-clasificados').value,
    nota_clasificacion: $('cfg-nota').value.trim()
  };
  let error = null;
  for (const [clave, valor] of Object.entries(valores)) {
    const { error: e } = await supabase.from('config').upsert({ clave, valor }, { onConflict: 'clave' });
    if (e) error = e;
  }
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Configuración guardada');
  state.config = valores;
});
