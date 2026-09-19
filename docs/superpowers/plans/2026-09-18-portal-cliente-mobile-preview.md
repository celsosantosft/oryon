# Portal do Cliente Mobile Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar uma versao mobile aprimorada do Portal do Cliente em `/portal-preview`, usando dados reais e preservando integralmente as rotas oficiais `/portal`.

**Architecture:** As paginas atuais receberao uma prop booleana `preview` definida exclusivamente pelas novas rotas. Servicos, hooks, regras e componentes de abas continuarao compartilhados; o preview recebera um tema visual isolado por classe raiz e estilos proprios, enquanto a renderizacao oficial mantem os estilos atuais. O deploy sera o fluxo normal da `main`, seguido de verificacao explicita das duas rotas.

**Tech Stack:** React 19, React Router 7, Vite 7, CSS nativo, Node Test Runner, SweetAlert2 existente.

**Spec:** `docs/superpowers/specs/2026-09-18-portal-cliente-mobile-homologacao-design.md`

## Global Constraints

- Usar somente dados reais retornados pelas APIs existentes.
- Nao alterar endpoints, banco de dados, autenticacao por token ou regras de permissao.
- Nao adicionar dependencias de interface ou animacao.
- `/portal` e `/portal/:code` devem permanecer na interface atual ate aprovacao explicita.
- `/portal-preview` deve exibir identificacao discreta de ambiente de teste.
- Consultas e escritas realizadas no preview continuam sendo reais.
- Cartoes do preview usam raio maximo de 8px; textos nao usam letter-spacing negativo.
- Animacoes necessarias ficam abaixo de 300ms e respeitam `prefers-reduced-motion`.

## Review Focus

- Codigo numerico, codigo completo e link com token devem navegar para `/portal-preview/:code` sem perder o token.
- Codigo inexistente deve restaurar o formulario depois do alerta, sem overlay cinza permanente.
- Falha de rede deve ser distinguida de pedido inexistente e permitir nova tentativa.
- Cliques repetidos em enviar grade, lista ou aprovar arte devem produzir apenas uma requisicao enquanto a primeira estiver pendente.
- Conteudo deve permanecer visivel com teclado aberto, safe area e navegacao inferior em 390x844 e 430x932.

---

### Task 1: Isolar as rotas publicas de homologacao

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/pages/PortalPreview.routing.test.js`

**Interfaces:**
- Produces: `<PortalHome preview />` em `/portal-preview` e `<ClientPortal preview />` em `/portal-preview/:code`.
- Preserves: `<PortalHome />` em `/portal` e `<ClientPortal />` em `/portal/:code`.

- [ ] **Step 1: Escrever o teste de rotas que falha**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('keeps the official portal routes and adds isolated preview routes', () => {
    const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

    assert.match(source, /path="\/portal" element={<PortalHome \/>}/);
    assert.match(source, /path="\/portal\/:code" element={<ClientPortal \/>}/);
    assert.match(source, /path="\/portal-preview" element={<PortalHome preview \/>}/);
    assert.match(source, /path="\/portal-preview\/:code" element={<ClientPortal preview \/>}/);
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test --prefix client -- --test-name-pattern="isolated preview routes"`

Expected: FAIL porque `/portal-preview` ainda nao existe.

- [ ] **Step 3: Adicionar as rotas sem alterar as oficiais**

Em `client/src/App.jsx`, manter as duas rotas atuais e adicionar imediatamente depois:

```jsx
<Route path="/portal-preview" element={<PortalHome preview />} />
<Route path="/portal-preview/:code" element={<ClientPortal preview />} />
```

- [ ] **Step 4: Executar o teste de rotas**

Run: `npm test --prefix client -- --test-name-pattern="isolated preview routes"`

Expected: PASS.

- [ ] **Step 5: Commitar a separacao das rotas**

```powershell
git add client/src/App.jsx client/src/pages/PortalPreview.routing.test.js
git commit -m "feat: add isolated customer portal preview routes"
```

---

### Task 2: Criar a entrada mobile do preview

**Files:**
- Modify: `client/src/pages/PortalHome.jsx`
- Create: `client/src/pages/PortalHome.preview.test.js`
- Create: `client/src/styles/PortalPreview.css`

**Interfaces:**
- Consumes: prop `preview?: boolean` fornecida pelas rotas.
- Produces: navegacao para `/portal-preview/:code` quando `preview === true`; a navegacao oficial continua em `/portal/:code`.

