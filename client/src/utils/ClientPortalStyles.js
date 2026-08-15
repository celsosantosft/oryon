// src/utils/ClientPortalStyles.js

export const styles = {
    container: { width: '100%', maxWidth: '600px', margin: '0 auto', padding: '16px', paddingBottom: '120px', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", backgroundColor: '#F8FAFC', minHeight: '100vh' },
    loading: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontWeight: '600' },
    
    // ⭐ MENU INFERIOR (ILHA FLUTUANTE) ⭐
    bottomNav: { 
        position: 'fixed', bottom: 'calc(16px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '568px', backgroundColor: '#1A2B4C', display: 'flex', justifyContent: 'space-between', padding: '8px 4px', boxShadow: '0 10px 30px rgba(26, 43, 76, 0.3)', borderRadius: '24px', zIndex: 1000 
    },
    navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative', padding: '6px 0', WebkitTapHighlightColor: 'transparent' },
    navPill: { 
        position: 'absolute', top: '8px', bottom: '8px', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderTop: '1px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)', borderRadius: '16px', transition: 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' 
    },

    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', backdropFilter: 'blur(3px)' },
    modalContent: { width: '100%', maxWidth: '380px', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.85) 100%)', backdropFilter: 'saturate(150%) blur(24px)', WebkitBackdropFilter: 'saturate(150%) blur(24px)', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid rgba(255,255,255,0.8)', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #E2E8F0', paddingBottom: '16px', marginBottom: '16px' },
    modalCloseBtn: { background: '#F1F5F9', border: 'none', color: '#64748B', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' },

    header: { width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', backgroundColor: '#1A2B4C', padding: '24px', borderRadius: '24px', color: 'white', boxShadow: '0 10px 15px -3px rgba(26, 43, 76, 0.3)' },
    logoCircle: { width: '48px', height: '48px', backgroundColor: '#2563EB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 },
    title: { margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    subtitle: { margin: 0, fontSize: '0.9rem', color: '#9CA3AF', fontWeight: '500' },

    tabBody: { width: '100%', boxSizing: 'border-box', minHeight: '55vh', paddingBottom: '24px' },
    
    glassCard: { width: '100%', boxSizing: 'border-box', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(241, 245, 249, 0.6) 100%)', backdropFilter: 'saturate(150%) blur(24px)', WebkitBackdropFilter: 'saturate(150%) blur(24px)', borderRadius: '24px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)', border: '1px solid rgba(255, 255, 255, 0.8)' },
    cardPremium: { width: '100%', boxSizing: 'border-box', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(241, 245, 249, 0.6) 100%)', backdropFilter: 'saturate(150%) blur(24px)', WebkitBackdropFilter: 'saturate(150%) blur(24px)', borderRadius: '24px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)', border: '1px solid rgba(255, 255, 255, 0.8)' },

    glassBox: { background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.9)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    glassItemCard: { background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.6) 100%)', backdropFilter: 'saturate(150%) blur(16px)', WebkitBackdropFilter: 'saturate(150%) blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderLeft: '4px solid #10B981', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,1)' },
    lastAddedGlass: { background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(241, 245, 249, 0.6) 100%)', backdropFilter: 'saturate(150%) blur(20px)', WebkitBackdropFilter: 'saturate(150%) blur(20px)', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.05), inset 0 1px 0 rgba(255,255,255,1)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' },

    label: { display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' },
    
    // ⭐ FORÇANDO 16px NOS INPUTS PARA EVITAR ZOOM NO IPHONE ⭐
    input: { padding: '12px', borderRadius: '12px', border: '1px solid rgba(203, 213, 225, 0.6)', fontSize: '16px', fontWeight: '600', color: '#0F172A', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' },

    glassBtnBlue: { background: 'rgba(59, 130, 246, 0.1)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#2563EB', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    glassBtnRed: { background: 'rgba(239, 68, 68, 0.1)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

    timelineItem: { display: 'flex', gap: '16px', position: 'relative', paddingBottom: '28px' },
    timelineLine: (isCompleted) => ({ position: 'absolute', left: '19px', top: '40px', bottom: '0', width: '2px', backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.3)' : '#E2E8F0', zIndex: 0 }),
    timelineDotCompleted: { width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' },
    timelineDotCurrent: { width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.4)', boxShadow: '0 0 0 6px rgba(59, 130, 246, 0.1)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' },
    timelineDotPending: { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(241, 245, 249, 0.5)', border: '1px dashed rgba(203, 213, 225, 0.8)', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative', boxSizing: 'border-box' },
    timelineTextWrapper: { display: 'flex', flexDirection: 'column', paddingTop: '10px' },
    timelineTextCompleted: { fontSize: '0.95rem', fontWeight: '700', color: '#0F172A' },
    timelineTextCurrent: { fontSize: '1rem', fontWeight: '900', color: '#2563EB' },
    timelineTextPending: { fontSize: '0.95rem', fontWeight: '600', color: '#94A3B8' },

    cardTitle: { margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' },
    mockupImage: { width: '100%', height: 'auto', borderRadius: '12px', objectFit: 'contain', backgroundColor: 'rgba(0,0,0,0.02)' },
    noMockup: { padding: '32px', textAlign: 'center', color: '#94A3B8', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '12px', fontSize: '0.9rem' },
    receiptBox: { backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '24px', width: '100%', boxSizing: 'border-box' },
    receiptHeader: { display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', marginBottom: '4px' },
    receiptText: { fontSize: '0.8rem', color: '#065F46', lineHeight: '1.5', margin: 0 },
    infoAlert: { width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#1E40AF', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.85rem' },
    itemCount: { backgroundColor: 'rgba(255,255,255,0.8)', color: '#475569', border: '1px solid rgba(255,255,255,1)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    itemCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed rgba(203, 213, 225, 0.6)' },
    itemBadge: { padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }
};

export const injectGlobalStyles = () => {
    if (!document.getElementById('portal-global-styles')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'portal-global-styles';
        styleSheet.innerText = `
        /* ⭐ TRAVA EXTRA DE ZOOM NO CSS ⭐ */
        html { touch-action: manipulation; }
        body { overflow-y: scroll !important; }
        @media (max-width: 400px) { .tab-text { display: none; } }
        
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }

        /* ⭐ BOTAO PRIMARIO (AÇÃO FORTE - AZUL VIBRANTE) ⭐ */
        .btn-primary {
            background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 800;
            font-size: 0.95rem;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            box-sizing: border-box;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(37, 99, 235, 0.5);
            filter: brightness(1.05);
        }
        .btn-primary:active {
            transform: translateY(1px);
            box-shadow: 0 2px 10px rgba(37, 99, 235, 0.3);
        }

        /* ⭐ BOTAO SECUNDARIO AZUL (AGORA PARA O "ENVIAR LISTA") ⭐ */
        .btn-secondary {
            background: rgba(59, 130, 246, 0.08);
            color: #2563EB;
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 12px;
            font-weight: 800;
            font-size: 0.95rem;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            box-sizing: border-box;
        }
        .btn-secondary:hover:not(:disabled) {
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.15);
        }
        .btn-secondary:active:not(:disabled) {
            transform: translateY(1px);
            box-shadow: none;
        }
        .btn-secondary:disabled {
            background: #F8FAFC;
            color: #94A3B8;
            border: 1px solid #E2E8F0;
            cursor: default; 
            transform: none;
            box-shadow: none;
        }

        /* ⭐ NOVO BOTAO SECUNDARIO VERDE (PARA "ADICIONAR CAMISA") ⭐ */
        .btn-secondary-green {
            background: rgba(16, 185, 129, 0.08);
            color: #10B981;
            border: 1px solid rgba(16, 185, 129, 0.2);
            border-radius: 12px;
            font-weight: 800;
            font-size: 0.95rem;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            box-sizing: border-box;
        }
        .btn-secondary-green:hover:not(:disabled) {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.15);
        }
        .btn-secondary-green:active:not(:disabled) {
            transform: translateY(1px);
            box-shadow: none;
        }
        .btn-secondary-green:disabled {
            background: #F8FAFC;
            color: #94A3B8;
            border: 1px solid #E2E8F0;
            cursor: default; 
            transform: none;
            box-shadow: none;
        }

        /* ⭐ BOTAO APROVAR ARTE (AMBER VIBRANTE) ⭐ */
        .btn-amber {
            background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-weight: 800;
            font-size: 0.95rem;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            box-sizing: border-box;
        }
        .btn-amber:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(245, 158, 11, 0.5);
            filter: brightness(1.05);
        }
        .btn-amber:active {
            transform: translateY(1px);
            box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
        }
        `;
        document.head.appendChild(styleSheet);
    }
};