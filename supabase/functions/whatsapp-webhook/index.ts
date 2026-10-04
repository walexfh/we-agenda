// Supabase Edge Function: Webhook de Integração com WhatsApp Real (Z-API / Evolution API)
// Recebe mensagens, interpreta comandos (despesas, receitas, compromissos) e responde no WhatsApp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Formatação simples de moeda
function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Extrai valor em centavos
function extractAmountInCents(text: string): number | null {
  const match = text.match(/(?:R\$\s*|de\s+|gastei\s+|paguei\s+|recebi\s+)?(\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;
  const rawNum = match[1].replace(",", ".");
  const floatVal = parseFloat(rawNum);
  if (isNaN(floatVal) || floatVal <= 0) return null;
  return Math.round(floatVal * 100);
}

// Interpretação de intenção simplificada e robusta no servidor
function parseCommand(text: string, assistantName = "Jarves") {
  const lower = text.toLowerCase().trim();
  const today = new Date().toISOString().split("T")[0];

  // 1. Despesa: "gastei 50 no mercado", "comprei pizza 45", "paguei luz 120"
  if (
    lower.includes("gastei") ||
    lower.includes("paguei") ||
    lower.includes("comprei") ||
    lower.includes("despesa") ||
    lower.includes("custou")
  ) {
    const amount = extractAmountInCents(text) || 0;
    let title = text
      .replace(new RegExp(assistantName, "gi"), "")
      .replace(/(?:gastei|paguei|comprei|despesa|custou)/i, "")
      .replace(/R\$\s*\d+([.,]\d+)?/gi, "")
      .replace(/\d+([.,]\d+)?\s*(reais|conto)?/gi, "")
      .replace(/\b(no|na|com|de|em|para|o|a)\b/gi, "")
      .trim();

    if (!title) title = "Despesa";
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      type: "expense",
      title: title,
      amountCents: amount,
      dateStr: today,
      reply: `✅ Registrei sua despesa de ${formatBRL(amount)} com *"${title}"* no seu calendário de hoje.`
    };
  }

  // 2. Receita: "recebi 200 de freela", "ganhei 500", "salario 3000"
  if (
    lower.includes("recebi") ||
    lower.includes("ganhei") ||
    lower.includes("salário") ||
    lower.includes("salario") ||
    lower.includes("receita")
  ) {
    const amount = extractAmountInCents(text) || 0;
    let title = text
      .replace(new RegExp(assistantName, "gi"), "")
      .replace(/(?:recebi|ganhei|sal[aá]rio|receita)/i, "")
      .replace(/R\$\s*\d+([.,]\d+)?/gi, "")
      .replace(/\d+([.,]\d+)?\s*(reais|conto)?/gi, "")
      .replace(/\b(de|do|da|com|em|para)\b/gi, "")
      .trim();

    if (!title) title = "Receita";
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      type: "income",
      title: title,
      amountCents: amount,
      dateStr: today,
      reply: `💰 Que ótimo! Registrei a entrada de ${formatBRL(amount)} de *"${title}"* no seu calendário de hoje.`
    };
  }

  // 3. Compromisso / Lembrete: "agendar reuniao amanha as 15h", "lembrete dentista"
  if (
    lower.includes("agendar") ||
    lower.includes("lembrar") ||
    lower.includes("lembrete") ||
    lower.includes("reuniao") ||
    lower.includes("reunião") ||
    lower.includes("consulta")
  ) {
    let dateStr = today;
    if (lower.includes("amanhã") || lower.includes("amanha")) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dateStr = d.toISOString().split("T")[0];
    }

    // Extrair horário ex: 15h, 15:30
    const timeMatch = text.match(/(\d{1,2})(?:h|:(\d{2}))/i);
    let startTime = "09:00";
    if (timeMatch) {
      const h = timeMatch[1].padStart(2, "0");
      const m = timeMatch[2] || "00";
      startTime = `${h}:${m}`;
    }

    let title = text
      .replace(new RegExp(assistantName, "gi"), "")
      .replace(/(?:agendar|lembrar|lembrete|marcar)/i, "")
      .replace(/(?:amanh[aã]|hoje|às\s*\d{1,2}(?:h|:\d{2})?)/gi, "")
      .trim();

    if (!title) title = "Compromisso";
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      type: "appointment",
      title: title,
      startTime: startTime,
      dateStr: dateStr,
      reply: `📅 Anotado! Agendei seu compromisso *"${title}"* para ${dateStr} às ${startTime}.`
    };
  }

  // Ajuda / Padrão
  return {
    type: "unknown",
    reply: `Olá! Sou seu assistente *${assistantName}* da W&E.Agenda.\n\nVocê pode me enviar mensagens como:\n• *"Gastei 45 no almoço"*\n• *"Recebi 350 do cliente"*\n• *"Agendar dentista amanhã às 14h"*\n\nO que gostaria de registrar hoje?`
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // 1. Ignorar mensagens enviadas pelo próprio bot ou de grupos
    if (body.fromMe === true || body.isGroup === true || body.data?.key?.fromMe === true) {
      return new Response(JSON.stringify({ status: "ignored_from_me_or_group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Extrai número do remetente (compatível com Z-API, Evolution API e Twilio)
    const rawSender =
      body.phone ||
      body.senderPhone ||
      body.sender ||
      body.from ||
      body.data?.key?.remoteJid ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
      "";

    const digitsOnly = String(rawSender).replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 8) {
      return new Response(JSON.stringify({ error: "Número do remetente não detectado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Extrai texto da mensagem
    const text =
      body.text?.message ||
      body.text ||
      body.message?.conversation ||
      body.message?.extendedTextMessage?.text ||
      body.data?.message?.conversation ||
      body.data?.message?.extendedTextMessage?.text ||
      "";

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ status: "empty_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Localiza usuário dono do número no Supabase (busca pelos últimos 8 dígitos)
    const phoneSuffix = digitsOnly.slice(-8);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, assistant_name, timezone, whatsapp")
      .ilike("whatsapp", `%${phoneSuffix}%`)
      .maybeSingle();

    const assistantName = profile?.assistant_name || "Jarves";

    if (!profile) {
      // Se não cadastrado, envia orientação
      const unregisteredMsg = `Olá! Não identifiquei sua conta no W&E.Agenda com o número *${digitsOnly}*.\n\nPor favor, entre no aplicativo da Agenda e informe seu WhatsApp nas configurações para ativar o assistente.`;
      
      await sendReplyBack(body, digitsOnly, unregisteredMsg);

      return new Response(JSON.stringify({ status: "unregistered_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Interpreta o comando e gera a resposta
    const action = parseCommand(text, assistantName);

    // 6. Grava no banco de dados se for despesa, receita ou compromisso
    if (action.type !== "unknown") {
      const newItemId = crypto.randomUUID();
      await supabase.from("calendar_items").insert({
        id: newItemId,
        user_id: profile.id,
        date_str: action.dateStr,
        type: action.type,
        title: action.title,
        amount_cents: action.amountCents || null,
        start_time: (action as any).startTime || null,
        is_paid: action.type === "expense" || action.type === "income",
        description: `Criado via WhatsApp por ${assistantName}`
      });
    }

    // 7. Envia a resposta de volta ao WhatsApp
    await sendReplyBack(body, digitsOnly, action.reply);

    return new Response(JSON.stringify({
      status: "success",
      userId: profile.id,
      action: action.type,
      reply: action.reply
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Erro no processamento do webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Função auxiliar para enviar resposta pelo gateway Z-API ou Evolution API
async function sendReplyBack(webhookBody: any, phone: string, message: string) {
  try {
    // 1. Caso Z-API:
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID") || webhookBody.instanceId;
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (zapiInstanceId && zapiToken) {
      const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
      await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(zapiClientToken ? { "Client-Token": zapiClientToken } : {})
        },
        body: JSON.stringify({
          phone: phone,
          message: message
        })
      });
      return;
    }

    // 2. Caso Evolution API:
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const evoInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "agenda";

    if (evoUrl && evoKey) {
      const sendUrl = `${evoUrl.replace(/\/$/, "")}/message/sendText/${evoInstance}`;
      await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evoKey
        },
        body: JSON.stringify({
          number: phone,
          text: message
        })
      });
      return;
    }

    console.log(`[WhatsApp Simulado/Log para ${phone}]: ${message}`);
  } catch (e) {
    console.error("Falha ao enviar resposta de volta ao WhatsApp:", e);
  }
}

