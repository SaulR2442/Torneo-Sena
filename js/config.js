export const CONFIG = {
  // 1) Crea un proyecto en https://supabase.com
  // 2) Project Settings > API > copia la URL y la anon/public key
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU-ANON-PUBLIC-KEY',

  // Clave para crear la cuenta del segundo administrador (co-admin).
  // Si desplegaste la Supabase Edge Function "registrar-admin",
  // esta clave se verifica en el servidor y no aquí.
  CLAVE_ADMIN: 'cambia-esta-clave'
};
