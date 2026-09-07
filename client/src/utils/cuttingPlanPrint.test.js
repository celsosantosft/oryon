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
    assert.match(html, /preserveAspectRatio="xMidYMin meet"/);
});
