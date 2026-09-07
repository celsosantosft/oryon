# Cutting Two-Spreads PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real grade `PP6 P11 M18 G12 GG4` produce two deterministic, no-rotation cutting spreads and exactly two A4 print pages.

**Architecture:** Replace the current smallest-quantity loop with a deterministic search that partitions supported sizes into the fewest feasible spreads. Each candidate uses fixed-orientation MaxRects packing, then the printable HTML is built by a pure utility so page structure can be tested independently from `window.open`.

**Tech Stack:** JavaScript ES modules, Node built-in test runner, React 19, browser print CSS.

**Spec:** `docs/superpowers/specs/2026-09-07-cutting-optimizer-surplus-design.md`

## Global Constraints

- Use only the real grades passed by the Corte PCP screen.
- Table size is exactly 180 cm wide and at most 280 cm long.
- Never rotate a marker.
- One shirt requires one front, one back, and two individual sleeves.
- Unsupported sizes remain explicit shortages; never invent measurements.
- This phase does not persist or consume stock and does not change order status.
- Every print page contains one complete spread; page count equals spread count.

---

### Task 1: Reproduce the Production Grade

**Files:**
- Modify: `client/src/utils/cuttingPlanner.test.js`
- Test: `client/src/utils/cuttingPlanner.test.js`

**Interfaces:**
- Consumes: existing `buildCuttingPlan(orders)`.
- Produces: acceptance assertions for spread count, layer recipes, bounds, rotation, and part surplus.

- [ ] **Step 1: Add the failing two-spread test**

```js
test('plans the real PP6 P11 M18 G12 GG4 grade in two spreads', () => {
    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'PP', quantidade: 6 },
        { tamanho: 'P', quantidade: 11 },
        { tamanho: 'M', quantidade: 18 },
        { tamanho: 'G', quantidade: 12 },
        { tamanho: 'GG', quantidade: 4 }
    ] }]);

    assert.equal(plan.spreads.length, 2);
    assert.equal(plan.spreads[0].layers, 12);
    assert.deepEqual(plan.spreads[0].markerCounts, {
        P: { front: 1, back: 1, sleeve: 2 },
        M: { front: 2, back: 2, sleeve: 3 },
        G: { front: 1, back: 1, sleeve: 2 }
    });
    assert.equal(plan.spreads[1].layers, 4);
    assert.equal(plan.shortages.length, 0);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --test-name-pattern="real PP6"`

Working directory: `client`

Expected: FAIL because the current planner returns more than two spreads and has no `markerCounts` contract.

- [ ] **Step 3: Add invariant assertions**

```js
for (const spread of plan.spreads) {
    assert.ok(spread.usedLength <= 280);
    assert.ok(spread.markers.every(({ x, y, width, height, rotated }) => (
        rotated === false && x >= 0 && y >= 0 && x + width <= 180 && y + height <= 280
    )));
}
assert.deepEqual(plan.surplusParts, [
    { tamanho: 'PP', front: 2, back: 2, sleeve: 0 },
    { tamanho: 'P', front: 1, back: 1, sleeve: 2 },
    { tamanho: 'M', front: 6, back: 6, sleeve: 0 }
]);
```

- [ ] **Step 4: Re-run and confirm the expected assertion failure remains**

Run: `npm test -- --test-name-pattern="real PP6"`

Expected: FAIL on the two-spread requirement, not on test syntax.

### Task 2: Implement Deterministic Spread Search

**Files:**
- Modify: `client/src/utils/cuttingPlanner.js`
- Test: `client/src/utils/cuttingPlanner.test.js`

**Interfaces:**
- Consumes: normalized grade totals and `SHIRT_MEASUREMENTS`.
- Produces: `buildCuttingPlan(orders)` with `spreads[].markerCounts`, `spreads[].partTotals`, and top-level `surplusParts`.

- [ ] **Step 1: Replace shelf packing with fixed-orientation MaxRects packing**

Implement `packMarkers(markers)` using free rectangles, best-short-side placement, rectangle splitting, and contained-free-rectangle pruning. Keep every returned marker with `rotated: false`.

- [ ] **Step 2: Build one candidate for a size subset and layer count**

For requested shirt quantity `q` and layer count `layers`, use:

```js
const markerCounts = {
    front: Math.ceil(q / layers),
    back: Math.ceil(q / layers),
    sleeve: Math.ceil((q * 2) / layers)
};
```

Reject the candidate before packing when its rectangular area exceeds `180 * 280`.

- [ ] **Step 3: Choose the best candidate for each subset**

Enumerate layer counts from `1` through the largest requested quantity in the subset. Compare feasible candidates by:

1. fewest surplus component pieces;
2. least `layers * usedLength`;
3. fewer markers;
4. deterministic size order.

- [ ] **Step 4: Partition active supported sizes**

Use a bitmask dynamic program over at most the seven supported sizes. Compare complete solutions by:

