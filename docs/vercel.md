# Desplegar guiddo en Vercel

El sitio funciona en Vercel **y** en cualquier servidor Node (Render, etc.): el adaptador se elige solo (`VERCEL=1` lo pone Vercel al compilar). La base de datos sigue siendo Supabase.

## Plan gratis (Hobby) vs. Pro — léelo antes de salir en vivo
- Vercel **Hobby** no "duerme" el sitio como el plan gratis de Render: responde siempre (la primera visita tras un rato sin tráfico puede tardar 1–2 s extra).
- **Pero los términos de Hobby limitan el plan a uso personal y no comercial.** guiddo cobra a los médicos por aparecer, así que es uso comercial: lo correcto es **Pro** (US$20/mes por usuario). Para pruebas y ver cómo se ve, Hobby sirve.
- Los límites de Hobby (tiempo de ejecución de funciones, tráfico) son suficientes para empezar; verifica los vigentes en vercel.com/pricing.

## Pasos
1. En vercel.com: **Add New → Project → Import** el repositorio `arthurliberato/directorio`. Framework: **Astro** (lo detecta solo). No cambies los comandos de build.
2. **Environment Variables** (las mismas de Render, más las del bot cuando existan):
   - `DATABASE_URL` → usa la cadena del **Transaction pooler** de Supabase (puerto **6543**), no la de Session pooler. En Supabase: *Connect → Transaction pooler*. En serverless cada petición puede abrir su conexión y el Session pooler se agota.
   - `ADMIN_PASSWORD`, `CEDULA_PEPPER`
   - `PUBLIC_SITE_URL` = `https://guiddo.net`
   - `SITE_MODE` = `prototype` al principio; `production` cuando quieras que Google indexe.
   - (Bot) `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE_APPT`.
3. **Deploy**. Pruébalo en la URL `*.vercel.app` antes de mover el dominio.
4. **Region**: en *Settings → Functions* elige la región de Functions más cercana a tu proyecto de Supabase (menos latencia a la base de datos).
5. **Dominio**: *Settings → Domains → Add* `guiddo.net` y `www.guiddo.net`. Vercel te dice qué poner en GoDaddy:
   - `A` `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
   (usa los valores que Vercel te muestre). Cuando verifique, **quita el dominio del servicio de Render** para que no compitan.
6. En Supabase ejecuta `db/migrations/007_bot_pending.sql` (estado de la conversación del bot, necesario en serverless).

## Qué cambió para que funcione en serverless
- El estado "este paciente está escribiendo una solicitud de cita" ya no vive en memoria: se guarda en la tabla `bot_pending` (007). El límite de 3 solicitudes por hora se cuenta en `appointment_requests`.
- El webhook de WhatsApp responde a los mensajes **antes** de contestarle a Meta (una función serverless se congela al terminar la respuesta).
- Conexiones a Postgres con `prepare: false`, necesario para el Transaction pooler.
- El caché (`s-maxage` / `stale-while-revalidate`) lo respeta la red de Vercel; las páginas públicas se sirven desde caché.

## Lo que sigue igual
- El recálculo nocturno de índices y el IndexNow corren en GitHub Actions (`.github/workflows/nightly.yml`), no en el servidor.
- `robots.txt`, sitemaps y `llms.txt` se generan por petición, igual que antes.
