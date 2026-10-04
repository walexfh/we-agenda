# Plano de Correções — W&E.Agenda

Este documento registra o diagnóstico, decisões técnicas, implementação, validação e pendências do projeto W&E.Agenda, organizado por etapas.

---

## Etapa 1 — Corrigir e Estabilizar a Base Local

### 1. Diagnóstico do Estado Inicial

#### A. Persistência e Segurança dos Dados
- **Armazenamento:** Realizado diretamente no `localStorage` por chaves (`fincal_current_user`, `fincal_items_${user}`, `fincal_profile_${user}`, `fincal_users`, `fincal_theme`).
- **Problema de Corrupção Silenciosa:** `JSON.parse` envolto em `try/catch` que retornava `INITIAL_ITEMS` (`[]`). Qualquer erro de parse causava perda imediata dos dados na gravação subsequente.
- **Armazenamento de Senhas:** O componente `LoginScreen` criava usuários salvando senhas em texto puro no `localStorage` (`fincal_users`).
- **Exposição de Segredos:** `vite.config.ts` injetava `GEMINI_API_KEY` no bundle cliente via `define: { 'process.env.API_KEY': ..., 'process.env.GEMINI_API_KEY': ... }`, mesmo sem uso no frontend.
- **Gravação sem Confirmação:** O modal de criação/edição fechava antes de confirmar o sucesso da persistência.

#### B. TypeScript e Build
- **Erro de Tipagem em EventModal:** `activeType` estava tipado como `ItemType` (`'appointment' | 'income' | 'expense'`), mas no código recebia o valor `'finance'`.
- **Scripts Ausentes:** Não havia comando `typecheck` e o build (`vite build`) não executava verificação de tipos (`tsc`).
- **Dependências de Tipos Ausentes:** `@types/react` e `@types/react-dom` não constavam em `devDependencies`.
- **CSS Ausente:** `index.html` referenciava `<link rel="stylesheet" href="/index.css">`, porém `index.css` não existia no projeto.
- **Tailwind por CDN:** Utilizava script externo `https://cdn.tailwindcss.com`, inadequado para builds locais previsíveis.
- **Importmap Redundante:** `index.html` continha `<script type="importmap">` apontando para `esm.sh`, concorrendo com o empacotamento do Vite.
- **Lockfile Ausente:** Não havia `package-lock.json` no repositório.

#### C. Valores Financeiros
- **Valores em Ponto Flutuante:** `CalendarItem.amount` era armazenado como float (`number`), sujeito a imprecisão de arredondamento binário e inconsistência de centavos.
- **Parser Frágil:** Uso de `parseFloat` sem validação de valores negativos, NaN, infinitos ou múltiplos separadores.
- **Falta de Diferenciação:** O valor armazenado não era claramente diferenciado do texto digitado no formulário.

#### D. Resumo Financeiro
- **Soma Indevida:** O cálculo de saldo mensal somava indistintamente itens pagos e itens pendentes (`acc + (curr.amount || 0)`).
- **Terminologia Inadequada:** Apresentava "Saldo Mensal" e "Saldo Final" como se fosse saldo de conta corrente, sem distinção entre realizado e previsto.

#### E. Validação de Formulários
- Ausência de validação robusta para títulos vazios ou com apenas espaços.
- Ausência de validação de horário de início e fim no mesmo dia (término deve ser posterior ao início).
- Ausência de proteção contra duplo clique no botão de salvar.
- Troca de tipo mantinha campos órfãos ou inconsistentes.

#### F. Datas, Identificadores e Recorrências
- **Identificadores:** IDs gerados com `Date.now().toString()`, propensos a colisão em criação rápida.
- **Fuso Horário:** Datas manipuladas com `new Date(string)` gerando deslocamento de fuso (UTC midnight interpretado como dia anterior no fuso local Brasil GMT-3).
- **Recorrência Limitada:** `generateRecurringItems` gerava um lote fixo de 12 itens no momento do salvamento inicial.
- **Edição em Cascata Falha:** `timeDiff` baseado em milissegundos causava desvios em meses com quantidade diferente de dias.
- **Falta de Tratamento de Fim de Mês:** Recorrência mensal criada no dia 31 avançava para março ou pulava dias em meses com menos de 31 dias.

#### G. Lembretes e Interface
- `alertMinutes` era apenas persistido no item, sem nenhum agendamento ou notificação real. O usuário podia acreditar falsamente que seria notificado.
- Viewport continha `maximum-scale=1.0, user-scalable=no`, bloqueando acessibilidade de zoom no celular.
- Acessibilidade e navegação por teclado (Escape para fechar modais, foco, rótulos ARIA) precisavam de aprimoramento.

---

### 2. Decisões Técnicas da Etapa 1

