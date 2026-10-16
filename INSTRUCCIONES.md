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

3.5. Repite lo mismo con `part3d_migration.sql`: **New query**, pega todo su contenido, **Run**. Crea una tabla nueva (no toca ninguna de las que ya tenés) para el cuestionario de bienestar diario. **Obligatorio** para que esa pantalla funcione.

3.6. Repite lo mismo con `part3e_migration.sql`: **New query**, pega todo su contenido, **Run**. Agrega una sola columna a `client_files` (no borra nada) para poder etiquetar cada foto de progreso como de frente, de espalda, lado derecho o lado izquierdo. **Obligatorio** para las fotos de progreso.

3.7. Repite lo mismo con `part3f_migration.sql`: **New query**, pega todo su contenido, **Run**. Agrega una sola columna a `programs` (no borra nada) para poder habilitar más de una rutina por día en un programa puntual. **Obligatorio** para el límite de una rutina por día.

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

- **Mi rutina (del lado del cliente)**: el cliente ve las semanas de su programa activo, elige una rutina, y la entrena de verdad — marca cada serie como hecha con sus repeticiones, carga y RIR reales, o un simple "hecho" para los ejercicios de cardio. Cada ejercicio muestra también el descanso y el tempo que prescribiste. Al marcar una serie como hecha, arranca un cronómetro de descanso real (con +15s y Saltar) usando el descanso que prescribiste para ese ejercicio — aparece pegado justo debajo de la serie que acaba de marcar (o de la ronda, si es una biserie), no fijo arriba de la pantalla, así no hace falta scrollear para verlo. Al terminar, deja su esfuerzo percibido de la sesión y comentarios.
- **Pagos**: crear planes de pago, registrar un cobro por cliente (con monto, vencimiento, estado y método), marcar como pagado, y que el cliente suba su comprobante para un pago pendiente. El entrenador ve un resumen de lo pendiente y lo cobrado este mes.
- **Mensajes**: un hilo de conversación por cliente, con contador de mensajes sin leer en la lista del entrenador. Es solo texto por ahora — no hay forma de enviar fotos ni archivos adjuntos ahí.
- **Configuración**: cada quien puede editar su nombre y teléfono, y cambiar su contraseña.

