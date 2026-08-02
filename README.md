# ⚽ Torneo SENA — Gestión de Torneo de Fútbol 4

Aplicación web de acceso público para consultar la tabla de posiciones, estadísticas, partidos,
cuadro eliminatorio, galería y reglamento del **Torneo SENA** (modalidad Fútbol 4:
1 arquero + 3 jugadores de campo). La escritura de datos está restringida a
administradores autenticados.

## Stack

| Capa | Tecnología | Costo |
|------|-----------|-------|
| Frontend | HTML5 + Tailwind CSS (CDN) + JavaScript (ES Modules) | Gratis (GitHub Pages / Vercel) |
| Base de datos | Supabase (PostgreSQL) | Gratis (500 MB, 2 proyectos) |
| Autenticación | Supabase Auth (correo + contraseña) | Gratis |
| Almacenamiento | Supabase Storage (fotos/videos) | Gratis (1 GB) |
| Registro de admins | Supabase Edge Function (opcional) | Gratis (500K invocaciones/mes) |

## Estructura del proyecto

```
torneo-sena/
├── index.html              → Sitio público (posiciones, estadísticas, partidos, eliminatoria, galería, reglas)
├── login.html              → Inicio de sesión / registro de administrador
├── admin.html              → Panel de administración (9 secciones)
├── js/
│   ├── config.js           → ⚠️ TU URL y clave pública de Supabase
│   ├── lib.js              → Cliente Supabase + utilidades compartidas
│   ├── public.js           → Lógica del sitio público
│   ├── auth.js             → Lógica de login/registro
│   ├── admin.js            → Lógica del panel (CRUD, bracket, estadísticas, galería)
│   └── bracket.js          → Motor del cuadro eliminatorio (visual + editable)
├── sql/schema.sql          → Esquema completo de la BD + RLS + vistas + Storage
├── supabase/functions/registrar-admin/index.ts → Edge Function para crear admins
└── README.md               → Esta guía
```

---

## 1. Crear el proyecto en Supabase

1. Regístrate en <https://supabase.com> (gratis) y crea un proyecto nuevo: **Torneo SENA**.
2. Espera a que se aprovisione (2–3 min) y anota de **Project Settings → API**:
   - **Project URL** → para `CONFIG.SUPABASE_URL`
   - **anon public key** → para `CONFIG.SUPABASE_ANON_KEY`
3. La **service_role key** solo se usa en la Edge Function (paso 4), nunca en el frontend.

## 2. Crear el esquema de la base de datos

1. Ve a **SQL Editor → New query**.
2. Pega TODO el contenido de `sql/schema.sql` y ejecútalo.
3. Esto crea: tablas (equipos, jugadores, partidos, estadisticas, galeria, reglas, config,
   administradores), la función `es_admin()`, políticas RLS (lectura pública / escritura solo
   admins), las vistas `tabla_posiciones` y `ranking_jugadores`, y el bucket `media`.

**Dato clave del RLS:** el público (anon) solo puede LEER; crear/editar/borrar requiere que el
correo del usuario autenticado esté en la tabla `administradores`.

## 3. Crear los administradores

Elige **una** de estas dos opciones:

### Opción A — Manual (más simple, recomendada para empezar)

1. En **Authentication → Users → Add user**: crea tu cuenta (y la de tu co-admin).
2. En **SQL Editor**, ejecuta:
   ```sql
   insert into administradores (email, nombre) values
     ('tu_correo@gmail.com', 'Administrador'),
     ('coadmin@gmail.com', 'Co-Administrador');
   ```
3. Los dos ya pueden iniciar sesión en `login.html`. Listo.

### Opción B — Autorregistro con Edge Function (el co-admin se registra solo)

1. Instala la CLI de Supabase:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref TU-REFERENCIA
   ```
2. Configura el secreto (la clave que pedirá el formulario de registro):
   ```bash
   supabase secrets set CLAVE_ADMIN=mi-clave-secreta
   ```
3. Despliega la función (se envía a `https://TU-PROYECTO.supabase.co/functions/v1/registrar-admin`):
   ```bash
   supabase functions deploy registrar-admin --no-verify-jwt
   ```
