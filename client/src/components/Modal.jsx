import React, { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
    
    // --- LÓGICA DO ESC E SCROLL ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden'; 
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset'; 
        };
    }, [isOpen, onClose]);
    // -----------------------------

    if (!isOpen) return null;

    return (
        // O clique no overlay (fundo escuro) fecha o modal
        <div style={styles.overlay} onClick={onClose}>
            {/* O clique dentro do modal NÃO fecha (stopPropagation) */}
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                
                {/* Cabeçalho */}
                <div style={styles.header}>
                    <h3 style={styles.title}>{title}</h3>
                    <button onClick={onClose} style={styles.closeButton} title="Fechar (ESC)">
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                {/* Conteúdo */}
                <div style={styles.content}>
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
        maxHeight: '90vh',
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
`;
document.head.appendChild(styleSheet);

export default Modal;