- **Mover entrenadores de organización** (Super Admin, en Usuarios): solo cuando el entrenador no tiene clientes asignados todavía — si tuviera, perdería el acceso a ellos al instante, porque sus clientes se quedarían en la organización anterior. **Eliminar una cuenta por completo sigue sin ser posible** desde la app (necesitaría la misma pieza técnica que el envío automático de correos); "Desactivar" sigue siendo el equivalente práctico.
- **Eliminar clientes** (en la ficha del cliente): solo si no tiene programas ni planes de pago asociados — si los tiene, te lo explica y te sugiere "Dar de baja" en su lugar, que sí conserva el historial.
- **Eliminar programas y rutinas**: esto ya estaba construido desde una entrega anterior — el botón para eliminar un programa está en Planificación (al lado de cada pastilla), y para eliminar una rutina específica, la "X" al lado de cada rutina en el Constructor.
- **Formulario de ingreso ampliado**: ahora también pide notas médicas (medicamentos, alergias, condiciones), calidad de la alimentación, nivel de estrés, equipamiento disponible, horario preferido, y contacto de emergencia — campos que ya existían en la base de datos desde el principio pero nunca se mostraban en el formulario. La ficha del cliente, del lado del entrenador, también muestra todo esto ahora.
- **Constructor — duplicar y reordenar rutinas**: cada rutina dentro de una semana ahora tiene flechas para moverla antes/después, y un botón para duplicarla completa (bloques y ejercicios, sin tocar cargas) dentro de la misma semana.
- **Planificación — duración derivada**: ya no se pide la duración al crear un programa. Un programa ATR usa sus fases fijas de siempre; uno de método libre arranca con un bloque de 1 semana y la duración total es, de ahí en más, la suma de los bloques — crece sola a medida que agregás o alargás bloques, sin ningún tope que bloquee. Si acortás un bloque, las semanas ya creadas no se borran (mismo criterio de seguridad de siempre, ahora automático). Se sacó el botón de "Extender duración" porque ya no hace falta.
- **Series gigantes solo con ejercicios seguidos**: en el Constructor, agrupar 3 o más ejercicios como "superserie" ahora exige que estén uno justo después del otro en la lista, sin nada en el medio — si no, te avisa y no los agrupa. Para una biserie (2 ejercicios) no hace falta que estén seguidos, igual que antes. Cada grupo que armás por separado ya recibía su propia letra (A1/A2, después B1/B2, después C1/C2...) — eso ya funcionaba bien, lo que faltaba era esta regla de continuidad para las series de 3+.
- **Una rutina por día, salvo excepción**: por defecto, un cliente no puede completar más de una rutina el mismo día — si lo intenta, le avisa que ya entrenó hoy y que hable con su entrenador. En Planificación, un casillero por programa ("Permitir más de una rutina por día") habilita lo contrario para ese programa puntual (útil para dobles turnos). Esta restricción no aplica cuando el entrenador carga la rutina él mismo desde "Entrenar con un cliente" — esa vía siempre queda libre, porque ahí el entrenador está presente viendo lo que realmente pasó.
- **Entrenar con un cliente** (nuevo, en el menú del entrenador): para cuando das la asesoría en persona. Elegís el cliente, la semana y la sesión, y cargás las series vos mismo con la misma pantalla que usa el cliente — biseries agrupadas y cronómetro de descanso incluidos. No pide el cuestionario de Bienestar (es del cliente, no tuyo), y queda guardado en el historial del cliente exactamente igual que si lo hubiera cargado él.
- **Sugerencias**: calcula alertas en el momento (no se guardan en ninguna tabla aparte) a partir de los datos reales de todos tus clientes activos — sin entrenamientos en los últimos 10 días, baja adherencia (menos del 60% de lo programado en 14 días), bienestar bajo sostenido (3+ días en riesgo en 14 días), evaluación vencida (más de 60 días sin una), pago vencido, y estancamiento de fuerza (el 1RM más reciente no mejoró respecto al anterior). Cada una tiene un botón "Revisar" que te lleva directo a la pantalla correspondiente. Los umbrales (10 días, 60%, 3 días, 60 días) son una decisión razonable mía, no una norma externa — si alguno no encaja con cómo trabajás, decímelo y lo ajusto. En el panel de Inicio aparece un aviso liviano con el total, sin repetir la lógica del panel de bienestar que ya estaba ahí.
- **Bienestar** (basado en tu planilla WAPerformance): el cuestionario aparece automáticamente **cada vez que el cliente inicia una rutina**, aunque sea la segunda o tercera del mismo día — si ya había completado uno hoy, el formulario se abre con esos mismos valores ya cargados, para que solo ajuste lo que cambió en vez de empezar de cero. Pide horas de sueño reales, y 5 parámetros de 1 a 5 (calidad de sueño, fatiga, energía, estrés, dolor muscular — en los 5, 5 es siempre el mejor estado), más localización del dolor si corresponde. Calcula el **Wellness Score** (promedio × 20, de 0 a 100) con el semáforo exacto de tu planilla: 🟢 Óptimo (80+), 🟡 Precaución (60-79), 🔴 Riesgo (menos de 60) — y marca una alerta puntual aparte si algún parámetro específico es ≤2, aunque el score total esté bien. El entrenador ve, por cliente, el historial de 30 días con el promedio móvil de 7 días y la tendencia (↑/↓), y puede dejar una nota de "ajuste aplicado" frente a una alerta (protegida a nivel de base de datos: el cliente no puede escribir ahí, ni siquiera llamando a Supabase directamente). En el panel de Inicio del entrenador aparece un resumen de las alertas del día en todos sus clientes — ahí es donde realmente "se entera" sin tener que ir a buscarlo cliente por cliente.
  - **Dejado afuera a propósito**: la tabla por posición (es específica de fútbol); la línea base individual por desvío % (tiene sentido recién con 5+ registros históricos por cliente); y el patrón grupal de 5+ alertas el mismo día (pensado para planteles grandes). Decímelo si alguno de estos te hace falta.
- **Fotos de progreso**: tanto el entrenador (nuevo ítem "Fotos" en su menú) como el cliente (ahora sí conectado "Mi progreso", antes decía "próximamente") suben hasta 4 fotos de una vez (de frente, de espalda, lado derecho, lado izquierdo — no hace falta completar las 4 juntas), con una fecha y notas compartidas. La galería las agrupa por sesión (fecha): cada tarjeta muestra las fotos de ese día lado a lado con su etiqueta, y al abrir una se puede saltar entre los ángulos de esa misma sesión sin cerrar la ventana. El entrenador puede marcar cada foto como "solo yo la veo" o "el cliente también la ve" — el cliente nunca puede ver una foto marcada como privada, ni cambiarle la visibilidad a las suyas después de subirlas. Usa `client_files`, que ya estaba lista desde el script original (con una columna nueva para el ángulo), y el mismo bucket de almacenamiento que ya usás para los comprobantes de pago. Límite de 10 MB por foto (viene del bucket, compartido con los comprobantes). elige un cliente y ve su evolución real, en gráficos — peso y % de grasa corporal, circunferencias (eligiendo la zona), Σ8 de pliegues ISAK, fuerza/1RM estimado por ejercicio, récords personales (el mejor 1RM de cada ejercicio probado), comparación lado a lado entre dos evaluaciones puntuales con la diferencia calculada, Wellness Score total y desglosado por los 5 parámetros, progreso real por cada ejercicio entrenado (carga y repeticiones, tomado de las sesiones completadas, no solo de las pruebas de Evaluaciones), y tres vistas del entrenamiento por semana (sesiones, volumen, RPE promedio). Cada gráfico avisa cuando todavía no hay suficientes datos para mostrar una tendencia, en vez de mostrar algo vacío o engañoso.
  - **El cliente tiene su propia versión** ("Mis reportes" en su menú) con exactamente los mismos gráficos de sus propios datos, de solo lectura.
  - **Exportar a PDF**: tanto el entrenador como el cliente tienen un botón "Exportar/Descargar PDF" que genera un archivo con todo el reporte tal como se ve en pantalla, listo para mandar por WhatsApp o email. Esto necesita dos librerías nuevas (`jspdf` y `html2canvas`) agregadas a `package.json` — corré `npm install` antes de probar.
