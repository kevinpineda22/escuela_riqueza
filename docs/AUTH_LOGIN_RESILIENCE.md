# Login y red inestable — sesión a medias

> Por qué varios alumnos veían "No pudimos iniciar sesión" desde el celular **estando ya autenticados**,
> qué se parchó, y qué falta decidir.
> **Leer antes de tocar** `src/lib/api/auth.ts` o el manejo de errores de `AuthPage`.

_Creado: 2026-09-11 · Estado: 🟡 PARCHE APLICADO — decisión de diseño pendiente_

---

## 1. El síntoma

Alumnos reportaron desde el celular el mensaje **"No pudimos iniciar sesión. Inténtalo de nuevo."**
Intermitente, solo a algunos, y solo en móvil. En una de las capturas el dispositivo estaba con
**4G a dos barras**.

---

## 2. La causa (probada, no inferida)

`signIn` en `src/lib/api/auth.ts` autentica contra Supabase y **después** hace dos consultas de
enriquecimiento:

1. `profiles` — para traer rol, nombre y estado de suspensión.
2. `subscriptions` — para traer el plan activo.

Ambas usaban `await supabase.from(...).single()` sin protección.

**El detalle clave:** cuando la red se corta a mitad de la petición, supabase-js **no** devuelve
`{ data, error }` como uno esperaría. **Rechaza la promesa** con un `TypeError: Failed to fetch`.

Esa excepción escapaba de `signIn`. Y el `catch` de `AuthPage` solo sabía traducir `ApiError`:

```ts
catch (err) {
  if (err instanceof ApiError) setSubmitError(err.message);
  else setSubmitError("No pudimos iniciar sesión. Inténtalo de nuevo.");  // ← acá caía todo
}
```

Reproducido con test **antes** de tocar nada:

```
TypeError: Failed to fetch
 ❯ Module.signIn src/lib/api/auth.ts:45   ← consulta de profiles
 ❯ Module.signIn src/lib/api/auth.ts:62   ← consulta de subscriptions
```

### Por qué es grave

Para cuando eso ocurre, **la sesión ya existe en Supabase**. `signInWithPassword` tuvo éxito.
El alumno quedó autenticado y la aplicación le dijo lo contrario.

---

## 3. Hipótesis descartadas (con evidencia — no volver a investigarlas)

| Hipótesis | Cómo se descartó |
|---|---|
| El navegador (Brave bloqueando storage) | zustand envuelve el acceso a storage en `toThenable`, que **se traga** los errores. Un `localStorage` bloqueado no puede romper el login. Verificado además que el storage funciona en producción. |
| CORS o Supabase caído | Ping real a `/auth/v1/token` desde el origen de producción con un email inventado: **400 `invalid_credentials` en 576 ms**. Endpoint sano. |
| Contraseña incorrecta | Ese camino lanza `ApiError` y mostraría "Email o contraseña incorrectos", no el mensaje genérico. |
| Bundle demasiado moderno para el dispositivo | La pantalla de login renderiza bien en el equipo afectado, así que el bundle parsea. |

---

## 4. Qué se parchó (ya está en el código)

### 4.1 Las consultas ya no tumban la sesión

Ambas quedaron envueltas en `try/catch`. Si fallan, el usuario **entra igual** con valores
mínimos: rol `student`, plan `free`. Al recargar se completan sus datos reales.

Los privilegios siguen protegidos por **RLS del lado del servidor**, así que fallar la lectura
del perfil **degrada** permisos, nunca los otorga.

### 4.2 `decodeURIComponent` sin protección

En `AuthPage.tsx`, `resolveReturnTarget` hacía:

```ts
const decoded = decodeURIComponent(returnToRaw);  // sin try/catch
```

Un `%` mal formado en el parámetro `returnTo` lanza `URIError` → mismo mensaje engañoso, con el
usuario ya autenticado. Ahora está protegido y cae al destino por defecto.

### 4.3 El mensaje genérico ahora habla

El `catch` loguea el error real en consola y distingue el fallo de red:
*"Se perdió la conexión. Revisá tu internet e intentá de nuevo."*

Ese mensaje genérico ocultó la causa durante días. Ese fue el verdadero costo del bug.

