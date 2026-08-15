import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const fireSidebarAlert = async (...args) => {
    const Swal = (await import('sweetalert2')).default;
    return Swal.fire(...args);
};

// --- 1. COMPONENTE DE LINK NORMAL ---
const SidebarLink = ({ to, icon, label, onLinkClick, isBackLink = false }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = () => { if (onLinkClick) onLinkClick(); };

    const style = {
        display: 'flex', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', 
        width: '100%', borderRadius: '6px', marginBottom: '2px', whiteSpace: 'nowrap', 
        cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', transition: 'all 0.2s ease-in-out',
        backgroundColor: isActive ? '#2563eb' : (isHovered ? 'rgba(255, 255, 255, 0.05)' : 'transparent'),
        color: isActive || isHovered ? '#ffffff' : (isBackLink ? '#94A3B8' : '#94a3b8'),
        transform: isHovered && !isActive ? 'translateX(4px)' : 'translateX(0)',
        fontWeight: isActive ? '600' : '400',
        border: isBackLink ? '1px dashed #334155' : 'none',
        marginTop: isBackLink ? '16px' : '0'
    };

    return (
        <Link to={to} style={style} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onClick={handleClick}>
            <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.8 }}>{icon}</span><span>{label}</span>
        </Link>
    );
};

// --- 2. COMPONENTE DE BOTÃO DE AÇÃO (Para o Portal) ---
const SidebarActionBtn = ({ icon, label, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    const style = {
        display: 'flex', alignItems: 'center', padding: '12px 16px', textDecoration: 'none', 
        width: '100%', borderRadius: '6px', marginBottom: '2px', whiteSpace: 'nowrap', 
        cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', transition: 'all 0.2s ease-in-out',
        backgroundColor: isHovered ? 'rgba(56, 189, 248, 0.1)' : 'transparent', // Um azulzinho mais claro no hover
        color: isHovered ? '#38bdf8' : '#94a3b8',
        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
        fontWeight: '600', border: '1px dashed #334155', textAlign: 'left', outline: 'none'
    };

    return (
        <button style={style} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onClick={onClick}>
            <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center', opacity: isHovered ? 1 : 0.8 }}>{icon}</span><span>{label}</span>
        </button>
    );
};

// --- COMPONENTE PRINCIPAL SIDEBAR ---
const Sidebar = ({ setIsMenuOpen, isMobile }) => { 
    const { logout, user, token, API_BASE_URL } = useAuth();
    const location = useLocation();
    const userRole = user?.role || ''; 

    const isFinanceModule = location.pathname.startsWith('/finance');
    const handleLinkClick = () => { if (isMobile && setIsMenuOpen) setIsMenuOpen(false); };

    // ⭐ FUNÇÃO MÁGICA PARA ABRIR O PORTAL ⭐
    const handleOpenPortal = async () => {
        if (isMobile && setIsMenuOpen) setIsMenuOpen(false); // Fecha o menu no celular

        const { value: code } = await fireSidebarAlert({
            title: 'Portal do Cliente',
            text: 'Digite apenas o número do pedido ou o código completo:',
            input: 'text',
            inputPlaceholder: 'Ex: 6620 ou #ATOS-6620',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#2563EB',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Abrir Portal',
            cancelButtonText: 'Cancelar'
        });

        if (code) {
            let safeCode = code.trim().toUpperCase();
            
            // ⭐ INTELIGÊNCIA SUPREMA: Autocompleta se o admin digitar só os números
            if (/^\d+$/.test(safeCode)) {
                safeCode = `#ATOS-${safeCode}`;
            } else if (!safeCode.startsWith('#')) {
                safeCode = '#' + safeCode;
            }
            
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/portal-link/${encodeURIComponent(safeCode)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                window.open(response.data.portal_path, '_blank');
            } catch {
                fireSidebarAlert({
                    title: 'Portal não encontrado',
                    text: 'Confira o código informado e tente novamente.',
                    icon: 'error',
                    confirmButtonColor: '#2563EB'
                });
            }
        }
    };

    const Icons = {
        Dashboard: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
        Users: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        Orders: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
        Quote: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        Finance: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        Statement: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6M9 10h6M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
        Truck: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
        Box: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7L12 3 4 7l8 4 8-4zM4 17l8 4 8-4M4 12l8 4 8-4" /></svg>, 
        Client: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        Kanban: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
        Cutter: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 006 6h7" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 3a3 3 0 100 6 3 3 0 000-6zM6 15a3 3 0 100 6 3 3 0 000-6zM21 16l-9-4" /></svg>,
        Target: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, 
        Design: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
        Logout: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
        Close: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
        Back: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
        Settings: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        Chart: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
        Marketing: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5v1A2.5 2.5 0 005.5 15H8l4.8 3.2a1 1 0 001.55-.83V6.63a1 1 0 00-1.55-.83L8 9H5.5A2.5 2.5 0 003 11.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 9a5 5 0 010 6M17.5 7a8 8 0 010 10" /></svg>,
        Whatsapp: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19l1.2-3.4A8 8 0 1 1 9 18.2L5 19Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8.8c.3 3 2.1 4.8 5.2 5.7l1.1-1.4-2-1-1 1c-1.1-.5-1.9-1.3-2.4-2.4l1-1-1-2-1.4 1.1Z" /></svg>,
        PortalLink: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    };

    const mainConfig = [
        { to: "/", icon: Icons.Dashboard, label: "Painel de Controle", roles: ['admin', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/design", icon: Icons.Design, label: "Criação", roles: ['admin', 'designer'] }, 
        { to: "/production", icon: Icons.Kanban, label: "Produção", roles: ['admin', 'gerente_producao', 'gerente_operacoes'] },
        { to: "/corte", icon: Icons.Cutter, label: "Corte PCP", roles: ['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte'] },
        { to: "/clients", icon: Icons.Client, label: "Clientes", roles: ['admin', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/quotes", icon: Icons.Quote, label: "Orçamentos", roles: ['admin', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/products", icon: Icons.Box, label: "Produtos", roles: ['admin', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/orders", icon: Icons.Orders, label: "Pedidos", roles: ['admin', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/deliveries", icon: Icons.Truck, label: "Entregas da Semana", roles: ['admin', 'gerente_producao', 'gerente_operacoes'] },
        { to: "/whatsapp", icon: Icons.Whatsapp, label: "WhatsApp", roles: ['admin', 'gerente_vendas', 'gerente_operacoes'] },
        { to: "/finance/dashboard", icon: Icons.Finance, label: "Financeiro", roles: ['admin'] },
        { to: "/users", icon: Icons.Users, label: "Gestão de Usuários", roles: ['admin'] },
        { action: handleOpenPortal, icon: Icons.PortalLink, label: "Acessar Portal do Cliente", roles: ['admin', 'gerente_vendas', 'gerente_operacoes', 'designer'] }
    ];

    const financeConfig = [
        { to: "/finance/dashboard", icon: Icons.Chart, label: "Dashboard & DRE", roles: ['admin'] },
        { to: "/finance/transactions", icon: Icons.Finance, label: "Contas a Pagar/Receber", roles: ['admin'] },
        { to: "/finance/expenses", icon: Icons.Statement, label: "Relatório de Saídas", roles: ['admin'] },
        { to: "/finance/settings", icon: Icons.Settings, label: "Plano de Contas", roles: ['admin'] },
        { to: "/finance/marketing", icon: Icons.Marketing, label: "Marketing & Tráfego", roles: ['admin'] },
        { to: "/finance/goals", icon: Icons.Target, label: "Objetivos", roles: ['admin', 'gerente_operacoes'] }
    ];

    const activeMenu = isFinanceModule ? financeConfig : mainConfig;

    return (
        <aside style={styles.sidebar}>
            <style>
                {`
                    .hide-scrollbar::-webkit-scrollbar { display: none; }
                    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}
            </style>

            {isMobile && setIsMenuOpen && (
                <button onClick={() => setIsMenuOpen(false)} style={styles.closeBtnMobile} onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                    {Icons.Close}
                </button>
            )}

            <div style={styles.logoContainer}>
                <img src="/logo-white.png" alt="Logo" width="581" height="581" decoding="async" style={styles.logoImage} onError={(e) => { e.target.style.display = 'none'; document.getElementById('sidebar-logo-text').style.display = 'block'; }} />
                <h2 id="sidebar-logo-text" style={styles.logoText}>Atos System</h2>
                <span style={styles.systemSubtitle}>
                    {isFinanceModule ? 'MÓDULO FINANCEIRO' : (userRole === 'admin' ? 'ADMINISTRADOR' : (userRole === 'corte' ? 'CORTE' : 'GESTÃO'))}
                </span>
            </div>
            
            <nav style={styles.nav} className="hide-scrollbar">
                <ul style={styles.menu}>
                    {activeMenu.map((item, index) => {
                        if (item.roles.includes(userRole)) {
                            return (
                                <li key={index} style={styles.menuItem}>
                                    {item.to ? (
                                        <SidebarLink to={item.to} icon={item.icon} label={item.label} onLinkClick={handleLinkClick} />
                                    ) : (
                                        <div style={{ marginTop: '24px' }}> 
                                            <SidebarActionBtn icon={item.icon} label={item.label} onClick={item.action} />
                                        </div>
                                    )}
                                </li>
                            );
                        }
                        return null;
                    })}

                    {isFinanceModule && (
                        <li style={styles.menuItem}>
                            <SidebarLink to="/" icon={Icons.Back} label="Voltar ao ERP Principal" onLinkClick={handleLinkClick} isBackLink={true} />
                        </li>
                    )}
                </ul>
            </nav>

            <div style={styles.footer}>
                <button onClick={logout} style={styles.logoutButton}>
                    <span style={styles.icon}>{Icons.Logout}</span>Sair
                </button>
            </div>
        </aside>
    );
};

const styles = {
    sidebar: { position: 'relative', width: '280px', backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px 20px', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0, boxShadow: '1px 0 0 rgba(255,255,255,0.05)', fontFamily: "'Inter', sans-serif", userSelect: 'none', caretColor: 'transparent', outline: 'none' },
    closeBtnMobile: { position: 'absolute', top: '24px', right: '20px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', transition: 'color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    logoContainer: { marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '80px' },
    logoImage: { maxWidth: '180px', maxHeight: '60px', objectFit: 'contain', marginBottom: '4px' },
    logoText: { display: 'none', color: '#ffffff', fontSize: '1.25rem', letterSpacing: '1px', margin: '0 0 5px 0', fontWeight: '800' },
    systemSubtitle: { color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600' },
    nav: { flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }, 
    menu: { listStyle: 'none', padding: 0, margin: 0 },
    menuItem: { marginBottom: '0px' },
    footer: { borderTop: '1px solid #1e293b', paddingTop: '16px', marginTop: 'auto' },
    icon: { marginRight: '12px', display: 'flex', alignItems: 'center' },
    logoutButton: { width: '100%', padding: '12px 16px', backgroundColor: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', fontSize: '0.9rem', fontFamily: "'Inter', sans-serif" }
};

export default Sidebar;
