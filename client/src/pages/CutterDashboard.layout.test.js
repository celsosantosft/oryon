import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('keeps the printable plan out of the fixed cutting action bar', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');
    const start = source.indexOf('fixed inset-x-0 bottom-0');
    const fixedBar = source.slice(start, source.indexOf('</aside>', start));

    assert.notEqual(start, -1);
    assert.equal(fixedBar.includes('<PrintableCuttingPlan'), false);
});

test('renders the selection check icon from the shared icon set', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');

    assert.match(source, /import \{ Icons \} from '\.\.\/components\/Icons';/);
    assert.match(source, /<Icons\.Check \/>/);
});

test('asks which calculated cutting strategy should be printed', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');

    assert.match(source, /chooseCuttingPlanAlert/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'economy'\)/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'fewer-spreads'\)/);
    assert.match(source, /await chooseCuttingPlanAlert/);
    assert.match(source, /printCuttingPlan\(selectedPlan, selectedCuttingOrders\)/);
});
