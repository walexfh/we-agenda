-- ==============================================================================
-- ARQUITETURA DE SCHEDULER / FILA DE LEMBRETES NO SERVIDOR (ETAPA 3)
-- Permite disparo de notificações mesmo com abas do navegador fechadas.
-- ==============================================================================

-- 1. Função executada periodicamente (via pg_cron ou Edge Function) para buscar lembretes vencidos
create or replace function public.process_due_reminders(batch_limit int default 50)
returns table (
  reminder_id uuid,
  target_user_id uuid,
  channel text,
  title text,
  body text,
  scheduled_at timestamptz
) as $$
begin
  return query
  update public.reminders r
  set
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  from (
    select id
    from public.reminders
    where status = 'scheduled'
      and scheduled_at <= now()
    order by scheduled_at asc
    limit batch_limit
    for update skip locked
  ) due
  where r.id = due.id
  returning r.id, r.user_id, r.channel, r.title, r.body, r.scheduled_at;
end;
$$ language plpgsql security definer;

-- 2. Agendamento com pg_cron (se habilitado no Supabase Dashboard em Database > Extensions > pg_cron)
-- Executa a cada minuto checando lembretes pendentes
-- select cron.schedule('process-agenda-reminders', '* * * * *', 'select public.process_due_reminders(100)');

-- 3. Documentação de canais de entrega suportados:
-- - browser_notification: disparado em primeiro/segundo plano pelo Service Worker via Web Notification API
-- - web_push: push payload assinado com VAPID keys entregue ao Push Service do dispositivo do usuário
-- - whatsapp: pronto para consumo na Etapa 5 (webhook/Evolution API/Baileys/Twilio)