1. **Esquema de Armazenamento Versionado (V2):**
   - Criação de chave de controle `fincal_storage_version_${userId} = 2`.
   - Backup automático e recuperável antes de qualquer migração: `fincal_backup_v1_${userId}_${timestamp}` (sem incluir senhas).
   - `amountCents: number` (inteiro) como padrão canônico para todos os valores monetários. Migração multiplica valores legados por 100 com arredondamento seguro (`Math.round(val * 100)`).
   - Normalização de datas em formato de calendário ISO local (`YYYY-MM-DD`), evitando distorções de fuso horário.
   - IDs convertidos e gerados via UUID v4.
   - Tratamento de corrupção: em caso de erro no parse do JSON, os dados originais são preservados em `fincal_corrupted_${userId}_${timestamp}` e uma tela de recuperação com exportação de emergência é exibida ao invés de sobrescrever com lista vazia.
   - Tratamento de cota/armazenamento indisponível com notificações claras ao usuário.

2. **Modo Local de Demonstração e Proteção de Credenciais:**
   - Desabilitar novos cadastros com gravação de senhas em texto puro.
   - Identificar visualmente a aplicação como "Modo Local de Demonstração".
   - Permitir entrada rápida local para testar a aplicação e preservar usuários locais pré-existentes intactos para migração na Etapa 2 (sem expor senhas em relatórios).
   - Remoção da injeção de `GEMINI_API_KEY` do `vite.config.ts`.

3. **Arquitetura Financeira:**
   - Módulo centralizado `utils/moneyUtils.ts` com funções puras para conversão, parse estrito (aceitando `"33"`, `"33,50"`, `"33.50"`, `"1.234,56"`), formatação em BRL e validação de centavos.
   - Rejeição estrita de valores `<= 0`, não numéricos, infinitos ou ambíguos.
   - Resumo financeiro reestruturado:
     - *Receitas Recebidas* (pagas)
     - *Despesas Pagas* (pagas)
     - *Contas a Receber* (pendentes)
     - *Contas a Pagar* (pendentes)
     - *Resultado Realizado* = Receitas Recebidas - Despesas Pagas
     - *Resultado Previsto* = Total de Receitas - Total de Despesas

4. **Série de Recorrência e Datas:**
   - Módulo centralizado `utils/dateUtils.ts` e `utils/recurrenceUtils.ts`.
   - Suporte a frequências: diária, semanal, quinzenal e mensal.
   - Recorrência mensal no dia 31 respeita o último dia do mês (ex: 28 ou 29 em fevereiro, 30 em abril) e retorna ao dia 31 em meses subsequentes de 31 dias.
   - Séries possuem `seriesId`, `frequency`, `startDate`, `endDate` (ou sem término).
   - Geração dinâmica para a janela exibida (mês corrente e adjacências) em vez de gravar 12 itens fixos ou listas infinitas.
   - Suporte a exceções: alteração/exclusão de uma ocorrência isolada vs "esta e as próximas", recalculando a regra sem duplicidade de datas e preservando o histórico anterior.
   - Marcar uma ocorrência como paga afeta apenas a ocorrência individual, nunca a série inteira.

5. **Interface e Acessibilidade:**
   - Aviso claro e honesto no seletor de lembrete: serviço de notificações em segundo plano indisponível no modo local (previsto para a etapa de sincronização/servidor).
   - Remoção do bloqueio de zoom no `<meta name="viewport">`.
   - Modais acessíveis via teclado (tecla Escape fecha o modal).
   - Validação de formulários com feedback imediato e preservação dos campos preenchidos.

---

## Etapa 2 — Conta Real e Sincronização

### 1. Diagnóstico e Arquitetura da Etapa 2

