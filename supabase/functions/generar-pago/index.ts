import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const WOMPI_PUBLIC_KEY     = Deno.env.get("WOMPI_PUBLIC_KEY")!;
const WOMPI_INTEGRITY      = Deno.env.get("WOMPI_INTEGRITY_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256hex(text: string): Promise<string> {
  const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function genCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "CGO-";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Rate limiting: máx 10 requests por IP por minuto
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: allowed } = await sb.rpc("check_rate_limit", { p_ip: ip, p_max: 10 });
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Demasiadas solicitudes. Intenta en un minuto." }),
        { status: 429, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const {
      cancha_id, fecha, hora, duracion_min, monto,
      nombre, telefono, email, metodo_pago, slug,
    } = await req.json();

    if (!cancha_id || !fecha || !hora || !monto || !nombre || !telefono) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const codigo = genCodigo();

    const { error: dbError } = await sb.from("reservas").insert({
      codigo,
      cancha_id,
      cliente_nombre:   nombre,
      cliente_telefono: telefono,
      cliente_email:    email || null,
      fecha,
      hora,
      duracion_min:     duracion_min ?? 60,
      monto,
      metodo_pago:      metodo_pago ?? "tarjeta",
      estado:           "pendiente",
    });

    if (dbError) throw new Error(dbError.message);

    const amountCents = monto * 100;
    const integrity   = await sha256hex(`${codigo}${amountCents}COP${WOMPI_INTEGRITY}`);

    const redirectBase = "https://canchago.com.co/cancha.html";
    const redirectUrl  = slug
      ? `${redirectBase}?slug=${slug}&pago=ok&codigo=${codigo}`
      : `${redirectBase}?pago=ok&codigo=${codigo}`;

    const wompiUrl = new URL("https://checkout.wompi.co/p/");
    wompiUrl.searchParams.set("public-key",          WOMPI_PUBLIC_KEY);
    wompiUrl.searchParams.set("currency",            "COP");
    wompiUrl.searchParams.set("amount-in-cents",     String(amountCents));
    wompiUrl.searchParams.set("reference",           codigo);
    wompiUrl.searchParams.set("signature:integrity", integrity);
    wompiUrl.searchParams.set("redirect-url",        redirectUrl);
    if (email) wompiUrl.searchParams.set("customer-data:email", email);
    wompiUrl.searchParams.set("customer-data:full-name",    nombre);
    wompiUrl.searchParams.set("customer-data:phone-number", telefono.replace(/\D/g, ""));

    return new Response(
      JSON.stringify({ codigo, wompi_url: wompiUrl.toString() }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
