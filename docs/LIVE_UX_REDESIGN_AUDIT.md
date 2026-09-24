# Auditoría y plan de rediseño de la experiencia en vivo

**Proyecto:** Escuela de la Riqueza · **Fecha:** 24 de septiembre de 2026  
**Estado:** propuesta para lectura y aprobación antes de implementar.  
**Base de código auditada:** `aa454651c69f8d63d692eba329e2716cb39e60f1`.

> **Recomendación:** reorganizar la sala alrededor del video, permitir escuchar sin obstáculos y convertir el chat en una zona adaptable. La experiencia debe sentirse simple tanto en un celular vertical como en una pantalla grande, conservando la identidad dorada y oscura de la Escuela. El trabajo incluye comportamiento, accesibilidad y estados de error; una renovación de colores y bordes sería insuficiente.

> **Límite de esta revisión:** la evidencia proviene de lectura del repositorio y documentación oficial. No se ejecutó una sesión real de transmisión, una inspección visual renderizada ni pruebas en dispositivos físicos. No se verificaron la base de datos desplegada, la configuración de Cloudflare ni las métricas de producción. Los riesgos de ejecución se identifican como pendientes de reproducción. Este trabajo crea únicamente este documento: no modifica código de la aplicación.

## 1. Qué se propone aprobar

1. Una sala con cuatro áreas claras: navegación mínima, video, contexto de la transmisión y conversación.
2. Una invitación compacta para activar el audio que deje visible el video y permita continuar sin sonido.
3. Un chat que respete la lectura, conserve borradores y muestre los errores de envío.
4. Modos normal, cine y pantalla completa definidos por su función y por la capacidad real del dispositivo.
5. Un diseño adaptable al ancho **y a la altura disponible**, al teclado, a la orientación y a las áreas seguras.
6. Una implementación por etapas verificables que preserve acceso, permisos, transmisión, grabaciones y convivencia con el modo podcast.

La referencia de Kick sirve para estudiar jerarquía, controles y conversación. No implica copiar su marca, reproducir funciones de entretenimiento ajenas al producto ni prometer la misma infraestructura o latencia.

### Decisiones sugeridas para revisar

| Decisión | Recomendación inicial | Consecuencia |
|---|---|---|
| Identidad visual | Mantener gold/dark y simplificar capas, bordes y efectos | Conserva el reconocimiento de la Escuela |
| Audio al entrar | Intentar reproducción silenciada cuando el navegador lo permita; ofrecer activación explícita | El inicio no depende de permisos de reproducción con sonido |
| Chat en celular | Disponible debajo del video y con control claro para ocultarlo | El alumno decide cuánto espacio dedica a conversar |
| Celular horizontal con poca altura | Prioridad al video; conversación mediante panel invocable | Evita columnas o controles comprimidos |
| Pantalla completa | Preferir contenedor si está soportado; ofrecer video nativo como alternativa | El chat puede no estar disponible en el modo nativo |
| Entrada pública y planes | Conservar reglas vigentes; verificar su contrato antes de reorganizar componentes | El rediseño no redefine el acceso comercial |
| Alcance de chat | Mejorar lectura, envío y errores; mantener las funciones actuales pertinentes | Evita convertir el proyecto en una red social |
| Subtítulos en vivo | Verificar origen y disponibilidad de pistas antes de comprometer accesibilidad completa | Puede necesitar trabajo en la emisión o proveedor |

Estas recomendaciones no equivalen a decisiones aprobadas por el usuario.

## 2. Alcance y método

### Dentro del alcance

- Sala del alumno y sus entradas: navegación, contexto, horario, estado de la emisión, video, audio y chat.
- Controles del reproductor, carga, pausa, reconexión, errores, pantalla completa y alternativas compatibles.
- Celular, tablet, escritorio, ventanas pequeñas, zoom, orientación y navegación con teclado o asistencia.
- Estados de acceso público/autenticado y permisos existentes, sin modificar su intención.
- Panel administrativo en lo que afecta crear, activar, emitir, pausar, finalizar y comprobar la experiencia del alumno.
- Arquitectura de componentes y secuencia de trabajo necesarias para ejecutar el rediseño sin romper el medio activo.

### Fuera del alcance de esta entrega

- Implementación, refactors, migraciones, despliegues o cambios en configuraciones de proveedores.
- Añadir monetización de chat, clips, regalos, badges comerciales, encuestas o funciones nuevas sin una decisión posterior.
- Migrar el transporte de video para buscar menor latencia.
- Cambiar el reproductor del catálogo o el modo podcast como proyecto independiente.
- Certificar compatibilidad con todos los dispositivos o conformidad de accesibilidad antes de probarla.

### Cómo leer la evidencia

| Etiqueta | Significado | Uso |
|---|---|---|
| **CONFIRMADO** | Comportamiento o estructura visible en el código auditado | Es evidencia del repositorio, no de su ejecución en producción |
| **RIESGO** | Consecuencia probable que depende de navegador, contenido o estado | Debe reproducirse antes de tratarla como falla observada |
| **PROPUESTA** | Comportamiento futuro recomendado | Requiere implementación y validación |
| **DEPENDENCIA** | Requisito que depende de emisión, proveedor, permisos o decisión comercial | No se resuelve sólo con cambios visuales |

Los archivos y líneas de esta auditoría corresponden al commit indicado arriba; pueden desplazarse después de una modificación. No se deben usar los documentos históricos como prueba del comportamiento actual sin contrastarlos con el código.

## 3. Resumen de prioridades

| Nivel | Qué significa | Trabajo recomendado |
|---|---|---|
| **P0** | Riesgo de impedir escuchar, recuperar la reproducción o participar sin pérdida de información | Resolver antes de presentar el rediseño como listo |
| **P1** | Problema que afecta la experiencia habitual o una familia de dispositivos | Parte del primer rediseño usable |
| **P2** | Mejora de claridad, consistencia o eficiencia sin bloquear el uso principal | Completar antes de cerrar la experiencia visual |
| **P3** | Evolución opcional y medible | Considerar sólo después de estabilizar lo esencial |

Los niveles representan prioridad propuesta de producto, no una clasificación de vulnerabilidades. La confirmación de fallas en ejecución puede elevar o bajar su urgencia.

## 4. Hallazgos del repositorio, impacto y cambio recomendado

Los hallazgos agrupan problemas relacionados para permitir una implementación coherente. **CONFIRMADO** significa visible en la fuente; las consecuencias en un navegador concreto siguen pendientes de reproducción cuando se indica **RIESGO**.

### 4.1 Fortalezas que conviene conservar

