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
| `login.html` | Login de dueños → Supabase Auth → redirige a panel.html |
| `cancha.html` | Página pública de cancha — carga por ?slug=, reserva real a Supabase |
| `buscar.html` | Búsqueda con filtros: deporte, localidad, luz, parqueadero, cubierta |
| `panel.html` | Dashboard del dueño — KPIs, reservas y bloqueos desde Supabase |
| `lista-espera.html` | Waitlist → INSERT en tabla lista_espera + WhatsApp |
| `privacidad.html` | Política de privacidad — Ley 1581 de 2012 |
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
- [x] Login de dueños con Supabase Auth (login.html)
- [x] Panel conectado a Supabase: reservas reales, KPIs, bloqueo de turnos
- [x] Lista de espera guardada en Supabase + contador en tiempo real
- [x] cancha.html carga por ?slug=, consulta disponibilidad real, guarda reservas
- [x] Wompi pagos: PSE, Nequi, tarjeta — checkout hosted, webhook HMAC-SHA256
- [x] Email de confirmación al cliente vía Resend desde reservas@canchago.com.co
- [x] Security headers en GitHub Pages (_headers)
- [x] Rate limiting en Edge Function generar-pago (10 req/min por IP)
- [x] Ley 1581 — política de privacidad + checkbox obligatorio en reserva

## Supabase (conectado oct 2026)
- **Proyecto**: CanchaGo Project · `https://xqklrfzhpywbyxhskvtq.supabase.co`
- **Publishable key**: `sb_publishable_nwWnl9ohsydrFtzmGjJz4A_dGodbr8D`
- **Región**: East US (North Virginia) — free tier
- **Email confirmation**: DESACTIVADO (para facilitar registro en MVP)
- **Cliente JS**: `supabase.js` (UMD via jsdelivr cdn, cargado en registro.html)
- **Schema**: `supabase/schema.sql` — ejecutado con éxito en SQL Editor

### Tablas creadas y con RLS activo
| Tabla | Estado |
|---|---|
| `perfiles` | ✅ Trigger automático al crear usuario en auth |
| `canchas` | ✅ INSERT funciona — dueño_id vinculado a auth.uid() |
| `disponibilidad` | ✅ Creada |
| `reservas` | ✅ Creada — campo código CGO-XXXXX |
| `reseñas` | ✅ Creada |
| `lista_espera` | ✅ Creada |

### Integración actual (oct 2026)
| Archivo | Supabase |
|---|---|
| `registro.html` | `auth.signUp()` + INSERT `canchas` ✅ |
| `login.html` | `auth.signInWithPassword()` → redirige a panel.html ✅ |
| `panel.html` | Auth check + SELECT `canchas`, `reservas`, `disponibilidad` · INSERT/DELETE `disponibilidad` ✅ |
| `cancha.html` | SELECT `canchas` por slug · SELECT `disponibilidad` · INSERT `reservas` ✅ |
| `lista-espera.html` | INSERT `lista_espera` · SELECT count (política pública) ✅ |
| `buscar.html` | Data hardcodeada (12 canchas demo) — intencional hasta onboarding real |

### Políticas RLS adicionales ejecutadas en SQL Editor
```sql
-- lista_espera: cualquiera puede leer el conteo
create policy "lista_espera: ver conteo"
  on public.lista_espera for select using (true);
```

### Trigger ejecutado en SQL Editor
```sql
-- Al insertar en reservas, marca automáticamente el slot en disponibilidad
create or replace function public.handle_reserva_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into public.disponibilidad (cancha_id, fecha, hora, estado, reserva_id)
  values (new.cancha_id, new.fecha, new.hora, 'reservado', new.id)
  on conflict (cancha_id, fecha, hora) do nothing;
  return new;
end;
$$;
create trigger on_reserva_created
  after insert on public.reservas
  for each row execute procedure public.handle_reserva_insert();
```

### Lección aprendida — RLS PostgreSQL
- Políticas `FOR INSERT` requieren `WITH CHECK (...)` NO `USING (...)`
- `FOR UPDATE` y `FOR DELETE` usan `USING (...)`
- `FOR ALL` necesita ambos: `USING` + `WITH CHECK`
- `.insert().select()` requiere política SELECT activa en la tabla para retornar la fila insertada
- `security definer` en funciones/triggers bypasea RLS (útil para operaciones cross-table)

### Patrón Supabase en HTML (UMD — sin bundler)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script>
  const sb = supabase.createClient('https://xqklrfzhpywbyxhskvtq.supabase.co', 'sb_publishable_...');
</script>
```

## Wompi (oct 2026 — en producción sandbox)
- **Cuenta**: comercios.wompi.co — cuenta propia de CanchaGo (modelo: CanchaGo recibe el dinero, transfiere 95% al dueño)
- **Modo actual**: Sandbox (pruebas) — cambiar a producción cuando se lancen canchas reales
- **Para pasar a producción**: Wompi → "Desactivar modo de pruebas" + actualizar 3 secrets en Supabase con llaves `prod_`
- **Edge Functions desplegadas**:
  - `generar-pago`: crea reserva pendiente + integrity hash + URL checkout Wompi
  - `wompi-webhook`: verifica HMAC-SHA256 + actualiza estado reserva + envía email
- **Webhook URL**: `https://xqklrfzhpywbyxhskvtq.supabase.co/functions/v1/wompi-webhook`
- **Secrets en Supabase**: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`
- **Flujo**: cliente reserva → `generar-pago` → Wompi checkout → `wompi-webhook` → reserva `confirmada` + email

## Resend (oct 2026 — activo)
- **Cuenta**: farith.miranda@gmail.com
- **Dominio verificado**: canchago.com.co (DNS auto-configurado vía Cloudflare en 3 min)
- **From**: `reservas@canchago.com.co`
- **Secret en Supabase**: `RESEND_API_KEY`
- **Cuándo envía**: al confirmar pago (estado APPROVED en webhook de Wompi)
- **Contenido email**: código CGO-XXXXX, cancha, fecha, hora, monto pagado

## Modelo de negocio — operación
- CanchaGo recibe el 100% del pago vía Wompi
- Transfiere 95% al dueño cada semana (manualmente en MVP)
- Retiene 5% como comisión
- Con 5-10 canchas es manejable; escalar con subcomercios Wompi cuando haya volumen

## Fase 3 — Seguridad (oct 2026 — completa)
- **`_headers`**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS
- **Rate limiting**: tabla `rate_limits` + función `check_rate_limit()` en Postgres · máx 10 req/min por IP en `generar-pago`
- **Ley 1581**: `privacidad.html` con política completa · checkbox obligatorio en formulario de reserva · link en footer de index.html
- **Archivos del proyecto**: agregar `privacidad.html` a la tabla de archivos

## Roadmap pendiente (en orden)
1. **Fase 1 ✅ COMPLETA** — Supabase + Auth + todas las páginas conectadas
2. **Fase 2 ✅ COMPLETA** — Wompi pagos + emails de confirmación Resend
3. **Fase 3 ✅ COMPLETA** — Seguridad: headers, rate limiting, Ley 1581
4. **Fase 4** — Lanzamiento: activar modo producción Wompi, onboarding 30 canchas de lista de espera, PWA

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