- [ ] **Step 1: Escrever testes SSR para identidade e destino do preview**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('marks only the preview entry as a test environment', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    try {
        const { default: PortalHome } = await vite.ssrLoadModule('/src/pages/PortalHome.jsx');
        const official = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(PortalHome)));
        const preview = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(PortalHome, { preview: true })));

        assert.equal(official.includes('Ambiente de teste'), false);
        assert.equal(preview.includes('Ambiente de teste'), true);
        assert.match(preview, /portal-preview-entry/);
    } finally {
        await vite.close();
    }
});
```

Adicionar um segundo teste por leitura de fonte que exige `const portalBasePath = preview ? '/portal-preview' : '/portal'` e `navigate(response.portal_path ? ...)` reescrito para manter `token` e usar o prefixo correto no preview.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix client -- --test-name-pattern="preview entry"`

Expected: FAIL porque `PortalHome` ainda nao aceita `preview`.

- [ ] **Step 3: Implementar o modo de entrada isolado**

Alterar a assinatura para:

```jsx
const PortalHome = ({ preview = false }) => {
    const portalBasePath = preview ? '/portal-preview' : '/portal';
```

No sucesso, extrair o caminho retornado e reconstruir somente o prefixo quando estiver no preview:

```js
const responseCode = response.tracking_code || safeCode;
const targetCode = encodeURIComponent(responseCode);
const targetToken = portalToken || new URL(response.portal_path, window.location.origin).searchParams.get('token') || '';
navigate(`${portalBasePath}/${targetCode}${targetToken ? `?token=${encodeURIComponent(targetToken)}` : ''}`);
```

Aplicar `className={preview ? 'portal-preview-entry' : undefined}` no wrapper, incluir o selo somente no preview e configurar o campo com `inputMode="numeric"`, `enterKeyHint="search"`, `autoCorrect="off"` e `autoCapitalize="characters"`.

- [ ] **Step 4: Criar os estilos da entrada sem afetar o oficial**

Em `client/src/styles/PortalPreview.css`, iniciar todos os seletores com `.portal-preview-entry`. Usar `min-height: 100svh`, safe areas, card com `border-radius: 8px`, botao com altura minima de 48px e feedback `:active`. Colocar qualquer `:hover` dentro de:

```css
@media (hover: hover) and (pointer: fine) {
  .portal-preview-entry .portal-preview-submit:hover { background: #1d4ed8; }
}
```

Adicionar:

```css
@media (prefers-reduced-motion: reduce) {
  .portal-preview-entry *, .portal-preview * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Executar os testes da entrada e regressao existente**

Run: `npm test --prefix client -- --test-name-pattern="portal|preview entry"`

Expected: PASS, incluindo `PortalHome.layering.test.js`.

- [ ] **Step 6: Commitar a entrada do preview**

```powershell
git add client/src/pages/PortalHome.jsx client/src/pages/PortalHome.preview.test.js client/src/styles/PortalPreview.css
git commit -m "feat: add mobile customer portal preview entry"
```

---

### Task 3: Aplicar o shell profissional ao portal interno

**Files:**
- Modify: `client/src/pages/ClientPortal.jsx`
- Modify: `client/src/components/tabs/HomeTab.jsx`
- Modify: `client/src/components/tabs/TrackingTab.jsx`
- Modify: `client/src/components/tabs/FinanceTab.jsx`
- Modify: `client/src/components/tabs/BulkTab.jsx`
- Modify: `client/src/components/tabs/ListTab.jsx`
- Modify: `client/src/styles/PortalPreview.css`
- Create: `client/src/pages/ClientPortal.preview.test.js`

**Interfaces:**
- Consumes: prop `preview?: boolean`.
- Produces: classe raiz `portal-preview`, identificacao de teste, botoes de navegacao semanticos e classes visuais isoladas.
- Preserves: dados e callbacks existentes de todas as abas.

- [ ] **Step 1: Escrever o teste estrutural do shell**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('isolates the preview shell without replacing portal business components', () => {
    const source = readFileSync(new URL('./ClientPortal.jsx', import.meta.url), 'utf8');

    assert.match(source, /const ClientPortal = \(\{ preview = false \}\)/);
    assert.match(source, /preview \? 'portal-preview portal-shell' : undefined/);
    assert.match(source, /Ambiente de teste/);
    assert.match(source, /<HomeTab[^>]+preview=\{preview\}/s);
    assert.match(source, /<ListTab[^>]+preview=\{preview\}/s);
    assert.match(source, /<button[^>]+aria-current=\{isActive \? 'page' : undefined\}/s);
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test --prefix client -- --test-name-pattern="preview shell"`

