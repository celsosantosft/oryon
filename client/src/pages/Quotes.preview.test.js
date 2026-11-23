import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const quotesSource = readFileSync(new URL('./Quotes.jsx', import.meta.url), 'utf8');
const previewStyles = readFileSync(new URL('../styles/OrdersPreview.css', import.meta.url), 'utf8');

test('applies the approved quote experience on mobile and keeps a comparison route', () => {
    assert.match(appSource, /path="\/quotes" element={<Quotes \/>}/);
    assert.match(appSource, /path="\/quotes-preview" element={<Quotes key="preview" preview \/>}/);
    assert.match(quotesSource, /const quotesMobileQuery = '\(width < 1000px\)'/);
    assert.match(quotesSource, /const preview = forcePreview \|\| isMobile/);
});

test('preserves the visual identity of each tenant', () => {
    assert.match(quotesSource, /appConfig\.theme === 'monochrome'/);
    assert.match(quotesSource, /orders-preview--monochrome/);
    assert.match(quotesSource, /orders-preview--default/);
    assert.match(previewStyles, /\.orders-preview--default\s*\{[\s\S]*--orders-accent:\s*#2563EB/);
    assert.match(previewStyles, /\.orders-preview--monochrome\s*\{[\s\S]*--orders-accent:\s*#111827/);
});

test('uses compact quote cards with labeled actions on mobile', () => {
    assert.match(quotesSource, /orders-preview-row quotes-preview-row/);
    assert.match(quotesSource, />Visualizar<\/button>/);
    assert.match(quotesSource, /Gerar pedido/);
    assert.match(quotesSource, />Editar<\/button>/);
    assert.match(quotesSource, />Imprimir<\/button>/);
    assert.match(quotesSource, /Quantidade<\/dt>/);
    assert.match(quotesSource, /Arte anexada/);
});

test('keeps tabs touch-native and centers the selected status', () => {
    assert.match(previewStyles, /\.quotes-preview \.quotes-tabs\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(previewStyles, /touch-action:\s*pan-x/);
    assert.match(previewStyles, /scroll-snap-type:\s*x proximity/);
    assert.match(quotesSource, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth', inline: 'center'/);
    assert.match(quotesSource, /prefers-reduced-motion: reduce/);
});

test('keeps mobile controls accessible and groups quote sizes correctly', () => {
    assert.match(previewStyles, /font-size:\s*16px !important/);
    assert.match(previewStyles, /min-height:\s*44px/);
    assert.match(quotesSource, /manageFocus=\{preview\}/);
    assert.match(quotesSource, /normalizeGradeSize/);
    assert.match(quotesSource, /sortGradeItems/);
    assert.match(quotesSource, /label: 'Infantil'/);
    assert.match(quotesSource, /label: 'Adulto'/);
});

test('avoids broad transitions and gates quote hover effects to precise pointers', () => {
    assert.doesNotMatch(quotesSource, /transition:\s*['"`]all/);
    assert.match(quotesSource, /@media \(hover: hover\) and \(pointer: fine\)/);
    assert.match(previewStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('guides quote creation on mobile without hiding the desktop form', () => {
    assert.match(quotesSource, /className="quote-form-mobile-nav"/);
    assert.match(quotesSource, /1\. Cliente/);
    assert.match(quotesSource, /2\. Produtos/);
    assert.match(quotesSource, /3\. Resumo/);
    assert.match(quotesSource, /className="quote-form-progress"/);
    assert.match(quotesSource, /className="quote-form-mobile-submit"/);
    assert.match(quotesSource, /defaultOpen=\{!compact \|\| hasEnhancements\}/);
    assert.match(previewStyles, /@container \(max-width: 640px\)[\s\S]*\.quotes-preview \.quote-form-mobile-submit/);
});

test('opens and copies the authenticated customer portal from quote details', () => {
    assert.match(quotesSource, /getPortalLink: \(api, token, trackingCode\)/);
    assert.match(quotesSource, /response\.data\.portal_direct_path \|\| response\.data\.portal_path/);
    assert.match(quotesSource, /navigator\.clipboard\.writeText\(portalUrl\)/);
    assert.match(quotesSource, /onOpenPortal\(quote\)/);
    assert.match(quotesSource, /onCopyPortal\(quote\)/);
    assert.match(quotesSource, /aria-label="Acessar portal do cliente"/);
    assert.match(quotesSource, /aria-label="Copiar link do portal para o WhatsApp"/);
});

test('shares the current quote as a 1080 by 1350 client image', () => {
    assert.match(quotesSource, /exportClientJpg/);
    assert.match(quotesSource, /onExportJpg\(quote\)/);
    assert.match(quotesSource, /Compartilhar imagem 1080 por 1350/);
    assert.match(quotesSource, /Icons\.Share\}\<\/span\>Compartilhar/);
    assert.match(quotesSource, /SHARE_UNSUPPORTED/);
    assert.match(quotesSource, /prepareOnly: true/);
    assert.match(quotesSource, /preConfirm: async/);
    assert.match(quotesSource, /shareClientJpg\(prepared\)/);
});