4. En `js/config.js` coloca la misma clave en `CLAVE_ADMIN`. Con ella, cualquiera que la sepa
   puede registrar su cuenta de admin desde `login.html` (pestaña **Registrar**).
5. ⚠️ Cambia la clave por defecto en `js/config.js` y en los secretos de Supabase.

## 4. Configurar el frontend

Edita `js/config.js`:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://tu-proyecto.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',   // anon public key
  CLAVE_ADMIN: 'mi-clave-secreta'
};
```

## 5. Desplegar gratis en GitHub Pages

1. Crea un repositorio en GitHub y sube todos estos archivos (no es necesario compilar nada).
2. **Settings → Pages → Deploy from branch** → rama `main` / carpeta `/ (root)` → **Save**.
3. En ~1 min tu sitio estará en `https://TU-USUARIO.github.io/TU-REPO/`.
   - `index.html` → sitio público
   - `login.html` → acceso de administradores
   - `admin.html` → panel (redirige a login si no hay sesión)

> ¿Vercel? Importa el repositorio con preset **Other / Static** — funciona igual.

## 6. Uso del panel de administración

| Sección | Qué hace |
|---------|----------|
| 📊 Resumen | Conteos rápidos y accesos directos |
| 🛡️ Equipos | Registrar equipos (nombre y escudo) |
| 👤 Jugadores | Registrar jugadores por equipo (nombre, posición, número, foto) |
| 📋 Partidos | Registrar partidos y resultados (Todos contra Todos y eliminatoria), goleadores y arbitraje por jugador |
| 🏆 Eliminatoria | Generar cuadro de 4/8/16/32 y cargar resultados con avance automático |
| 📈 Estadísticas | Contadores por jugador por partido: goles, asistencias, 🟨, 🟥 |
| 📜 Reglamento | Redactar las reglas en Markdown con vista previa |
| 📸 Galería | Subir fotos y videos (Supabase Storage) y asociarlos a partidos |
| ⚙️ Configuración | Nombre del torneo, clasificados a eliminatoria, nota de clasificación |

### Cómo funciona la eliminatoria

1. En **Eliminatoria** selecciona cuántos equipos clasifican (4/8/16/32) y pulsa **Generar cuadro**
   (regenerar borra solo los partidos de eliminatoria).
2. En cada cruce asigna los equipos clasificados con los desplegables.
3. Al marcar **Jugado** y guardar: el ganador avanza automáticamente al siguiente cruce, y los
   perdedores de las semifinales alimentan automáticamente el **Tercer Lugar**.
4. Los resultados de la fase **Todos contra Todos** actualizan solos la tabla de posiciones (vista SQL).

### Nota sobre videos

- El plan gratuito limita cada archivo a **50 MB**. Los videos largos comprímelos antes
  (p. ej. con HandBrake, H.264, resolución 720p, ~30 MB por clip).
- Fotos: JPG/PNG/WebP recomendados.

## 7. Datos de prueba (opcional)

Para probar rápido, ejecuta en el SQL Editor:

```sql
insert into equipos (nombre) values
  ('Los Tiburones'), ('Rayo Verde'),
  ('Furia Negra'), ('Estrellas SENA');

insert into jugadores (equipo_id, nombre, posicion, numero)
select id, 'Jugador ' || row_number() over (), 'Delantero', 7 from equipos;

insert into partidos (fase, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, jugado, fecha, ganador_id)
select 'grupos', e1.id, e2.id, 3, 1, true, now(), e1.id
from equipos e1, equipos e2 where e1.nombre = 'Los Tiburones' and e2.nombre = 'Rayo Verde';
```

## 8. Preguntas frecuentes

- **¿Cómo revoco un admin?** `delete from administradores where email = '...';` — perderá acceso
  de escritura al instante.
- **¿Por qué no veo la tabla de posiciones?** La vista se calcula solo con partidos marcados
  como **jugado** en la fase `grupos`.
- **¿Empate en eliminatoria?** No avanza: define un ganador en los marcadores.
- **¿Cuánto cuesta?** Todo dentro del plan gratuito de Supabase + GitHub Pages. El frontend no
  necesita servidor.
