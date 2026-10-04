// Supabase Edge Function: Webhook de Integração com WhatsApp (Etapa 5)
// Executado no servidor para receber mensagens e áudios do WhatsApp e gravar no banco

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Extrai número do remetente e corpo (adaptável para Evolution API / Meta / Twilio)
    const sender = body.sender || body.from || body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    const text = body.text || body.message?.conversation || body.message?.extendedTextMessage?.text || "";
    const audioUrl = body.message?.audioMessage?.url || body.audioUrl || null;

    if (!sender) {
      return new Response(JSON.stringify({ error: "Remetente ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Localiza usuário dono do número de WhatsApp
    const digitsOnly = sender.replace(/\D/g, "");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, assistant_name, timezone, whatsapp")
      .ilike("whatsapp", `%${digitsOnly.slice(-9)}%`)
      .maybeSingle();

    if (!profile) {
      // Mensagem informando que o número não está cadastrado
      return new Response(JSON.stringify({
        status: "unregistered",
        message: "Número não cadastrado na agenda"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      status: "received",
      userId: profile.id,
      assistantName: profile.assistant_name || "Jarves"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
