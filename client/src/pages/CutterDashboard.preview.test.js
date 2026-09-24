import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dashboardSource = readFileSync(new URL('./CutterDashboard.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../components/Layout.jsx', import.meta.url), 'utf8');
const previewStylesUrl = new URL('../styles/CutterPreview.css', import.meta.url);
const previewStyles = existsSync(previewStylesUrl) ? readFileSync(previewStylesUrl, 'utf8') : '';

test('keeps the official cutting route and adds an isolated preview route', () => {
    assert.match(appSource, /path="\/corte"[\s\S]*?<CutterDashboard \/>/);
    assert.match(appSource, /path="\/corte-preview"[\s\S]*?<CutterDashboard preview \/>/);
});

test('uses the configured tenant theme only in cutting preview mode', () => {
    assert.match(dashboardSource, /export default function CutterDashboard\(\{ preview = false \}\)/);
    assert.match(dashboardSource, /appConfig\.theme === 'monochrome'/);
    assert.match(dashboardSource, /cutter-preview--monochrome/);
    assert.match(dashboardSource, /cutter-preview--default/);
    assert.match(dashboardSource, /Ambiente de teste/);
});

test('keeps both cutting routes in the focused workspace layout', () => {
    assert.match(layoutSource, /location\.pathname === '\/corte-preview'/);
});

test('preview styles define tenant accents and native mobile behavior', () => {
    assert.match(previewStyles, /\.cutter-preview--default\s*\{[\s\S]*?--cut-accent:\s*#2563eb/);
    assert.match(previewStyles, /\.cutter-preview--monochrome\s*\{[\s\S]*?--cut-accent:\s*#111827/);
    assert.match(previewStyles, /min-height:\s*100dvh/);
    assert.match(previewStyles, /env\(safe-area-inset-bottom/);
    assert.match(previewStyles, /@media \(hover: hover\) and \(pointer: fine\)/);
    assert.match(previewStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('contains cutting cards inside narrow mobile viewports', () => {
    assert.match(dashboardSource, /className="cutter-order-meta/);
    assert.match(dashboardSource, /className="cutter-order-footer/);
    assert.match(previewStyles, /\.cutter-preview\s*\{[\s\S]*?overflow-x:\s*clip/);
    assert.match(previewStyles, /\.cutter-preview \.cutter-order-card[\s\S]*?min-width:\s*0/);
    assert.match(previewStyles, /\.cutter-preview \.cutter-order-meta > span[\s\S]*?overflow-wrap:\s*anywhere/);
    assert.match(previewStyles, /@media \(max-width: 640px\)[\s\S]*?\.cutter-preview \.cutter-order-meta[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('centers a selected fabric tab with accessible native scrolling', () => {
    assert.match(dashboardSource, /const fabricTabsRef = useRef\(null\)/);
    assert.match(dashboardSource, /if \(!preview \|\| !fabricTabsRef\.current \|\| !button\) return/);
    assert.match(dashboardSource, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
    assert.match(dashboardSource, /fabricTabsRef\.current\.scrollTo\(\{[\s\S]*?left,[\s\S]*?behavior: reduceMotion \? 'auto' : 'smooth'/);
    assert.match(dashboardSource, /ref=\{fabricTabsRef\}/);
    assert.match(dashboardSource, /onClick=\{\(event\) => \{[\s\S]*?centerFabricTab\(event\.currentTarget\)/);
    assert.match(previewStyles, /\.cutter-preview \.cutter-fabric-tabs button\s*\{[\s\S]*?scroll-snap-align:\s*center/);
});
