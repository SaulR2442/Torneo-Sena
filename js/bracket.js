import { escudo, esc, ETIQUETAS_FASE, ORDEN_ELIMINATORIA } from './lib.js?v=1.0.1';

function filaEquipo(equipo, goles, ganador, empatado) {
  const cls = ganador
    ? 'bg-emerald-500/15 text-emerald-200 border-l-4 border-emerald-400'
    : empatado
      ? 'bg-amber-500/10 text-amber-200 border-l-4 border-amber-400'
      : 'border-l-4 border-transparent';
  return `
    <div class="flex items-center justify-between gap-2 px-2 py-1.5 ${cls}">
      <span class="flex items-center gap-2 min-w-0">
        ${escudo(equipo, 'w-5 h-5')}
        <span class="truncate text-xs">${esc(equipo?.nombre ?? 'Clasificado')}</span>
        ${ganador ? '<span class="text-emerald-400">→</span>' : ''}
      </span>
      <span class="font-bold text-xs shrink-0">${equipo ? (goles ?? 0) : ''}</span>
    </div>`;
}

function tarjetaPublica(p) {
  const div = document.createElement('div');
  div.className = 'bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden';
  let g = null;
  if (p.jugado && p.equipo_local && p.equipo_visitante) {
    if (p.goles_local > p.goles_visitante) g = 'L';
    else if (p.goles_visitante > p.goles_local) g = 'V';
  }
  div.innerHTML = `
    <div class="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/60 flex justify-between">
      <span>${ETIQUETAS_FASE[p.fase] ?? p.fase}</span>
      <span>${p.posicion_bracket ?? ''}</span>
    </div>
    ${filaEquipo(p.equipo_local, p.goles_local, g === 'L', p.jugado && g === null)}
    ${filaEquipo(p.equipo_visitante, p.goles_visitante, g === 'V', p.jugado && g === null)}`;
  return div;
}

function tarjetaEditable(p, equipos, onSave) {
  const div = document.createElement('div');
  div.className = 'bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden p-2';
  const id = p.id;
  div.innerHTML = `
    <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex justify-between">
      <span>${ETIQUETAS_FASE[p.fase] ?? p.fase}</span>
      <span>Partido ${p.posicion_bracket ?? ''}</span>
    </div>
    <div class="flex items-center gap-1.5 mb-1">
      <select data-campo="equipo_local_id" class="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
        <option value="">Local…</option>
        ${equipos.map(e => `<option value="${esc(e.id)}" ${e.id === p.equipo_local_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-1.5 mb-1">
      <select data-campo="equipo_visitante_id" class="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white">
        <option value="">Visitante…</option>
        ${equipos.map(e => `<option value="${esc(e.id)}" ${e.id === p.equipo_visitante_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-1.5">
      <input data-campo="goles_local" type="number" min="0" value="${p.goles_local ?? 0}" class="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center">
      <span class="text-slate-500 text-xs">:</span>
      <input data-campo="goles_visitante" type="number" min="0" value="${p.goles_visitante ?? 0}" class="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center">
      <label class="flex items-center gap-1 ml-auto text-[10px] text-slate-400 cursor-pointer">
        <input data-campo="jugado" type="checkbox" ${p.jugado ? 'checked' : ''} class="accent-emerald-500"> Jugado
      </label>
      <button data-boton-guardar class="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded">Guardar</button>
    </div>`;
  div.querySelector('[data-boton-guardar]').addEventListener('click', () => {
    const leer = campo => div.querySelector(`[data-campo="${campo}"]`);
    onSave(id, {
      equipo_local_id: leer('equipo_local_id').value || null,
      equipo_visitante_id: leer('equipo_visitante_id').value || null,
      goles_local: Number(leer('goles_local').value || 0),
      goles_visitante: Number(leer('goles_visitante').value || 0),
      jugado: leer('jugado').checked
    });
  });
  return div;
}

export function renderBracket(container, partidos, { editable = false, equipos = [], onSave = null } = {}) {
  container.innerHTML = '';
  const orden = ORDEN_ELIMINATORIA.filter(f => partidos.some(p => p.fase === f));
  const tercer = partidos.filter(p => p.fase === 'tercer_lugar').sort((a, b) => (a.posicion_bracket ?? 0) - (b.posicion_bracket ?? 0));

  if (!orden.length && !tercer.length) {
    container.innerHTML = '<p class="text-slate-400 text-center py-10">Aún no hay eliminatorias configuradas.</p>';
    return;
  }

  const R = orden.length;
  const fila = document.createElement('div');
  fila.className = 'flex gap-x-6 gap-y-4 items-start overflow-x-auto pb-2';

  orden.forEach((fase, c) => {
    const col = document.createElement('div');
    col.className = 'flex flex-col w-56 shrink-0';
    const espaciado = (Math.pow(2, R - 1 - c) - 1) * 96;
    partidos
      .filter(p => p.fase === fase)
      .sort((a, b) => (a.posicion_bracket ?? 0) - (b.posicion_bracket ?? 0))
      .forEach((p, i) => {
        const card = editable ? tarjetaEditable(p, equipos, onSave) : tarjetaPublica(p);
        if (i > 0) card.style.marginTop = `${espaciado}px`;
        col.appendChild(card);
      });
    fila.appendChild(col);
  });

  container.appendChild(fila);

  if (tercer.length) {
    const zonaTercer = document.createElement('div');
    zonaTercer.className = 'mt-6 flex items-center gap-4';
    const flecha = document.createElement('span');
    flecha.className = 'text-slate-600 font-bold';
    flecha.textContent = '→';
    zonaTercer.appendChild(flecha);
    tercer.forEach(p => {
      zonaTercer.appendChild(editable ? tarjetaEditable(p, equipos, onSave) : tarjetaPublica(p));
    });
    container.appendChild(zonaTercer);
  }
}