- El reproductor HLS es compartido y contempla reproducción inline, inicio silenciado y video sin recorte con `object-contain`. No hace falta reemplazarlo sólo por renovar el aspecto. [LiveHLSPlayer.tsx:455](../src/components/feature/LiveHLSPlayer.tsx#L455).
- La lógica actual conserva el player montado durante la pausa y distingue intención manual de interrupciones del sistema. Es una base valiosa para mantener continuidad. [LiveHLSPlayer.tsx:416](../src/components/feature/LiveHLSPlayer.tsx#L416), [VIPLiveRoom.tsx:145](../src/pages/student/VIPLiveRoom.tsx#L145).
- La activación de audio espera el resultado real de `play()` y tiene recuperación visible. El rediseño debe preservar esa comprobación. [VIPLiveRoom.tsx:79](../src/pages/student/VIPLiveRoom.tsx#L79), [PublicLiveRoom.tsx:96](../src/pages/public/PublicLiveRoom.tsx#L96).
- La rama hls.js ya implementa backoff, recuperación de manifiesto, watchdog y cambio de calidad sin vaciar el buffer mediante `nextLevel`. No eliminar esas protecciones durante la extracción de controles. [LiveHLSPlayer.tsx:125](../src/components/feature/LiveHLSPlayer.tsx#L125), [LiveHLSPlayer.tsx:270](../src/components/feature/LiveHLSPlayer.tsx#L270), [LiveHLSPlayer.tsx:363](../src/components/feature/LiveHLSPlayer.tsx#L363).
- Los controles tienen demora para el spinner y un indicador de cercanía al directo con histéresis; se deben conservar sus objetivos evitando información engañosa durante pausa. [LivePlayerControls.tsx:82](../src/components/feature/LivePlayerControls.tsx#L82), [LivePlayerControls.tsx:117](../src/components/feature/LivePlayerControls.tsx#L117).
- El chat público ya evita seguir automáticamente cuando el lector se aleja del final y utiliza merge por ID con orden. Es una base para unificar la experiencia, no empezar de cero. [PublicLiveChat.tsx:26](../src/components/feature/PublicLiveChat.tsx#L26), [mergeMessagesById.ts:11](../src/lib/chat/mergeMessagesById.ts#L11).
- El polling público conserva la sala ante fallos transitorios y confirma respuestas vacías antes de borrarla. [PublicLiveRoom.tsx:158](../src/pages/public/PublicLiveRoom.tsx#L158).
- Ya existe soporte global para movimiento reducido, primitivas Radix y rutas de vivo sin transforms que interfieran con elementos fijos. No describir la app como carente de toda accesibilidad o adaptación. [MotionProvider.tsx:19](../src/components/providers/MotionProvider.tsx#L19), [routes.tsx:36](../src/routes.tsx#L36).
- El texto de mensajes se presenta mediante React, y el chat público ofrece inicio de sesión con retorno. Conservar el tratamiento seguro de contenido y la continuidad de navegación. [PublicLiveChat.tsx:94](../src/components/feature/PublicLiveChat.tsx#L94).

### 4.2 Reproductor, audio y controles

#### F01 · P1 · La invitación de audio domina y bloquea el video

- **CONFIRMADO:** ocupa todo el player con capa oscura, blur, animación y botón grande; no ofrece cerrar ni continuar silenciado. La capa se ubica por encima de los controles. [VIPLiveRoom.tsx:501](../src/pages/student/VIPLiveRoom.tsx#L501), [PublicLiveRoom.tsx:456](../src/pages/public/PublicLiveRoom.tsx#L456).
- **Impacto:** dificulta mirar la emisión nítidamente sin activar sonido y convierte una preferencia en un paso obligatorio de la presentación.
- **Cambio:** aviso compacto descartable, control persistente de audio y ausencia de blur global. Preservar el resultado real de `play()` antes de confirmar éxito.
- **Aceptación:** el alumno puede mirar, elegir silencio y activar audio después; no reaparece el onboarding al silenciar desde la barra.

#### F02 · P2 · Una pulsación de audio puede ejecutar dos handlers

- **CONFIRMADO:** el contenedor y el botón invocan la misma acción por bubbling. [VIPLiveRoom.tsx:510](../src/pages/student/VIPLiveRoom.tsx#L510), [PublicLiveRoom.tsx:465](../src/pages/public/PublicLiveRoom.tsx#L465).
- **RIESGO:** solicitudes duplicadas de reproducción y feedback difícil de razonar.
- **Cambio y aceptación:** una única acción por interacción; comprobar touch, teclado y clic sin duplicar llamadas.

#### F03 · P1 · El primer toque para ver controles también cambia reproducción

- **CONFIRMADO:** `touchStart` muestra controles, mientras el clic ejecuta `togglePlay`. [LivePlayerControls.tsx:274](../src/components/feature/LivePlayerControls.tsx#L274).
- **RIESGO:** el usuario intenta revelar la barra y pausa el video involuntariamente; debe reproducirse en dispositivos.
- **Cambio y aceptación:** distinguir revelar controles de pulsar una acción; un toque exploratorio no altera el medio sin una semántica explícita y validada.

#### F04 · P0 · La pausa de la sala no gobierna todos los caminos de arranque

- **CONFIRMADO:** el arranque tras cargar manifiesto puede llamar a reproducción sin comprobar `roomPaused`; el efecto de pausa no se vuelve a ejecutar por cada carga de metadata/manifiesto. [LiveHLSPlayer.tsx:209](../src/components/feature/LiveHLSPlayer.tsx#L209), [LiveHLSPlayer.tsx:423](../src/components/feature/LiveHLSPlayer.tsx#L423).
- **RIESGO:** reproducción debajo del estado visual de pausa; la secuencia exacta y audibilidad requieren una prueba real.
- **Cambio:** puerta común de reproducción basada en permiso, estado de sala, intención local y disponibilidad del medio.
- **Aceptación:** entrar pausado, recuperar manifiesto estando pausado y reanudar obedecen la misma regla en ambas ramas del player.

#### F05 · P1 · La barra puede ocultarse durante una interacción

- **CONFIRMADO:** el timeout de tres segundos desmonta controles sin una condición completa para foco, menú abierto o manipulación. [LivePlayerControls.tsx:61](../src/components/feature/LivePlayerControls.tsx#L61), [LivePlayerControls.tsx:386](../src/components/feature/LivePlayerControls.tsx#L386).
- **Impacto:** una persona que navega despacio, con teclado o táctil puede perder el objetivo de su acción.
- **Cambio y aceptación:** no ocultar mientras haya foco, menú abierto, drag, pausa o error pertinente; respetar interacción y luego reiniciar el plazo.

#### F06 · P1 · Fullscreen, menús y orientación no comparten un contrato completo

- **CONFIRMADO:** el fullscreen de contenedor apunta al padre del video mientras el menú utiliza un portal al `body`; son árboles visuales distintos. La entrada prioriza fullscreen nativo si el video expone la función y la salida no contempla de igual modo todos los mecanismos nativos. [LiveHLSPlayer.tsx:90](../src/components/feature/LiveHLSPlayer.tsx#L90), [LiveHLSPlayer.tsx:115](../src/components/feature/LiveHLSPlayer.tsx#L115), [dropdown-menu.tsx:19](../src/components/ui/dropdown-menu.tsx#L19).
- **CONFIRMADO:** se intenta bloquear orientación después de solicitar pantalla completa y se desbloquea desde la acción propia, sin cubrir todas las salidas. [LivePlayerControls.tsx:220](../src/components/feature/LivePlayerControls.tsx#L220).
- **RIESGO:** menú fuera de la superficie visible, controles que no reflejan la salida del sistema y orientación residual. Validar en navegador; la API nativa puede no mostrar chat ni overlays propios.
- **Cambio y aceptación:** portal dentro del contenedor visible cuando corresponda, manejo de rechazo, eventos como fuente de estado y alternativa nativa explícita. No depender de bloqueo de orientación para lograr un layout usable.

#### F07 · P2 · Los controles son pequeños y distribuyen demasiadas acciones flotantes

- **CONFIRMADO:** varios botones sólo dimensionan el SVG a 20–22 px sin área mínima explícita; el selector de calidad flota independientemente y aparecen términos como “renditions”. [LivePlayerControls.tsx:283](../src/components/feature/LivePlayerControls.tsx#L283), [LivePlayerControls.tsx:316](../src/components/feature/LivePlayerControls.tsx#L316), [LivePlayerControls.tsx:396](../src/components/feature/LivePlayerControls.tsx#L396).
- **Impacto:** densidad visual irregular, objetivos táctiles estrechos y lenguaje interno del proveedor.
- **Cambio y aceptación:** agrupar calidad/ajustes en una barra coherente; botones con objetivos de producto medidos, texto claro y nombre accesible. Mostrar sólo opciones soportadas por el motor en uso.

#### F08 · P1 · Preferencia de calidad y calidad efectiva se mezclan

- **CONFIRMADO:** eventos `LEVEL_SWITCHED` actualizan el mismo estado que usa el selector Auto/manual. [LiveHLSPlayer.tsx:242](../src/components/feature/LiveHLSPlayer.tsx#L242), [VIPLiveRoom.tsx:479](../src/pages/student/VIPLiveRoom.tsx#L479), [PublicLiveRoom.tsx:436](../src/pages/public/PublicLiveRoom.tsx#L436), [LivePlayerControls.tsx:253](../src/components/feature/LivePlayerControls.tsx#L253).
- **RIESGO:** ABR cambia resolución y la interfaz parece abandonar Auto aunque la elección del usuario siga siendo automática.
- **Cambio y aceptación:** separar preferencia y nivel observado; ejemplo **Automática · 720p**, sin afirmar control manual en una rama que no lo expone.

#### F09 · P1 · Hay caminos de error del medio que no llegan a una recuperación visible

- **CONFIRMADO:** clases de error se envían a `onError`, pero las salas conectan `onFatalError`; el video nativo no declara `onError`. La rama nativa tampoco incluye el mismo backoff/watchdog de hls.js. [LiveHLSPlayer.tsx:331](../src/components/feature/LiveHLSPlayer.tsx#L331), [LiveHLSPlayer.tsx:379](../src/components/feature/LiveHLSPlayer.tsx#L379), [LiveHLSPlayer.tsx:455](../src/components/feature/LiveHLSPlayer.tsx#L455), [VIPLiveRoom.tsx:465](../src/pages/student/VIPLiveRoom.tsx#L465), [PublicLiveRoom.tsx:422](../src/pages/public/PublicLiveRoom.tsx#L422).
- **RIESGO:** ciertos fallos dejan al alumno sin mensaje/reintento o con recuperación diferente según el motor.
- **Cambio y aceptación:** contrato común de errores y recuperación, con adaptadores por capacidad; probar timeout, manifiesto, error de medio y ruta nativa. No asumir que todo Safari usa la misma rama: la selección actual evalúa primero `Hls.isSupported()`.

#### F10 · P1 · La sala pública ofrece un ajuste de latencia sin efecto

- **CONFIRMADO:** pasa `smooth` fijo y callback sin operación mientras el menú ofrece baja latencia. Además, cambiar el perfil en el player reinicializa HLS. [PublicLiveRoom.tsx:429](../src/pages/public/PublicLiveRoom.tsx#L429), [PublicLiveRoom.tsx:449](../src/pages/public/PublicLiveRoom.tsx#L449), [LivePlayerControls.tsx:346](../src/components/feature/LivePlayerControls.tsx#L346), [LiveHLSPlayer.tsx:408](../src/components/feature/LiveHLSPlayer.tsx#L408).
- **Cambio:** retirar el control inoperante o implementar un contrato aprobado; no presentar latencia como una preferencia visual inocua.
- **Aceptación:** cada opción visible modifica una capacidad real, comunica el resultado y no promete latencia que depende de infraestructura.

#### F11 · P2 · Estado de volumen y eventos nativos pueden quedar desincronizados

- **CONFIRMADO:** volumen local sin escucha equivalente de `volumechange`; la sala puede reactivar a volumen uno. Los listeners nativos leen el video una vez aunque un retry pueda reemplazar su elemento. [LivePlayerControls.tsx:38](../src/components/feature/LivePlayerControls.tsx#L38), [LivePlayerControls.tsx:146](../src/components/feature/LivePlayerControls.tsx#L146), [LivePlayerControls.tsx:170](../src/components/feature/LivePlayerControls.tsx#L170), [VIPLiveRoom.tsx:99](../src/pages/student/VIPLiveRoom.tsx#L99), [VIPLiveRoom.tsx:123](../src/pages/student/VIPLiveRoom.tsx#L123).
- **RIESGO:** volumen o PiP/fullscreen mostrados no coinciden con el medio tras recuperación.
- **Cambio y aceptación:** suscripción a la identidad efectiva del elemento, estado derivado de eventos y conservación de intención del usuario. No exigir volumen programático idéntico en Apple y Android.

### 4.3 Composición, estados y continuidad de la sala

#### F12 · P1 · La composición móvil depende de media pantalla y sólo del ancho

- **CONFIRMADO:** ambas salas usan `50dvh` para video móvil y chat permanente, sobre raíz `100dvh` con overflow oculto. `useIsDesktop` cambia a partir de 768 px de ancho; el chat lateral pasa de 320 a 400 px en el siguiente rango. [VIPLiveRoom.tsx:299](../src/pages/student/VIPLiveRoom.tsx#L299), [VIPLiveRoom.tsx:761](../src/pages/student/VIPLiveRoom.tsx#L761), [PublicLiveRoom.tsx:323](../src/pages/public/PublicLiveRoom.tsx#L323), [PublicLiveRoom.tsx:657](../src/pages/public/PublicLiveRoom.tsx#L657), [useMediaQuery.ts:24](../src/hooks/useMediaQuery.ts#L24).
- **RIESGO:** reparto ineficiente, poco espacio al escribir y una maqueta de escritorio en un teléfono horizontal de poca altura.
- **Cambio y aceptación:** video proporcionado y conversación plegable; decisiones por espacio útil, altura y entrada. Probar 768 px con poca altura, no sólo una tablet ideal.

#### F13 · P1 · El contexto del evento pierde jerarquía en móvil

- **CONFIRMADO:** cabecera y tarjetas se superponen al video, mientras el título se oculta por debajo de 768 px. Volver tiene un objetivo base aproximado de 34 px por icono y padding. [VIPLiveRoom.tsx:356](../src/pages/student/VIPLiveRoom.tsx#L356), [VIPLiveRoom.tsx:377](../src/pages/student/VIPLiveRoom.tsx#L377), [PublicLiveRoom.tsx:330](../src/pages/public/PublicLiveRoom.tsx#L330), [PublicLiveRoom.tsx:351](../src/pages/public/PublicLiveRoom.tsx#L351).
- **Cambio y aceptación:** título compacto visible fuera del contenido cuando sea inline, estado entendible y controles táctiles amplios. Probar títulos extensos y video con diapositivas.

#### F14 · P2 · La entrada cinemática y los estados grandes consumen espacio y tiempo

- **CONFIRMADO:** la intro VIP cubre pantalla y chat durante 3,5 segundos sin omitir; countdowns ocupan una superficie importante. [VIPLiveRoom.tsx:165](../src/pages/student/VIPLiveRoom.tsx#L165), [VIPLiveRoom.tsx:318](../src/pages/student/VIPLiveRoom.tsx#L318), [VIPLiveRoom.tsx:639](../src/pages/student/VIPLiveRoom.tsx#L639), [PublicLiveRoom.tsx:593](../src/pages/public/PublicLiveRoom.tsx#L593).
- **Cambio:** transición integrada, breve o prescindible, estados legibles en poca altura y respeto de movimiento reducido también en esperas y scroll imperativo.
- **Aceptación:** el alumno accede a la tarea sin esperar una decoración obligatoria; preservar el soporte global de movimiento reducido ya existente.

#### F15 · P1 · Teclado y áreas seguras no tienen tratamiento explícito en las regiones auditadas

- **CONFIRMADO:** no se encontró manejo específico de safe areas/viewport visual en salas/chat; el meta viewport no incluye `viewport-fit=cover`. [index.html:6](../index.html#L6), [LivePlayerControls.tsx:393](../src/components/feature/LivePlayerControls.tsx#L393).
- **RIESGO:** controles obstruidos por indicador inferior, notch, barras o teclado. No se afirma una falla universal: la app sí usa unidades dinámicas de altura.
- **Cambio y aceptación:** resolver según diseño y pruebas físicas; comprobar el composer al abrir/cerrar teclado y al rotar, sin suponer que añadir `dvh` resuelve todo.

#### F16 · P1 · La precedencia de estados y los errores de carga requieren definición

- **CONFIRMADO:** el error inicial VIP se registra en consola y puede terminar en una vista genérica de ausencia de eventos; su condición de player combina estado de sala con conexión del input y antecede la vista finalizada. [VIPLiveRoom.tsx:151](../src/pages/student/VIPLiveRoom.tsx#L151), [VIPLiveRoom.tsx:287](../src/pages/student/VIPLiveRoom.tsx#L287), [VIPLiveRoom.tsx:141](../src/pages/student/VIPLiveRoom.tsx#L141), [VIPLiveRoom.tsx:448](../src/pages/student/VIPLiveRoom.tsx#L448), [VIPLiveRoom.tsx:591](../src/pages/student/VIPLiveRoom.tsx#L591).
- **RIESGO:** una sala finalizada con señal aún conectada conserva presentación de reproducción; errores parecen “no hay eventos”.
- **Cambio y aceptación:** precedencia explícita y recuperación por tipo de estado; probar finalización con OBS conectado, error de consulta, ausencia real y acceso restringido. Preservar la resiliencia del polling público.

#### F17 · P1 · Rotación y cambio de sala pueden conservar o perder estados incorrectos

- **CONFIRMADO:** las ramas desktop/mobile montan chat en posiciones distintas; los estados locales de audio/error/calidad no tienen un reset explícito por `live.id` en las salas auditadas. [VIPLiveRoom.tsx:35](../src/pages/student/VIPLiveRoom.tsx#L35), [VIPLiveRoom.tsx:750](../src/pages/student/VIPLiveRoom.tsx#L750), [VIPLiveRoom.tsx:763](../src/pages/student/VIPLiveRoom.tsx#L763).
- **RIESGO:** cruzar el breakpoint pierde borrador/lectura y cambiar de evento hereda onboarding o selección indebida.
- **Cambio y aceptación:** persistir estados de interfaz durante resize; reiniciar los específicos al cambiar de sala; limpiar suscripciones antiguas y conservar una sola identidad de video.

#### F18 · P2 · Repetición y cierre difieren entre rutas

- **CONFIRMADO:** la sala pública puede pasar a replay y retirar chat/presencia, mientras VIP finalizada muestra agradecimiento/chat. El replay alterna video nativo R2 e iframe según la fuente. [PublicLiveRoom.tsx:86](../src/pages/public/PublicLiveRoom.tsx#L86), [PublicLiveRoom.tsx:314](../src/pages/public/PublicLiveRoom.tsx#L314), [PublicLiveRoom.tsx:543](../src/pages/public/PublicLiveRoom.tsx#L543), [VIPLiveRoom.tsx:591](../src/pages/student/VIPLiveRoom.tsx#L591).
- **Cambio:** definir continuidad visual por elegibilidad real, estados de carga/error/reintento y diferencias entre fuentes.
- **Aceptación:** no prometer replay a quien no tiene acceso ni asumir que todos los reproductores permiten los mismos controles.

### 4.4 Conversación, datos y accesibilidad

#### F19 · P1 · El chat autenticado fuerza el desplazamiento al llegar mensajes

- **CONFIRMADO:** ejecuta `scrollIntoView` suave en cada cambio de mensajes; el público ya usa umbral de cercanía al final. El contador VIP existente cubre chat oculto en escritorio, no lectura histórica móvil. [LiveChat.tsx:47](../src/components/feature/LiveChat.tsx#L47), [PublicLiveChat.tsx:26](../src/components/feature/PublicLiveChat.tsx#L26), [VIPLiveRoom.tsx:65](../src/pages/student/VIPLiveRoom.tsx#L65).
- **Cambio y aceptación:** conservar ancla de lectura, contador de nuevos y retorno voluntario; desplazar sólo la región del chat, sin arrastrar la página/video.

#### F20 · P1 · Carga inicial y Realtime pueden competir por el historial

- **CONFIRMADO:** la carga reemplaza mensajes; las inserciones consultan perfiles de manera asíncrona y anexan al completarse, sin un merge ordenado equivalente al público. [LiveChat.tsx:73](../src/components/feature/LiveChat.tsx#L73), [LiveChat.tsx:109](../src/components/feature/LiveChat.tsx#L109), [LiveChat.tsx:123](../src/components/feature/LiveChat.tsx#L123).
- **RIESGO:** perder una inserción recibida durante la carga inicial o mostrar orden distinto por respuestas de perfiles. La acumulación sin ventana también requiere medirse.
- **Cambio y aceptación:** merge determinista por ID/orden estable, cargar últimos mensajes y política de historial definida; probar fetch lento, inserciones concurrentes y perfiles con latencias invertidas.

#### F21 · P1 · El SQL público del repositorio limita a los primeros mensajes

- **CONFIRMADO:** el comentario anuncia últimos mensajes, pero la consulta usa orden ascendente y `LIMIT`; la llamada usa 100 por defecto. Esto devuelve los primeros 100 en esa definición. [migrate-lives-public-link.sql:32](../sql/migrate-lives-public-link.sql#L32), [migrate-lives-public-link.sql:60](../sql/migrate-lives-public-link.sql#L60), [lives.ts:274](../src/lib/api/stream/lives.ts#L274).
- **Límite:** no se inspeccionó la función desplegada; no se afirma que producción tenga exactamente esta definición.
- **Cambio y aceptación:** comprobar despliegue y obtener últimos N con orden de presentación ascendente; probar 101, 200 y 500 mensajes con cursor estable. Cambiar sólo el orden visual no corrige qué filas se reciben.

#### F22 · P0 · Un fallo de envío puede perder el mensaje escrito

- **CONFIRMADO:** se borra el input antes de insertar y el error sólo va a consola; no hay un contrato de pendiente/reintento/conservación. [LiveChat.tsx:167](../src/components/feature/LiveChat.tsx#L167).
- **Impacto:** ante error, el alumno pierde lo que redactó y puede creer que lo envió.
- **Cambio y aceptación:** mantener borrador hasta confirmación o restaurarlo al fallar, feedback visible y reintento sin duplicados. Probar caída de red y rechazo de permisos.

#### F23 · P1 · El composer carece de apoyos accesibles y estados de conexión veraces

- **CONFIRMADO:** el campo no presenta label explícito y el botón de envío usa sólo icono; faltan tratamiento de composición, límite visible y estado pendiente. El indicador verde de tiempo real no deriva de la suscripción; errores públicos quedan en consola. [LiveChat.tsx:275](../src/components/feature/LiveChat.tsx#L275), [LiveChat.tsx:189](../src/components/feature/LiveChat.tsx#L189), [PublicLiveChat.tsx:56](../src/components/feature/PublicLiveChat.tsx#L56).
- **Cambio y aceptación:** campo etiquetado, error asociado, tamaño de lectura móvil apropiado, conexión/reconexión real y envío con IME/teclado virtual probado; el estado “sin mensajes” no oculta un fallo.

#### F24 · P2 · La presentación del chat usa espacio en decoración y reduce legibilidad

- **CONFIRMADO:** nombres de 10 px, horas de 9 px, burbujas, sombras y espaciado amplio conviven con texto principal pequeño. [LiveChat.tsx:206](../src/components/feature/LiveChat.tsx#L206), [LiveChat.tsx:231](../src/components/feature/LiveChat.tsx#L231), [PublicLiveChat.tsx:120](../src/components/feature/PublicLiveChat.tsx#L120).
- **Cambio:** filas compactas legibles, nombres con capitalización natural, jerarquía discreta de hora/rol y menos superficies.
- **Aceptación:** texto base propuesto de 14–16 CSS px, interlineado y espaciado validados, enlaces/nombres/emojis largos sin overflow. El mensaje de bienvenida no se presenta como mensaje fijado real.

#### F25 · P1 · Chat oculto y anuncios accesibles requieren control explícito

- **CONFIRMADO:** los paneles cerrados permanecen montados con ancho cero/opacidad, sin `inert`/`aria-hidden` en esas ramas; los chats no explicitan región de log ni estrategia de anuncios. [VIPLiveRoom.tsx:750](../src/pages/student/VIPLiveRoom.tsx#L750), [PublicLiveRoom.tsx:657](../src/pages/public/PublicLiveRoom.tsx#L657), [LiveChat.tsx:189](../src/components/feature/LiveChat.tsx#L189).
- **RIESGO:** foco en elementos invisibles y conversación difícil de seguir con lector de pantalla.
- **Cambio y aceptación:** panel cerrado fuera de interacción/foco con retorno al disparador; anuncios moderados de mensajes y estados, probados con VoiceOver/TalkBack. Mantener la suscripción no obliga a dejar controles ocultos accesibles.

#### F26 · P2 · Moderación y propagación de eliminaciones no están definidas en esta UI

- **CONFIRMADO:** no se hallaron controles de eliminar/reportar/bloquear/fijar/slow mode en los componentes auditados; Realtime escucha inserciones y el merge público conserva IDs ausentes. Las políticas SQL del repositorio requieren contraste con permisos desplegados. [LiveChat.tsx:123](../src/components/feature/LiveChat.tsx#L123), [mergeMessagesById.ts:11](../src/lib/chat/mergeMessagesById.ts#L11), [migrate-lives-schema.sql:27](../sql/migrate-lives-schema.sql#L27).
- **DEPENDENCIA:** decidir si moderación mínima es parte de una entrega posterior; no crear botones que aparenten autoridad sin backend/RLS/eventos apropiados.
- **Aceptación si se aprueba:** roles verificados en servidor, eliminación reflejada consistentemente y límites explícitos. No abrir escritura anónima ni aprovechar el rediseño para ampliar permisos.

#### F27 · P2 · Presencia y diálogo de espectadores necesitan claridad y revisión de privacidad

- **CONFIRMADO:** el diálogo puede mostrar “Cargando” con lista vacía aun si hay invitados; usa un scroll interno con altura considerable. La presencia pública incorpora nombre/avatar/plan y el diálogo muestra plan. [LiveViewersDialog.tsx:33](../src/components/feature/LiveViewersDialog.tsx#L33), [LiveViewersDialog.tsx:63](../src/components/feature/LiveViewersDialog.tsx#L63), [PublicLiveRoom.tsx:231](../src/pages/public/PublicLiveRoom.tsx#L231).
- **RIESGO:** estados ambiguos, scrolls anidados y exposición de datos de perfil que requiere revisar el contrato de audiencia. No se afirma una fuga de datos demostrada sin validar autorizaciones del canal.
- **Cambio y aceptación:** separar cargando/sin perfiles/con invitados, aclarar conteo aproximado y decidir datos visibles por audiencia. El plan comercial no se usa como rol de moderación.

### 4.5 Administración y documentación

#### F28 · P2 · La operación administrativa queda después de configuración extensa

- **CONFIRMADO:** configuración y formulario preceden los controles operativos; la vista previa inspeccionada muestra imagen, no la experiencia video/chat del alumno. El sidebar también reduce ancho útil en tablet. [AdminLiveManager.tsx:529](../src/pages/admin/AdminLiveManager.tsx#L529), [AdminLiveManager.tsx:575](../src/pages/admin/AdminLiveManager.tsx#L575), [AdminLiveManager.tsx:817](../src/pages/admin/AdminLiveManager.tsx#L817), [AdminLiveManager.tsx:830](../src/pages/admin/AdminLiveManager.tsx#L830), [AdminLayout.tsx:174](../src/components/layout/AdminLayout.tsx#L174).
- **Cambio y aceptación:** separar programar de monitorizar, resumen operativo y acceso a sala concreta como alumno, silenciada para evitar eco; no rehacer todo el backoffice.

#### F29 · P1 · Pausar, detener y finalizar se comunican de forma ambigua

- **CONFIRMADO:** “Detener” y “Finalizar” comparten icono; la primera acción pausa la sala, no detiene OBS. En estado pausado se ofrece reanudar, sin equivalente directo de finalizar en esa zona. [AdminLiveManager.tsx:852](../src/pages/admin/AdminLiveManager.tsx#L852), [AdminLiveManager.tsx:880](../src/pages/admin/AdminLiveManager.tsx#L880).
- **Cambio y aceptación:** nombres explícitos, consecuencias visibles y confirmación de finalización; considerar finalizar desde pausa si las reglas lo permiten. Toda acción debe reflejar qué cambia en la plataforma y qué sigue controlando el emisor.

#### F30 · P2 · Algunas acciones administrativas tienen riesgo de overflow o feedback prematuro

- **CONFIRMADO:** una fila combina input y dos acciones sin adaptación suficiente; copiar enlace confirma éxito sin esperar/capturar la operación; la orientación posterior a finalizar puede apuntar al editor aunque se cambie de pestaña. [AdminLiveManager.tsx:690](../src/pages/admin/AdminLiveManager.tsx#L690), [AdminLiveManager.tsx:1066](../src/pages/admin/AdminLiveManager.tsx#L1066), [AdminLiveManager.tsx:868](../src/pages/admin/AdminLiveManager.tsx#L868).
- **RIESGO:** desborde móvil y mensajes de éxito/siguiente paso que no coinciden con lo ocurrido.
- **Cambio y aceptación:** apilar o envolver acciones, mostrar pendientes y confirmar sólo el resultado real; conservar confirmaciones de borrado, horarios y demás protecciones existentes.

#### F31 · P2 · La documentación histórica no describe íntegramente el player actual

- **CONFIRMADO:** `PROJECT_STATE.md` contiene referencias a WebRTC y latencia menor a un segundo que no describen el reproductor HLS auditado; el responsive audit mantiene validaciones de landscape/dispositivos pendientes. [PROJECT_STATE.md:39](./PROJECT_STATE.md#L39), [PROJECT_STATE.md:75](./PROJECT_STATE.md#L75), [RESPONSIVE_AUDIT.md:24](./RESPONSIVE_AUDIT.md#L24).
- **Cambio y aceptación:** reconciliar inventario, decisiones y cobertura al implementar. Esta entrega conserva esos archivos sin editarlos y usa el código como evidencia vigente.

#### F32 · P1 · La cobertura existente no demuestra compatibilidad del conjunto

- **CONFIRMADO:** existen tests de recuperación, calidad y pausa del HLS, pero fijan `Hls.isSupported` a verdadero; no cubren la rama nativa. No se hallaron tests con nombres correspondientes a controles/salas en el alcance inspeccionado. [LiveHLSPlayer.test.tsx:33](../src/components/feature/LiveHLSPlayer.test.tsx#L33), [LiveHLSPlayer.test.tsx:80](../src/components/feature/LiveHLSPlayer.test.tsx#L80).
- **Límite:** no se ejecutaron los tests ni una sesión real; no es evidencia de que otros tests no puedan cubrir indirectamente algún comportamiento.
- **Cambio y aceptación:** ampliar pruebas donde se cambia lógica, cubrir ambas ramas y complementar con matriz física; no considerar el emulador prueba suficiente de audio/fullscreen.

### 4.6 Hallazgos complementarios (segunda pasada sobre el mismo commit)

Estos hallazgos completan o precisan los anteriores. Donde uno amplía un F existente, se indica.

#### Precisiones sobre hallazgos anteriores

- **F12, cuantificado.** Con el bloque de video en `h-[50dvh]` y `object-contain`, en un celular de 390×844 el bloque mide 390×422 y un video 16:9 ocupa 390×219: **~200 px de franja negra** dentro de la mitad destinada al video, mientras el chat se queda con la otra mitad. Es la causa más visible de la sensación de "engorroso en celular". [VIPLiveRoom.tsx:301](../src/pages/student/VIPLiveRoom.tsx#L301), [VIPLiveRoom.tsx:474](../src/pages/student/VIPLiveRoom.tsx#L474).
- **F21, prioridad.** Se recomienda subirlo a **P0**: si el SQL desplegado coincide con el del repo, a partir del mensaje 101 el chat público no muestra nada nuevo. Es pérdida de información exactamente en el momento de mayor participación. El cliente además vuelve a pedir las mismas 100 filas cada 4 s. [PublicLiveChat.tsx:25](../src/components/feature/PublicLiveChat.tsx#L25).
- **F04 y H15.** Es una hipótesis complementaria para H15 de `LIVE_STABILITY_PLAN.md` (el video arranca solo después de que el alumno lo pausó y la sala se pausó y reanudó). El `<video>` lleva el atributo `autoPlay` ([LiveHLSPlayer.tsx:459](../src/components/feature/LiveHLSPlayer.tsx#L459)). Cuando una recarga del manifiesto vuelve a enganchar el medio ([LiveHLSPlayer.tsx:273](../src/components/feature/LiveHLSPlayer.tsx#L273)), el algoritmo de carga del navegador puede reactivar la reproducción por su cuenta, y el `onPlay` resultante limpia `userPausedRef` ([LiveHLSPlayer.tsx:462](../src/components/feature/LiveHLSPlayer.tsx#L462)). **RIESGO**: hay que confirmarlo con logs en `onPlay` y en `executeReload` antes de cambiarlo.
- **F06, alcance.** `webkitEnterFullscreen` no existe solo en iOS: Safari de macOS lo expone, y los navegadores Chromium conservan la versión prefijada heredada. Como se prueba **antes** que el contenedor y su llamada no reporta fallos ([LiveHLSPlayer.tsx:92](../src/components/feature/LiveHLSPlayer.tsx#L92)), existe el **RIESGO** de que la pantalla completa sea la del video nativo también en escritorio y Android: sin controles propios, sin avisos de pausa/error y sin chat. Hay que reproducirlo en Chrome desktop, Chrome Android y Safari macOS.
- **F23, dato concreto.** El campo usa `text-sm` (14 px) ([LiveChat.tsx:281](../src/components/feature/LiveChat.tsx#L281)). Safari de iOS amplía la página al enfocar campos con menos de 16 px. **RIESGO** por reproducir: al tocar el campo en iPhone, la sala se agranda y queda descuadrada al cerrar el teclado. La corrección no pasa por bloquear el zoom del viewport, que es una necesidad de accesibilidad, sino por usar un tamaño de fuente adecuado.

#### F33 · P1 · Al finalizar, la sala VIP dice "No hay eventos programados"

- **CONFIRMADO:** `fetchActiveLive` filtra `status in ('live','scheduled')`. Cuando el admin finaliza, la sala VIP recibe `null` y pinta el estado vacío "No hay eventos programados… Vuelve pronto". La rama "Transmisión finalizada" y el badge "FINALIZADO" nunca se alcanzan desde esta consulta. [lives.ts:62](../src/lib/api/stream/lives.ts#L62), [VIPLiveRoom.tsx:287](../src/pages/student/VIPLiveRoom.tsx#L287), [VIPLiveRoom.tsx:389](../src/pages/student/VIPLiveRoom.tsx#L389), [VIPLiveRoom.tsx:591](../src/pages/student/VIPLiveRoom.tsx#L591).
- **Impacto:** en plena clase, el alumno pasa de golpe a una pantalla que dice que no hay nada programado y el chat desaparece. No hay despedida ni aviso de grabación. F16 anticipa un problema de precedencia; este es más directo: la sala finalizada deja de existir para la vista.
- **Cambio y aceptación:** la vista debe recordar la sala en la que estaba el alumno y mostrar un cierre explícito (y, si corresponde, la grabación según el acceso vigente). Probar finalizar con alumnos conectados, en VIP y en la sala pública.

#### F34 · P1 · El video corre con la etiqueta "En espera"

- **CONFIRMADO:** el player se muestra si `status === 'live' || liveInputConnected`, pero en el segundo caso el badge dice "EN ESPERA". La promoción automática a `live` al detectar OBS solo ocurre desde el navegador del admin con el panel abierto; el webhook no recibe eventos (H3). [VIPLiveRoom.tsx:148](../src/pages/student/VIPLiveRoom.tsx#L148), [VIPLiveRoom.tsx:413](../src/pages/student/VIPLiveRoom.tsx#L413), [AdminLiveManager.tsx:78](../src/pages/admin/AdminLiveManager.tsx#L78).
- **Impacto:** el alumno ve la clase con una etiqueta que dice lo contrario. Si Iván emite sin el panel abierto, la sala puede no pasar nunca a "En vivo".
- **DEPENDENCIA:** la solución real depende de H3 (sincronización del servidor), no de la UI. La UI debe derivar su etiqueta de una sola fuente.

#### F35 · P2 · El countdown se queda en 00:00:00

- **CONFIRMADO:** llegada la hora sin señal, el contador muestra ceros sin mensaje adicional. La rama "Próximamente" para una sala sin `starts_at` es código muerto porque la columna es `NOT NULL`. [VIPLiveRoom.tsx:265](../src/pages/student/VIPLiveRoom.tsx#L265), [VIPLiveRoom.tsx:697](../src/pages/student/VIPLiveRoom.tsx#L697).
- **Cambio y aceptación:** estado "Comenzará en instantes" cuando la hora pasó y aún no hay señal; con retraso largo, un texto que no parezca un error.

#### F36 · P2 · El plan se valida solo al montar

- **CONFIRMADO:** la sala se pinta antes de redirigir (`setLive` antes del `navigate`), y las actualizaciones por Realtime o polling no repiten la validación de `allowed_plans`. [VIPLiveRoom.tsx:152](../src/pages/student/VIPLiveRoom.tsx#L152).
- **DEPENDENCIA:** si el admin activa otra sala con otros planes, el alumno se queda en ella. Hay que decidirlo con el contrato de acceso (§11.3) y verificarlo en RLS. No se resuelve ocultando elementos.

#### F37 · P1 · Las dos salas son copias que ya divergieron

- **CONFIRMADO:** `VIPLiveRoom` (781 líneas) y `PublicLiveRoom` (683) duplican los handlers de audio, reproducción, mute y calidad, los overlays de audio, pausa y error, el header, el countdown y el layout. Ya divergieron en la latencia inoperante (F10), en el toggle del chat (icono en VIP, caracteres `›`/`‹` en la pública), en el contador de no leídos (solo VIP) y en la regla `showIframe`. `LiveChat` y `PublicLiveChat` divergen en el scroll (F19). [PublicLiveRoom.tsx:652](../src/pages/public/PublicLiveRoom.tsx#L652), [PublicLiveRoom.tsx:83](../src/pages/public/PublicLiveRoom.tsx#L83), [VIPLiveRoom.tsx:148](../src/pages/student/VIPLiveRoom.tsx#L148).
- **Impacto:** cada mejora del rediseño habría que hacerla dos veces, y cada diferencia es un bug latente. Según `CLAUDE.md`, un componente que pasa de ~150 líneas se divide.
- **Cambio y aceptación:** extraer la sala compartida (§19) **antes** de rediseñar. Aceptación: una sola implementación de sala y de chat, con las diferencias de acceso como parámetros.

#### F38 · P2 · Carga de red y re-render constantes

- **CONFIRMADO:** conviven tres fuentes de estado: Realtime sobre **toda** la tabla `lives`, polling cada 3 s y estado de Cloudflare cada 10 s. Cada poll hace `setLive` con un objeto nuevo y las promesas rechazadas del intervalo no tienen `catch`. Además, cada mensaje entrante del chat VIP dispara una consulta a `profiles` por espectador. [VIPLiveRoom.tsx:173](../src/pages/student/VIPLiveRoom.tsx#L173), [VIPLiveRoom.tsx:189](../src/pages/student/VIPLiveRoom.tsx#L189), [LiveChat.tsx:129](../src/components/feature/LiveChat.tsx#L129).
- **Impacto:** la sala entera se re-renderiza cada 3 s. Con 300 espectadores son ~100 consultas por segundo a Supabase solo de polling, y cada mensaje multiplica las consultas por el número de espectadores. Cualquier edición del admin en cualquier sala dispara una recarga en todos.
- **Cambio y aceptación:** medir primero (Paso 1). Actualizar solo cuando cambie el contenido, filtrar Realtime por la sala y resolver el nombre del autor una sola vez.

#### F39 · P2 · Decoración con dependencias externas y restos de diagnóstico

- **CONFIRMADO:** una textura de fondo se carga desde un tercero (`transparenttextures.com`) al 3 % de opacidad. El logo es una URL fija repetida en el header y en la intro, fuera de `useThemedLogo`. Queda en producción un `console.log` de diagnóstico LL-HLS marcado "TEMPORAL" que imprime la URL del manifiesto. [VIPLiveRoom.tsx:435](../src/pages/student/VIPLiveRoom.tsx#L435), [VIPLiveRoom.tsx:372](../src/pages/student/VIPLiveRoom.tsx#L372), [LiveHLSPlayer.tsx:222](../src/components/feature/LiveHLSPlayer.tsx#L222).
- **Cambio:** retirar la textura externa, usar el logo configurable y eliminar el log temporal al tocar esos archivos.

#### F40 · P1 · El documento declara `lang="en"`

- **CONFIRMADO:** `<html lang="en">` con todo el contenido en español. [index.html:2](../index.html#L2).
- **Impacto:** VoiceOver, TalkBack y NVDA pronuncian la sala con reglas del inglés. El cambio es global, de una línea y de bajo riesgo, pero afecta a toda la app y conviene tratarlo como tal.

#### F41 · P2 · Convivencia con el podcast distinta según la ruta

- **CONFIRMADO:** `VIPLiveRoom` llama a `clearPlayer()` al montar y corta el podcast sin aviso. `PublicLiveRoom` no lo hace. [VIPLiveRoom.tsx:63](../src/pages/student/VIPLiveRoom.tsx#L63).
- **RIESGO:** con sesión iniciada, abrir el link público con un podcast sonando puede producir dos audios simultáneos. Hay que reproducirlo y resolverlo según `docs/PODCAST_ARCHITECTURE.md` (§17).

#### F42 · P2 · `100vh` dentro de `100dvh`

- **CONFIRMADO:** la raíz usa `h-[100dvh]`, pero el bloque del video y el panel de chat usan `md:h-screen` (100vh). [VIPLiveRoom.tsx:309](../src/pages/student/VIPLiveRoom.tsx#L309), [VIPLiveRoom.tsx:753](../src/pages/student/VIPLiveRoom.tsx#L753).
- **RIESGO:** en Safari de iPad con barras visibles, 100vh supera el alto visible y el composer puede quedar recortado. Probar dentro de la matriz de §8.

#### F43 · P2 · "EN VIVO" no distingue estar al día de estar atrasado

- **CONFIRMADO:** el indicador es siempre rojo con pulso, aun en el filo del directo. El atraso solo aparece como sufijo (`-12s`) y la explicación vive en un `title`, que no existe en touch. [LivePlayerControls.tsx:424](../src/components/feature/LivePlayerControls.tsx#L424).
- **Cambio y aceptación:** dos estados visuales claros: "En vivo", y "Volver al vivo" como acción cuando hay atraso. Deben distinguirse sin depender del color.

### 4.7 Cruce con `docs/LIVE_STABILITY_PLAN.md` en el commit auditado

| ID | Estado en el código | Relación |
|---|---|---|
| H1 | Fuera del alcance visual | RLS de `lives`; no se reverificó aquí |
| H2 | Sigue en el código (`api/stream/cloudflare-webhook.ts:82`) | Sin efecto práctico mientras H3 impida recibir eventos |
| H3 | Abierto | F34 |
| H4 | Corregido (`api/stream/live-input-status.ts:61`) | — |
| H5 | Corregido (`nextLevel`) | F08 conserva el buen comportamiento |
| H6 | Abierto | F10 |
| H7 | Corregido (player montado durante la pausa) | Fortaleza §4.1 |
| H8 | Corregido (tope de 6 recargas con backoff) | Fortaleza §4.1 |
| H9 | Corregido (espera `play()`) | El problema de diseño sigue: F01 |
| H10 | Corregido (`liveSyncOffset` por modo) | — |
| H11 | Abierto | F19, F20, F22, F38 |
| H12 | Abierto | F38 |
| H13 | Abierto | F09 |
| H14 | Abierto | F03 |
| H15 | Abierto | Hipótesis complementaria en §4.6 (F04 y H15) |

### Orden recomendado de atención

1. **Integridad del uso:** F04, F22, F21 (subido a P0) y F33; recuperación F09 y semántica F16/F29/F34.
2. **Base para no duplicar el trabajo:** F37 antes de tocar la interfaz.
3. **Experiencia principal móvil:** F01, F03, F05, F06, F12, F13, F15, F17, F19, F23/F25 y F42.
4. **Coherencia y datos:** F08, F10, F11, F20, F18, F27, F36, F38 y F41.
5. **Acabado y operación:** F02, F07, F14, F24, F28, F30, F31, F35, F39, F40, F43 y cobertura F32 durante cada etapa.
6. **Evolución condicionada:** F26 sólo con decisión explícita de producto y revisión del contrato de permisos.

## 5. Qué tomar de Kick y qué adaptar

La documentación de Kick describe una experiencia móvil con controles que aparecen al tocar el reproductor, uso en vertical u horizontal, acceso a calidad y chat, y PiP sujeto a compatibilidad. Es una referencia de interacción documentada; no se inspeccionó una captura real ni se verificó su versión actual de diseño. [Guía móvil oficial de Kick](https://help.kick.com/en/articles/14994597-the-kick-mobile-app-a-viewer-s-guide).

Su guía de conversación documenta el chat junto a la transmisión en escritorio, envío con Enter o el botón correspondiente y herramientas de conversación según disponibilidad. Tomamos la proximidad de la conversación y la claridad de acciones; no hace falta trasladar todas sus funciones sociales. [Guía oficial del chat de Kick](https://help.kick.com/en/articles/14994494-how-to-use-kick-chat-as-a-viewer).

| Patrón | Base del benchmark | Aplicación en la Escuela | Criterio de éxito |
|---|---|---|---|
| El video es el centro | PROPUESTA apoyada en patrones del sector | Jerarquía de tamaño, contraste y espacio a favor de la emisión | La acción principal se entiende al entrar |
| Controles bajo demanda en móvil | Documentado por Kick | Toque muestra controles; foco o interacción evita su ocultamiento | No se pierde el botón mientras se intenta usar |
| Conversación lateral en escritorio | Documentado por Kick | Columna estable, ancho legible, plegable | Ocultarla amplía el video sin reiniciarlo |
| Adaptación vertical/horizontal | Documentado por Kick | Composición según ancho y altura, no sólo un breakpoint | Horizontal no hereda automáticamente una maqueta de escritorio |
| Pausa de lectura del chat | Documentado por Kick | Desactivar seguimiento al alejarse del final; contador de nuevos | Nunca se arrastra al lector de vuelta sin pedirlo |
| Configuración de reproducción | Documentada por Kick | Mostrar únicamente capacidades reales del player | Ningún control ornamental o inoperante |
| Continuidad del video | PROPUESTA específica de esta arquitectura | Conservar la identidad del elemento multimedia | Cambiar paneles no provoca nueva conexión |
| Marca sobria | PROPUESTA propia | Oscuros escalonados, dorado para acciones relevantes | Jerarquía sin exceso de brillos o tarjetas |

**Evitar:** una réplica literal verde/negra, densidad social innecesaria, varias barras con las mismas acciones, botones de capacidad no comprobada y ventanas modales para tareas simples.

## 6. Arquitectura visual propuesta

### 6.1 Orden de importancia

1. **Video y estado:** qué está pasando y si se puede ver/escuchar.
2. **Controles:** audio, reproducción disponible, configuración y modo de vista.
3. **Contexto:** título de la clase, anfitrión y aviso pertinente.
4. **Conversación:** mensajes, lectura pendiente, composición y envío.
5. **Navegación secundaria:** volver, información ampliada y ayuda contextual.

La sala no necesita una apariencia de dashboard. El alumno debe reconocer dónde mirar, cómo escuchar y cómo escribir sin recorrer tarjetas equivalentes.

### 6.2 Sistema visual

| Elemento | Dirección propuesta | Cómo se verifica |
|---|---|---|
| Fondo principal | `darker`/`dark` existentes; separación sutil entre zonas | Video y conversación se distinguen sin bordes gruesos |
| Dorado | Acción relevante, selección y foco compatible con contraste | No usarlo para todos los textos ni todos los iconos |
| Texto | Jerarquía breve, etiquetas claras y longitud controlada | Un título extenso no desplaza los controles |
| Superficies | Pocas capas; eliminar cajas anidadas sin función | Cada superficie corresponde a una tarea distinta |
| Radios y separadores | Escala consistente con el sistema actual | No mezclar bordes, sombras y radios arbitrarios |
| Densidad | Espaciado compacto legible en escritorio; táctil en móvil | Ningún icono queda pegado a otro objetivo |
| Objetivos táctiles | Objetivo de producto de 44–48 CSS px cuando sea viable | Medir área interactiva real, no sólo tamaño del dibujo |
| Iconos | Familia actual, semántica consistente, nombre accesible | Usuarios con lector de pantalla conocen la acción |
| Movimiento | Transiciones breves sin animar el video; respetar movimiento reducido | La reproducción no depende de animaciones de entrada |
| Estados | Cambios de texto y semántica además de color | Pausa/error/directo se distinguen sin reconocer colores |

El objetivo táctil de producto es deliberadamente más amplio que el mínimo WCAG 2.2 AA de 24 CSS px, que admite excepciones. Android recomienda 48 dp para interfaces nativas; dp y CSS px no deben tratarse como unidades equivalentes. [WCAG: tamaño mínimo del objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Android: accesibilidad](https://developer.android.com/guide/topics/ui/accessibility/apps).

## 7. Composiciones de referencia

Los siguientes esquemas son propuestas funcionales, no capturas del producto ni diseños finales. Las proporciones deben comprobarse con contenido real y tamaños extremos.

### 7.1 Escritorio amplio

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Volver       Escuela de la Riqueza                 Ayuda / cuenta  │
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │ Conversación    [×] │
│                                               ├──────────────────────┤
│                  VIDEO                        │ Mensajes             │
│                                               │                      │
│ [Activar sonido] [Seguir sin sonido]           │ [↓ 8 mensajes nuevos]│
│ [controles agrupados y legibles]               ├──────────────────────┤
├───────────────────────────────────────────────┤ Escribe...     Enviar│
│ EN VIVO · Título de la clase                   │ Estado / restricción │
│ Iván Mazo · Información ampliable              │                      │
└───────────────────────────────────────────────┴──────────────────────┘
```

- La columna de conversación tiene un ancho objetivo aproximado de 320–380 CSS px, validado por contenido y ancho total.
- El video aprovecha el espacio restante con una proporción consistente; no se recorta contenido para llenar un rectángulo arbitrario.
- La información secundaria puede desplazarse sin obligar a perder las acciones de la sala.
- La columna se puede cerrar y abrir con un control con estado explícito.

### 7.2 Celular vertical

```text
┌──────────────────────────────┐
│ ←  En vivo               ⋯  │
├──────────────────────────────┤
│            VIDEO             │
│ [Activar sonido]             │
│ [controles al interactuar]    │
├──────────────────────────────┤
│ EN VIVO · Título de la clase  │
│ Información       [Ocultar chat]│
├──────────────────────────────┤
│ Conversación                 │
│ Mensajes                     │
│         [↓ Nuevos mensajes]  │
├──────────────────────────────┤
│ Escribe un mensaje...   [➤]  │
│ área segura inferior         │
└──────────────────────────────┘
```

- El video se dimensiona por proporción y espacio disponible, no por una cuota rígida de media pantalla.
- El título y el estado tienen una versión compacta visible; la descripción completa es ampliable.
- Al abrir el teclado se priorizan el campo y los mensajes cercanos. El video puede reducir su área o salir del área visible según la composición, pero no debe reiniciarse.
- Ocultar el chat elimina su consumo de espacio y deja una vía clara para recuperarlo.

### 7.3 Celular horizontal con poca altura

```text
┌───────────────────────────────────────────────────────────────────┐
│                        VIDEO                                      │
│                                                                   │
│ [audio] [estado]                   [Chat] [ajustes] [pantalla completa]│
└───────────────────────────────────────────────────────────────────┘

Al abrir chat, panel acotado dentro del modo compatible:
┌────────────────────────────────────────────┬──────────────────────┐
│                  VIDEO                     │ Conversación      [×]│
│                                            │ Mensajes             │
│ [controles]                                │ Escribe...       [➤] │
└────────────────────────────────────────────┴──────────────────────┘
```

Si no hay espacio para una división usable, el chat puede ocupar temporalmente una vista de conversación con retorno explícito. No se debe forzar la coexistencia cuando vuelve ilegibles ambas áreas.

### 7.4 Tablet, escritorio estrecho y multitarea

```text
┌───────────────────────────────────────────────────┐
│ Navegación mínima                                 │
├───────────────────────────────────────────────────┤
│                      VIDEO                        │
├───────────────────────────────────────────────────┤
│ Título / estado / [Mostrar conversación]           │
├───────────────────────────────────────────────────┤
│ Conversación debajo o lateral según ancho útil     │
│ Mensajes                                          │
│ Campo de mensaje                                  │
└───────────────────────────────────────────────────┘
```

La misma tablet puede necesitar diseños diferentes al pasar de pantalla completa a Split View. La decisión debe depender del espacio de la ventana, no del nombre del dispositivo.

## 8. Matriz de adaptación

Los anchos son puntos de comprobación, no doce breakpoints obligatorios. Se propone resolver con pocas reglas y verificar los intermedios.

| Ancho útil CSS | Escenario de prueba | Composición esperada | Atención especial |
|---|---|---|---|
| 320 | Ventana mínima / equivalente de reflow | Una columna, acciones esenciales, chat plegable | Sin scroll horizontal de la interfaz |
| 360 | Android compacto | Video + título breve + conversación | Campo de mensaje y objetivos táctiles |
| 390 | iPhone habitual | Igual jerarquía vertical | Notch, teclado y barras del navegador |
| 430 | Celular grande | Aprovechar espacio sin inflar controles | Safe area y texto aumentado |
| 600 | Ventana estrecha / tablet pequeña | Columna única o composición intermedia | No activar columnas prematuramente |
| 768 | Tablet / móvil horizontal | Decidir por altura además de ancho | Evitar el salto automático a escritorio |
| 820 | iPad vertical / ventana intermedia | Video dominante, chat debajo o panel | Teclado y multitarea |
| 1024 | Tablet horizontal / notebook | Dos zonas sólo si ambas siguen siendo usables | Altura real con barras y teclado |
| 1280 | Notebook común | Video + conversación lateral | Navegación y título sin reducir excesivamente el video |
| 1440 | Escritorio | Dos zonas equilibradas | Ancho máximo de lectura |
| 1920 | Monitor grande | Contenedor amplio con límites razonables | El chat no se ensancha proporcionalmente al monitor |
| >1920 | Ultrawide | Centrar o distribuir con ancho máximo | Evitar líneas de texto interminables y video deformado |

### Dimensiones adicionales obligatorias

- **Altura:** comprobar ventanas de 320, 360, 480, 600 y 800 CSS px cuando tengan sentido para el dispositivo; registrar el área real ocupada por barras y teclado.
- **Zoom:** 200% y reflow equivalente a 400% sobre una ventana de 1280 CSS px. No reducir el texto para aparentar compatibilidad.
- **Texto aumentado:** escalado del sistema y navegador, títulos extensos, nombres largos, mensajes sin espacios y enlaces.
- **Orientación:** vertical → horizontal → vertical con video activo, chat abierto, borrador y menú visible.
- **Multiventana:** iPad Split View/Stage Manager cuando estén disponibles, Android dividido y ventana de escritorio redimensionada.
- **Plegables:** comprobar área útil y cambios de postura como redimensionamiento; no prometer adaptación a bisagras sin dispositivo y APIs verificadas.
- **Entrada:** touch, mouse, teclado externo y lector de pantalla; ningún comportamiento esencial depende de hover.

WCAG exige reflow para contenido aplicable hasta el equivalente de 320 CSS px, con excepciones para contenido que necesita dos dimensiones. Esa excepción no justifica que el chat o la navegación se desborden. [WCAG: reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow).

## 9. Activación de audio: contrato de interacción

### Entrada y reproducción

1. Si hay señal y permiso de acceso, preparar reproducción sin montar overlays de contenido innecesarios.
2. Intentar reproducción silenciada sólo cuando resulte compatible con el navegador; observar el resultado real de `play()`.
3. Si se reproduce sin sonido, mostrar una invitación compacta con icono, texto y botón **Activar sonido**.
4. Ofrecer **Seguir sin sonido** o cierre de la invitación; el control de volumen debe seguir accesible después.
5. Activar el audio dentro de la interacción directa del usuario, sin demoras o pasos intermedios que pierdan el contexto de gesto.
6. Confirmar el estado de la interfaz con propiedades/eventos reales del medio. El clic por sí solo no demuestra que el usuario esté oyendo.
7. Si la reproducción es rechazada, mostrar **Reproducir** con un mensaje breve y recuperación manual; evitar bucles automáticos de intentos.
8. Si falla el stream, diferenciar el error de reproducción del estado de silencio y de una pausa del emisor.

Los navegadores aplican políticas de autoplay y una llamada a `play()` puede ser rechazada. El comportamiento propuesto debe tratar ese rechazo, no asumir reproducción exitosa. [Chrome: políticas de autoplay](https://developer.chrome.com/blog/autoplay).

La documentación de WebKit explica las bases de reproducción silenciada y `playsinline` en iOS. Es una referencia histórica de política, no una matriz vigente de soporte para cada versión; se necesitan pruebas reales en los dispositivos objetivo. [WebKit: políticas de video en iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/).

### Detalles visuales y de comportamiento

- No aplicar blur a toda la transmisión para pedir audio ni bloquear el chat por ese motivo.
- Evitar que la invitación tape los subtítulos, la cara del expositor o todos los controles; usar una zona consistente y compacta.
- Nombrar la acción según el estado: **Activar sonido** / **Silenciar**. Un icono de parlante aislado no basta para todos los usuarios.
- En entornos donde el volumen depende del sistema, conservar mute/unmute y evitar sliders que aparenten controlar algo que no controlan.
- Guardar preferencias sólo cuando haya una decisión clara; la preferencia de sonido nunca salta las restricciones del navegador.
- No solicitar micrófono: escuchar una emisión no necesita ese permiso.
- Al regresar desde segundo plano, comprobar el medio y presentar recuperación explícita si fue suspendido.
- Si se detecta volumen cero, mostrar el estado correcto; no asegurar audibilidad del altavoz físico, Bluetooth o volumen del sistema.

**Aceptación:** entrar, continuar silenciado, activar, silenciar, reactivar y recuperar un rechazo funcionan sin ocultar permanentemente el video ni crear dos fuentes de audio.

## 10. Modos de vista y pantalla completa

| Modo | Propósito | Video | Chat | Salida |
|---|---|---|---|---|
| Normal | Ver y conversar en la sala | Dentro del layout adaptable | Visible o plegado por elección | Navegación habitual |
| Cine | Dedicar más espacio al video sin salir de la página | Más ancho, navegación secundaria reducida | Opcional, con control claro | Botón del mismo modo |
| Pantalla completa del contenedor | Expandir la experiencia de sala cuando exista soporte | Controles propios compatibles | Sólo si cabe y está dentro del contenedor | Control visible + mecanismos del navegador |
| Pantalla completa nativa del video | Alternativa cuando el navegador gestiona el medio | Interfaz nativa | Habitualmente fuera de esa vista; explicitar la limitación | Controles nativos |
| Picture in Picture | Continuidad flotante cuando esté disponible | Ventana gestionada por el sistema | Permanece en la página | Controles del sistema y estado actualizado |

### Reglas

- No denominar pantalla completa a una mera expansión CSS. Usar nombres y estados distintos para cine y fullscreen real.
- Detectar capacidades y capturar fallos de solicitud. Si un modo no está disponible, ofrecer una alternativa compatible o retirar la acción.
- Solicitar fullscreen/PiP desde un gesto válido del usuario; no abrirlos automáticamente al rotar.
- Sincronizar el estado tras eventos del navegador, incluyendo salida mediante Escape, botón del sistema o cambio de app.
- El botón debe cambiar de nombre según la acción: **Pantalla completa** / **Salir de pantalla completa**.
- Si la pantalla completa contiene chat, mantener foco, scroll y controles dentro del elemento correcto; evitar portales fuera del contenedor visible.
- Entrar o salir no debe recrear el video, borrar el borrador, perder posición de lectura ni duplicar suscripciones.
- El modo nativo puede no incluir overlays personalizados; no prometer que chat, marca y controles propios estarán siempre presentes.
- Mantener una salida accesible también en horizontal, con safe areas y barras superpuestas.
- PiP web, PiP de una app nativa, AirPlay y casting son capacidades distintas. Sólo ofrecer lo verificado en este producto y proveedor.
- Si el navegador suspende reproducción en segundo plano, ofrecer recuperación al volver; no prometer audio persistente en todos los ecosistemas.

## 11. Chat: de lista de mensajes a conversación usable

### 11.1 Lectura

- Al abrir, cargar la porción reciente definida por producto y ordenar cronológicamente para lectura.
- Si el usuario está cerca del final, seguir los nuevos mensajes sin movimientos bruscos.
- Si sube para leer, pausar el seguimiento y mantener su posición aunque lleguen mensajes.
- Mostrar **N mensajes nuevos** y un botón para volver al final. Al activarlo se reanuda el seguimiento.
- No usar anuncios hablados por cada mensaje en una sala activa; ofrecer una estrategia accesible que no sature al lector de pantalla.
- Diferenciar cargando, sin mensajes, desconectado, reconectando, error de carga y conversación disponible.
- Definir límite de mensajes retenidos y paginación según volumen medido; no agregar virtualización antes de demostrar su necesidad.
- Mostrar enlaces y palabras largas sin romper el ancho. Mantener escapado de contenido y reglas de seguridad existentes.

### 11.2 Escritura y envío

- Conservar el borrador mientras el usuario cambie de vista o cierre temporalmente la conversación.
- En un envío fallido, conservar/restaurar el contenido y mostrar **Reintentar**; no depender de la consola.
- Mostrar estado de envío que prevenga doble clic sin bloquear toda la conversación.
- Definir Enter para enviar y Shift+Enter para salto de línea si el campo admite múltiples líneas; no enviar durante composición IME.
- La acción del teclado virtual debe ser coherente con el campo. Probar Android, iOS, teclado externo y dictado.
- Mostrar límite de longitud cerca del campo cuando sea relevante; no cortar silenciosamente el mensaje.
- Restaurar el foco de forma predecible tras enviar. No abrir automáticamente el teclado al entrar a la sala.
- No exponer identificadores internos, datos privados ni detalles técnicos de la API en mensajes de error.
- Un reintento debe prevenir duplicados según el contrato real de persistencia; verificarlo antes de introducir envío optimista.

### 11.3 Permisos y moderación

| Usuario / estado | Comportamiento requerido |
|---|---|
| Anónimo con lectura pública permitida | Puede leer según reglas vigentes; acción de escribir explica el inicio de sesión necesario |
| Autenticado con permiso | Campo activo, envío y estados de recuperación |
| Autenticado sin permiso | Mensaje claro y acción apropiada sin aparentar fallo de red |
| Sala pausada | Mensajería según política actual, comunicada sin mezclarla con el estado de audio |
| Sala finalizada | Definir lectura y escritura conforme al contrato vigente; no decidirlo implícitamente en la maqueta |
| Moderador / admin | Acciones actuales identificables, separadas de la composición normal |
| Sesión vencida | Borrador preservado mientras se solicita reautenticación; no revelar contenido a otra cuenta |

No cambiar RLS, acceso público ni privilegios para facilitar una maqueta. Verificar permisos en la capa de datos y APIs; ocultar un botón no equivale a autorización.

## 12. Modelo de estados de la sala

Una única variable como `isPlaying` no puede representar correctamente una emisión que existe, está silenciada, se está recuperando y tiene el chat desconectado. Se propone separar dimensiones y derivar el mensaje visible por prioridad.

| Dimensión | Estados mínimos a distinguir | Responsabilidad |
|---|---|---|
| Emisión / negocio | No hay sala; programada; en directo; pausa del emisor; finalizada | Datos de la sala y sincronización existente |
| Acceso | Resolviendo; permitido; requiere sesión; restringido; sesión vencida | Auth, plan y permisos reales |
| Medio | Inactivo; cargando; listo; reproduciendo; pausa local; buffering; error recuperable; error terminal | Eventos del video y motor HLS |
| Audio | Silenciado; volumen cero; audio solicitado; activo según medio; solicitud fallida | Propiedades reales + resultado de operaciones |
| Conexión | Online; offline; reconectando; conexión insuficiente inferida | Red y eventos relevantes sin falsas certezas |
| Visualización | Normal; cine; fullscreen contenedor; fullscreen nativo; PiP si soportado | Navegador y layout |
| Chat | Cargando; activo al final; leyendo historial; enviando; reconectando; error; restringido | Datos, scroll y envío |
| Documento | Visible; en segundo plano; recuperando al volver | Ciclo de vida y políticas del navegador |

### Prioridad de mensajes

1. Acceso no permitido o sesión requerida cuando realmente corresponda.
2. Sala inexistente/finalizada o estado del emisor que impide ver.
3. Error de reproducción que requiere acción.
4. Espera/buffering/reconexión con mensaje no bloqueante cuando sea recuperable.
5. Invitación a activar sonido.
6. Información complementaria y conversación.

Evitar dos overlays simultáneos con acciones que se contradigan. La desconexión de chat no debe presentarse como caída del video; el silencio local no debe mostrarse como pausa de la emisión.

### Transiciones que deben especificarse

| Desde → hacia | Resultado esperado |
|---|---|
| Programada → directo | Entrar en estado de reproducción disponible sin cambiar reglas de acceso |
| Directo → pausa del emisor | Mantener contexto y chat permitido; mensaje de pausa, sin afirmar que terminó |
| Pausa → directo | Recuperar señal y conservar preferencia de audio en lo permitido |
| Directo → finalizada | Estado inequívoco; evitar reconexión infinita a una sala cerrada |
| Online → offline → online | Mensaje adecuado y recuperación controlada; preservar borrador |
| Reproduciendo → buffering → reproducción | Indicador discreto; no exigir activar audio otra vez sin motivo |
| Fullscreen → normal | Volver al mismo estado de medio, conversación y foco |
| Cuenta A → cerrar sesión / cuenta B | Limpiar información y borradores según privacidad; no heredar permisos |
| Sala A → sala B | Limpiar suscripción anterior y cargar sólo mensajes/estado correspondientes |

## 13. Teclado, áreas seguras y scroll

- Usar las áreas seguras para controles pegados a bordes en dispositivos con recortes o indicador de inicio.
- Revisar `viewport-fit=cover` junto con padding de safe area; activar uno sin diseñar el otro puede exponer contenido a zonas obstruidas.
- Definir un dueño del scroll para cada región: página/contexto y lista de mensajes. Evitar que tres contenedores compitan por el mismo gesto.
- El composer debe permanecer alcanzable al abrir el teclado, incluso tras rotar o cambiar de modo.
- Las unidades `dvh` ayudan con variaciones del viewport, pero no resuelven por sí solas todos los comportamientos del teclado virtual.
- Evaluar `VisualViewport` sólo si las pruebas muestran necesidad; no introducir listeners globales como solución preventiva sin medir su efecto.
- Al cerrar un panel, regresar el foco al botón que lo abrió. No hacer scroll de toda la página para acompañar mensajes nuevos.
- El gesto de volver y los mecanismos nativos del navegador deben funcionar sin quedar atrapados en un overlay.

WebKit documenta el uso conjunto de `viewport-fit` y `safe-area-inset-*`. Chrome explica que el teclado puede afectar de forma diferente al viewport visual y al de layout, dejando controles fijos obstruidos. Ambas condiciones requieren pruebas de la composición final. [WebKit: diseño para iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [Chrome: redimensionamiento ante el teclado](https://developer.chrome.com/blog/viewport-resize-behavior).

## 14. Accesibilidad

### Interacción y semántica

- Botones reales con nombre accesible, estado de selección y foco visible; no depender de `title` o tooltips para entender controles.
- Orden de tabulación: navegación, controles de video, contexto, controles de conversación y composer.
- Ningún control enfocado se oculta automáticamente. Los menús permiten Escape y devuelven foco al disparador.
- Atajos sólo cuando no interfieran con inputs, lectores de pantalla ni comandos del navegador; documentar los disponibles.
- Encabezados, regiones y mensajes de estado con semántica coherente. Errores de envío se asocian al campo.
- Contraste medido para texto normal, texto pequeño, estados, bordes relevantes y foco, incluidos overlays sobre video claro.
- Mantener información sin depender de color, hover, sonido o animaciones.
- Respetar `prefers-reduced-motion` y las preferencias ya existentes del producto.

### Contenido audiovisual

- Inventariar pistas de subtítulos y capacidades de Cloudflare/ingesta antes de diseñar un selector operativo.
- Si no existen subtítulos en vivo, registrar la dependencia, costo y responsable. No presentar la sala como WCAG AA completa sólo por mejorar botones y contraste.
- Verificar legibilidad y posición de subtítulos sin invasión de controles, banners de audio o safe areas.
- Informar claramente el estado del medio mediante texto cuando sea útil; un spinner no describe una pérdida de señal.

WCAG AA contempla subtítulos para contenido de audio en vivo dentro de medios sincronizados. Su disponibilidad depende del proceso audiovisual además de la interfaz. [WCAG: subtítulos en vivo](https://www.w3.org/WAI/WCAG21/Understanding/captions-live).

## 15. Apple, Android y escritorio: plan de compatibilidad

La matriz define pruebas requeridas. **Ninguna fila representa compatibilidad ya demostrada por esta auditoría.** Registrar modelo, SO, navegador y versión exactos al ejecutarla.

| Ecosistema | Dispositivo / navegador | Pruebas prioritarias |
|---|---|---|
| Apple móvil | iPhone con Safari en versión estable y anterior soportada por el producto | Autoplay/rechazo, audio, `playsinline`, fullscreen disponible, teclado, rotación, notch |
| Apple móvil | iPhone con Chrome | Repetir flujos reales; no asumir paridad por el nombre del navegador o del motor |
| Apple tablet | iPad con Safari, vertical/horizontal | Chat, fullscreen, teclado externo y pantalla dividida |
| Apple tablet | iPad multitarea cuando esté disponible | Redimensionamiento durante reproducción y preservación del elemento de video |
| Android | Teléfono de gama media con Chrome | Teclado, CPU/memoria, reconexión, rotación y área inferior |
| Android | Samsung Internet en dispositivo compatible | Reproducción HLS, controles nativos, fullscreen y scroll |
| Android | Teléfono con pantalla pequeña / texto aumentado | Objetivos táctiles, títulos largos y composer |
| Android opcional | Plegable o pantalla dividida | Cambios de ventana y postura, sin promesa de soporte especial no probado |
| macOS | Safari + Chrome | HLS nativo/MSE según soporte, teclado, fullscreen y PiP si expuesto |
| Windows | Chrome + Edge + Firefox | Reproducción, recuperación de errores, foco y zoom |
| Escritorio adicional | Linux si está en el público real | Chrome/Firefox y restricciones de reproducción del entorno |

### Casos transversales

- Abrir enlace directo, recargar, volver desde otra sección y usar navegación atrás/adelante.
- Auriculares/Bluetooth conectados y desconectados; la UI muestra lo que sabe, no asegura salida física de audio.
- Bloquear/desbloquear el teléfono, cambiar de app y regresar después de una suspensión.
- Modo de bajo consumo, ahorro de datos y conexión limitada: observar comportamiento sin prometer continuidad garantizada.
- Recibir una interrupción del sistema y recuperar controles, foco y reproducción según permisos.
- Emuladores y vista responsive sirven para layout preliminar; no reemplazan estas pruebas de medio y gestos en dispositivos físicos.

## 16. Red, rendimiento y continuidad

### Comportamientos requeridos

- Diferenciar carga inicial, buffering durante reproducción, desconexión y fallo permanente.
- Reconectar con política limitada y observabilidad; no crear nuevos players en cada render o cada evento de chat.
- Mantener el stream activo cuando se pliega el chat, se cambia la composición o se abre información.
- El selector de calidad sólo se implementa si las variantes y APIs del player lo permiten; incluir modo automático cuando exista.
- Una pérdida de señal no debe borrar mensajes escritos ni marcar la sala como finalizada sin autoridad para hacerlo.
- No inventar un indicador de espectadores o de calidad de conexión: mostrarlo sólo con una fuente confiable y significado definido.
- Verificar consumo de mensajes/suscripciones y listeners al salir de la sala, cambiar de sala y reabrirla.
- La resolución de video debe respetar proporción; evitar recortar diapositivas o texto de la clase con `object-cover` por estética.

Cloudflare documenta el uso de reproductores propios con HLS; hls.js documenta sus requisitos y uso de Media Source Extensions. La selección entre reproducción nativa y biblioteca depende de capacidades comprobadas. Mantener la integración actual hasta verificar si existe un problema técnico real. [Cloudflare: reproductor propio](https://developers.cloudflare.com/stream/viewing-videos/using-own-player/), [Repositorio oficial de hls.js](https://github.com/video-dev/hls.js).

### Objetivos propuestos, todavía no medidos

| Indicador | Objetivo de aceptación inicial | Condición de medición |
|---|---|---|
| Estabilidad del medio | 0 reinicios causados por abrir/cerrar chat, rotar o cambiar modo compatible | Misma transmisión, registrando identidad del video y eventos |
| Controles | Respuesta visual local perceptible dentro de 100 ms como objetivo | Medir en dispositivo representativo; excluir espera de red/proveedor |
| Layout | 0 desbordes horizontales de controles/chat a 320 CSS px | Con contenido largo y zoom definido |
| Chat | 0 borradores perdidos ante error de envío reproducible | Error de red/controlado, reintento y restauración |
| Lectura | 0 saltos involuntarios al recibir mensajes mientras se lee historial | Carga reproducible de mensajes |
| Limpieza | 0 suscripciones/listeners duplicados tras ciclos de entrada y salida | Instrumentación en desarrollo |
| Inicio/rebuffer | Sin regresión frente a la línea base bajo la misma red y stream | Establecer línea base antes del cambio |
| Animación | Sin saltos visibles en controles y reducción de movimiento respetada | Dispositivo de gama media + configuración reducida |

El tiempo hasta primer cuadro y la latencia total dependen de captura, codificación, red, CDN y player. No fijar una promesa de “menos de un segundo” por rediseñar la UI.

## 17. Convivencia con el modo podcast

- Leer `docs/PODCAST_ARCHITECTURE.md` antes de tocar componentes o stores protegidos por las reglas del proyecto.
- Definir qué ocurre si el usuario entra a un vivo mientras hay podcast reproduciéndose. Verificar primero el comportamiento actual y mantener la autoridad de audio existente.
- Evitar dos reproducciones con sonido simultáneas. La solución debe coordinarse con el store/engine vigente, sin introducir un segundo controlador global aislado.
- Al salir del vivo, no reanudar automáticamente otro audio sin contrato definido y gesto/permisos compatibles.
- Probar entrar/salir, navegación atrás, cierre de sesión y retorno desde segundo plano con un podcast previamente cargado.
- La persistencia del reproductor del vivo debe limitarse al alcance aprobado; no convertirlo en reproductor global por accidente.

## 18. Panel administrativo: claridad operativa

El objetivo no es rediseñar todo el backoffice. Es que quien administra pueda anticipar lo que verá el alumno y distinguir decisiones de producto de estados técnicos.

| Área | Dirección propuesta | Verificación |
|---|---|---|
| Selección de sala | Distinguir sala activa de transmisión efectivamente conectada | Activar una sala no se comunica como empezar a emitir |
| Estado | Separar programada, en vivo, pausa, finalizada y señal del emisor | No usar el mismo color/mensaje para estados diferentes |
| Programación | Horario legible con zona horaria pertinente | Admin y alumno entienden cuándo comienza |
| Permisos | Explicar audiencia/planes con la regla existente | No confundir vista previa de admin con acceso real de alumno |
| Vista del alumno | Acceso claro a previsualización con contexto | Aclarar qué permisos representa esa vista |
| Acciones críticas | Jerarquía y explicación para finalizar/reactivar | Finalizar no se confunde con pausar o perder conexión |
| Móvil | Acciones accesibles sin tablas/menús que se corten | Crear, activar, comprobar y finalizar en ancho reducido |
| Grabación | Diferenciar procesando, disponible y error | No mostrar descarga lista cuando aún no existe |
| Retroalimentación | Estado pendiente, resultado y recuperación | Evitar acciones repetidas por ausencia de feedback |

Preservar el webhook, sincronización y decisiones manuales que evitan finalizar una sesión por microcortes. Si la auditoría encuentra un desajuste entre documentación y comportamiento, resolverlo con evidencia antes de alterar esa lógica.

## 19. Límites de componentes propuestos

Los nombres siguientes son orientativos; no son archivos creados ni un mandato de reestructurar todo de una vez.

| Responsabilidad | Límite sugerido | Contrato que debe preservar |
|---|---|---|
| Página de sala | `VIPLiveRoom` como composición y permisos | Resolución de sala, acceso y estados de negocio |
| Layout | Contenedor adaptable de la sala | Ancho, altura, regiones y modo sin duplicar video |
| Medio | Player/adapter existente con cambios focalizados | Una instancia multimedia y ciclo de vida verificable |
| Controles | Barra y menús del player | Propiedades reales, errores y accesibilidad |
| Audio | Invitación compacta y control de silencio | Gesto válido, resultado real, posibilidad de continuar silenciado |
| Contexto | Encabezado de la transmisión | Título, estado y descripción sin invadir video |
| Conversación | Panel contenedor + lista + composer | Permisos, seguimiento, borrador y envío |
| Presentación de estado | Mensajes coherentes de sala y medio | Una prioridad visible, sin overlays contradictorios |

### Reglas de implementación futuras

- Mantener la identidad del `<video>` al cambiar layout; no renderizar un player para desktop y otro para móvil.
- Mover la presentación con CSS/composición estable antes de recurrir a remontajes condicionales.
- Separar estado de negocio, estado del medio y estado efímero de interfaz.
- No suscribir toda la sala a cada mensaje si basta con actualizar la región de conversación.
- Usar los patrones actuales de React 19, TypeScript estricto y Tailwind; extraer responsabilidades cuando simplifique cambios y pruebas.
- Reutilizar primitivas existentes con soporte accesible; comprobar portales dentro de fullscreen antes de adoptarlas.
- Preservar auth, RLS, contratos de APIs y validaciones; cualquier modificación necesaria debe tener justificación y pruebas propias.

## 20. Plan de ejecución, paso a paso

**Esta sección es un plan posterior a la aprobación del documento. No se ejecutó ninguna etapa de implementación.** Las complejidades son relativas, no compromisos de fechas.

### Paso 1 — Levantar una línea base reproducible

- **Depende de:** acceso a una emisión de prueba, cuentas/planes representativos y dispositivos.
- **Trabajo:** recorrer los casos identificados; capturar pantallas vertical/horizontal; medir anchos/alturas; registrar navegador, versión y red; contrastar SQL/proveedor desplegados sin exponer secretos.
- **Entregable:** evidencia vinculada a los IDs de hallazgos dentro de este mismo documento o en el sistema de seguimiento acordado.
- **Aceptación:** cada riesgo prioritario queda reproducido, descartado o justificado como pendiente con responsable.
- **Áreas:** sala, player, chat, panel admin, configuración desplegada pertinente.
- **Complejidad:** media; requiere dispositivos y una transmisión real.

### Paso 2 — Acordar los contratos de la experiencia

- **Depende de:** paso 1 y revisión de esta propuesta.
- **Trabajo:** definir semántica de audio, pausa del emisor/local, normal/cine/fullscreen, chat plegado, acceso y finalización.
- **Entregable:** tabla de estados y decisiones actualizada; microcopy aprobado.
- **Aceptación:** cada acción visible tiene efecto, error y salida definidos; no se cambia acceso por accidente.
- **Áreas:** contratos de componentes, stores/hooks pertinentes, textos de UI.
- **Complejidad:** media.

### Paso 3 — Diseñar las composiciones y detalles visuales

- **Depende de:** paso 2.
- **Trabajo:** preparar vistas de escritorio, móvil vertical, horizontal bajo, tablet y estados críticos; incluir títulos/mensajes largos, safe areas y teclado.
- **Entregable:** diseño revisable con medidas, jerarquía, objetivos táctiles y estados de foco/error.
- **Aceptación:** los flujos ver, escuchar, escribir y ampliar se entienden sin explicación; se conserva la paleta del cliente.
- **Áreas:** layout de sala, encabezado, controles, chat y estados.
- **Complejidad:** media/alta.

### Paso 4 — Corregir interacción y recuperación de audio

- **Depende de:** pasos 2–3; baseline de compatibilidad.
- **Trabajo:** sustituir invitación bloqueante por control compacto, observar `play()`/estado real, permitir silencio persistente y recuperar fallos.
- **Entregable:** flujo de entrada y audio completo con pruebas de rechazo/silencio y dispositivos.
- **Aceptación:** no hay bloqueo visual total por silencio, falsas confirmaciones ni audio duplicado.
- **Áreas:** player, controles y coordinación con estado de audio existente.
- **Complejidad:** alta por diferencias de navegador.

### Paso 5 — Reorganizar layout sin reiniciar el video

- **Depende de:** pasos 3–4.
- **Trabajo:** reemplazar repartos rígidos por regiones adaptables, título compacto visible, conversación plegable y reglas para poca altura.
- **Entregable:** sala coherente en todos los anchos de la matriz.
- **Aceptación:** rotación, resize y plegado preservan medio y borrador; no hay desbordes ni controles inaccesibles.
- **Áreas:** `VIPLiveRoom`, layout de sala, player y panel del chat.
- **Complejidad:** alta.

### Paso 6 — Hacer confiable la lectura y el envío del chat

- **Depende de:** contratos del paso 2; layout del paso 5 para validación final.
- **Trabajo:** seguimiento condicionado, contador de nuevos, borrador preservado, error/reintento, estados de conexión y teclado; verificar consulta de mensajes recientes.
- **Entregable:** conversación usable y contrato de carga/envío probado.
- **Aceptación:** leer historial no genera saltos; el error no pierde el mensaje; la sala recibe los mensajes esperados en orden.
- **Áreas:** `LiveChat`, hooks/API de mensajes y SQL sólo si la verificación demuestra necesidad.
- **Complejidad:** media/alta; separar una corrección de datos de los cambios visuales.

### Paso 7 — Completar cine, fullscreen y alternativas

- **Depende de:** player estable y layout del paso 5.
- **Trabajo:** capacidad real, solicitud/rechazo, sincronización de salida, foco, portales, safe areas y alternativa nativa; PiP sólo si se aprueba y soporta.
- **Entregable:** modos con nombres, acciones y limitaciones claras.
- **Aceptación:** cada dispositivo probado puede ampliar o recibe alternativa honesta; nunca pierde la salida o remonta el medio por un cambio de vista.
- **Áreas:** player, control de modos, panel del chat y primitivas de menús/dialogs usadas.
- **Complejidad:** alta.

### Paso 8 — Unificar estados y operación administrativa

- **Depende de:** contrato de sala del paso 2 y primeras pruebas de pasos 4–7.
- **Trabajo:** coherencia de mensajes programada/en vivo/pausada/finalizada; separar señal de sala activa; feedback de acciones y acceso a vista del alumno.
- **Entregable:** operación comprensible y estados de alumno consistentes con la autoridad backend.
- **Aceptación:** microcorte no se presenta como finalización; el admin entiende qué verá el alumno.
- **Áreas:** sala, `AdminLiveManager`, hooks de estado y grabaciones pertinentes.
- **Complejidad:** media; no cambiar lógica de sincronización sin evidencia y pruebas.

### Paso 9 — Verificar accesibilidad, rendimiento y dispositivos

- **Depende de:** pasos 4–8 integrados.
- **Trabajo:** ejecutar matrices de este documento, auditar foco/contraste/lectores, medir regresiones y comprobar podcast.
- **Entregable:** resultados reales con pass/fail, defectos restantes y capacidades no soportadas.
- **Aceptación:** ningún P0 abierto; P1 justificado y corregido o excluido de forma explícita; límites de subtítulos documentados.
- **Áreas:** flujo completo y pruebas pertinentes.
- **Complejidad:** alta por cobertura de dispositivos.

### Paso 10 — Revisar y desplegar gradualmente

- **Depende de:** paso 9 y aprobación del resultado concreto.
- **Trabajo:** revisión visual final, checklist de regresión y plan de vuelta atrás; comprobar una emisión controlada antes de ampliar exposición.
- **Entregable:** experiencia validada y documentación del estado real actualizada.
- **Aceptación:** se reproducen entrada/audio/chat/fullscreen/finalización en entorno desplegado sin regresiones críticas.
- **Áreas:** despliegue existente, documentación del proyecto y seguimiento acordado.
- **Complejidad:** media.

## 21. Estrategia de entregas revisables

El conjunto puede superar con facilidad un cambio cómodo de revisar. Se propone dividir por comportamiento terminado, incluyendo sus pruebas y ajustes de documentación correspondientes.

| Entrega sugerida | Incluye | Evita mezclar |
|---|---|---|
| 1 | Contrato de audio y recuperación con interfaz compacta | Cambio completo del chat |
| 2 | Layout adaptable y encabezado/contexto | Modificación de permisos o proveedor |
| 3 | Chat confiable: lectura, borrador, envío y carga reciente | Rediseño de operación administrativa |
| 4 | Modos de vista, fullscreen y alternativas verificadas | Funciones sociales nuevas |
| 5 | Estados coherentes y ajustes administrativos acotados | Refactor general de backend |
| 6 | Correcciones de validación final y documentación real | Nuevas funcionalidades de producto |

Las dependencias concretas se ajustan al diseño final. Si una entrega rebasa el presupuesto de revisión del proyecto, dividirla por comportamiento o tramitar la excepción correspondiente antes de implementarla. Este documento no crea commits ni PRs ni autoriza una excepción de tamaño.

## 22. Matriz de aceptación funcional

Todos los escenarios son **pruebas por ejecutar**, no resultados ya obtenidos.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| T01 | Sala en directo y navegador que permite autoplay silenciado | Abro el enlace | Veo el video y una invitación compacta de audio |
| T02 | Autoplay rechazado | Abro la sala | Veo una acción manual y no un estado falso de reproducción |
| T03 | Video silenciado | Elijo seguir sin sonido | Desaparece la invitación; sigue disponible activar sonido |
| T04 | Solicitud de audio/reproducción rechazada | Pulso activar | Recibo una explicación recuperable y el estado no afirma éxito |
| T05 | Video activo | Oculto y abro chat | La misma instancia continúa sin reiniciar conexión |
| T06 | Celular en vertical con borrador | Roto dos veces | Layout usable, mismo video y borrador preservado |
| T07 | Móvil horizontal de poca altura | Abro controles y conversación | Puedo acceder a las acciones y cerrar el panel |
| T08 | Chat al final | Llega un mensaje | Lo veo con seguimiento suave apropiado |
| T09 | Chat desplazado hacia arriba | Llegan mensajes | Mi lectura permanece y aparece contador de nuevos |
| T10 | Hay nuevos mensajes pendientes | Pulso el contador | Vuelvo al final y reanudo seguimiento |
| T11 | Mensaje redactado | El envío falla | El contenido no se pierde y puedo reintentar |
| T12 | Envío pendiente | Pulso enviar de nuevo | No se duplican mensajes por la interacción |
| T13 | Campo con composición IME | Confirmo una composición | No se envía el mensaje prematuramente |
| T14 | Composer en iOS/Android | Abro y cierro teclado | Campo, envío y mensajes relevantes siguen alcanzables |
| T15 | Fullscreen soportado | Entro y salgo por control del sistema | UI, foco y estado quedan sincronizados |
| T16 | Fullscreen de contenedor no soportado o rechazado | Intento ampliar | Recibo alternativa disponible sin botón atascado |
| T17 | Menú abierto dentro de fullscreen | Navego con teclado/touch | Menú visible, foco correcto y salida accesible |
| T18 | Emisor se desconecta temporalmente | Llega estado de pausa | Se explica pausa sin finalizar la sesión |
| T19 | Sala pausada | Vuelve señal | Recupero video según política y no pierdo conversación |
| T20 | Sala en directo | Admin finaliza | Veo cierre claro; se evita reconectar indefinidamente |
| T21 | Red activa con borrador | Pierdo y recupero conexión | Recibo estados separados y conservo borrador |
| T22 | Video activo | Voy a otra app y vuelvo | Estado se comprueba y se ofrece recuperación si hace falta |
| T23 | Usuario con permisos insuficientes | Abre sala o intenta escribir | Se mantienen las reglas reales y el mensaje es claro |
| T24 | Usuario anónimo donde hay lectura pública | Abre chat | Se preserva acceso previsto y se explica cómo escribir |
| T25 | Sesión vencida o cambio de cuenta | Intento participar | No se heredan permisos ni borradores privados entre cuentas |
| T26 | Podcast cargado/reproduciéndose | Entro al vivo y activo sonido | Se cumple la política acordada sin doble audio |
| T27 | Sala A con mensajes | Cambio a sala B | No quedan mensajes, listeners ni permisos de A |
| T28 | Texto largo y zoom equivalente a 320 CSS px | Recorro sala y chat | Interfaz legible sin scroll horizontal innecesario |
| T29 | Navegación sólo con teclado | Uso todos los controles | Foco visible, orden coherente y ninguna trampa |
| T30 | Lector de pantalla y chat activo | Llegan varios mensajes | No se interrumpe continuamente la tarea del usuario |
| T31 | Subtítulos disponibles | Muestro controles o invitación de audio | El contenido sigue legible sin superposición evitable |
| T32 | Historial con más de 100 mensajes | Abro conversación | Recibo el tramo reciente definido y orden correcto |
| T33 | Admin en celular | Activa/finaliza y revisa grabación | Distingue acciones, estado pendiente y resultado |
| T34 | Transmisión con diapositivas/texto | Cambio de tamaño de ventana | El contenido del video no se recorta por llenar el área |
| T35 | Capacidad PiP aprobada y presente | Entro/salgo de PiP | Estado coherente; no se promete chat dentro de esa ventana |

## 23. Verificación técnica posterior

- Ejecutar `npm run typecheck` y los tests pertinentes con `npx vitest run <files>` al completar cada módulo, conforme a las reglas del proyecto.
- No ejecutar `npm run build` como verificación.
- Tests de lógica para transiciones, errores de envío, preservación de borradores, seguimiento del chat y manejo de rechazos.
- Tests de componentes para nombres accesibles, estados visibles y acciones; evitar tests que sólo copien clases CSS.
- Pruebas de integración para permisos, carga reciente de mensajes y sincronización de sala si esas capas cambian.
- Pruebas de navegador para foco, scroll, fullscreen y continuidad del elemento multimedia, con límites conocidos de automatización.
- Pruebas físicas para gestos de reproducción, audio, teclado, rotación, sistema operativo y modos nativos.
- Revisión visual de estados reales en los puntos de ancho/altura definidos; no basta una captura del estado feliz.

## 24. Puertas de salida y regresión

### Antes de implementar

- [ ] Revisar y aprobar alcance, prioridades y dirección visual.
- [ ] Confirmar qué estados y permisos están realmente desplegados.
- [ ] Completar línea base con una transmisión controlada.
- [ ] Definir política de audio y convivencia con podcast.
- [ ] Confirmar capacidades reales de fullscreen, calidad, PiP y subtítulos antes de prometerlas.

### Antes de dar por terminado el rediseño

- [ ] No quedan problemas P0 abiertos.
- [ ] Video, audio, chat y modos de vista pasan escenarios correspondientes.
- [ ] Celular vertical/horizontal y teclado están probados físicamente en Apple y Android.
- [ ] Tablet/multitarea y escritorio pequeño/grande tienen resultados registrados.
- [ ] Acceso, RLS, sesión y roles conservan su comportamiento autorizado.
- [ ] Pausa, finalización, grabación y operación administrativa no tienen regresiones.
- [ ] Navegación y podcast no producen doble audio ni estado residual.
- [ ] Accesibilidad y limitaciones audiovisuales están descritas con evidencia.
- [ ] Se conoce cómo revertir el cambio de interfaz sin afectar datos/transmisiones.
- [ ] `docs/PROJECT_STATE.md` y `docs/CHANGELOG.md` se actualizarán al implementar, según las convenciones del repo.

## 25. Incertidumbres que deben cerrarse

| Tema | Qué falta comprobar | Recomendación mientras tanto |
|---|---|---|
| Producción | Coincidencia entre commit auditado, SQL y configuración desplegada | Tratar las diferencias como pendientes, no asumirlas |
| Aspecto real | Capturas y observación de la interfaz con video/chat reales | No atribuir defectos visuales concretos a una observación inexistente |
| Dispositivos prioritarios | Distribución real de usuarios y versiones de SO | Cubrir matriz base y ajustar con datos de audiencia |
| Pantalla completa | Capacidades de navegador y elemento concreto | Detección + manejo de rechazo + alternativa |
| Volumen/PiP/AirPlay/casting | Soporte exacto por dispositivo, proveedor y UX actual | No mostrar funciones no verificadas |
| Subtítulos en vivo | Disponibilidad de pistas y proceso de generación | Registrar dependencia de producción audiovisual |
| Chat histórico | Consulta desplegada, retención y volumen habitual | Verificar antes de cambiar consulta/paginación |
| Permisos | Semántica efectiva de lectura pública, planes y sala finalizada | Mantener reglas y probar con cuentas representativas |
| Calidad de video | Variantes disponibles y control expuesto por player | Mantener automático hasta comprobar alternativas |
| Rendimiento | Línea base de inicio, rebuffer, memoria y eventos | Medir antes y después bajo condiciones comparables |

## 26. Referencias y alcance de las fuentes

- **Kick:** guías oficiales enlazadas en la sección 5. Respaldan comportamientos documentados; no prueban píxeles, estilos actuales ni rendimiento comparado.
- **WebKit y Chrome:** fuentes de políticas y comportamiento del navegador enlazadas junto a audio, safe areas y teclado. Las históricas explican fundamentos; la compatibilidad vigente debe probarse.
- **W3C:** criterios de reflow, tamaño de objetivo y subtítulos enlazados donde se aplican. Este documento no constituye certificación WCAG.
- **Android:** guía nativa usada como referencia de ergonomía; no convierte unidades dp a CSS px.
- **Cloudflare y hls.js:** documentación primaria del medio. No demuestra la configuración concreta desplegada por este proyecto.
- **Repositorio de la Escuela:** evidencia estática de archivos y líneas en la sección de hallazgos, fijada al commit indicado al inicio.

**Resultado esperado de la siguiente etapa:** un diseño revisable y luego una implementación que permita ver, escuchar, conversar y ampliar sin fricción, con limitaciones explícitas y pruebas reales. La aprobación de este documento autoriza definir el trabajo siguiente; no convierte en implementadas ni verificadas las propuestas aquí descritas.
