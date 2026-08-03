import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

export const ETIQUETAS_FASE = {
  grupos: 'Todos contra Todos',
  dieciseisavos: 'Dieciseisavos de Final',
  octavos: 'Octavos de Final',
  cuartos: 'Cuartos de Final',
  semifinal: 'Semifinal',
  final: 'Final',
  tercer_lugar: 'Tercer Lugar'
};

export const POSICIONES = ['Arquero', 'Defensa', 'Centrocampista', 'Delantero'];

export const ORDEN_ELIMINATORIA = ['dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'final'];

export function iniciales(nombre) {
  return (nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Convierte a URL pública del bucket "media" cualquier formato guardado:
//   - ruta relativa ("escudos/1785.jpg")  -> getPublicUrl()
//   - URL completa ya generada            -> se usa tal cual (no duplica carpeta)
export function urlPublico(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function escudo(equipo, cls = 'w-8 h-8') {
  if (equipo?.escudo_url) {
    return `<img src="${esc(urlPublico(equipo.escudo_url))}" alt="${esc(equipo.nombre)}" loading="lazy" class="${cls} rounded-full object-cover shrink-0 bg-slate-700">`;
  }
  return `<span class="${cls} rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold grid place-items-center shrink-0 border border-emerald-500/30">${iniciales(equipo?.nombre)}</span>`;
}

export function fmtFecha(iso) {
  if (!iso) return 'Por definir';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function toDateTimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function toast(mensaje, tipo = 'ok') {
  const estilos = {
    ok: 'bg-emerald-600',
    error: 'bg-rose-600',
    info: 'bg-sky-600'
  };
  let zona = document.getElementById('toast-zona');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'toast-zona';
    zona.className = 'fixed bottom-4 right-4 z-[100] flex flex-col gap-2';
    document.body.appendChild(zona);
  }
  const el = document.createElement('div');
  el.className = `${estilos[tipo] || estilos.ok} text-white text-sm px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 max-w-xs`;
  el.textContent = mensaje;
  zona.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

export function confirmar(mensaje, titulo = '¿Estás seguro?') {
  return new Promise(resolve => {
    let capa = document.getElementById('confirmar-capa');
    if (!capa) {
      capa = document.createElement('div');
      capa.id = 'confirmar-capa';
      document.body.appendChild(capa);
    }
    capa.innerHTML = `
      <div class="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" id="confirmar-fondo">
        <div class="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl">
          <h3 class="text-white font-bold text-lg mb-2">${titulo}</h3>
          <p class="text-slate-400 text-sm mb-6">${mensaje}</p>
          <div class="flex gap-3 justify-end">
            <button data-accion="no" class="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600">Cancelar</button>
            <button data-accion="si" class="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500">Confirmar</button>
          </div>
        </div>
      </div>`;
    capa.querySelector('#confirmar-fondo').addEventListener('click', e => {
      if (e.target.id === 'confirmar-fondo') { capa.innerHTML = ''; resolve(false); }
    });
    capa.querySelector('[data-accion="si"]').addEventListener('click', () => { capa.innerHTML = ''; resolve(true); });
    capa.querySelector('[data-accion="no"]').addEventListener('click', () => { capa.innerHTML = ''; resolve(false); });
  });
}

export async function subirArchivo(file, carpeta, onProgreso) {
  const MAX_BYTES = 50 * 1024 * 1024; // límite del plan gratuito de Supabase
  if (!file) throw new Error('No se seleccionó ningún archivo');
  if (file.size > MAX_BYTES) throw new Error('El archivo supera el límite de 50 MB');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: p => onProgreso?.(p.totalBytes)
    });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

// Sube un escudo y devuelve la RUTA RELATIVA ("escudos/xxxx.jpg") para
// guardarla en equipos.escudo_url. El renderizado la convierte en URL
// pública con urlPublico().
export async function subirEscudo(file, onProgreso) {
  const MAX_BYTES = 50 * 1024 * 1024;
  if (!file) throw new Error('No se seleccionó ningún archivo');
  if (file.size > MAX_BYTES) throw new Error('El archivo supera el límite de 50 MB');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `escudos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: p => onProgreso?.(p.totalBytes)
    });
  if (error) throw error;
  return path;
}

export function esVideo(file) {
  return (file.type || '').startsWith('video');
}

export function cargando(el, activo, texto = 'Cargando...') {
  if (activo) {
    el.innerHTML = `<div class="py-16 flex flex-col items-center gap-3 text-slate-500"><div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><p class="text-sm">${texto}</p></div>`;
  }
}

export function opcionesSelect(lista, seleccionado, placeholder = 'Seleccionar...') {
  let html = `<option value="">${esc(placeholder)}</option>`;
  lista.forEach(x => {
    html += `<option value="${esc(x.id)}" ${x.id === seleccionado ? 'selected' : ''}>${esc(x.nombre)}</option>`;
  });
  return html;
}
