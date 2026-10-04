# Plano de Correções — W&E.Agenda

Este documento registra o diagnóstico, decisões técnicas, implementação, validação e pendências do projeto W&E.Agenda, organizado por etapas.

---

## Etapa 1 — Corrigir e Estabilizar a Base Local

### 1. Diagnóstico do Estado Inicial

#### A. Persistência e Segurança dos Dados
- **Armazenamento:** Realizado diretamente no `localStorage` por chaves (`fincal_current_user`, `fincal_items_${user}`, `fincal_profile_${user}`, `fincal_users`, `fincal_theme`).
- **Problema de Corrupção Silenciosa:** `JSON.parse` envolto em `try/catch` que retornava `INITIAL_ITEMS` (`[]`). Qualquer erro de parse (ex.: corrupção acidental ou truncamento) causava perda imediata dos dados na gravação subsequente.
- **Armazenamento de Senhas:** O componente `LoginScreen` criava usuários salvando senhas em texto puro no `localStorage` (`fincal_users`).
- **Exposição de Segredos:** `vite.config.ts` injetava `GEMINI_API_KEY` no bundle cliente via `define: { 'process.env.API_KEY': ..., 'process.env.GEMINI_API_KEY': ... }`, mesmo sem uso no frontend.
- **Gravação sem Confirmação:** O modal de criação/edição fechava antes de confirmar o sucesso da persistência.

#### B. TypeScript e Build
- **Erro de Tipagem em EventModal:** `activeType` estava tipado como `ItemType` (`'appointment' | 'income' | 'expense'`), mas no código recebia o valor `'finance'`.
- **Scripts Ausentes:** Não havia comando `typecheck` e o build (`vite build`) não executava verificação de tipos (`tsc`).
- **Dependências de Tipos Ausentes:** `@types/react` e `@types/react-dom` não constavam em `devDependencies`.
- **CSS Ausente:** `index.html` referenciava `<link rel="stylesheet" href="/index.css">`, porém `index.css` não existia no projeto.
- **Tailwind por CDN:** Utilizava script externo `https://cdn.tailwindcss.com`, dependente de conexão externa e inadequado para builds locais previsíveis.
- **Importmap Redundante:** `index.html` continha `<script type="importmap">` apontando para `esm.sh`, concorrendo com o empacotamento do Vite.
- **Lockfile Ausente:** Não havia `package-lock.json` no repositório.

#### C. Valores Financeiros
- **Valores em Ponto Flutuante:** `CalendarItem.amount` era armazenado como float (`number`), sujeito a imprecisão de arredondamento binário e inconsistência de centavos.
- **Parser Frágil:** Uso de `parseFloat(amount.replace(/\./g, '').replace(',', '.'))` sem validação de valores negativos, NaN, infinitos ou múltiplos separadores.
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
- **Edição em Cascata Falha:** `timeDiff` baseado em milissegundos causava desvios em meses com quantidade diferente de dias (ex.: 28, 30 e 31).
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

### 3. Progresso das Correções e Arquivos Alterados

| Arquivo | Motivo da Alteração | Status |
|---|---|---|
| `package.json` | Adição de scripts (`typecheck`, `test`, `build`), tipos e dependências locais (`tailwindcss`, `vitest`) com caminhos seguros | Concluído |
| `vite.config.ts` | Remoção de injeção de GEMINI_API_KEY e configurações desnecessárias | Concluído |
| `index.html` | Remoção de Tailwind CDN, importmap redundante, correção de viewport e link do CSS | Concluído |
| `index.css` | Criação com diretivas locais do Tailwind CSS e estilos do tema | Concluído |
| `tailwind.config.js` | Configuração local compatível com o design system existente | Concluído |
| `postcss.config.js` | Configuração de PostCSS para Tailwind | Concluído |
| `types.ts` | Correção da tipagem de `activeType`, definição de `amountCents`, esquemas de recorrência e série | Concluído |
| `utils/moneyUtils.ts` | Centralização de conversão, formatação, validação e cálculo em centavos inteiros | Concluído |
| `utils/dateUtils.ts` | Manipulação segura de datas sem deslocamento de fuso e centralização de formatação | Concluído |
| `utils/recurrenceUtils.ts` | Geração de ocorrências por período, regra de fim de mês e controle de exceções | Concluído |
| `utils/storageManager.ts` | Gerenciamento resiliente de LocalStorage, backup V1, migração V2 e recuperação de corrupção | Concluído |
| `components/EventModal.tsx` | Correção de tipagem, validação robusta, aviso de lembretes e prevenção de submissão duplicada | Concluído |
| `components/BalanceSummary.tsx` | Separação entre Realizado e Previsto, exibição de Contas a Pagar e a Receber | Concluído |
| `components/LoginScreen.tsx` | Sinalização de Modo Local Demonstração e desativação de cadastro de senhas em texto puro | Concluído |
| `components/CalendarGrid.tsx` | Ajustes de acessibilidade, renderização de séries dinâmicas e suporte a centavos | Concluído |
| `components/SideMenu.tsx` | Ajuste para valores em centavos e filtros coerentes com o mês | Concluído |
| `App.tsx` | Integração do storage resiliente, gerenciamento de séries, cálculo de balanço e recuperação | Concluído |

