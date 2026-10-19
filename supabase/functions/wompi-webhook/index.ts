import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const WOMPI_EVENTS_SECRET  = Deno.env.get("WOMPI_EVENTS_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function enviarEmail(to: string, subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CanchaGo <reservas@canchago.com.co>",
      to: [to],
      subject,
      html,
    }),
  });
}

async function enviarEmailConfirmacion(reserva: {
  codigo: string; cliente_nombre: string; cliente_email: string;
  fecha: string; hora: string; cancha_nombre: string; monto: number;
}) {
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(reserva.monto);
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0f1e;color:#f9fafb;padding:32px;border-radius:12px">
      <div style="color:#22c55e;font-weight:900;font-size:1.2rem;margin-bottom:24px">⚽ CanchaGo</div>
      <h1 style="font-size:1.5rem;margin-bottom:8px">¡Reserva confirmada!</h1>
      <p style="color:#9ca3af;margin-bottom:24px">Hola ${reserva.cliente_nombre}, tu turno está listo.</p>
      <div style="background:#111827;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="font-size:1.5rem;font-weight:700;color:#22c55e;text-align:center;letter-spacing:2px;margin-bottom:16px">${reserva.codigo}</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#9ca3af;padding:6px 0">Cancha</td><td style="text-align:right;font-weight:600">${reserva.cancha_nombre}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Fecha</td><td style="text-align:right;font-weight:600">${reserva.fecha}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Hora</td><td style="text-align:right;font-weight:600">${reserva.hora.slice(0,5)}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Total pagado</td><td style="text-align:right;font-weight:600;color:#22c55e">${monto}</td></tr>
        </table>
      </div>
      <p style="color:#9ca3af;font-size:.85rem;text-align:center">Preséntate 10 minutos antes con este código.</p>
    </div>`;
  await enviarEmail(reserva.cliente_email, `✅ Reserva confirmada ${reserva.codigo} — ${reserva.cancha_nombre}`, html);
}

async function enviarEmailDueno(reserva: {
  codigo: string; cliente_nombre: string; cliente_telefono: string;
  fecha: string; hora: string; cancha_nombre: string; monto: number;
  dueno_email: string;
}) {
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(reserva.monto);
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0f1e;color:#f9fafb;padding:32px;border-radius:12px">
      <div style="color:#22c55e;font-weight:900;font-size:1.2rem;margin-bottom:24px">⚽ CanchaGo</div>
      <h1 style="font-size:1.5rem;margin-bottom:8px">Nueva reserva en ${reserva.cancha_nombre}</h1>
      <p style="color:#9ca3af;margin-bottom:24px">Se ha confirmado un nuevo turno en tu cancha.</p>
      <div style="background:#111827;border-radius:8px;padding:20px;margin-bottom:24px">
        <div style="font-size:1.5rem;font-weight:700;color:#22c55e;text-align:center;letter-spacing:2px;margin-bottom:16px">${reserva.codigo}</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="color:#9ca3af;padding:6px 0">Cliente</td><td style="text-align:right;font-weight:600">${reserva.cliente_nombre}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Teléfono</td><td style="text-align:right;font-weight:600">${reserva.cliente_telefono}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Fecha</td><td style="text-align:right;font-weight:600">${reserva.fecha}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Hora</td><td style="text-align:right;font-weight:600">${reserva.hora.slice(0,5)}</td></tr>
          <tr><td style="color:#9ca3af;padding:6px 0">Monto recibido</td><td style="text-align:right;font-weight:600;color:#22c55e">${monto}</td></tr>
        </table>
      </div>
      <a href="https://canchago.com.co/panel.html" style="display:block;text-align:center;background:#22c55e;color:#000;font-weight:700;padding:12px;border-radius:8px;text-decoration:none;">Ver en mi panel</a>
    </div>`;
  await enviarEmail(reserva.dueno_email, `🏟️ Nueva reserva ${reserva.codigo} — ${reserva.cancha_nombre}`, html);
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { event, sent_at, signature, data } = body;

    if (event !== "transaction.updated") {
      return new Response("ignorado", { status: 200 });
    }

    const tx = data?.transaction;
    if (!tx) return new Response("sin transacción", { status: 400 });

    const expected = await sha256hex(
      `${event}${sent_at}${tx.id}${tx.amount_in_cents}${tx.status}` +
      `${tx.payment_method_type}${tx.currency}${tx.customer_email ?? ""}${WOMPI_EVENTS_SECRET}`
    );

    if (signature?.checksum !== expected) {
      return new Response("firma inválida", { status: 401 });
    }

    const estadoMap: Record<string, string> = {
      APPROVED: "confirmada",
      DECLINED: "cancelada",
      VOIDED:   "cancelada",
      ERROR:    "cancelada",
    };
    const nuevoEstado = estadoMap[tx.status];
    if (!nuevoEstado) {
      return new Response(`estado ${tx.status} ignorado`, { status: 200 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await sb
      .from("reservas")
      .update({ estado: nuevoEstado, pago_id: String(tx.id) })
      .eq("codigo", tx.reference);

    if (error) throw new Error(error.message);

    // Enviar emails si el pago fue aprobado
    if (nuevoEstado === "confirmada") {
      const { data: reserva } = await sb
        .from("reservas")
        .select("codigo, cliente_nombre, cliente_telefono, cliente_email, fecha, hora, monto, canchas(nombre, dueño_id)")
        .eq("codigo", tx.reference)
        .single();

      const cancha_nombre = (reserva?.canchas as { nombre: string; dueño_id: string } | null)?.nombre ?? "—";
      const dueno_id      = (reserva?.canchas as { nombre: string; dueño_id: string } | null)?.dueño_id;

      // Email al cliente
      if (reserva?.cliente_email) {
        await enviarEmailConfirmacion({
          codigo:         reserva.codigo,
          cliente_nombre: reserva.cliente_nombre,
          cliente_email:  reserva.cliente_email,
          fecha:          reserva.fecha,
          hora:           reserva.hora,
          cancha_nombre,
          monto:          reserva.monto,
        });
      }

      // Email al dueño de la cancha
      if (dueno_id) {
        const { data: { user } } = await sb.auth.admin.getUserById(dueno_id);
        if (user?.email) {
          await enviarEmailDueno({
            codigo:           reserva!.codigo,
            cliente_nombre:   reserva!.cliente_nombre,
            cliente_telefono: reserva!.cliente_telefono ?? "—",
            fecha:            reserva!.fecha,
            hora:             reserva!.hora,
            cancha_nombre,
            monto:            reserva!.monto,
            dueno_email:      user.email,
          });
        }
      }
    }

    console.log(`✅ Reserva ${tx.reference} → ${nuevoEstado} (tx ${tx.id})`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("webhook error:", (err as Error).message);
    return new Response((err as Error).message, { status: 500 });
  }
});
