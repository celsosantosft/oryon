import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingPlan } from './cuttingPlanner.js';
import { buildCuttingPlanPrintHtml } from './cuttingPlanPrint.js';

function countPages(html) {
    return (html.match(/<section class="spread-page">/g) || []).length;
}

test('prints one A4 page per spread with back-to-front instructions', () => {
    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'P', quantidade: 20 },
        { tamanho: 'M', quantidade: 10 },
        { tamanho: 'G', quantidade: 5 },
        { tamanho: 'GG', quantidade: 5 }
    ] }], 'economy');
    const html = buildCuttingPlanPrintHtml(plan, [{ tracking_code: '#ATOS-1' }]);

    assert.equal(countPages(html), plan.spreads.length);
    assert.equal((html.match(/<h1>Plano de Corte PCP<\/h1>/g) || []).length, plan.spreads.length);
    assert.match(html, /MANTER 5 COSTAS/);
    assert.match(html, /TRANSFORMAR 5 EM FRENTE/);
    assert.match(html, /class="instruction" textLength="[\d.]+" lengthAdjust="spacingAndGlyphs"/);
    assert.match(html, /@page \{ size: A4 portrait; margin: 8mm; \}/);
    assert.match(html, /preserveAspectRatio="xMidYMin meet"/);
});

test('lists loose cuts on the last spread without adding a page', () => {
    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'P', quantidade: 8 },
        { tamanho: 'M', quantidade: 15 },
        { tamanho: 'G', quantidade: 10 },
        { tamanho: 'GG', quantidade: 7 },
        { tamanho: 'XG', quantidade: 2 },
        { tamanho: 'EXG', quantidade: 1 }
    ] }], 'economy');
    const html = buildCuttingPlanPrintHtml(plan, [{ tracking_code: '#ATOS-4186' }]);

    assert.equal(countPages(html), plan.spreads.length);
    assert.match(html, /Cortes avulsos em retalho/);
    assert.match(html, /EXG: 1 frente, 1 costa, 2 mangas/);
});

test('prints one instruction page when the complete plan is loose cutting', () => {
    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'P', quantidade: 1 },
        { tamanho: 'M', quantidade: 1 }
    ] }], 'economy');
    const html = buildCuttingPlanPrintHtml(plan, [{ tracking_code: '#ATOS-2' }]);

    assert.equal(plan.spreads.length, 0);
    assert.equal(countPages(html), 1);
    assert.match(html, /Corte avulso em retalho/);
    assert.doesNotMatch(html, /<svg/);
});
