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
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'economy', effectiveCuttingArea\)/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'balanced', effectiveCuttingArea\)/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'fewer-spreads', effectiveCuttingArea\)/);
    assert.match(source, /await chooseCuttingPlanAlert/);
    assert.match(source, /printCuttingPlan\(selectedPlan, selectedCuttingOrders\)/);
});

test('edits the layer count of every spread before printing', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');

    assert.match(source, /chooseCuttingLayersAlert/);
    assert.doesNotMatch(source, /MAX_CUTTING_LAYERS/);
    assert.match(source, /buildCuttingPlan\([\s\S]*?'manual-layers'/);
    assert.match(source, /layerCounts/);
});

test('configures table and fabric measurements inside the active fabric section', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');

    assert.match(source, /\/corte\/configuracoes/);
    assert.match(source, /Largura da malha/);
    assert.match(source, /Largura da mesa/);
    assert.match(source, /Comprimento da mesa/);
    assert.match(source, /getEffectiveCuttingArea/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'economy', effectiveCuttingArea\)/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'balanced', effectiveCuttingArea\)/);
    assert.match(source, /buildCuttingPlan\(selectedCuttingOrders, 'fewer-spreads', effectiveCuttingArea\)/);
});

test('keeps cutting settings synchronized without saving them to another fabric', () => {
    const source = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');

    assert.match(source, /\/corte\/configuracoes\/mesa/);
    assert.match(source, /\/corte\/configuracoes\/malha/);
    assert.match(source, /window\.setInterval\(loadCuttingSettings, 15000\)/);
    assert.match(source, /settingsDraft\.fabricId !== activeFabric\.id/);
    assert.match(source, /requestRevision !== settingsRevisionRef\.current/);
    assert.equal((source.match(/settingsRevisionRef\.current \+= 1/g) || []).length, 2);
    assert.match(source, /setSelectedFabricId\(\(current\) =>/);
    assert.match(source, /settingsSaving \|\| hasUnsavedSettings/);
});
