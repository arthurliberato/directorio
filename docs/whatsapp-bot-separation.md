# Separar el bot de WhatsApp (guiddo) del sitio

Hoy el bot vive **dentro** del sitio Astro: comparte proceso, despliegue y datos. Este documento explica qué es del bot, de qué depende del sitio, y cómo sacarlo a su propio servicio/repositorio sin romper nada.

## 1. Qué es del bot hoy

| Archivo | Qué hace |
|---|---|
| `src/lib/whatsapp/bot.ts` | Lógica de conversación: recibe un mensaje y devuelve respuestas. Función pura `respond()`. |
| `src/lib/whatsapp/messages.ts` | Constructores de mensajes (texto, imagen, botones, listas) con los límites de WhatsApp. |
| `src/lib/whatsapp/client.ts` | Firma HMAC, parseo del webhook, deduplicación, envío por Graph API, hash del remitente para logs. |
| `src/pages/api/whatsapp.ts` | Webhook: GET (verify token) y POST (firma + respuesta en segundo plano). |
| `src/pages/admin/whatsapp.astro` | Simulador (no envía nada a WhatsApp). |
| `src/lib/search.ts` | Búsqueda por texto libre (especialidad/ciudad/ARS). También la usaba el buscador del sitio, que ya no la usa. |
| `tests/whatsapp.test.ts` | Pruebas del bot. |
| `src/middleware.ts` (1 línea) | Exime `/api/whatsapp` del Basic auth. |
| `src/components/AdminShell.astro` (1 enlace) | Enlace "WhatsApp" del menú admin. |

Variables de entorno: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_API_VERSION` (opcional, `v24.0`), `WHATSAPP_BOT_NAME` (opcional), `CEDULA_PEPPER` (para el hash en logs).

## 2. De qué depende el bot del sitio

El bot **no** tiene datos propios: lee el mismo catálogo que las páginas, para no contradecirlas nunca.

- `src/lib/data.ts` y `dataset.ts` (+ `db-loader.ts`, `types.ts`): catálogo en memoria cargado desde Postgres (`DATABASE_URL`) o la semilla.
- `src/lib/booking.ts` (`canBook`, enlace de WhatsApp con mensaje prellenado), `facts.ts`, `format.ts`, `hubs.ts` (`hubPath`, `sortDoctors`).
- `src/data/trust.ts` (texto de "Cómo verificamos") y `src/config.ts` (`SITE_URL`, `BOT_NAME`, `NAP`).

Reglas que el bot debe seguir respetando (SPEC §2.1): foto, insignia "verificado" y reserva solo para `affiliated`; los `listed` son informativos, sin foto ni reserva, solo central de la clínica; nunca inventar datos.

## 3. Dos formas de separarlo

### Opción A — Servicio aparte que lee la misma base de datos (recomendada)
Un repo/servicio nuevo (`guiddo-bot`) con su propio Render Web Service. Copia los módulos de la sección 2 (o los publica como paquete interno) y se conecta a **la misma** Postgres con un usuario **de solo lectura**.

- Ventaja: el sitio y el bot se despliegan, escalan y fallan por separado; una caída del bot no toca el SEO.
- Costo: hay que mantener sincronizadas las reglas de niveles (`affiliated`/`listed`) entre dos repos, o compartirlas como paquete.
- Pasos:
  1. Crear usuario de solo lectura en Supabase (`select` sobre las tablas del catálogo).
  2. Repo nuevo con Node + el webhook (puede ser Astro mínimo, Fastify o Hono) y los archivos de la sección 1 y 2.
  3. Variables: las de WhatsApp, `DATABASE_URL` (solo lectura), `PUBLIC_SITE_URL=https://guiddo.net`, `CEDULA_PEPPER`.
  4. Render: nuevo Web Service, ej. `bot.guiddo.net`. Callback en Meta: `https://bot.guiddo.net/webhook`.
  5. Mover el simulador al bot (o a una ruta protegida del propio servicio).

### Opción B — El bot habla con el sitio por una API JSON
El sitio expone un API de solo lectura (`/api/catalog/...`, con clave) y el bot, sin base de datos, la consume.

- Ventaja: una sola fuente de verdad en código; el bot no conoce el esquema.
- Costo: más trabajo (diseñar la API, caché, latencia) y una dependencia de red entre servicios.

**Recomendación:** A. Es lo más simple y el bot nunca escribe en la base de datos.

## 4. Qué se borra del sitio al separar

1. `src/lib/whatsapp/`, `src/pages/api/whatsapp.ts`, `src/pages/admin/whatsapp.astro`, `tests/whatsapp.test.ts`.
2. La excepción `/api/whatsapp` en `src/middleware.ts` y el enlace en `AdminShell.astro`.
3. `src/lib/search.ts` si nada más lo usa (el buscador del inicio ya no lo usa).
4. En `src/config.ts`, `BOT_NAME`.
5. Las variables `WHATSAPP_*` del Render del sitio (pasan al servicio del bot).

Lo que **se queda** en el sitio: los botones de "Programar cita por WhatsApp" de cada doctor (`booking.ts`, panel del perfil). Son enlaces `wa.me` al WhatsApp del propio doctor y no tienen nada que ver con el bot.

## 5. Orden recomendado (sin tiempo sin servicio)

1. Crear el servicio del bot y probarlo con el número de pruebas de Meta.
2. Cambiar el callback del webhook en Meta al nuevo servicio.
3. Verificar mensajes reales de ida y vuelta.
4. Solo entonces, borrar el bot del sitio (PR aparte).

## 6. Pendiente en cualquier caso

- Guía de configuración de Meta (SIM → WhatsApp Business → app → número → token permanente → secreto de app → webhook) todavía no escrita.
- Aviso de privacidad (Ley 172-13) y texto de consentimiento para el chat.
- Nombre visible del perfil de WhatsApp Business: "guiddo".
- Traspaso a humano: hoy solo da el correo de contacto; falta definir quién responde y cómo.

## 7. Prompt para Claude Code

```
Lee docs/whatsapp-bot-separation.md. Implementa la Opción A: crea un repo/servicio "guiddo-bot" con el bot de WhatsApp,
copiando los módulos de las secciones 1 y 2 y leyendo el catálogo de la misma Postgres con un usuario de solo lectura.
Mantén las reglas de niveles de SPEC §2.1 y las pruebas de tests/whatsapp.test.ts. No borres nada del sitio hasta que el
bot nuevo responda mensajes reales; después abre un PR aparte que elimine el bot del sitio (sección 4).
```
