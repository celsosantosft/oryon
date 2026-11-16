import React, { useEffect, useId, useRef } from 'react';
import { shouldCloseFromOverlayPointer } from '../utils/modalInteraction';

const Modal = ({ isOpen, onClose, title, children, manageFocus = false }) => {
    const overlayPointerDownTarget = useRef(null);
    const cardRef = useRef(null);
    const titleId = useId();

    useEffect(() => {
        if (!isOpen || !manageFocus) return;
        const previous = document.activeElement;
        const card = cardRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        card.focus({ preventScroll: true });

        const containFocus = (event) => {
            if (event.key !== 'Tab' || document.querySelector('.swal2-container')) return;
            const controls = Array.from(card.querySelectorAll(
                'button, input, textarea, select, a[href], [tabindex]'
            )).filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
            const edge = event.shiftKey ? controls.at(-1) : controls[0];
            const opposite = event.shiftKey ? controls[0] : controls.at(-1);
            if (!edge || !card.contains(document.activeElement) || document.activeElement === opposite ||
                (event.shiftKey && document.activeElement === card)) {
                event.preventDefault();
                (edge || card).focus();
            }
        };
        document.addEventListener('keydown', containFocus);
        return () => {
            document.removeEventListener('keydown', containFocus);
            document.body.style.overflow = previousOverflow;
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, [isOpen, manageFocus]);
    
    // --- LÓGICA DO ESC E SCROLL ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && (!manageFocus || !document.querySelector('.swal2-container'))) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            if (!manageFocus) document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (!manageFocus) document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, manageFocus]);
    // -----------------------------

    if (!isOpen) return null;

    const handleOverlayPointerDown = (event) => {
        overlayPointerDownTarget.current = event.target;
    };

    const handleOverlayPointerUp = (event) => {
        if (shouldCloseFromOverlayPointer(event.currentTarget, overlayPointerDownTarget.current, event.target)) {
            onClose();
        }
        overlayPointerDownTarget.current = null;
    };

    return (
        <div
            className="oryon-modal-overlay"
            style={styles.overlay}
            onPointerDown={handleOverlayPointerDown}
            onPointerUp={handleOverlayPointerUp}
        >
            <div className="oryon-modal-card" style={styles.modal} ref={cardRef} role={manageFocus ? "dialog" : undefined} aria-modal={manageFocus || undefined} aria-labelledby={manageFocus ? titleId : undefined} tabIndex={manageFocus ? -1 : undefined}>
                
                {/* Cabeçalho */}
                <div className="oryon-modal-header" style={styles.header}>
                    <h3 id={manageFocus ? titleId : undefined} className="oryon-modal-title" style={styles.title}>{title}</h3>
                    <button onClick={onClose} style={styles.closeButton} title="Fechar (ESC)">
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="oryon-modal-body" style={styles.content}>
                    {children} 
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '16px',          // mais moderno e “premium”
        width: '100%',
        maxWidth: '820px',             // AQUI: mais largo para formulários profissionais
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
    },
    title: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#0f172a'
    },
    closeButton: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#64748b',
        padding: '4px',
        borderRadius: '4px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    content: {
        padding: '24px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1
    }
};

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    @keyframes fadeIn { 
        from { opacity: 0; } 
        to { opacity: 1; } 
    }
    @keyframes slideUp { 
        from { opacity: 0; transform: translateY(20px) scale(0.95); } 
        to { opacity: 1; transform: translateY(0) scale(1); } 
    }

    @media (max-width: 640px) {
        .oryon-modal-overlay {
            align-items: flex-end !important;
            padding: 8px !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
        }

        .oryon-modal-card {
            max-height: calc(100dvh - 16px) !important;
            border-radius: 16px 16px 0 0 !important;
            max-width: none !important;
        }

        .oryon-modal-header {
            padding: 16px !important;
        }

        .oryon-modal-title {
            font-size: 1.05rem !important;
            line-height: 1.25 !important;
        }

        .oryon-modal-body {
            padding: 16px !important;
        }
    }
`;
document.head.appendChild(styleSheet);

export default Modal;
