import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom'; // <--- IMPORTANTE: Adicionado para detectar a rota
import Sidebar from './Sidebar';
import '../styles/dashboard-preview.css';

// Componente de Notificação
const Notification = ({ message, type }) => {
    const notificationStyle = {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: type === 'error' ? '#EF4444' : '#10B981',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        zIndex: 2000, 
        fontWeight: '600',
        animation: 'fadeIn 0.3s ease-out'
    };

    return (
        <div style={notificationStyle}>
            {message}
        </div>
    );
};

// Ícones Mobile / Toggle
const MenuIcon = <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CloseIcon = <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

const Layout = ({ children }) => {
    const { user, notification } = useAuth();
    const location = useLocation(); // Hook para saber a rota atual
    
    // 1. Estados
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const preview = location.pathname === '/visao';
    const drawerOpen = preview && isMobile && isMenuOpen;
    const drawer = useRef(null);
    const menuTrigger = useRef(null);

    useEffect(() => {
        if (drawerOpen) drawer.current?.querySelector('button')?.focus();
    }, [drawerOpen]);

    const closePreviewMenu = () => {
        setIsMenuOpen(false);
        requestAnimationFrame(() => menuTrigger.current?.focus());
    };

    const handleDrawerKey = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePreviewMenu();
        }
        if (event.key !== 'Tab') return;
        const controls = drawer.current.querySelectorAll('button, a[href]');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && event.target === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && event.target === last) {
            event.preventDefault();
            first.focus();
        }
    };

    // Verifica se estamos em uma página de foco, com a sidebar principal recolhida.
    const isFocusMode = location.pathname === '/production'
        || location.pathname === '/whatsapp'
        || location.pathname === '/corte'
        || location.pathname === '/corte-preview';

    // Lógica para fechar o menu automaticamente ao entrar em modo foco.
    useEffect(() => {
        if (isFocusMode) {
            setIsMenuOpen(false);
        }
    }, [location.pathname]); // Executa toda vez que muda de rota

    // Efeito de Resize
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1000;
            setIsMobile(mobile);
            
            // Se passar de mobile para desktop, fecha o menu (reset)
            if (!mobile && isMenuOpen) {
                setIsMenuOpen(false); 
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMenuOpen]);

    // --- LÓGICA VISUAL DA SIDEBAR ---
    // No desktop, ela deve sumir (width: 0) se estiver em FocusMode e o menu não estiver aberto manualmente.
    const isSidebarVisible = isMobile 
        ? true // No mobile, a visibilidade é controlada pelo transform translateX, então a largura base mantém-se
        : (!isFocusMode || isMenuOpen); // No desktop: visível se NÃO for modo foco, OU se usuário abriu.

    const sidebarStyle = {
        ...styles.sidebarBase,
        position: isMobile ? 'fixed' : 'relative',
        left: 0,
        top: 0,
        height: '100dvh',
        // Mágica do Desktop: Se for para esconder, largura vira 0. Se não, 280px.
        width: isMobile ? 'min(86vw, 320px)' : (isSidebarVisible ? '280px' : '0px'),
        overflow: 'hidden', // Importante para o conteúdo não vazar quando width for 0
        
        // Transformação apenas para mobile
        transform: isMobile 
            ? (!isMenuOpen ? 'translateX(-100%)' : 'translateX(0)') 
            : 'none',
            
        transition: 'width 0.25s ease-out, transform 0.25s ease-out',
        zIndex: 100
    };

    return (
        <div style={styles.container} className={preview ? 'dashboard-preview' : undefined}>
            
            {notification && <Notification message={notification.message} type={notification.type} />}

            {/* 1. SIDEBAR */}
            <div style={sidebarStyle} ref={drawer} className={preview ? 'dashboard-preview-drawer' : undefined}
                id={preview ? 'dashboard-preview-menu' : undefined} inert={preview && isMobile && !drawerOpen ? true : undefined}
                role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined}
                aria-label={drawerOpen ? 'Menu lateral' : undefined} onKeyDown={drawerOpen ? handleDrawerKey : undefined}>
                <Sidebar setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} preview={preview} onClose={closePreviewMenu} />
            </div>
            
            {/* 1b. Overlay em Mobile */}
            {isMobile && isMenuOpen && (
                <div style={styles.mobileOverlay} onClick={preview ? closePreviewMenu : () => setIsMenuOpen(false)} />
            )}

            {/* 2. ÁREA DE CONTEÚDO */}
            <main style={styles.mainContent} inert={drawerOpen || undefined}>
                
                {/* Barra de Topo */}
                <header className={preview ? 'dashboard-preview-topbar' : undefined} style={{ ...styles.topBar, ...(isMobile ? styles.topBarMobile : {}) }}>
                    
                    {/* Botão Hamburguer: Aparece no Mobile OU se estiver no Modo Foco Desktop Fechado */}
                    {(isMobile || (isFocusMode && !isMenuOpen)) && (
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ ...styles.menuButton, ...(isMobile ? styles.menuButtonMobile : {}) }} ref={menuTrigger}
                            className={preview ? 'dashboard-preview-toggle' : undefined}
                            aria-label={isMenuOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
                            aria-expanded={isMenuOpen}
                            aria-controls={preview ? 'dashboard-preview-menu' : undefined}>
                            {isMenuOpen ? CloseIcon : MenuIcon}
                        </button>
                    )}

                    <div style={{...styles.userInfo, ...(isMobile ? styles.userInfoMobile : {}), marginLeft: 'auto'}}>
                        <span style={{ ...styles.userRole, ...(isMobile ? styles.userRoleMobile : {}) }}>{user?.role === 'admin' ? 'ADMINISTRADOR' : (user?.role === 'corte' ? 'CORTE' : 'COLABORADOR')}</span>
                        <span style={{ ...styles.userName, ...(isMobile ? styles.userNameMobile : {}) }}>{user?.name}</span>
                    </div>
                </header>

                {/* Conteúdo da Página */}
                <div style={styles.pageScrollArea}>
                    <div style={{ ...styles.pageContent, ...(isMobile ? styles.pageContentMobile : {}) }}>
                        {children}
                    </div>
                </div>

            </main>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        height: '100dvh',
        width: '100vw',
        backgroundColor: '#f8fafc', 
        overflow: 'hidden'
    },

    sidebarBase: {
        flexShrink: 0, 
        zIndex: 10,
        backgroundColor: '#0f172a', // Garante fundo escuro durante a transição
        whiteSpace: 'nowrap' // Evita que texto quebre feio na animação
    },

    mainContent: {
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0 
    },

    topBar: {
        height: '64px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px', 
        flexShrink: 0 
    },

    topBarMobile: {
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        padding: 'env(safe-area-inset-top, 0px) max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px))',
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)'
    },

    menuButton: {
        background: 'none',
        border: 'none',
        color: '#0f172a',
        cursor: 'pointer',
        padding: '8px',
        marginRight: '16px', // Espaço entre botão e o resto
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },

    menuButtonMobile: {
        minWidth: '44px',
        minHeight: '44px',
        touchAction: 'manipulation'
    },

    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        lineHeight: '1.2'
    },

    userInfoMobile: {
        maxWidth: '58vw'
    },
    
    userName: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#0f172a'
    },

    userNameMobile: {
        fontSize: '0.82rem',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    
    userRole: {
        fontSize: '0.7rem',
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: '0.5px'
    },

    userRoleMobile: {
        fontSize: '0.62rem',
        letterSpacing: '0.3px'
    },

    pageScrollArea: {
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden'
    },

    pageContent: {
        padding: '20px', 
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%'
    },

    pageContentMobile: {
        padding: '12px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
    },
    
    mobileOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50
    }
};

export default Layout;
