# Cutting Batch Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cutting planner that creates arbitrary surplus with a deterministic batch planner, provide economy and fewer-spreads alternatives, and ask the cutter which calculated plan to print.

**Architecture:** Keep the existing no-rotation rectangle packer and A4 renderer. Replace whole-size partitioning and greedy filler with component demand allocation: body batches can split a size across spreads, a back marker can allocate selected layers to fronts, sleeves can move to later spreads, and small residual demand can become explicit loose cuts. Build both strategies from the same result shape and let the dashboard select one through the existing SweetAlert dependency.

**Tech Stack:** React 19, JavaScript ES modules, Node test runner, SweetAlert2, Vite.

**Spec:** `docs/superpowers/specs/2026-09-08-cutting-batch-planner-design.md`

## Global Constraints

- Never leave any requested front, back, or sleeve missing.
- Do not rotate markers; the table remains exactly 180 cm by 280 cm.
- A shirt requires one front, one back, and two sleeves.
- Use only selected real demand; never insert a size with zero demand.
- Economy minimizes surplus before spread count and may list loose cuts.
- Fewer-spreads minimizes spread count and must disclose every surplus component before printing.
- Keep exactly one A4 page per spread, except an all-loose plan uses one instruction page.
- Generating or printing a plan must not mutate orders, stock, history, or status.
- Add no dependency.

---

### Task 1: Lock the reported regression into planner tests

**Files:**
- Modify: `client/src/utils/cuttingPlanner.test.js`

**Interfaces:**
- Consumes: existing `buildCuttingPlan(orders, strategy)` export.
- Produces: executable acceptance tests for both strategies and component accounting.

- [ ] **Step 1: Replace obsolete filler assertions with the reported grade**

Add a test using `P8 M15 G10 GG7 XG2 EXG1` and request the economy strategy:

```js
const plan = buildCuttingPlan([{ grade: [
    { tamanho: 'P', quantidade: 8 },
    { tamanho: 'M', quantidade: 15 },
    { tamanho: 'G', quantidade: 10 },
    { tamanho: 'GG', quantidade: 7 },
    { tamanho: 'XG', quantidade: 2 },
    { tamanho: 'EXG', quantidade: 1 }
] }], 'economy');

assert.equal(plan.strategy, 'economy');
assert.equal(plan.shortages.length, 0);
assert.equal(plan.surplusParts.reduce((sum, item) => (
    sum + item.front + item.back + item.sleeve
), 0), 0);
assert.ok(plan.looseCuts.some((item) => item.tamanho === 'EXG'));
assert.equal(plan.producedParts.find((item) => item.tamanho === 'EXG')?.front || 0, 0);
```

- [ ] **Step 2: Add the back-to-front acceptance case**

```js
const plan = buildCuttingPlan([{ grade: [
    { tamanho: 'P', quantidade: 20 },
    { tamanho: 'M', quantidade: 10 },
    { tamanho: 'G', quantidade: 5 },
    { tamanho: 'GG', quantidade: 5 }
] }], 'economy');

assert.equal(plan.shortages.length, 0);
assert.ok(plan.spreads.some((spread) => (
    spread.layers === 10
    && spread.transformations.some((item) => item.tamanho === 'G' && item.toFront === 5)
    && spread.transformations.some((item) => item.tamanho === 'GG' && item.toFront === 5)
)));
```

- [ ] **Step 3: Add accounting and strategy tests**

For every requested size assert:

```js
assert.equal(applied.front, requested);
assert.equal(applied.back, requested);
assert.equal(applied.sleeve, requested * 2);
assert.equal(produced.front + loose.front, applied.front + surplus.front);
assert.equal(produced.back + loose.back, applied.back + surplus.back);
assert.equal(produced.sleeve + loose.sleeve, applied.sleeve + surplus.sleeve);
```

Also assert that `buildCuttingPlan(orders, 'fewer-spreads')` has no more spreads than economy, never adds an unrequested size, and exposes non-negative `metrics.surplusPieces`.

- [ ] **Step 4: Run the focused test and verify RED**

Run: `npm test -- --test-name-pattern="reported grade|back-to-front|strategy accounting"`

Working directory: `client`

Expected: FAIL because the current planner has no strategy, loose cuts, transformations, or strategy metrics and still generates EXG surplus.

### Task 2: Replace whole-size partitioning with batch allocation

**Files:**
- Modify: `client/src/utils/cuttingPlanner.js`
- Test: `client/src/utils/cuttingPlanner.test.js`

**Interfaces:**
- Consumes: selected orders with `grade: Array<{ tamanho, quantidade }>` and strategy `'economy' | 'fewer-spreads'`.
- Produces: `buildCuttingPlan(orders, strategy = 'economy')` returning `strategy`, `spreads`, `looseCuts`, `producedParts`, `appliedParts`, `surplusParts`, `shortages`, and `metrics`.

