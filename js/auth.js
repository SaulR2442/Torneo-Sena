import { supabase, toast } from './lib.js';
import { CONFIG } from './config.js';

const $ = id => document.getElementById(id);

function mostrarError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function alternarTab(login) {
  $('form-login').classList.toggle('hidden', !login);
  $('form-registro').classList.toggle('hidden', login);
  const [b1, b2] = [$('btn-tab-login'), $('btn-tab-registro')];
  const base = 'py-2 rounded-md transition';
  b1.className = `${base} ${login ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`;
  b2.className = `${base} ${!login ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`;
}

$('btn-tab-login').addEventListener('click', () => alternarTab(true));
$('btn-tab-registro').addEventListener('click', () => alternarTab(false));

$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('login-error');
  err.classList.add('hidden');
  const { error } = await supabase.auth.signInWithPassword({
    email: $('login-correo').value.trim(),
    password: $('login-clave').value
  });
  if (error) {
    mostrarError(err, error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message);
    return;
  }
  toast('Sesión iniciada. Bienvenido.');
  setTimeout(() => location.href = 'admin.html', 500);
});

$('form-registro').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('reg-error');
  err.classList.add('hidden');

  const email = $('reg-correo').value.trim();
  const password = $('reg-clave').value;
  const nombre = $('reg-nombre').value.trim();
  const claveAdmin = $('reg-clave-admin').value;

  if (claveAdmin !== CONFIG.CLAVE_ADMIN) {
    mostrarError(err, 'La clave de administrador no es correcta.');
    return;
  }

  const urlFuncion = `${CONFIG.SUPABASE_URL}/functions/v1/registrar-admin`;
  try {
    const resp = await fetch(urlFuncion, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nombre, clave: claveAdmin })
    });
    if (!resp.ok) {
      const detalle = await resp.json().catch(() => ({}));
      const msg = detalle.error === 'email_exists'
        ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
        : detalle.error === 'clave_incorrecta'
          ? 'La clave de administrador no es correcta.'
          : 'No se pudo crear la cuenta. Verifica que la Edge Function "registrar-admin" esté desplegada (ver README).';
      mostrarError(err, msg);
      return;
    }
    toast('Cuenta creada. Iniciando sesión...');
    await supabase.auth.signInWithPassword({ email, password });
    setTimeout(() => location.href = 'admin.html', 800);
  } catch {
    mostrarError(err, 'No se pudo conectar. Verifica tu conexión o que la Edge Function esté desplegada (ver README).');
  }
});