### 4.4 Tests

`src/lib/api/auth.test.ts` (nuevo, 4 tests) cubre: login normal, fallo de red en `profiles`,
fallo de red en `subscriptions`, y que las credenciales inválidas sigan lanzando `ApiError`.

---

## 5. El problema que el parche deja abierto

**Un alumno VIP con mala señal entra y ve la plataforma como si fuera `free`:** contenido
bloqueado, sin modo podcast, sin lives. Pagó, y la aplicación le dice en silencio que no tiene nada.

Es seguro, pero **silenciosamente incorrecto** — la peor clase de error, porque el usuario no
sabe que está viendo una mentira. El reporte que va a llegar a soporte es "perdí mi plan".

### Cómo lo resuelven las plataformas grandes

Ninguna degrada permisos en silencio:

1. **Los permisos viajan en el token.** El JWT trae rol y plan como claims. No hay dos consultas
   sueltas que puedan fallar por separado.
2. **Reintentan.** Un fallo de red móvil dura segundos, no minutos.
3. **Si de verdad no pueden, fallan claro** y no dejan sesión a medias.

Regla de fondo: **fallar ruidoso es mejor que degradar callado.**

---

## 6. Las tres salidas

### Opción A — Reintentar y fallar limpio *(propuesta)*

Retry con backoff en las dos consultas. Si aun así fallan, cerrar la sesión de Supabase y mostrar
el error de conexión.

- **A favor:** elimina casi todos los reportes. Sin estado inconsistente ni identidad parcial.
  Cambio acotado a `auth.ts`.
- **En contra:** con la red realmente caída, el alumno no entra. Es un "no" honesto, pero es un "no".

### Opción B — Rol y plan en el token

Mover rol y plan a claims del JWT con un *custom access token hook* de Supabase.

- **A favor:** resuelve el problema de raíz — no hay consultas que puedan fallar. Menos latencia
  en cada login.
- **En contra:** toca configuración de Supabase y la forma de leer permisos en todo el front.
  Los claims quedan cacheados hasta refrescar el token, así que **un cambio de plan tarda en verse**.

### Opción C — Perfil diferido

El login devuelve solo la sesión; el perfil se hidrata después con react-query, que **ya está
instalado** y reintenta solo.

- **A favor:** login instantáneo. La interfaz muestra un estado de carga real en vez de datos falsos.
- **En contra:** hay que manejar el estado "todavía no sé tu plan" en cada pantalla que dependa
  de él. Es el más invasivo en la interfaz.

---

## 7. Propuesta concreta

Aplicar **A** ahora, dejar **B** como trabajo de fondo. Dos capas:

1. **Reintentar con backoff** las consultas de perfil y suscripción. Tres intentos con espera
   creciente (~300 ms, 900 ms, 2 s). Una caída de red móvil dura segundos: esto solo debería
   hacer desaparecer prácticamente todos los reportes sin que el alumno note nada.

2. **Si aún así falla, login limpio.** Cerrar la sesión de Supabase y mostrar
   *"Se perdió la conexión, revisá tu internet"*. Nada de identidades parciales: el alumno
   reintenta y entra completo, o sabe exactamente por qué no entró.

A mediano plazo, mover rol y plan al token elimina la clase entera de errores. No es urgente,
pero es la dirección correcta.

---

## 8. Qué hay que decidir

1. **¿El alumno debe entrar degradado o no entrar con un mensaje claro** cuando la red impide
   cargar su perfil? Es una decisión de producto, no técnica.
2. **¿Cuántos reintentos antes de rendirse?** La propuesta son tres.
3. **¿Se abre el trabajo de mover rol y plan al token**, o queda anotado para más adelante?

---

## 9. Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `src/lib/api/auth.ts` | `try/catch` en las consultas de `profiles` y `subscriptions` |
| `src/pages/public/AuthPage.tsx` | `try/catch` en `decodeURIComponent`; el catch del login distingue fallo de red y loguea el error real |
| `src/lib/api/auth.test.ts` | Nuevo — 4 tests de resiliencia |

> El parche ya está en el código y tiene tests. Lo que está en discusión **no es si arreglarlo**,
> sino qué debe ver el alumno cuando la red no alcanza.