- [ ] **Step 1: Keep the geometry helpers and remove arbitrary filler**

Delete `makeSingleMarker`, `compareFillOptions`, `fillSpread`, whole-size `partitionSizes`, and their obsolete callers. Keep `packMarkers`, measurement normalization, and deterministic grade sorting.

- [ ] **Step 2: Represent remaining demand by component**

Create maps with this exact value shape:

```js
{ front: quantity, back: quantity, sleeve: quantity * 2 }
```

Add small helpers that clone maps, subtract allocations without going below zero, sum remaining components, and convert maps to sorted arrays.

- [ ] **Step 3: Generate deterministic body allocations for a layer count**

For each size and candidate layer count:

```js
const fullRuns = Math.floor(quantity / layers);
const remainder = quantity % layers;
```

Create one front and one back marker per full run. When `layers` is even and `remainder === layers / 2`, create one back marker and record:

```js
{
    tamanho: size,
    bodies: layers,
    keepBack: remainder,
    toFront: remainder
}
```

Other residual quantities remain for a later batch or loose cut in economy mode. In fewer-spreads mode, permit `ceil(quantity / layers)` marker repetitions only for sizes with real remaining demand and record the resulting component surplus.

- [ ] **Step 4: Build and rank candidate batches**

Evaluate layer counts from `2` through the largest remaining shirt quantity plus a one-layer fallback. For each layer count, enumerate subsets of the at most seven supported sizes, pack the resulting body markers without rotation, then try to add required sleeve markers while space remains.

Economy candidate order:

```js
coveredComponents desc,
surplusPieces asc,
fabricUsage asc,
markerCount asc,
stableKey asc
```

Fewer-spreads candidate order:

```js
coveredComponents desc,
remainingComponents asc,
surplusPieces asc,
fabricUsage asc,
stableKey asc
```

Reject candidates that cover no remaining component, contain an unrequested size, exceed 180 by 280 cm, or rotate a marker.

- [ ] **Step 5: Iterate batches and isolate residual loose cuts**

Select the best candidate, subtract its applied components, and repeat until no component remains or no candidate improves the state. In economy mode, move the residual to `looseCuts`. In fewer-spreads mode, first try one final rounded batch; only geometrically impossible residue becomes loose.

Use a state signature and an iteration ceiling derived from requested component count to prevent non-progress loops. A repeated state is a planner error and must appear in `shortages`, never as silent success.

- [ ] **Step 6: Allocate sleeves independently**

After body batches, place outstanding sleeve markers into available body spreads with matching layer counts. Pack any remainder into sleeve-only spreads. Keep sleeve accounting by unit and allow final loose sleeves in economy mode.

- [ ] **Step 7: Validate accounting before returning**

For each size and component, enforce:

```js
produced + loose === applied + surplus
applied === requested
```

If either equality fails, include that size/component in `shortages` and make the plan unprintable. Return metrics:

```js
{
    spreadCount,
    looseCutPieces,
    surplusPieces,
    fabricMeters: Number((fabricUsage / 100).toFixed(2))
}
```

- [ ] **Step 8: Run planner tests and verify GREEN**

Run: `npm test -- src/utils/cuttingPlanner.test.js`

Working directory: `client`

Expected: all planner tests pass, including both real grades, no-rotation geometry, deterministic output, transformation, loose cuts, and accounting.

- [ ] **Step 9: Commit the planner unit**

```bash
git add client/src/utils/cuttingPlanner.js client/src/utils/cuttingPlanner.test.js
git commit -m "Fix cutting plan batch allocation"
```

### Task 3: Print transformations and loose cuts without extra pages

**Files:**
- Modify: `client/src/utils/cuttingPlanPrint.js`
- Modify: `client/src/utils/cuttingPlanPrint.test.js`

**Interfaces:**
- Consumes: the Task 2 plan result, including `spread.transformations`, `spread.appliedParts`, `spread.surplusParts`, and top-level `looseCuts`.
- Produces: `buildCuttingPlanPrintHtml(plan, selectedOrders)` with one printable section per spread or one loose-only section.

- [ ] **Step 1: Write failing print tests**

Assert the output contains instructions such as:

```js
assert.match(html, /MANTER 5 COSTAS/);
assert.match(html, /TRANSFORMAR 5 EM FRENTE/);
assert.match(html, /Cortes avulsos em retalho/);
```

