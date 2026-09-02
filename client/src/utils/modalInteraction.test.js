import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldCloseFromOverlayPointer } from './modalInteraction.js';

test('closes only when pointer starts and ends on the overlay', () => {
    const overlay = { id: 'overlay' };
    const modal = { id: 'modal' };

    assert.equal(shouldCloseFromOverlayPointer(overlay, overlay, overlay), true);
    assert.equal(shouldCloseFromOverlayPointer(overlay, modal, overlay), false);
    assert.equal(shouldCloseFromOverlayPointer(overlay, overlay, modal), false);
});
