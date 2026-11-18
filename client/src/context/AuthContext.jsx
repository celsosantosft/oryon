import React, { createContext, useCallback, useState, useEffect, useContext } from 'react';
import { resolveApiBaseUrl } from '../config/appConfig';
import {
    AUTH_API_BASE_URL_KEY,
    AUTH_NOTICE_KEY,
    INACTIVITY_EXPIRED_MESSAGE,
    LAST_ACTIVITY_KEY,
    SESSION_EXPIRED_MESSAGE,
    handleSessionActivity,
    isInactiveSessionExpired
} from './authSession';

const AuthContext = createContext();

const isLocalDevHost = (hostname) => (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
);

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
    const API_BASE_URL = resolveApiBaseUrl();

    const clearSession = () => {
        ['token', 'user', AUTH_API_BASE_URL_KEY, LAST_ACTIVITY_KEY].forEach((key) => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
    };

    // 3. Função de Logout
    const logout = useCallback((message = '') => {
        console.log("Logout realizado.");
        clearSession();

        if (message) {
            localStorage.setItem(AUTH_NOTICE_KEY, message);
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
                if (!localStorage.getItem('token') && sessionStorage.getItem('token')) {
                    ['token', 'user', AUTH_API_BASE_URL_KEY, LAST_ACTIVITY_KEY].forEach((key) => {
                        const value = sessionStorage.getItem(key);
                        if (value !== null) localStorage.setItem(key, value);
                    });
                }

                const storedToken = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');
                const storedApiBaseUrl = localStorage.getItem(AUTH_API_BASE_URL_KEY);
                const storedLastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
                const lastActivity = storedLastActivity === null ? Date.now() : Number(storedLastActivity);
                if (storedLastActivity === null) {
                    localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
                }

                if (storedToken && storedUser) {
                    const isLocalHost = typeof window !== 'undefined' && isLocalDevHost(window.location.hostname);
                    const sessionFromDifferentApi = storedApiBaseUrl && storedApiBaseUrl !== API_BASE_URL;
                    const legacyLocalSession = isLocalHost && !storedApiBaseUrl;

                    if (sessionFromDifferentApi || legacyLocalSession) {
                        clearSession();
                        localStorage.setItem(AUTH_NOTICE_KEY, 'Sua sessão era de outro servidor. Faça login novamente neste ambiente.');
                    } else if (isTokenExpired(storedToken)) {
                        clearSession();
                        localStorage.setItem(AUTH_NOTICE_KEY, SESSION_EXPIRED_MESSAGE);
                    } else if (isInactiveSessionExpired(lastActivity)) {
                        clearSession();
                        localStorage.setItem(AUTH_NOTICE_KEY, INACTIVITY_EXPIRED_MESSAGE);
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
        const syncAuthBetweenTabs = (event) => {
            if (event.storageArea !== localStorage || !['token', 'user'].includes(event.key)) return;

            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (!storedToken || !storedUser) {
                setToken(null);
                setUser(null);
                if (window.location.pathname !== '/login') window.location.replace('/login');
                return;
            }

            if (!isTokenExpired(storedToken)) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                if (window.location.pathname === '/login') window.location.replace('/');
            }
        };

        window.addEventListener('storage', syncAuthBetweenTabs);
        return () => window.removeEventListener('storage', syncAuthBetweenTabs);
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

        const recordActivity = (event) => {
            if (!localStorage.getItem('token')) return;

            const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
            handleSessionActivity({
                event,
                lastActivityTime: lastActivity,
                onExpired: () => logout(INACTIVITY_EXPIRED_MESSAGE),
                onActive: () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
            });
        };

        if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }

        const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
        const listenerOptions = { capture: true };
        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, recordActivity, listenerOptions);
        });

        return () => {
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, recordActivity, listenerOptions);
            });
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
                    const hasActiveSession = Boolean(localStorage.getItem('token'));
                    const isAuthProblem = status === 401 || message.includes('token') || message.includes('jwt');

                    if (hasActiveSession && isAuthProblem) {
                        logout(status === 403 ? 'Sessão inválida neste servidor. Faça login novamente.' : SESSION_EXPIRED_MESSAGE);
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
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem(AUTH_API_BASE_URL_KEY, API_BASE_URL);
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
            
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
