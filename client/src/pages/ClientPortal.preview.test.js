import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ClientPortal.jsx', import.meta.url), 'utf8');
const previewStyles = readFileSync(new URL('../styles/PortalPreview.css', import.meta.url), 'utf8');

test('supports the mobile styling on official and preview portal routes', () => {
    assert.match(source, /const ClientPortal = \(\{ preview = false, modern = false \}\)/);
    assert.match(source, /const useModernPortal = preview \|\| modern/);
    assert.match(source, /useModernPortal \? 'portal-preview portal-shell' : undefined/);
    assert.match(source, /preview && \([\s\S]*Ambiente de teste/);
    assert.match(source, /<HomeTab[\s\S]*preview=\{useModernPortal\}/);
});

test('uses accessible bottom navigation controls in preview mode', () => {
    assert.match(source, /<button[\s\S]*className="portal-nav-item"/);
    assert.match(source, /aria-current=\{isActive \? 'page' : undefined\}/);
    assert.match(source, /disabled=\{item\.disabled\}/);
});

test('keeps the original glass and spring effects in the preview navigation', () => {
    assert.match(source, /className="portal-nav-pill"/);
    assert.match(source, /left: `calc\(\$\{activeNavIndex \* 20\}% \+ 1%\)`/);
    assert.match(previewStyles, /\.portal-preview \.portal-nav-pill \{[\s\S]*background: linear-gradient\(135deg, rgba\(255, 255, 255, 0\.15\) 0%, rgba\(255, 255, 255, 0\.05\) 100%\);/);
    assert.match(previewStyles, /\.portal-preview \.portal-nav-pill \{[\s\S]*backdrop-filter: blur\(12px\);/);
    assert.match(previewStyles, /\.portal-preview \.portal-nav-pill \{[\s\S]*transition: left 400ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\);/);
    assert.match(previewStyles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.portal-preview \.portal-nav-pill \{[\s\S]*transition-duration: 400ms !important;/);
    assert.doesNotMatch(previewStyles, /\.portal-preview \.portal-nav-item:hover/);
});
