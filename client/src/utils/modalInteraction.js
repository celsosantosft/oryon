export function shouldCloseFromOverlayPointer(overlayElement, pointerDownTarget, pointerUpTarget) {
    return Boolean(
        overlayElement
        && pointerDownTarget === overlayElement
        && pointerUpTarget === overlayElement
    );
}
