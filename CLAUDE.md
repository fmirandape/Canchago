# CanchaGo — Memoria del proyecto

## Qué es
Plataforma de reservas de canchas deportivas para Bogotá, Colombia.
- **Dueños de cancha**: registran su espacio y administran horarios
- **Clientes**: buscan disponibilidad, reservan y pagan en línea
- **Fundador**: Farith Miranda · farith.miranda@gmail.com · Bogotá

## Stack actual (MVP — todo en producción)
- **Frontend**: HTML/CSS/JS vanilla — sin frameworks
- **Hosting**: GitHub Pages rama `gh-pages`
- **Dominio**: canchago.com.co (Cloudflare DNS + HTTPS activo)
- **Notificaciones**: WhatsApp API wa.me — número `573177867255`
- **SEO**: Schema.org, sitemap.xml enviado a Google Search Console ✅

## Ramas git
- Desarrollo: `claude/responsive-web-version-FRjyf`
- Producción: `gh-pages`
- Deploy: `git checkout gh-pages && git checkout claude/... -- [archivos] && git add && git commit && git push origin gh-pages && git checkout claude/...`

## Archivos del proyecto
| Archivo | Descripción |
|---|---|
| `index.html` | Landing page SEO (Bogotá, Schema.org, FAQ, pricing COP) |
| `registro.html` | Wizard 3 pasos para dueños de cancha |
| `cancha.html` | Página pública de cancha (reserva + pagos) |
| `buscar.html` | Búsqueda con filtros: deporte, localidad, luz, parqueadero, cubierta |
| `panel.html` | Dashboard del dueño (KPIs, reservas, bloqueo de franjas) |
| `lista-espera.html` | Waitlist → notifica WhatsApp al registrar |
| `sitemap.xml` | Sitemap enviado a Google Search Console |
| `robots.txt` | Allow all, referencia sitemap |

## Diseño / UI
- Tema oscuro (`#0a0f1e` fondo, `#22c55e` acento verde)
- Mobile-first, responsive
- Fuente: Inter (Google Fonts)
- Precio en COP (pesos colombianos)
- 20 localidades de Bogotá en selectores

## Características implementadas
- [x] Filtro por cubierta / al aire libre
- [x] Filtro por parqueadero
- [x] Iluminación nocturna
- [x] Deportes: Fútbol 5, Fútbol 7, Pádel, Tenis, Básquet, Voleibol
- [x] Selector de franja horaria (disponible / ocupada / pasada)
- [x] Drawer de reserva con PSE / Nequi / Tarjeta
- [x] Código de reserva CGO-XXXXX
- [x] Web Share API en cancha.html

## Roadmap pendiente (en orden)
1. **Fase 1** — Backend real con Supabase (PostgreSQL + Auth + RLS)
   - Tablas: usuarios, canchas, disponibilidad, reservas, reseñas
   - Auth: email/password + JWT
   - Emails con Resend (3K/mes gratis)
2. **Fase 2** — Wompi (pasarela pagos Colombia): PSE, Nequi, tarjeta
   - Webhook firmado HMAC-SHA256 → Edge Function → actualiza reserva
3. **Fase 3** — Seguridad: headers CSP, rate limiting, Ley 1581
4. **Fase 4** — Lanzamiento: 30 canchas de lista de espera, PWA, GSC

## Costos actuales
- Todo en $0/mes (GitHub Pages + Cloudflare Free + Supabase Free tier)
- Wompi: 3.49% por transacción (sin mensualidad)
- Dominio canchago.com.co: ~$60K COP/año (ya pagado)

## Modelo de negocio
- Comisión 5% sobre cada reserva procesada
- Plan Pro dueños: $49,900 COP/mes (hasta 5 canchas)
- Precio prom reserva Bogotá: $78,000 COP/hora

## Artefactos publicados
- Roadmap: https://claude.ai/artifact/6vTB3NqyDRLpJN2gf3rcBV
- Proyección financiera: https://claude.ai/artifact/6m3ejiDbrw7DR3j76pG51R
