import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackingService } from '../services/trackingService';
import { appConfig, normalizeTrackingCode } from '../config/appConfig';

const Icons = {
    Search: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
};

const parsePortalInput = (value) => {
    const rawValue = String(value || '').trim();

    try {
        const parsedUrl = new URL(rawValue, window.location.origin);
        const portalIndex = parsedUrl.pathname.split('/').findIndex((part) => part === 'portal');
        const codeFromPath = portalIndex >= 0 ? parsedUrl.pathname.split('/')[portalIndex + 1] : '';

        if (codeFromPath) {
            return {
                code: normalizeTrackingCode(decodeURIComponent(codeFromPath)),
                token: parsedUrl.searchParams.get('token') || ''
            };
        }
    } catch {
        // Segue para o modo manual abaixo.
    }

    return { code: normalizeTrackingCode(rawValue), token: '' };
};

const showSearchError = async () => {
    const Swal = (await import('sweetalert2')).default;
    return Swal.fire({
        title: 'Pedido não encontrado',
        text: 'Confira o número do pedido ou cole o link completo recebido.',
        icon: 'error',
        confirmButtonColor: '#2563EB',
        confirmButtonText: 'Tentar Novamente'
    });
};

const PortalHome = () => {
    const [code, setCode] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!code.trim()) return;

        const { code: safeCode, token: portalToken } = parsePortalInput(code);

        setIsSearching(true);
        try {
            const response = portalToken
                ? await trackingService.getPortalOrder(safeCode, portalToken)
                : await trackingService.getPortalLink(safeCode);
            
            // ⭐ A CORREÇÃO: Validação rigorosa para forçar o erro se o pedido não existir
            if (!response || response.error || (response.data && response.data.error)) {
                throw new Error("Pedido não encontrado");
            }

            const encodedCode = encodeURIComponent(response.tracking_code || safeCode);
            navigate(response.portal_path || `/portal/${encodedCode}?token=${encodeURIComponent(portalToken)}`);
        } catch {
            await showSearchError();
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div style={styles.wrapper}>
            <style>{`
                * { box-sizing: border-box; }
                
                .login-card {
                    width: 100%;
                    max-width: 420px;
                    background-color: #FFFFFF;
                    padding: 40px 32px;
                    border-radius: 24px;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    transform: translateY(0);
                    transition: all 0.3s ease;
                    position: relative;
                    z-index: 10;
                }
                
                .premium-input-wrapper { position: relative; width: 100%; }
                
                .premium-input-login {
                    width: 100%;
                    padding: 18px 16px 18px 52px;
                    border-radius: 14px;
                    border: 2px solid #E2E8F0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: #0F172A;
                    outline: none;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    background-color: #F8FAFC;
                }
                
                .premium-input-login:focus {
                    border-color: #3B82F6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
                    background-color: #FFFFFF;
                }
                
                .premium-input-login::placeholder { 
                    color: #94A3B8; 
                    font-weight: 500; 
                    text-transform: none; 
                }
                
                .btn-acessar {
                    width: 100%;
                    padding: 18px;
                    background-color: #2563EB;
                    color: #FFFFFF;
                    border: none;
                    border-radius: 14px;
                    font-size: 1.1rem;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    margin-top: 8px;
                }
                
                .btn-acessar:hover:not(:disabled) {
                    background-color: #1D4ED8;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
                }
                
                .btn-acessar:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
                .btn-acessar:disabled { background-color: #94A3B8; cursor: not-allowed; box-shadow: none; opacity: 0.8; }
                
                @media (max-width: 480px) {
                    .login-card { padding: 32px 24px; border-radius: 20px; }
                }
            `}</style>

            <div className="login-card">
                <div style={styles.logoWrapper}>
                    <img 
                        src={appConfig.logoMediumUrl}
                        srcSet={`${appConfig.logoSmallUrl} 120w, ${appConfig.logoMediumUrl} 240w, ${appConfig.logoUrl} 580w`}
                        sizes="96px"
                        alt={appConfig.systemName}
                        width="240"
                        height="240"
                        decoding="async"
                        fetchPriority="high"
                        style={styles.logoImg} 
                        onError={(e) => { 
                            e.target.onerror = null; 
                            e.target.style.display = 'none'; 
                            e.target.parentNode.innerHTML = `<span style="color:#2563EB; font-weight:900; font-size:2rem; letter-spacing:1px;">${appConfig.orderPrefix}</span>`;
                            e.target.parentNode.style.backgroundColor = '#EFF6FF';
                            e.target.parentNode.style.borderRadius = '50%';
                        }}
                    />
                </div>
                
                <h1 style={styles.title}>Portal do Cliente</h1>
                <p style={styles.subtitle}>Digite o número do pedido ou cole o link recebido para acompanhar e enviar a lista de tamanhos.</p>

                <form onSubmit={handleSearch} style={styles.form}>
                    <div className="premium-input-wrapper">
                        <div style={styles.inputIcon}><Icons.Search /></div>
                        <input 
                            type="text" 
                            className="premium-input-login"
                            placeholder={`Ex: 7376 ou #${appConfig.orderPrefix}-7376`}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={isSearching}
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="btn-acessar" disabled={isSearching}>
                        {isSearching ? 'A procurar...' : 'Acessar Pedido'}
                    </button>
                </form>
            </div>

            <div style={styles.footer}>
                Tecnologia <strong style={{color: '#94A3B8'}}>{appConfig.systemName}</strong>
            </div>
        </div>
    );
};

const styles = {
    wrapper: { 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        minHeight: '100vh',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'radial-gradient(circle at center, #1E293B 0%, #0F172A 100%)', 
        padding: '24px', 
        fontFamily: "'Inter', sans-serif",
        zIndex: 9999, 
        overflowY: 'auto'
    },
    logoWrapper: { 
        width: '96px', 
        height: '96px', 
        margin: '0 auto 24px auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },
    logoImg: { 
        width: '96px',
        height: '96px',
        maxWidth: '100%', 
        maxHeight: '100%', 
        objectFit: 'contain' 
    },
    title: { 
        margin: '0 0 10px 0', 
        fontSize: '1.8rem', 
        fontWeight: '800', 
        color: '#0F172A', 
        letterSpacing: '-0.03em' 
    },
    subtitle: { 
        margin: '0 0 32px 0', 
        fontSize: '0.95rem', 
        color: '#64748B', 
        lineHeight: '1.5',
        fontWeight: '500'
    },
    form: { 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        width: '100%'
    },
    inputIcon: { 
        position: 'absolute', 
        left: '20px', 
        top: '50%', 
        transform: 'translateY(-50%)', 
        color: '#94A3B8', 
        display: 'flex', 
        alignItems: 'center',
        zIndex: 2
    },
    footer: { 
        marginTop: '40px', 
        color: '#475569', 
        fontSize: '0.85rem',
        fontWeight: '500',
        zIndex: 10
    }
};

export default PortalHome;