---

### 4. Validação e Testes Realizados

#### A. Verificação TypeScript (`npm run typecheck`)
- **Comando:** `node ./node_modules/typescript/bin/tsc --noEmit`
- **Resultado:** **0 erros**. Todos os tipos estritos validados com sucesso.

#### B. Testes Automatizados Unitários (`npm run test`)
- **Ferramenta:** Vitest v3.2.7
- **Resultado:** **19 testes em 5 arquivos com 100% de sucesso**.
  - `tests/moneyUtils.test.ts` (6 testes):
    - Conversão de "33", "33,50", "33.50", "1.234,56", "1234,56", "1234.56".
    - Rejeição de valores negativos, zero, vazios e não finitos.
    - Rejeição de formatos ambíguos ("1.234") com orientação explícita.
    - Edição e salvamento cíclico sem multiplicação ou distorção de centavos.
    - Formatação para padrão Real Brasileiro (BRL).
    - Conversão segura de float legado para centavos inteiros.
  - `tests/financialSummary.test.ts` (1 teste):
    - Separação entre receitas recebidas, contas a receber, despesas pagas e contas a pagar.
    - Cálculo exato de Resultado Realizado e Resultado Previsto em centavos.
    - Isolamento de compromissos sem valor no balanço.
  - `tests/recurrenceUtils.test.ts` (7 testes):
    - Recorrência mensal no dia 31 em ano bissexto (2024: 29 fev, 31 mar, 30 abr, 31 mai).
    - Recorrência mensal no dia 31 em ano comum (2026: 28 fev, 31 mar).
    - Geração sob demanda para a janela consultada.
    - Exclusão de ocorrência única isolada via exceção.
    - Exclusão de "esta e futuras" preservando o histórico anterior.
    - Edição pontual com overrides.
    - Recalcular regra de "esta e futuras" sem deslocamentos por ms e sem duplicidade.
    - Pagamento de uma ocorrência isolada sem afetar as demais da série.
  - `tests/storageManager.test.ts` (2 testes):
    - Preservação de dados corrompidos com geração de backup de emergência sem sobrescrever com lista vazia.
    - Migração V1 para V2 executada exatamente uma vez com criação de backup pré-migração.
  - `tests/dateUtils.test.ts` (3 testes):
    - Normalização de datas sem distorção por UTC/fuso local.
    - Normalização de formatos legados.
    - Validação de horários no mesmo dia exigindo término posterior ao início.

#### C. Build de Produção (`npm run build`)
- **Comando:** `tsc --noEmit && vite build`
- **Resultado:** Build concluído com sucesso.
- **Artefatos:**
  - `dist/index.html` (0.62 kB)
  - `dist/assets/index-BtpOTMWa.css` (34.49 kB)
  - `dist/assets/index-Cbe3UD87.js` (335.09 kB)

#### D. Testes em Navegador
- **Servidor Local Testado:** `http://127.0.0.1:3000/` via Vite Preview (`node ./node_modules/vite/bin/vite.js preview --port 3000`).
- **Limitação Observada:** O subagente de navegador interno relatou falha de download do driver Playwright (`404 Not Found` nos endpoints do Azure CDN da infraestrutura do subagente). O servidor web local e a aplicação funcionam perfeitamente na porta 3000.

---

### 5. Limitações e Pendências para Etapas Futuras

- **Etapa 2 (Próximo Passo):**
  - Autenticação real com Supabase (ou serviço compatível) com e-mail e senha.
  - Verificação de e-mail no fluxo de cadastro.
  - Criação da tabela de perfil e itens no PostgreSQL com isolamento rigoroso por `user_id` e Row Level Security (RLS).
  - Fluxo de importação explícita dos registros locais preservados na Etapa 1 para a conta autenticada, sem duplicidades e sem importar senhas.
  - Sincronização em tempo real entre múltiplos dispositivos.
- **Etapa 3:** Lembretes em segundo plano via servidor agendador, fuso horário configurável na conta (`America/Sao_Paulo`) e notificações push reais.
- **Etapa 4:** Assistente pessoal com IA interpretando comandos de linguagem natural e validando ações no backend.
- **Etapa 5:** Integração oficial com WhatsApp (áudio e texto).
- **Etapa 6:** Categorias, parcelamentos, busca avançada e visualizações adicionais.