1. fewest spreads;
2. fewest surplus component pieces;
3. least total fabric usage.

Sort resulting spreads by layer count descending so the 12-layer production spread prints first.

- [ ] **Step 5: Compute production and surplus by component**

For each size:

```js
produced.front += markerCounts.front * layers;
produced.back += markerCounts.back * layers;
produced.sleeve += markerCounts.sleeve * layers;
surplus.front = Math.max(0, produced.front - requestedShirts);
surplus.back = Math.max(0, produced.back - requestedShirts);
surplus.sleeve = Math.max(0, produced.sleeve - requestedShirts * 2);
```

Only include a size in `surplusParts` when at least one component is positive.

- [ ] **Step 6: Run planner tests and verify GREEN**

Run: `npm test -- src/utils/cuttingPlanner.test.js`

Working directory: `client`

Expected: all planner tests PASS.

- [ ] **Step 7: Commit the planner independently**

```bash
git add client/src/utils/cuttingPlanner.js client/src/utils/cuttingPlanner.test.js
git commit -m "Fix cutting spread optimization"
```

### Task 3: Guarantee One A4 Page Per Spread

**Files:**
- Create: `client/src/utils/cuttingPlanPrint.js`
- Create: `client/src/utils/cuttingPlanPrint.test.js`
- Modify: `client/src/pages/CutterDashboard.jsx`

**Interfaces:**
- Consumes: `buildCuttingPlanPrintHtml(plan, selectedOrders)`.
- Produces: a complete escaped HTML document with one `.spread-page` section per spread.

- [ ] **Step 1: Write the failing print-structure test**

```js
test('prints exactly one self-contained A4 page per spread', () => {
    const html = buildCuttingPlanPrintHtml(twoSpreadPlan, [{ tracking_code: '#ATOS-1' }]);
    assert.equal((html.match(/class="spread-page"/g) || []).length, 2);
    assert.match(html, /@page \{ size: A4 portrait; margin: 8mm; \}/);
    assert.match(html, /\.spread-page:last-child/);
    assert.equal((html.match(/Plano de Corte PCP/g) || []).length, 2);
});
```

- [ ] **Step 2: Run the print test and verify RED**

Run: `node --test src/utils/cuttingPlanPrint.test.js`

Working directory: `client`

Expected: FAIL because `cuttingPlanPrint.js` does not exist.

- [ ] **Step 3: Build the pure printable HTML utility**

Generate one section per spread. Put title, orders, grade summary, layer data, SVG, cut totals, and surplus inside that section. Use:

```css
@page { size: A4 portrait; margin: 8mm; }
body { margin: 0; }
.spread-page {
    box-sizing: border-box;
    height: 280mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
}
.spread-page:last-child {
    break-after: auto;
    page-break-after: auto;
}
.marker { flex: 1; min-height: 0; }
.marker svg { display: block; width: 100%; height: 100%; }
```

Use `preserveAspectRatio="xMidYMin meet"` so the complete marker shrinks inside the remaining page instead of spilling into another page.

- [ ] **Step 4: Make the dashboard open the generated HTML**

Keep `window.open`, `document.write`, and `document.close` in `CutterDashboard.jsx`. Replace the inline template with `buildCuttingPlanPrintHtml(plan, selectedOrders)`.

- [ ] **Step 5: Run print and client tests and verify GREEN**

Run: `npm test`

Working directory: `client`

Expected: all tests PASS.

- [ ] **Step 6: Commit the print correction independently**

```bash
git add client/src/utils/cuttingPlanPrint.js client/src/utils/cuttingPlanPrint.test.js client/src/pages/CutterDashboard.jsx
git commit -m "Keep each cutting spread on one PDF page"
```

### Task 4: Full Verification and Delivery

**Files:**
- Verify only; no expected source edits.

**Interfaces:**
- Consumes: completed planner and print changes.
- Produces: test/build evidence and pushed commits.

- [ ] **Step 1: Run the full client suite**

Run: `npm test`

Working directory: `client`

Expected: zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Working directory: `client`

Expected: Vite exits with code `0`.

- [ ] **Step 3: Render the generated HTML with Chromium**

Generate a temporary HTML file for the acceptance fixture, print it headlessly to PDF, and inspect it with `pdfinfo`.

Expected: `Pages: 2`.

- [ ] **Step 4: Inspect both rendered pages**

Render the PDF pages to PNG and verify that each page contains one complete title, summary, enfesto header, full marker drawing, totals, and no clipped text.

- [ ] **Step 5: Verify repository state and push**

```bash
git status --short
git push origin main
git log -3 --oneline --decorate
```

Expected: clean worktree and `origin/main` at the final correction commit.

## Deferred Follow-up

The stock popup, transactional stock ledger, execution confirmation, and permanent order progress from the design specification require backend schema/API work. They will be implemented in a separate plan after the two-spread and two-page output is verified in production behavior.
