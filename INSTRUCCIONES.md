# Cómo dejar esto funcionando

No hace falta saber programar para estos pasos. Son dos partes: primero Supabase (la base de datos), después Netlify (donde vive la página web).

## Parte 1 — Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta si no tienes, y crea un **proyecto nuevo**. Elige una contraseña para la base de datos y guárdala en un lugar seguro (no la necesitarás seguido, pero por si acaso).

2. En el menú de la izquierda, entra a **SQL Editor** y presiona **New query**.

3. Abre el archivo `supabase_setup.sql` que viene en esta carpeta, copia **todo** su contenido, pégalo ahí, y presiona **Run**. Esto crea automáticamente todas las tablas, los permisos y las reglas de seguridad. Puede tardar unos segundos. Si ves un mensaje de éxito al final, ya está.

3.1. Repite lo mismo con el archivo `catalog_seed.sql`: **New query**, pega todo su contenido, **Run**. Este carga una lista inicial de grupos musculares, patrones de movimiento y equipamiento en español, para que los desplegables al crear un ejercicio no aparezcan vacíos. Es opcional pero muy recomendado — sin esto, igual puedes crear ejercicios, solo que sin esas listas.

3.2. Repite lo mismo con `part3_migration.sql`: **New query**, pega todo su contenido, **Run**. Este agrega las columnas que necesitan el Constructor de rutinas y Planificación (zona de frecuencia cardíaca, pasos diarios, tipo de fuerza) y que no estaban en el script original. **Este paso es obligatorio** para que esas dos pantallas funcionen; sin él, vas a ver errores al intentar crear un programa o una rutina.

3.3. Repite lo mismo con `part3b_migration.sql`: **New query**, pega todo su contenido, **Run**. Agrega lo que necesita el formulario de ingreso del cliente (objetivos, cuestionario de salud, hábitos). **También obligatorio** para esa pantalla.

3.4. Repite lo mismo con `part3c_migration.sql`: **New query**, pega todo su contenido, **Run**. Corrige un error real: la base de datos rechazaba el envío del formulario de ingreso porque no reconocía los campos nuevos como permitidos para el cliente. También agrega el paso de aprobación del entrenador. **Obligatorio si ya corriste `part3b_migration.sql` antes de esta corrección.**

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

Un entrenador ya puede invitar clientes desde dentro de la aplicación (pantalla "Clientes" → "Invitar cliente"), sin volver a Supabase. Lo que todavía no está conectado es que el administrador invite entrenadores — esa pantalla llega en la próxima entrega.

## Qué es real en esta entrega y qué todavía no

**Ya funciona de verdad**, contra tu base de datos real (no simulado):
- Iniciar sesión, cerrar sesión, recuperar contraseña.
- Registrarse con un código de invitación (el formulario te confirma a qué organización te unes antes de completar el resto).
- El menú y las pantallas cambian según el rol (Super Admin, Entrenador, Cliente).
- El panel de Super Admin consulta datos reales de tu Supabase (cuenta organizaciones y entrenadores en vivo).
- **Clientes** (entrenador): lista con búsqueda y filtros, invitar cliente (crea la ficha y un código real para que se registre), ficha de datos y salud editable, suspender, reactivar y dar de baja — todo escribiendo en tu base de datos real.
- **Ejercicios**: biblioteca compartida entre Super Admin (ejercicios globales) y Entrenador (los suyos propios), con filtro por tren del cuerpo, búsqueda, y formulario para crear ejercicios nuevos con grupo muscular, patrón de movimiento, equipamiento y objetivos. Sin fotos ni videos todavía, como se definió.
- **Planificación**: elige un cliente, crea un programa (nombre, método de periodización, duración en semanas), y edita sus fases (si elegiste ATR: Acumulación, Transformación y Realización, con valores de partida) o bloques (para los demás métodos, los defines tú). El gráfico de semanas refleja la duración real que programaste, y no te deja repartir más semanas de las que tiene el programa en total — esto incluye "Añadir bloque" y "Duplicar bloque", que antes podían pasarse del total sin avisar (ya corregido). También puedes renombrar el programa, eliminarlo (con confirmación), y **extender** su duración (solo alargarla, nunca acortarla — acortar podría borrar semanas que ya tengan rutinas armadas en el Constructor).
- **Constructor de rutinas**: elige cliente, programa y semana, crea una o varias rutinas (sesiones) para esa semana, y arma cada una por bloques: Calentamiento, Principal, Cardio, Movilidad, Flexibilidad. El bloque Cardio tiene sus propios campos (duración, distancia, pasos diarios, zona de frecuencia cardíaca) en vez de series y repeticiones. Puedes agrupar ejercicios como biserie o triserie (se etiquetan A1/A2… automáticamente), elegir el tipo de fuerza a trabajar por rutina (con la leyenda de criterios y un botón que sugiere series/repeticiones/descanso), y copiar toda la semana a la siguiente con progresión de carga automática.