Expected: FAIL porque o shell ainda nao distingue preview.

- [ ] **Step 3: Implementar a estrutura semantica e isolada**

Alterar `ClientPortal` para aceitar `preview`, importar `PortalPreview.css`, usar `100dvh` nos estados de carregamento/erro do preview e voltar para `preview ? '/portal-preview' : '/portal'` na nova busca.

No root:

```jsx
<div className={preview ? 'portal-preview portal-shell' : undefined} style={styles.container}>
```

Adicionar o selo `Ambiente de teste` no cabecalho somente quando `preview` for verdadeiro. Substituir cada item clicavel da barra inferior por `<button type="button">`, preservando `disabled`, e adicionar `aria-current` no item ativo e `aria-label` em todos os controles de icone.

Passar `preview={preview}` para as cinco abas. Adicionar classes semanticas (`portal-section`, `portal-card`, `portal-product-card`, `portal-finance-summary`, `portal-name-card`) nos containers existentes. O CSS oficial nao tera regras para essas classes.

- [ ] **Step 4: Implementar os estilos do shell e das abas**

Completar `PortalPreview.css` com seletores prefixados por `.portal-preview` para:

- largura maxima de 640px, fundo `#f8fafc`, padding com safe area e espaco da barra inferior;
- cabecalho compacto sem gradiente, raio de 8px e codigo/prazo legiveis;
- cartoes brancos com borda `#e2e8f0`, raio de 8px e sombra discreta;
- grid nominal de uma coluna abaixo de 360px, duas colunas a partir de 360px e tres no desktop;
- barra inferior fixa, sem pill animada, com cinco botoes de pelo menos 52px e estado ativo por cor/fundo;
- modal como bottom sheet em mobile, sem ocultar campos com o teclado;
- botoes com transicoes de `transform`, `background-color`, `border-color` e `opacity`, nunca `transition: all`;
- `:hover` somente para `hover: hover` e `pointer: fine`;
- `:active { transform: scale(0.98); }` em controles;
- `touch-action: manipulation` e selecao desabilitada apenas nos controles.

- [ ] **Step 5: Executar o teste estrutural e o build**

Run: `npm test --prefix client -- --test-name-pattern="preview shell"`

Expected: PASS.

Run: `npm run build --prefix client`

Expected: build Vite concluido sem erro.

- [ ] **Step 6: Commitar o shell do preview**

```powershell
git add client/src/pages/ClientPortal.jsx client/src/components/tabs client/src/styles/PortalPreview.css client/src/pages/ClientPortal.preview.test.js
git commit -m "feat: add professional mobile portal preview shell"
```

---

### Task 4: Tornar erros e escritas do preview confiaveis

**Files:**
- Modify: `client/src/hooks/usePortalOrder.js`
- Modify: `client/src/pages/PortalHome.jsx`
- Modify: `client/src/pages/ClientPortal.jsx`
- Create: `client/src/hooks/portalRequestState.test.js`

**Interfaces:**
- Produces: `error` no retorno de `usePortalOrder` e trava por acao durante requests.
- Preserves: payloads e endpoints de `trackingService`.

- [ ] **Step 1: Escrever testes de contrato por leitura de fonte**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('portal hook exposes the real loading error', () => {
    const source = readFileSync(new URL('./usePortalOrder.js', import.meta.url), 'utf8');
    assert.match(source, /const \[error, setError\] = useState\(null\)/);
    assert.match(source, /setError\(err\)/);
    assert.match(source, /return \{ order, loading, error, updateOrderStatus \}/);
});

test('portal actions block repeated submissions while pending', () => {
    const source = readFileSync(new URL('../pages/ClientPortal.jsx', import.meta.url), 'utf8');
    assert.match(source, /const \[pendingAction, setPendingAction\] = useState\(null\)/);
    assert.match(source, /if \(pendingAction\) return/);
    assert.match(source, /finally \{ setPendingAction\(null\); \}/);
});
```

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test --prefix client -- --test-name-pattern="portal hook|repeated submissions"`

Expected: FAIL porque erro e estado pendente ainda nao sao expostos.

- [ ] **Step 3: Expor erro real e proteger acoes**

No hook, limpar `error` antes da consulta, armazenar o erro recebido e continuar retornando `order: null`. Em `ClientPortal`, usar `pendingAction` com valores `list`, `bulk`, `approve` e envolver cada request em `try/finally`. Passar `disabled` e texto de progresso somente aos botoes do preview; no oficial, manter os mesmos textos e aparencia atuais, embora a trava contra clique repetido continue ativa.

