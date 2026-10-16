import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const WOMPI_EVENTS_SECRET  = Deno.env.get("WOMPI_EVENTS_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { event, sent_at, signature, data } = body;

    // Solo procesar actualizaciones de transacciones
    if (event !== "transaction.updated") {
      return new Response("ignorado", { status: 200 });
    }

    const tx = data?.transaction;
    if (!tx) return new Response("sin transacción", { status: 400 });

    // Verificar firma HMAC de Wompi
    // checksum = SHA256(event + sent_at + tx.id + tx.amount_in_cents + tx.status + tx.payment_method_type + tx.currency + tx.customer_email + events_secret)
    const expected = await sha256hex(
      `${event}${sent_at}${tx.id}${tx.amount_in_cents}${tx.status}` +
      `${tx.payment_method_type}${tx.currency}${tx.customer_email ?? ""}${WOMPI_EVENTS_SECRET}`
    );

    if (signature?.checksum !== expected) {
      console.error("Firma inválida", { recibida: signature?.checksum, esperada: expected });
      return new Response("firma inválida", { status: 401 });
    }

    // Mapear estado Wompi → estado CanchaGo
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

    // Actualizar reserva por código (reference = codigo CGO-XXXXX)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await sb
      .from("reservas")
      .update({ estado: nuevoEstado, pago_id: String(tx.id) })
      .eq("codigo", tx.reference);

    if (error) throw new Error(error.message);

    console.log(`✅ Reserva ${tx.reference} → ${nuevoEstado} (tx ${tx.id})`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("webhook error:", (err as Error).message);
    return new Response((err as Error).message, { status: 500 });
  }
});
