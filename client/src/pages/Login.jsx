import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    // Estados de Dados
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Estados de Visual
    const [focusedField, setFocusedField] = useState(null); 
    const [btnHover, setBtnHover] = useState(false);

    const { login, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    // --- FUNÇÃO DE AJUDA PARA LER O CARGO ---
    // Transforma cargos complexos em strings simples para o código entender
    const normalizeRole = (roleName) => {
        if (!roleName) return 'guest';
        return roleName
            .toLowerCase() // Tudo minúsculo
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Tira acentos
            .replace(/\s+/g, '_'); // Troca espaço por underline
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. CHAMADA REAL AO SEU BANCO DE DADOS
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'Email ou senha incorretos.');
            }

            const { token, user } = data;
            if (!token || !user) {
                throw new Error('Resposta de login inválida.');
            }

            // Debug: Ver no console o que veio do banco
            console.log("Usuário vindo do banco:", user);
            console.log("Cargo original:", user.role);

            // 2. CORRIGE O FORMATO DO CARGO
            let safeRole = user.role;
            const normalized = normalizeRole(user.role);
            
            // Verifica variações comuns e força o padrão do sistema
            if (normalized.includes('admin')) safeRole = 'admin';
            else if (normalized.includes('producao')) safeRole = 'gerente_producao';
            else if (normalized.includes('operacoes') || normalized.includes('geral')) safeRole = 'gerente_operacoes';
            // ⭐ ADICIONADA A VERIFICAÇÃO PARA O DESIGNER ⭐
            else if (normalized.includes('design') || normalized.includes('arte') || normalized.includes('criacao')) safeRole = 'designer';
            else if (normalized.includes('corte')) safeRole = 'corte';

            // Atualiza o usuário com o cargo padronizado para o frontend
            const userWithSafeRole = { ...user, role: safeRole };

            // 3. SALVA NO SISTEMA
            await login(token, userWithSafeRole);

            // 4. ⭐ REDIRECIONAMENTO INTELIGENTE POR CARGO ⭐
            if (safeRole === 'designer') {
                navigate('/design'); // Manda o Designer direto pro Painel de Criação
            } else if (safeRole === 'gerente_producao') {
                navigate('/production'); // Manda a Produção pro Kanban Deles
            } else if (safeRole === 'corte') {
                navigate('/corte'); // Manda o cortador direto para sua bancada
            } else {
                navigate('/'); // Manda o Admin ou outros para o Dashboard Central
            }

        } catch (err) {
            console.error("Erro no login:", err);
            setError(err.message || 'Email ou senha incorretos.');
        } finally {
            setLoading(false);
        }
    };

    // Estilos auxiliares
    const getInputStyle = (fieldName) => ({
        ...styles.input,
        ...(focusedField === fieldName ? styles.inputFocus : {})
    });

    const getButtonStyle = () => ({
        ...styles.button,
        ...(btnHover && !loading ? styles.buttonHover : {}),
        ...(loading ? styles.buttonDisabled : {})
    });

    return (
        <div style={styles.container}>
            <div style={styles.glowEffect}></div>
            <div style={styles.card}>
                <div style={styles.logoHeader}>
                    <div style={styles.logoFrame}>
                        <img 
                            src="/logo-240.png" 
                            srcSet="/logo-120.png 120w, /logo-240.png 240w, /logo.png 580w"
                            sizes="120px"
                            alt="Logo" 
                            width="240"
                            height="240"
                            decoding="async"
                            fetchPriority="high"
                            style={styles.logo} 
                            onError={(e) => { e.target.style.display='none'; document.getElementById('fallback').style.display='block'; }}
                        />
                    </div>
                    <h2 id="fallback" style={styles.titleFallback}>atos ERP</h2>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>E-mail Corporativo</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            style={getInputStyle('email')}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            required 
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Senha</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            style={getInputStyle('password')}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            required 
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={getButtonStyle()}
                        onMouseEnter={() => setBtnHover(true)}
                        onMouseLeave={() => setBtnHover(false)}
                        disabled={loading}
                    >
                        {loading ? 'ACESSANDO...' : 'ENTRAR NO SISTEMA'}
                    </button>
                </form>
                
                <div style={styles.footer}>
                    &copy; 2026 Atos Systems
                </div>
            </div>
        </div>
    );
};

// --- ESTILOS ORIGINAIS ---
const styles = {
    container: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, #091A2D 0%, #0D1F33 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", zIndex: 1 },
    glowEffect: { position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(0,0,0,0) 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: -1, pointerEvents: 'none' },
    card: { backgroundColor: '#ffffff', padding: '48px 40px', borderRadius: '16px', boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.3), 0 10px 20px -5px rgba(0, 0, 0, 0.2)', width: '100%', maxWidth: '420px', boxSizing: 'border-box', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
    logoHeader: { display: 'grid', placeItems: 'center', width: '100%', textAlign: 'center', marginBottom: '32px' },
    logoFrame: { width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' },
    logo: { display: 'block', width: '120px', height: '120px', maxWidth: '100%', objectFit: 'contain', objectPosition: 'center', margin: 0 },
    titleFallback: { display: 'none', color: '#0f172a', fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px', margin: 0 },
    form: { display: 'flex', flexDirection: 'column', gap: '24px' },
    inputGroup: { textAlign: 'left' },
    label: { display: 'block', marginBottom: '8px', color: '#334155', fontWeight: '600', fontSize: '0.875rem' },
    input: { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', color: '#0f172a', backgroundColor: '#F8FAFC', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' },
    inputFocus: { borderColor: '#3B82F6', backgroundColor: '#FFFFFF', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' },
    button: { width: '100%', padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', marginTop: '12px', letterSpacing: '0.5px', transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' },
    buttonHover: { backgroundColor: '#1D4ED8', transform: 'translateY(-1px)', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)' },
    buttonDisabled: { opacity: 0.7, cursor: 'not-allowed', transform: 'none' },
    error: { backgroundColor: '#FEF2F2', color: '#B91C1C', padding: '12px', borderRadius: '8px', fontSize: '0.875rem', textAlign: 'center', border: '1px solid #FECACA', fontWeight: '500', marginBottom: '20px' },
    footer: { marginTop: '40px', borderTop: '1px solid #F1F5F9', paddingTop: '24px', fontSize: '0.75rem', color: '#64748B', textAlign: 'center', fontWeight: '500' }
};

export default Login;