- **Evaluaciones**: elige un cliente, registra una evaluación (fecha y tipo), y completa cualquiera de las 8 categorías — datos corporales, circunferencias, pliegues cutáneos, pruebas de fuerza (con 1RM estimado automático por la fórmula de Epley si no hiciste un 1RM directo), pruebas de potencia, de resistencia, de movilidad y de flexibilidad. Un desplegable deja elegir cuál completar en cada momento, mostrando cuántos datos ya tiene cada una. Arriba, una sugerencia automática según el objetivo y el perfil del cliente (por ejemplo, a alguien con objetivo de pérdida de grasa le sugiere circunferencias y pliegues; a alguien con una lesión declarada, movilidad). El cliente ve su propio historial, de solo lectura.
  - **Protocolo ISAK (pliegues)**: ahora están los 8 pliegues estándar (se agregaron bíceps y pantorrilla medial, antes faltaban). En la sección de Pliegues cutáneos se muestra la **Σ8** (suma de los 8), que es lo que te avisa si falta alguno. Decidí **no** agregar una conversión automática a "% de grasa" específicamente etiquetada como "fórmula de Yuhasz": al verificarla antes de programarla, encontré que hay confusión documentada en la propia literatura científica sobre a quién pertenecen realmente esos coeficientes (hay un estudio publicado específicamente sobre esta confusión, entre Yuhasz y una reinterpretación posterior de Faulkner). Preferí no escribir en el código un número que ni la disciplina tiene del todo claro, antes que arriesgarme a que uses un valor mal atribuido con tus atletas. La Σ8 sola, comparada entre evaluaciones del mismo cliente, es además el indicador que la misma literatura señala como más confiable para trackear cambios reales — así que no es una renuncia, es la opción más sólida de las dos.
  - **Estimación de % de grasa corporal**: en "Datos corporales", un botón calcula el % de grasa automáticamente a partir de lo ya cargado en la misma evaluación — usa pliegues (fórmula de Jackson-Pollock de 3 sitios, necesita la fecha de nacimiento del cliente y los 3 pliegues correspondientes a su sexo) si están disponibles, o si no, circunferencias (método Naval, necesita sexo, estatura, cuello y cintura — y cadera en mujeres). Si faltan datos, te dice exactamente cuáles. **No calculamos masa muscular automáticamente**: no existe un método simple y confiable para eso a partir de solo estas medidas (los que existen necesitan correcciones por etnia y son bastante menos precisos) — ese campo sigue siendo de carga manual, para cuando el cliente se lo midió por otro medio (bioimpedancia, DEXA).
- **Importar ejercicios y rutinas desde Excel, Word o texto pegado**: en "Ejercicios" hay un botón "Importar" que lee un Excel o Word con columnas como "Ejercicio", "Músculo", "Equipamiento", etc., e intenta hacer coincidir cada valor con tu catálogo — siempre te muestra una tabla de revisión antes de crear nada. En el Constructor de rutinas, "Importar rutina" hace lo mismo pero además intenta encontrar cada ejercicio importado dentro de tu biblioteca ya existente (si no encuentra uno que coincida, te deja elegirlo a mano antes de confirmar — no se puede agregar un ejercicio que no exista en tu biblioteca). **Para PDF no hay lectura automática** en ninguna de las dos pantallas: no tenemos una librería de lectura de PDF en este proyecto, así que la solución es abrir el PDF, copiar el texto, y pegarlo en el cuadro de texto — ahí sí se interpreta automáticamente.

**Todavía no está conectado**: fotos de progreso, Sugerencias, Reportes (ahora que el cliente ya puede entrenar y dejar datos reales, estas dos ya se pueden construir con sentido en la próxima entrega).