Na entrada, interpretar `error.response?.status === 404` como pedido inexistente, `403` como link incompleto/invalido e demais falhas como indisponibilidade temporaria. Todos os alertas fecham normalmente e `finally` restaura `isSearching`.

- [ ] **Step 4: Executar testes e build**

Run: `npm test --prefix client`

Expected: todos os testes do cliente passam.

Run: `npm run build --prefix client`

Expected: build concluido sem erro.

- [ ] **Step 5: Commitar estados confiaveis**

```powershell
git add client/src/hooks/usePortalOrder.js client/src/pages/PortalHome.jsx client/src/pages/ClientPortal.jsx client/src/hooks/portalRequestState.test.js
git commit -m "fix: make portal preview requests resilient"
```

---

### Task 5: Aplicar baseline mobile, validar e publicar o preview

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/index.css`
- Test: `client/src/pages/PortalPreview.routing.test.js`
- Test: `client/src/pages/PortalHome.preview.test.js`
- Test: `client/src/pages/ClientPortal.preview.test.js`

**Interfaces:**
- Produces: viewport com safe area e teclado responsivo para todo o frontend.
- Preserves: zoom por acessibilidade; nao adicionar `maximum-scale` nem `user-scalable=no`.

- [ ] **Step 1: Escrever o teste do baseline mobile**

Adicionar ao teste de preview:

```js
test('uses a mobile-safe viewport without disabling zoom', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /interactive-widget=resizes-content/);
    assert.doesNotMatch(html, /maximum-scale|user-scalable/);
});
```

- [ ] **Step 2: Executar e confirmar a falha**

Run: `npm test --prefix client -- --test-name-pattern="mobile-safe viewport"`

Expected: FAIL porque o meta viewport ainda nao contem os dois parametros.

- [ ] **Step 3: Aplicar o baseline minimo**

Em `client/index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

Em `client/src/index.css`, adicionar sem bloquear selecao de conteudo:

```css
html { -webkit-text-size-adjust: 100%; }
button, a, [role="button"] { touch-action: manipulation; }
button, [role="button"] { -webkit-user-select: none; user-select: none; }
@media (pointer: coarse) {
  input, textarea, select { font-size: 16px !important; }
}
```

- [ ] **Step 4: Executar toda a verificacao automatizada**

Run: `npm test --prefix client`

Expected: todos os testes passam.

Run: `npm run lint --prefix client`

Expected: nenhum erro novo nos arquivos alterados; corrigir apenas erros causados por esta implementacao.

Run: `npm run build --prefix client`

Expected: build concluido sem erro.

Run: `npm test --prefix server`

Expected: todos os testes do servidor passam, comprovando que os contratos existentes permanecem validos.

- [ ] **Step 5: Validar visualmente antes do deploy**

Iniciar `npm run dev --prefix client`, abrir `/portal-preview` e verificar screenshots em 390x844, 430x932 e 1440x900. Conferir entrada, erro, carregamento, barra inferior, todas as abas, modal de edicao e teclado. Conferir pixels do conteudo para garantir que a pagina nao esta em branco e que nenhum controle se sobrepoe.

- [ ] **Step 6: Commitar o baseline e a verificacao**

```powershell
git add client/index.html client/src/index.css client/src/pages/PortalPreview.routing.test.js client/src/pages/PortalHome.preview.test.js client/src/pages/ClientPortal.preview.test.js
git commit -m "fix: add mobile baseline for customer portal preview"
```

- [ ] **Step 7: Revisar a branch completa**

Run: `git diff --check HEAD~4..HEAD`

Expected: sem erros de whitespace.

Run: `git status --short`

Expected: worktree limpo.

- [ ] **Step 8: Publicar somente depois das verificacoes**

Executar `git push origin main`, acompanhar o workflow `Deploy production` ate concluir e validar:

- `https://atosfardamentos.com.br/portal-preview` mostra o selo de teste e a nova entrada;
- `https://atosfardamentos.com.br/portal` continua com a entrada oficial atual;
- um codigo real abre `/portal-preview/:code?token=...` preservando dados e navegacao;
- `/login` responde normalmente apos o deploy.

- [ ] **Step 9: Entregar o link de homologacao**

Fornecer `https://atosfardamentos.com.br/portal-preview` e informar claramente que toda edicao feita ali atua sobre dados reais. Nao substituir as rotas oficiais ate nova aprovacao explicita.