Count `class="spread-page"` and assert it equals `plan.spreads.length`, except when there are zero spreads and loose cuts, where it equals one.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/utils/cuttingPlanPrint.test.js`

Working directory: `client`

Expected: FAIL because the renderer does not know transformations or loose cuts.

- [ ] **Step 3: Render operational instructions**

Add a compact marker annotation for converted back markers and a final compact loose-cut band. Keep existing A4 dimensions and avoid a new summary page. Use the approved red marker drawing and current typography.

- [ ] **Step 4: Run print tests and verify GREEN**

Run: `npm test -- src/utils/cuttingPlanPrint.test.js`

Working directory: `client`

Expected: all print tests pass and page count remains exact.

- [ ] **Step 5: Commit the print unit**

```bash
git add client/src/utils/cuttingPlanPrint.js client/src/utils/cuttingPlanPrint.test.js
git commit -m "Print cutting transformations and loose cuts"
```

### Task 4: Ask which calculated strategy to print

**Files:**
- Modify: `client/src/utils/alerts.js`
- Modify: `client/src/pages/CutterDashboard.jsx`
- Modify: `client/src/pages/CutterDashboard.layout.test.js`

**Interfaces:**
- Consumes: `{ economy, fewerSpreads }` planner results.
- Produces: `chooseCuttingPlanAlert(plans)` resolving to `'economy'`, `'fewer-spreads'`, or `null`.

- [ ] **Step 1: Add failing source-level integration assertions**

Assert `CutterDashboard.jsx` imports `chooseCuttingPlanAlert`, calculates both strategy names, awaits the chooser inside `handlePrintCuttingPlan`, and passes only the chosen plan to `printCuttingPlan`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/pages/CutterDashboard.layout.test.js`

Working directory: `client`

Expected: FAIL because the button currently prints one precomputed old plan directly.

- [ ] **Step 3: Add the SweetAlert chooser**

Use the existing lazy `getSwal()` helper. Show exact metrics for each option and use confirm/deny/cancel actions:

```js
const result = await Swal.fire({
    title: 'Como deseja preparar o corte?',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Economizar malha',
    denyButtonText: 'Reduzir enfestos',
    cancelButtonText: 'Cancelar'
});

return result.isConfirmed
    ? 'economy'
    : result.isDenied ? 'fewer-spreads' : null;
```

The popup body must list spread count, fabric meters, loose cuts, and surplus for both plans. Escape all interpolated labels before placing them in HTML.

- [ ] **Step 4: Wire both plans into the dashboard**

Calculate both plans from `selectedCuttingOrders`. Keep economy metrics in the fixed action bar as the recommended preview. On `Gerar PDF`, await the chooser; cancellation does nothing; invalid chosen plans show the existing real error notice; valid plans open only the chosen PDF.

- [ ] **Step 5: Run dashboard tests and verify GREEN**

Run: `npm test -- src/pages/CutterDashboard.layout.test.js`

Working directory: `client`

Expected: all dashboard layout/integration assertions pass.

- [ ] **Step 6: Commit the popup integration**

```bash
git add client/src/utils/alerts.js client/src/pages/CutterDashboard.jsx client/src/pages/CutterDashboard.layout.test.js
git commit -m "Add cutting plan strategy chooser"
```

### Task 5: Full regression and browser verification

**Files:**
- Modify only if a verification failure identifies a defect in Tasks 1-4.

**Interfaces:**
- Consumes: completed planner, renderer, and dashboard integration.
- Produces: verified production build and visual evidence for the reported flow.

- [ ] **Step 1: Run the complete client test suite**

Run: `npm test`

Working directory: `client`

Expected: zero failed tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Working directory: `client`

Expected: zero errors introduced by the changed files. Existing unrelated warnings, if any, must be reported exactly.

- [ ] **Step 3: Build the production client**

Run: `npm run build`

Working directory: `client`

Expected: Vite exits with code 0.

- [ ] **Step 4: Start the development server and verify the real interaction**

Run: `npm run dev -- --port 4174`

Working directory: `client`

In the browser, select compatible cutting orders and verify:

- the fixed bar uses the selected real grade;
- `Gerar PDF` opens the strategy popup;
- both options show different calculated metrics when applicable;
- cancel opens no print window;
- economy does not turn `EXG 1` into eight sets;
- choosing either option opens the matching PDF;
- each spread occupies one A4 page;
- transformed backs and loose cuts have explicit instructions;
- no unrelated Corte PCP interaction changed.

- [ ] **Step 5: Inspect the final diff and commit verification fixes**

Run: `git diff --check`

Expected: no whitespace errors.

Commit only if Step 1-4 required a correction:

```bash
git add client/src
git commit -m "Verify cutting plan generation flow"
```

- [ ] **Step 6: Push through GitHub Desktop and verify the remote**

Push the completed commits using GitHub Desktop. Then compare local `HEAD` with:

```bash
git ls-remote origin refs/heads/main
```

Expected: the remote main hash equals local `HEAD`, and `git status --short --branch` reports `main...origin/main` with no changed files.
