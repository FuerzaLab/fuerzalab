# Cómo dejar esto funcionando

No hace falta saber programar para estos pasos. Son dos partes: primero Supabase (la base de datos), después Netlify (donde vive la página web).

## Parte 1 — Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta si no tienes, y crea un **proyecto nuevo**. Elige una contraseña para la base de datos y guárdala en un lugar seguro (no la necesitarás seguido, pero por si acaso).

2. En el menú de la izquierda, entra a **SQL Editor** y presiona **New query**.

3. Abre el archivo `supabase_setup.sql` que viene en esta carpeta, copia **todo** su contenido, pégalo ahí, y presiona **Run**. Esto crea automáticamente todas las tablas, los permisos y las reglas de seguridad. Puede tardar unos segundos. Si ves un mensaje de éxito al final, ya está.

4. En el menú de la izquierda, entra a **Authentication > Users** y presiona **Add user > Create new user**. Pon tu correo y una contraseña. **No marques ninguna casilla especial.** Esta va a ser tu cuenta de administrador — el sistema la reconoce automáticamente como tal porque es la primera cuenta que se crea.

5. Todavía en Supabase, ve a **Storage** y crea dos buckets (botón **New bucket**):
   - `exercise-media` — **privado** (sin marcar "Public")
   - `client-files` — **privado** (sin marcar "Public")

6. Por último, ve a **Project Settings > API**. Ahí vas a ver dos datos que necesitas copiar:
   - **Project URL**
   - **anon / public key** (una clave larga)

   Guárdalos, los usas en el paso siguiente.

## Parte 2 — Conectar la aplicación

1. Dentro de esta carpeta del proyecto, busca el archivo `.env.example` y haz una copia llamada `.env` (sin ".example").

2. Abre `.env` con cualquier editor de texto y completa las dos líneas con lo que copiaste de Supabase:

   ```
   VITE_SUPABASE_URL=la URL que copiaste
   VITE_SUPABASE_ANON_KEY=la clave que copiaste
   ```

3. Guarda el archivo.

## Parte 3 — Publicar en Netlify

1. Sube esta carpeta a un repositorio de GitHub (si no sabes cómo, Netlify también permite arrastrar la carpeta directamente, buscando la opción "Deploy manually" — pero para poder actualizarla después, lo normal es conectarla a GitHub).

2. Entra a [netlify.com](https://netlify.com), crea una cuenta, y elige **Add new site > Import an existing project**. Conecta tu repositorio.

3. Netlify va a detectar automáticamente cómo construir el proyecto (ya viene configurado en el archivo `netlify.toml`). No necesitas tocar nada ahí.

4. Antes de publicar, ve a **Site configuration > Environment variables** y agrega las mismas dos variables que pusiste en tu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

5. Presiona **Deploy**. En uno o dos minutos tu sitio está en línea, con una dirección tipo `tu-proyecto.netlify.app`.

6. Entra a esa dirección, inicia sesión con el correo y la contraseña que creaste en el paso 4 de la Parte 1. Deberías entrar directo al panel de administrador.

---

## Qué hace falta para crear más usuarios

Desde dentro de la aplicación, no desde Supabase: el administrador invita entrenadores, y cada entrenador invita a sus clientes. Esa pantalla de invitaciones se conecta en la próxima entrega de este proyecto (todavía no está activa en esta versión).

## Qué es real en esta entrega y qué todavía no

**Ya funciona de verdad**, contra tu base de datos:
- Iniciar sesión y cerrar sesión.
- Registrarse con un código de invitación.
- Recuperar la contraseña.
- El menú y las pantallas cambian según el rol (Super Admin, Entrenador, Cliente).
- El panel de Super Admin ya consulta datos reales de tu base de datos (cuenta organizaciones y entrenadores).

**Todavía no está conectado** (vas a ver una pantalla de "este módulo todavía no está conectado" si entras): Clientes, Ejercicios, Constructor de rutinas, Planificación, Pagos, Reportes, Mensajes, y el resto de las pantallas que ya viste en la vista previa. Esas llegan en las siguientes dos entregas, como acordamos.