- **Provedor Escolhido:** **Supabase** (PostgreSQL relacional, Auth nativo, Row Level Security e Realtime).
- **Segurança Absoluta no Frontend:** Apenas a chave pública `anon` é utilizada no cliente. A chave `service_role` (privilegiada) nunca é colocada no frontend.
- **Row Level Security (RLS):** Toda a autorização de dados é garantida no banco de dados através da função nativa `auth.uid() = user_id`, impossibilitando que qualquer requisição maliciosa ou manipulada no frontend acerte registros de outro usuário.
- **Tratamento de Credenciais Ausentes:** Conforme regra de não simular integrações concluídas, caso as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` não estejam configuradas em `.env.local`, a aplicação exibe orientações transparentes de configuração e permite continuar operando sem bloqueios no Modo Local de Demonstração.
- **Importação Explícita e Não-Destrutiva:** Desenvolvido assistente que detecta registros legados ou criados localmente no navegador e solicita confirmação explícita do usuário para migrá-los para a nuvem sob seu `auth.uid()`, sem duplicidade e sem copiar senhas.

### 2. Decisões Técnicas da Etapa 2

1. **Esquema de Banco e Migração SQL (`supabase/schema.sql`):**
   - Criação da tabela `profiles` vinculada a `auth.users(id)` com trigger automática para criação de perfil.
   - Criação da tabela `calendar_items` com campos fortemente tipados (`date_str`, `amount_cents`, `is_paid`, etc.).
   - Criação da tabela `recurrence_series` com suporte a template JSONB e exceções.
   - Políticas RLS rigorosas para SELECT, INSERT, UPDATE e DELETE.
   - Índices compostos `(user_id, date_str)` para buscas velozes no calendário.

2. **Serviço de Autenticação Segura (`services/authService.ts`):**
   - Cadastro com validação de formato de e-mail e senha mínima de 6 caracteres.
   - Detecção de necessidade de confirmação de e-mail (caso o projeto Supabase exija verificação).
   - Fluxo de recuperação de senha oficial via `resetPasswordForEmail`.
   - Atualização de senha e encerramento de sessão seguro.

3. **Serviço de Sincronização e Nuvem (`services/syncService.ts`):**
   - Sincronização bidirecional entre cliente e nuvem.
   - Suporte a status de sincronização no cabeçalho: `synced` (Conectado), `syncing` (Sincronizando), `error` (Erro com opção de retry) e `local_demo` (Modo Local).
   - Importação explícita com filtro de itens virtuais e verificação de duplicidade por ID.

4. **Componente de Importação (`components/ImportModal.tsx`):**
   - Modal com resumo categorizado dos registros locais encontrados.
   - Opções claras: "Importar para a Conta" ou "Ignorar".
   - Garantia de que senhas locais nunca são transmitidas.

5. **Interface de Login Atualizada (`components/LoginScreen.tsx`):**
   - Integração completa com login, cadastro e recuperação de senha por e-mail.
   - Alternância fluida para o Modo Local de Demonstração.

---

### 3. Progresso dos Arquivos Alterados e Criados

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `package.json` | Adição da dependência `@supabase/supabase-js` | Concluído |
| `vite-env.d.ts` | Tipagem estrita de `import.meta.env` para Vite e Supabase | Concluído |
| `tsconfig.json` | Inclusão de `vite/client` na lista de tipos do TypeScript | Concluído |
| `supabase/schema.sql` | Script DDL completo de PostgreSQL, RLS, triggers e índices | Concluído |
| `.env.example` | Documentação de variáveis de ambiente do Supabase | Concluído |
| `services/supabaseClient.ts` | Inicialização segura do cliente Supabase e detecção de configuração | Concluído |
| `services/authService.ts` | Autenticação com e-mail, confirmação, reset de senha e logout | Concluído |
| `services/syncService.ts` | Sincronização em nuvem, tratamento de erros e importação deduplicada | Concluído |
| `components/ImportModal.tsx` | Assistente de importação explícita de dados locais para a nuvem | Concluído |
| `components/LoginScreen.tsx` | Abas de login/cadastro com e-mail, recuperação e acesso local | Concluído |
| `App.tsx` | Indicador de sincronização em nuvem, gestão de sessão e importação | Concluído |
| `tests/supabaseClient.test.ts` | Testes de detecção de credenciais ausentes e placeholders | Concluído |
| `tests/authService.test.ts` | Testes de validação de e-mail e tamanho de senha | Concluído |
| `tests/syncService.test.ts` | Testes de deduplicação e filtro de ocorrências virtuais na importação | Concluído |

---

### 4. Validação e Testes Realizados

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Compilação estrita limpa.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **25 testes em 8 arquivos com 100% de aprovação**.
  - `tests/moneyUtils.test.ts`: 6 testes aprovados.
  - `tests/authService.test.ts`: 4 testes aprovados (validação de formato de e-mail, senha mínima, credenciais vazias).
  - `tests/supabaseClient.test.ts`: 1 teste aprovado (detecção precisa de ambiente e ausência de simulação falsa).
  - `tests/syncService.test.ts`: 1 teste aprovado (filtro de ocorrências virtuais e prevenção de duplicações na importação).
  - `tests/financialSummary.test.ts`: 1 teste aprovado (separação entre realizado e previsto).
  - `tests/recurrenceUtils.test.ts`: 7 testes aprovados (recorrência no dia 31, bissextos, exceções, etc.).
  - `tests/storageManager.test.ts`: 2 testes aprovados (proteção de corrupção e migração versionada única).
  - `tests/dateUtils.test.ts`: 3 testes aprovados (estabilidade de timezone e horários de compromisso).

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso.

---

## Etapa 3 — Lembretes Reais e Agendamento no Servidor

### 1. Diagnóstico e Arquitetura da Etapa 3

1. **Fuso Horário Explícito da Conta:**
   - Padronizado para `America/Sao_Paulo` (Horário de Brasília, GMT-3).
   - Armazenado no perfil do usuário (`profiles.timezone` no Supabase e `UserProfile.timezone` no armazenamento local).
   - Seletor acessível diretamente no Menu Lateral (`SideMenu.tsx`) e indicador no cabeçalho.
   - Conversão matemática e determinística entre data do calendário (`YYYY-MM-DD`), hora do evento (`HH:mm`), fuso IANA e timestamp UTC (`utils/reminderUtils.ts`).

2. **Arquitetura de Fila / Scheduler no Servidor (Independente da Aba Aberta):**
   - Criação da tabela relacional `reminders` no Supabase com isolamento rigoroso via Row Level Security (`auth.uid() = user_id`).
   - Máquina de estados oficial: `scheduled` (agendado) → `sent` (enviado pelo scheduler) → `delivered` (entregue ao dispositivo) | `failed` (falhou) | `dismissed` (dispensado).
   - Suporte nativo a múltiplos canais de entrega: `browser_notification`, `web_push` e `whatsapp` (preparado para as Etapas 4 e 5).
   - Procedimento SQL concorrente com lock de linha (`for update skip locked`) em `supabase/reminders_cron.sql`, pronto para execução periódica a cada minuto via extensão `pg_cron` ou Supabase Edge Function / Webhook.

3. **Respeito Rigoroso à Antecipação Configurada:**
   - **Compromissos:** Antecipações de 0 min (no horário), 5 min, 10 min, 15 min, 30 min, 1 hora, 2 horas ou 1 dia antes.
   - **Lançamentos Financeiros (Vencimentos):** Alertas configuráveis no dia do vencimento às 08:00, 1 dia antes às 08:00, 2 dias antes ou 3 dias antes.
   - **Inteligência Financeira:** Lançamentos com status `isPaid: true` (pagos/recebidos) cancelam automaticamente qualquer lembrete pendente para evitar notificações desnecessárias.

4. **Service Worker e Notificações Push:**
   - Arquivo `public/sw.js` registrado no ciclo de vida do cliente.
   - Suporte ao recebimento de eventos `push` mesmo com o navegador fechado ou em segundo plano.
   - Clique na notificação redireciona com foco automático para a aba aberta ou inicializa o app.
   - Alerta in-app flutuante de alta visibilidade caso o usuário esteja com o aplicativo aberto no momento do disparo.

---

### 2. Arquivos Alterados e Criados na Etapa 3

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `types.ts` | Definição de `ReminderItem`, `ReminderStatus`, `ReminderChannel`, `alertTime` e fuso em `UserProfile` | Concluído |
| `utils/reminderUtils.ts` | Cálculo de antecipação com fuso horário IANA, conversores UTC e máquina de estados | Concluído |
| `public/sw.js` | Service Worker para Web Push, vibração de dispositivo e manipulação de cliques em notificações | Concluído |
| `services/reminderService.ts` | Gestão de permissões, registro de SW, reconciliação de fila, watcher in-app e sincronização | Concluído |
| `supabase/schema.sql` | Adição de `timezone` em `profiles` e criação da tabela `reminders` com RLS, índices e triggers | Concluído |
| `supabase/reminders_cron.sql` | Procedimento de processamento em lote para agendador independente via `pg_cron` ou Edge Function | Concluído |
| `components/EventModal.tsx` | Seletor de lembrete com antecipação para compromissos e vencimentos financeiros | Concluído |
| `components/SideMenu.tsx` | Seletor de fuso horário da conta e status de permissão de notificações no perfil | Concluído |
| `services/syncService.ts` | Inclusão de `timezone` no mapeamento de perfil na nuvem | Concluído |
| `App.tsx` | Inicialização do Service Worker, Daemon ReminderWatcher, badge de status e toast in-app | Concluído |
| `tests/reminderUtils.test.ts` | Testes de conversão de fuso, cálculo de antecipação, cancelamento para pagos e máquina de estados | Concluído |

---

### 3. Validação e Testes da Etapa 3

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Compilação 100% limpa.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **32 testes em 9 arquivos com 100% de aprovação**.
  - `tests/reminderUtils.test.ts`: 7 testes aprovados cobrindo conversão para UTC em `America/Sao_Paulo`, cálculo de antecipação, cancelamento de alerta em contas pagas e máquina de estados.
  - `tests/moneyUtils.test.ts`: 6 testes aprovados.
  - `tests/recurrenceUtils.test.ts`: 7 testes aprovados.
  - `tests/authService.test.ts`: 4 testes aprovados.
  - `tests/storageManager.test.ts`: 2 testes aprovados.
  - `tests/dateUtils.test.ts`: 3 testes aprovados.
  - `tests/syncService.test.ts`: 1 teste aprovado.
  - `tests/supabaseClient.test.ts`: 1 teste aprovado.
  - `tests/financialSummary.test.ts`: 1 teste aprovado.

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso em 9.51s gerando `dist/` minificado.

---

---

## Etapa 4 — Assistente com Nome Personalizável e IA

### 1. Diagnóstico e Arquitetura da Etapa 4

1. **Nome Personalizável do Assistente:**
   - Nome padrão configurado: `Jarves`.
   - O usuário pode renomear seu assistente para qualquer nome desejado (ex: "Jarvis", "Siri", "Antigravity", "Mia", etc.) diretamente no [AssistantModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/AssistantModal.tsx) ou no [SideMenu.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/SideMenu.tsx).
   - O nome é persistido na coluna `assistant_name` do perfil no Supabase e no estado local do perfil.
   - O assistente responde tanto a comandos chamados pelo nome (ex: *"Jarves, gastei 33 reais no mercado."*) quanto a comandos diretos (ex: *"gastei 33 no mercado"*).

2. **Garantia Transacional: Responder Somente Depois de Confirmar a Gravação:**
   - **Regra Fundamental Cumprida:** O pipeline do assistente em [services/assistantService.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/services/assistantService.ts) primeiro executa a interpretação NLU, constrói o objeto de domínio fortemente tipado e chama a função persistente de gravação `onSaveItem`.
   - **Confirmação Estrita:** A mensagem de confirmação para o usuário só é montada e exibida **após** a gravação ser confirmada com sucesso no armazenamento local e na nuvem.
   - **Tratamento de Falha:** Se a persistência falhar ou a validação for rejeitada, o assistente informa o erro com transparência e jamais simula uma confirmação falsa.

3. **Motor Determinístico de NLU / Compreensão de Linguagem Natural (`utils/assistantEngine.ts`):**
   - **Despesas Imediatas (Passadas):** *"Jarves, gastei 33 reais no mercado."* → detecta tipo `expense`, valor `3300` centavos inteiros (R$ 33,00), data atual, status `isPaid: true` (já pago) e título limpo `"Mercado"`.
   - **Despesas Futuras / Vencimentos:** *"Lembrar de pagar o condomínio de 450 reais dia 10"* → detecta tipo `expense`, valor `45000` centavos (R$ 450,00), data calculada no fuso da conta, status `isPaid: false` (a pagar) e lembrete ativo.
   - **Receitas:** *"Recebi 1200 de freelance hoje"* → detecta tipo `income`, valor `120000` centavos (R$ 1.200,00), status `isPaid: true` e título `"Freelance"`.
   - **Compromissos:** *"Dentista amanhã às 14h"* → detecta tipo `appointment`, data de amanhã, horário das `14:00` às `15:00` e alerta de 15 min antes.
   - **Consultas em Linguagem Natural:** *"Qual minha agenda de hoje?"* e *"Quanto gastei este mês?"* com síntese detalhada e formatada em BRL.

4. **Interface e Interação por Voz / Áudio no Navegador:**
   - Interface de chat dedicada [AssistantModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/AssistantModal.tsx) com chips de atalho rápido.
   - Integração com a **Web Speech API** no botão de microfone, permitindo ditar comandos por áudio diretamente no navegador com transcrição instantânea e envio automático.
   - Botão Flutuante (FAB) de gradiente violeta/azul no canto inferior direito para acesso rápido em 1 clique em qualquer visualização.
   - Botão de acesso rápido no cabeçalho superior.

---

### 2. Arquivos Alterados e Criados na Etapa 4

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `types.ts` | Adição de `assistantName` em `UserProfile` e interfaces `AssistantParsedAction` e `AssistantChatMessage` | Concluído |
| `utils/assistantEngine.ts` | Motor de NLU com parsing de despesas, receitas, compromissos, valores em centavos e datas contextuais | Concluído |
| `services/assistantService.ts` | Serviço com garantia transacional de gravação confirmada no banco/storage antes da resposta | Concluído |
| `components/AssistantModal.tsx` | Interface de chat com o assistente, atalhos, gravação de áudio via microfone e personalização de nome | Concluído |
| `components/SideMenu.tsx` | Campo de personalização do nome do assistente nas preferências do perfil | Concluído |
| `services/syncService.ts` | Inclusão de `assistant_name` na sincronização do perfil na nuvem | Concluído |
| `supabase/schema.sql` | Coluna `assistant_name text not null default 'Jarves'` na tabela `profiles` | Concluído |
| `App.tsx` | Integração do modal do assistente, botão FAB duplo e botão de cabeçalho | Concluído |
| `tests/assistantEngine.test.ts` | Testes do caso de uso obrigatório ("gastei 33 reais no mercado"), NLU e confirmação transacional | Concluído |

---

### 3. Validação e Testes da Etapa 4

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Compilação 100% limpa.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **41 testes em 10 arquivos com 100% de aprovação**.
  - `tests/assistantEngine.test.ts` (9 testes):
    - Remoção do gatilho/nome do assistente.
    - Extração de valores em centavos inteiros ("33 reais e 50 centavos" → 3350, "1200" → 120000).
    - Caso de uso mandatório: `"Jarves, gastei 33 reais no mercado."` validando despesa paga de R$ 33,00 na data atual.
    - Agendamento de compromissos ("Dentista amanhã às 14h").
    - Registro de receitas ("Recebi 1200 de freelance hoje").
    - Consultas de agenda e balanço.
    - Teste de garantia transacional: `onSaveItem` chamado e confirmado antes da resposta, com resposta de erro transparente caso a gravação falhe.
  - Demais testes mantidos e aprovados (32 testes de lembretes, finanças, recorrências, storage e auth).

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso em 9.15s gerando bundle otimizado em `dist/`.

---

## Etapa 5 — Integração com WhatsApp por Texto e Áudio

### 1. Diagnóstico e Arquitetura da Etapa 5

1. **Normalização e Validação Telefônica E.164:**
   - Criação de utilitários em [services/whatsappService.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/services/whatsappService.ts) para validação e normalização de números telefônicos no padrão internacional E.164 (`normalizeWhatsAppNumber`, `isValidWhatsAppNumber`, `formatDisplayPhoneNumber`).
   - Suporte inteligente a números brasileiros: aceita formatos com ou sem DDI +55, com ou sem nono dígito, parênteses e traços (ex: `(11) 98765-4321`, `11987654321`, `+55 11 98765-4321` → normalizado para `+5511987654321`).
   - O número normalizado é persistido na coluna `whatsapp` da tabela `profiles` no Supabase e no estado de perfil da aplicação.

2. **Pipeline de Áudio e Transcrição:**
   - Implementação de `transcribeAudioMessage` preparada para receber mensagens de voz (OGG/Opus, MP3, WAV, etc.) enviadas pelo WhatsApp.
   - Suporte plugável a provedores de transcrição por inteligência artificial (OpenAI Whisper, Google Cloud Speech-to-Text ou Supabase Storage audio-to-text), processando o áudio recebido e convertendo-o em texto bruto que é encaminhado diretamente ao motor `assistantEngine`.
   - Fallback gracioso com tratamento de falhas em conexões de áudio inaudíveis ou sem fala detectada.

3. **Webhook Bidirecional do WhatsApp (Texto e Áudio):**
   - **Supabase Edge Function:** Desenvolvida em [supabase/functions/whatsapp-webhook/index.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/supabase/functions/whatsapp-webhook/index.ts), compatível com Meta WhatsApp Cloud API, Evolution API e Z-API.
   - **Fluxo do Webhook:**
     1. Recebe a requisição HTTP POST com a mensagem de texto ou URL/mídia de áudio.
     2. Identifica o usuário proprietário a partir do número de telefone de origem (`From` / `wa_id`), consultando `profiles` com índice dedicado `idx_profiles_whatsapp`.
     3. Se for áudio, executa transcrição automática.
     4. Encaminha o texto para o motor de NLU [assistantEngine.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/utils/assistantEngine.ts).
     5. **Garantia Transacional Estrita ("responder somente depois de confirmar a gravação"):** O webhook chama `saveItem` para persistir o registro (seja uma despesa como *"Jarves, gastei 33 reais no mercado"*, uma receita ou um compromisso) e **somente** após a confirmação da transação gera a mensagem final de confirmação. Se a gravação falhar, o assistente responde com um aviso de erro e não confirma o registro.
     6. Envia a resposta de volta ao usuário pelo WhatsApp via API.

4. **Despacho de Lembretes Devidos para o WhatsApp:**
   - Função `dispatchDueRemindersToWhatsApp` em [services/whatsappService.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/services/whatsappService.ts).
   - Consulta a fila de lembretes da tabela `reminders` com canal `whatsapp` ou `all` e status `pending`.
   - Verifica se o perfil do usuário possui número WhatsApp cadastrado e a flag `whatsapp_notifications: true` ativa.
   - Formata a mensagem com detalhes do compromisso ou vencimento de conta e atualiza o status do lembrete para `sent` (ou `failed` em caso de erro), registrando carimbo de data/hora.

5. **Interface de Configuração e Simulador de Webhook ([components/WhatsAppModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/WhatsAppModal.tsx)):**
   - Modal com interface moderna e responsiva acessível pelo [SideMenu.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/SideMenu.tsx) (botão com ícone `MessageSquare`).
   - Configuração do telefone WhatsApp com máscara visual em tempo real e validação instantânea.
   - Switch de ativação de notificações e lembretes de vencimentos via WhatsApp.
   - **Simulador Interativo de Webhook:** Ambiente em tempo real onde o usuário pode testar comandos de texto (ex: *"Jarves, gastei 33 reais no mercado"* ou *"Dentista na sexta às 16h"*) e simular áudio, inspecionando o payload do webhook recebido, a gravação real no banco/agenda e a resposta enviada de volta pelo WhatsApp.

---

### 2. Arquivos Alterados e Criados na Etapa 5

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `types.ts` | Adição de `whatsapp` e `whatsappNotifications` em `UserProfile`; interfaces de payload de webhook `WhatsAppMessagePayload` e `WhatsAppWebhookResult` | Concluído |
| `services/whatsappService.ts` | Normalização E.164, transcrição de áudio, envio de mensagem, processador transacional de webhook e despachante de lembretes | Concluído |
| `supabase/schema.sql` | Adição das colunas `whatsapp text` e `whatsapp_notifications boolean default true` na tabela `profiles` com índice `idx_profiles_whatsapp` | Concluído |
| `supabase/functions/whatsapp-webhook/index.ts` | Supabase Edge Function completa para recepção de webhooks do WhatsApp (texto e áudio) | Concluído |
| `tsconfig.json` | Exclusão de `supabase/functions` da checagem do Vite para evitar conflitos de tipos entre Deno e DOM | Concluído |
| `components/WhatsAppModal.tsx` | Modal com configuração de telefone, lembretes WhatsApp e simulador interativo de webhook | Concluído |
| `components/SideMenu.tsx` | Botão de integração com WhatsApp na seção de perfil com ícone `MessageSquare` | Concluído |
| `services/syncService.ts` | Mapeamento dos campos `whatsapp` e `whatsapp_notifications` na sincronização com Supabase | Concluído |
| `App.tsx` | Gerenciamento de estado do modal de WhatsApp, persistência das configurações no perfil e injeção no SideMenu | Concluído |
| `tests/whatsappService.test.ts` | Testes de normalização E.164, transcrição de áudio, webhook transacional com save-before-reply e despacho de lembretes | Concluído |

---

### 3. Validação e Testes da Etapa 5

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Compilação 100% limpa em todos os componentes e serviços.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **48 testes em 11 arquivos com 100% de aprovação**.
  - `tests/whatsappService.test.ts` (7 testes):
    - Normalização e validação de números telefônicos no padrão E.164 com e sem nono dígito.
    - Formatação amigável para exibição visual no frontend.
    - Transcrição de mensagens de voz e áudio.
    - Processamento de webhook com garantia transacional: `onSaveItem` chamado e confirmado antes da resposta enviada via WhatsApp.
    - Rejeição segura de números desconhecidos não vinculados a nenhum usuário.
    - Tratamento de erro quando a gravação falha (sem falsa confirmação).
    - Despacho de lembretes pendentes na fila devida para números WhatsApp válidos com atualização de status para `sent`.
  - Demais 41 testes de etapas anteriores mantidos com 100% de aprovação (NLU, motor do Jarves, lembretes, finanças, recorrências, storage e auth).

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso em 9.20s gerando bundle otimizado em `dist/`.

---

---

## Etapa 6 — Melhorias de Produto e Produtividade Financeira

### 1. Diagnóstico e Arquitetura da Etapa 6

1. **Categorias Personalizadas para Receitas e Despesas ([utils/categoryUtils.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/utils/categoryUtils.ts) e [components/CategoryManagerModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/CategoryManagerModal.tsx)):**
   - Criação da interface `Category` com suporte a identificador único, nome, cor hexadecimal e escopo (`expense`, `income` ou `both`).
   - Fornecimento de 13 categorias padrão do sistema (Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Serviços, Salário, Freelance, Investimentos, Vendas, etc.).
   - Modal dedicado [CategoryManagerModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/CategoryManagerModal.tsx) para o usuário criar, visualizar e remover categorias customizadas com seletor de paleta de cores.
   - Sincronização em nuvem na coluna `custom_categories jsonb` da tabela `profiles` e persistência na coluna `category text` da tabela `calendar_items`.
   - Seletor de categorias visual no [EventModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/EventModal.tsx), pills coloridas no [CalendarGrid.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/CalendarGrid.tsx) e no Drawer de detalhes do dia.

2. **Pagamentos e Recebimentos Parciais / Amortizações ([utils/moneyUtils.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/utils/moneyUtils.ts)):**
   - Criação da interface `PartialPayment` vinculada ao `CalendarItem.partialPayments` com valor amortizado em centavos inteiros, data de liquidação e observações (ex: "Pago via Pix").
   - Métodos utilitários de alta precisão:
     - `getPaidAmountCents(item)`: Retorna o total pago ou a soma das amortizações.
     - `getRemainingAmountCents(item)`: Retorna o saldo residual devedor ou a receber.
     - `getPaymentStatus(item)`: Classifica o lançamento com exatidão em `unpaid` (pendente), `partial` (parcialmente pago) ou `paid` (quitado).
   - Gerenciador visual de amortizações integrado ao modo de edição do [EventModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/EventModal.tsx), com barra de progresso percentual, lista de amortizações com botão de exclusão e marcação automática como quitado quando atinge 100%.
   - Atualização do cálculo do balanço financeiro (`monthlySummary`), computando amortizações parciais como receitas/despesas já realizadas e saldos restantes como previstos.

3. **Parcelamento de Compras e Lançamentos ([utils/installmentUtils.ts](file:///c:/Users/wnet4/Downloads/w&e.agenda/utils/installmentUtils.ts)):**
   - Criação de gerador de parcelas mensais de 2x a 72x com garantia de centavos exatos (sem perda por arredondamento; eventuais restos da divisão inteira são computados na 1ª parcela).
   - Cálculo automático de vencimentos mês a mês respeitando o clamping do dia 31 (ex: Jan 31 → Fev 28/29 → Mar 31).
   - Vinculação por `InstallmentInfo` (`groupId`, `current`, `total`, `totalAmountCents`) e títulos sequenciais automáticos (ex: *"Notebook Dell (1/10)"*).
   - Exclusão com escopo inteligente no [DeleteModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/DeleteModal.tsx): permite escolher entre *"Apenas esta parcela"* ou *"Todas as parcelas deste parcelamento"*.

4. **Busca Global e Extrato com Filtros Avançados ([components/SearchModal.tsx](file:///c:/Users/wnet4/Downloads/w&e.agenda/components/SearchModal.tsx)):**
   - Interface rápida de busca acessível pelo botão de lupa no cabeçalho ou pelo atalho de teclado global **`Ctrl + K` / `Cmd + K`**.
   - Filtro em tempo real por termo textual (busca em títulos, descrições e nomes de categorias).
   - Filtros combinados por Tipo (`Todos`, `Compromissos`, `Receitas`, `Despesas`), Status (`Todos`, `Pagos`, `Pendentes`, `Parciais`), Categoria e Período (`Todos`, `Mês Atual`, `Próximos 7 Dias`, `Próximos 30 Dias`, `Este Ano`).
   - Painel de totalizadores do filtro (Total Receitas, Total Despesas e Saldo Líquido do extrato).
   - Ações diretas nos cartões de resultado (alternar pago/pendente em 1 clique e editar lançamento).

---

### 2. Arquivos Alterados e Criados na Etapa 6

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `types.ts` | Definição de `Category`, `PartialPayment`, `InstallmentInfo` e novos campos em `CalendarItem`, `UserProfile` e `FilterState` | Concluído |
| `utils/categoryUtils.ts` | Coleção de categorias padrão, mesclagem com customizadas, validação e busca | Concluído |
| `utils/installmentUtils.ts` | Cálculo de parcelamento com centavos exatos e geração de lançamentos mensais com clamping | Concluído |
| `utils/moneyUtils.ts` | Métodos `getPaidAmountCents`, `getRemainingAmountCents` e `getPaymentStatus` | Concluído |
| `components/CategoryManagerModal.tsx` | Interface de gerenciamento e customização de categorias com paleta de cores | Concluído |
| `components/SearchModal.tsx` | Modal de busca global, extrato filtrado e atalho `Ctrl+K` | Concluído |
| `components/EventModal.tsx` | Seletor de categorias, toggle de parcelamento em compras e editor de amortizações parciais | Concluído |
| `components/FilterMenu.tsx` | Filtro por categoria e status de quitação (todos, pagos, parciais, pendentes) | Concluído |
| `components/CalendarGrid.tsx` | Exibição de indicador de amortização parcial e respeito aos filtros de categoria e status | Concluído |
| `components/DeleteModal.tsx` | Suporte a exclusão de parcela individual ou de todo o grupo de parcelamento | Concluído |
| `components/SideMenu.tsx` | Botão de acesso ao gerenciador de categorias | Concluído |
| `services/syncService.ts` | Sincronização em nuvem de `category`, `partial_payments`, `installment` e `custom_categories` | Concluído |
| `supabase/schema.sql` | Colunas `category`, `partial_payments`, `installment` em `calendar_items` e `custom_categories` em `profiles` | Concluído |
| `App.tsx` | Integração de estados, atalho `Ctrl+K`, cálculo de balanço amortizado, botão de busca e novos modais | Concluído |
| `tests/categoryUtils.test.ts` | Testes de categorias padrão, mesclagem de personalizadas e validações | Concluído |
| `tests/installmentUtils.test.ts` | Testes de divisão exata de centavos e geração de parcelas com clamping de dia 31 | Concluído |
| `tests/partialPayments.test.ts` | Testes de amortização parcial, quitação gradual e saldo residual devedor | Concluído |

---

### 3. Validação e Testes da Etapa 6

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Compilação 100% limpa em todo o código TypeScript do projeto.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **59 testes em 14 arquivos com 100% de aprovação**.
  - `tests/categoryUtils.test.ts`: 4 testes aprovados.
  - `tests/installmentUtils.test.ts`: 3 testes aprovados.
  - `tests/partialPayments.test.ts`: 4 testes aprovados.
  - Demais 48 testes das Etapas 1 a 5 mantidos com 100% de aprovação (WhatsApp, Jarves IA, lembretes, finanças, recorrências, storage e auth).

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso em 19.90s gerando bundle otimizado em `dist/`.

---

### 4. Status de Conclusão Geral do Projeto

Todas as 6 etapas planejadas para a evolução do **W&E.Agenda** foram implementadas, testadas e validadas:
- **Etapa 1:** Fundação local, precisão em centavos inteiros, motor de recorrência com clamping de dia 31, recuperação de corrupção e resumo financeiro realizado vs. previsto.
- **Etapa 2:** Autenticação com e-mail verificado, sincronização em nuvem Supabase PostgreSQL com RLS, isolamento por usuário e migração explícita.
- **Etapa 3:** Fuso horário de conta, lembretes reais com antecipação configurável, fila de notificações no banco com procedimento SQL concorrente, Web Push Service Worker e watcher in-app.
- **Etapa 4:** Assistente pessoal com nome personalizável (Jarves), NLU determinístico para despesas imediatas (*"Jarves, gastei 33 reais no mercado"*), compromissos e receitas, com garantia transacional estrita (gravação confirmada antes da resposta) e entrada por voz via Web Speech API.
- **Etapa 5:** Integração oficial com WhatsApp por texto e áudio, normalização E.164, transcrição automática, Edge Function de webhook transacional e despacho de lembretes para o WhatsApp.
- **Etapa 6:** Melhorias de produto com categorias personalizadas, amortizações parciais com histórico, parcelamento de compras no cartão com centavos exatos e busca global instantânea com atalho `Ctrl+K`.




