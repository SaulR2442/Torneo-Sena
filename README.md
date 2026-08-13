# ⚽🏆 TORNEO SENA 2026 — Copa de Selecciones (Fútbol 4)

> 🌐 **[¡HAZ CLIC AQUÍ PARA ENTRAR Y VER EL TORNEO EN VIVO!](https://torneo-sena.onrender.com)**

---

### 🎨 1. ¿De qué trata la app?
Una plataforma súper rápida e interactiva para seguir cada detalle de la Copa de Selecciones SENA en modalidad **Fútbol 4** (1 Arquero + 3 Jugadores de campo). Aquí puedes consultar en tiempo real:
- 📊 **Tabla de Posiciones** actualizada al instante.
- ⚽ **Goleadores y Asistencias** de cada fecha.
- 🗓️ **Fixture de Partidos** y resultados.
- 🏆 **Cuadro Eliminatorio (Bracket)** camino a la final.
- 📸 **Galería de fotos y videos** de las mejores jugadas.
- 📜 **Reglamento Oficial** y sistema VAR.

---

### 📂 2. Estructura de la Casa (Archivos Principales)
```text
torneo-sena/
├── index.html        → Vista pública (posiciones, estadísticas, partidos, reglamento)
├── login.html        → Acceso exclusivo para administradores
├── admin.html        → Panel de control (gestión de equipos, partidos y tabla)
├── js/               → Lógica interactiva de la página y conexión de datos
└── sql/schema.sql    → Base de datos completa
```

---

### ⚡ 3. La Alineación Titular (Cómo está hecha)
| Posición | Jugador | Puesto |
|----------|---------|--------|
| 🥅 **Arquero** | Supabase (PostgreSQL) | Detrás de todo: guarda equipos, partidos, goles y más |
| 🧱 **Defensa** | RLS + Auth | Solo los administradores escriben; el público solo mira |
| 🎮 **Mediocampo** | JavaScript + Tailwind CSS | El motor que hace que todo se mueva en pantalla |
| 🎯 **Delantero** | Supabase Storage | Bodega de escudos, fotos y videos del torneo |
| 💰 **El Patrocinador** | Plan Gratuito | $0 pesos para siempre 💸 |

---

### 🏟️ 4. Preparación Física (Poner la cancha a rodar)
1. 🆕 Crea un proyecto en **supabase.com** (gratis, tarda 2–3 min).
2. 🧪 Abre **SQL Editor → New query**, pega TODO `sql/schema.sql` y ejecuta.
   *(Eso crea tablas, permisos, vistas y el bucket de escudos. Si lo corres otra vez, no se queja.)*
3. 💰 **Módulo de tesorería (opcional):** si instalas la app ya existente, ejecuta `sql/financiero.sql` para añadir las columnas de pago (`pago_local`, `pago_visitante`, `arbitraje_pagado`), las cuotas configurables y la corrección de la tabla de posiciones (partidos `FINALIZADO`).
4. 🪪 Crea los administradores:
   - **Opción A (rápida):** en Authentication → Users agrega los correos, y registra esos mismos correos en la tabla `administradores`.
   - **Opción B (pro):** despliega la Edge Function `registrar-admin` con `supabase functions deploy registrar-admin --no-verify-jwt` y la clave `CLAVE_ADMIN` como secreto. Tu co-admin se registra solito desde `login.html`.
5. 🔑 Edita `js/config.js` con tu **Project URL** y tu **anon public key**.
6. 🚀 Publica y a jugar (Render, GitHub Pages o Vercel — lo que tengas a mano).

> ⚠️ **Aviso de vestuario:** la clave `CLAVE_ADMIN` por defecto es `020308`. Cámbiala antes del primer partido oficial.

---

### 🎮 5. En el Banquillo (Panel de Administración)
- 📊 **Resumen** — conteo de equipos, jugadores y partidos de un vistazo.
- 🛡️ **Equipos** — registra nombres y escudos (el álbum se llena aquí).
- 👤 **Jugadores** — posición, número de camiseta y foto.
- 📋 **Partidos** — resultados, goleadores, arbitraje por jugador y cuotas de participación.
- 🏆 **Eliminatoria** — arma el cuadro de 4/8/16/32 y el ganador avanza solo.
- 📈 **Estadísticas** — goles y asistencias partido a partido.
- 💰 **Recaudo** — control de cartera: total recaudado, deudas por equipo y bolsa del premio.
- 📜 **Reglamento** — escribe las reglas en Markdown con vista previa.
- 📸 **Galería** — sube fotos y videos de cada fecha.
- ⚙️ **Configuración** — nombre del torneo, clasificados, nota y cuotas de tesorería.

---

### 🕹️ 6. Trucos de Vestuario (FAQ)
- ❓ **¿Empate en la eliminatoria?** No hay penaltis aquí: nadie avanza. Define un ganador.
- ❓ **¿Por qué no veo la tabla?** La tabla solo cuenta partidos marcados como **jugado** o con estado **FINALIZADO** en la fase Todos contra Todos.
- ❓ **¿El escudo no carga?** Revisa que el bucket `media` sea público y que la vista `tabla_posiciones` incluya `escudo_url` (está en `sql/schema.sql`).
- ❓ **¿Revocar a un admin?** `delete from administradores where email = '...';` — pierde acceso al instante. Sin dramas.
- ❓ **¿Videos pesados?** El plan gratis acepta hasta **50 MB** por archivo. Comprime antes de subir.

---

> 🏅 **Hecho con pasión para la familia SENA** — ¡que ruede el balón y gane el mejor! ⚽💚