**Una diferencia a propósito frente a la vista previa que armamos antes**: ahí "Constructor" y "Planificación" eran dos sistemas separados. Acá quedaron conectados de verdad — primero planificas el programa y sus semanas, y después el Constructor arma las rutinas dentro de esas semanas. Es más fiel a cómo funciona de verdad una base de datos de este tipo, y evita que puedas crear una rutina "flotante" sin un programa detrás.

- **Organizaciones y Usuarios** (Super Admin): crear organizaciones, invitar entrenadores desde la fila de cada organización (ya no hace falta hacerlo por SQL), suspender/reactivar organizaciones, y activar/desactivar cualquier usuario de la plataforma.
- **Formulario de ingreso del cliente**: la primera vez que un cliente inicia sesión, el menú queda bloqueado hasta que complete el formulario (datos personales, objetivos, el cuestionario de salud PAR-Q+, hábitos y preferencias). Después de enviarlo, queda en espera: el entrenador lo revisa en la ficha del cliente (con alerta si hay alguna señal de salud) y presiona "Aprobar ingreso" — recién ahí se desbloquea el resto de la app para el cliente. **Importante**: no hay ningún aviso automático (correo o notificación) ni para el entrenador cuando el cliente envía el formulario, ni para el cliente cuando el entrenador lo aprueba — cada uno tiene que volver a abrir la app para ver si ya avanzó. Avisar automáticamente necesitaría la misma pieza de infraestructura que conversamos para el envío de correos (un servicio externo), así que quedó fuera de esta entrega a propósito.

- **Mi rutina (del lado del cliente)**: el cliente ve las semanas de su programa activo, elige una rutina, y la entrena de verdad — marca cada serie como hecha con sus repeticiones, carga y RIR reales, o un simple "hecho" para los ejercicios de cardio. Al terminar, deja su esfuerzo percibido de la sesión y comentarios. Esto es lo que faltaba para que Sugerencias y Reportes tengan datos reales de dónde partir. **Queda afuera, a propósito**: no hay temporizador de descanso entre series (era una mejora visual de la vista previa, no algo que hiciera falta para que los datos queden guardados correctamente).
- **Pagos**: crear planes de pago, registrar un cobro por cliente (con monto, vencimiento, estado y método), marcar como pagado, y que el cliente suba su comprobante para un pago pendiente. El entrenador ve un resumen de lo pendiente y lo cobrado este mes.
- **Mensajes**: un hilo de conversación por cliente, con contador de mensajes sin leer en la lista del entrenador. Es solo texto por ahora — no hay forma de enviar fotos ni archivos adjuntos ahí.
- **Configuración**: cada quien puede editar su nombre y teléfono, y cambiar su contraseña.

- **Importar ejercicios y rutinas desde Excel, Word o texto pegado**: en "Ejercicios" hay un botón "Importar" que lee un Excel o Word con columnas como "Ejercicio", "Músculo", "Equipamiento", etc., e intenta hacer coincidir cada valor con tu catálogo — siempre te muestra una tabla de revisión antes de crear nada. En el Constructor de rutinas, "Importar rutina" hace lo mismo pero además intenta encontrar cada ejercicio importado dentro de tu biblioteca ya existente (si no encuentra uno que coincida, te deja elegirlo a mano antes de confirmar — no se puede agregar un ejercicio que no exista en tu biblioteca). **Para PDF no hay lectura automática** en ninguna de las dos pantallas: no tenemos una librería de lectura de PDF en este proyecto, así que la solución es abrir el PDF, copiar el texto, y pegarlo en el cuadro de texto — ahí sí se interpreta automáticamente.

**Todavía no está conectado**: fotos de progreso, Sugerencias, Reportes (ahora que el cliente ya puede entrenar y dejar datos reales, estas dos ya se pueden construir con sentido en la próxima entrega).
