import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingPlan } from './cuttingPlanner.js';

test('prints exactly one self-contained A4 page per spread', async () => {
    let buildCuttingPlanPrintHtml;
    try {
        ({ buildCuttingPlanPrintHtml } = await import('./cuttingPlanPrint.js'));
    } catch {
        assert.fail('buildCuttingPlanPrintHtml must exist');
    }

    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'PP', quantidade: 6 },
        { tamanho: 'P', quantidade: 11 },
        { tamanho: 'M', quantidade: 18 },
        { tamanho: 'G', quantidade: 12 },
        { tamanho: 'GG', quantidade: 4 }
    ] }]);
    const html = buildCuttingPlanPrintHtml(plan, [{ tracking_code: '#ATOS-1' }]);

    assert.equal((html.match(/<section class="spread-page">/g) || []).length, 2);
    assert.equal((html.match(/<h1>Plano de Corte PCP<\/h1>/g) || []).length, 2);
    assert.match(html, /@page \{ size: A4 portrait; margin: 8mm; \}/);
    assert.match(html, /\.spread-page:last-child/);
    assert.match(html, /\.spread-page \+ \.spread-page/);
    assert.match(html, /break-inside: avoid/);
    assert.match(html, /break-before: page/);
    assert.match(html, /height: 270mm/);
    assert.match(html, /preserveAspectRatio="xMidYMin meet"/);

    const crossSizeSurplus = plan.spreads
        .flatMap((spread) => spread.surplusParts.map((item) => ({ spread, item })))
        .find(({ spread, item }) => !spread.sizes.includes(item.tamanho));
    assert.ok(crossSizeSurplus);
    assert.match(html, new RegExp(
        `<b>Sobras:</b>[^\\n]*${crossSizeSurplus.item.tamanho}: ${crossSizeSurplus.item.front} frente(?:s)?, `
        + `${crossSizeSurplus.item.back} costa(?:s)?, ${crossSizeSurplus.item.sleeve} manga(?:s)?`
    ));
});
