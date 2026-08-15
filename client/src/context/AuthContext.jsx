import React, { createContext, useCallback, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();
const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.';
const AUTH_NOTICE_KEY = 'auth_notice';

const getTokenExpirationTime = (jwtToken) => {
    try {
        const payload = jwtToken?.split('.')[1];
        if (!payload) return null;

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        const decodedPayload = JSON.parse(window.atob(paddedBase64));

        return typeof decodedPayload.exp === 'number' ? decodedPayload.exp * 1000 : null;
    } catch (error) {
        console.error('Erro ao ler validade da sessão:', error);
        return null;
    }
};

const isTokenExpired = (jwtToken) => {
    const expirationTime = getTokenExpirationTime(jwtToken);
    return !expirationTime || Date.now() >= expirationTime;
};

export const AuthProvider = ({ children }) => {
    // Estados iniciais nulos
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- LÓGICA DE NOTIFICAÇÃO ---
    const [notification, setNotification] = useState(null); 

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        // Faz a notificação sumir após 3 segundos
        setTimeout(() => {
            setNotification(null);
        }, 3000);
    };
    // ------------------------------------------

    // Endereço do Backend
    const API_BASE_URL = 'https://atosfardamentos.com.br/api';

    const clearSession = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    };

    // 3. Função de Logout
    const logout = useCallback((message = '') => {
        console.log("Logout realizado.");
        clearSession();

        if (message) {
            sessionStorage.setItem(AUTH_NOTICE_KEY, message);
        }

        setToken(null);
        setUser(null);
        // Redireciona forçado para garantir limpeza
        window.location.href = '/login';
    }, []);

    // 1. Ao carregar a página, verifica se já existe sessão salva
    useEffect(() => {
        const loadStorageData = () => {
            try {
                const storedToken = sessionStorage.getItem('token');
                const storedUser = sessionStorage.getItem('user');

                if (storedToken && storedUser) {
                    if (isTokenExpired(storedToken)) {
                        clearSession();
                        sessionStorage.setItem(AUTH_NOTICE_KEY, SESSION_EXPIRED_MESSAGE);
                    } else {
                        setToken(storedToken);
                        setUser(JSON.parse(storedUser));
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar sessão:", error);
                clearSession();
            } finally {
                setLoading(false); // Terminou de carregar
            }
        };

        loadStorageData();
    }, []);

    useEffect(() => {
        if (!token) return undefined;

        const checkSessionExpiration = () => {
            if (isTokenExpired(token)) {
                logout(SESSION_EXPIRED_MESSAGE);
            }
        };

        checkSessionExpiration();

        const expirationTime = getTokenExpirationTime(token);
        const timeUntilExpiration = expirationTime ? Math.max(expirationTime - Date.now(), 0) : 0;
        const expirationTimer = window.setTimeout(checkSessionExpiration, timeUntilExpiration);

        window.addEventListener('focus', checkSessionExpiration);
        document.addEventListener('visibilitychange', checkSessionExpiration);

        return () => {
            window.clearTimeout(expirationTimer);
            window.removeEventListener('focus', checkSessionExpiration);
            document.removeEventListener('visibilitychange', checkSessionExpiration);
        };
    }, [token, logout]);

    useEffect(() => {
        if (!token) return undefined;

        let isMounted = true;
        let axiosInstance = null;
        let interceptorId = null;

        import('axios').then(({ default: axios }) => {
            if (!isMounted) return;

            axiosInstance = axios;
            interceptorId = axios.interceptors.response.use(
                response => response,
                error => {
                    const status = error.response?.status;
                    const message = String(error.response?.data?.message || error.response?.data?.error || '').toLowerCase();
                    const hasActiveSession = Boolean(sessionStorage.getItem('token'));
                    const isAuthProblem = status === 401 || message.includes('token') || message.includes('jwt');

                    if (hasActiveSession && isAuthProblem) {
                        logout(SESSION_EXPIRED_MESSAGE);
                    }

                    return Promise.reject(error);
                }
            );
        });

        return () => {
            isMounted = false;
            if (axiosInstance && interceptorId !== null) {
                axiosInstance.interceptors.response.eject(interceptorId);
            }
        };
    }, [token, logout]);

    // 2. Função de Login
    const login = (newToken, userData) => {
        console.log("Login realizado:", userData);
        
        try {
            sessionStorage.setItem('token', newToken);
            sessionStorage.setItem('user', JSON.stringify(userData));
            
            setToken(newToken);
            setUser(userData);
        } catch (error) {
            console.error("Erro ao salvar login:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            authenticated: !!token, // Helper para saber se está logado (true/false)
            user, 
            token, 
            login, 
            logout, 
            loading, 
            API_BASE_URL, 
            notification, 
            showNotification 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
