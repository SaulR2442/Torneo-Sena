import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'metodo_invalido' }), { status: 405, headers: corsHeaders });
  }

  const { email, password, nombre, clave } = await req.json().catch(() => ({}));

  if (!email || !password || !clave) {
    return new Response(JSON.stringify({ error: 'datos_incompletos' }), { status: 400, headers: corsHeaders });
  }
  if (clave !== Deno.env.get('CLAVE_ADMIN')) {
    return new Response(JSON.stringify({ error: 'clave_incorrecta' }), { status: 403, headers: corsHeaders });
  }
  if (String(password).length < 6) {
    return new Response(JSON.stringify({ error: 'clave_corta' }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  const { data: usuario, error: errorCrear } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre || '' }
  });

  if (errorCrear) {
    const error = errorCrear.code === 'user_already_exists' ? 'email_exists' : 'error_crear';
    return new Response(JSON.stringify({ error }), { status: 400, headers: corsHeaders });
  }

  const { error: errorAdmin } = await supabase.from('administradores').insert({
    email: email.toLowerCase(),
    nombre: nombre || email
  });

  if (errorAdmin) {
    return new Response(JSON.stringify({ error: 'error_admin', detalle: errorAdmin.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, id: usuario.id }), { status: 200, headers: corsHeaders });
});
