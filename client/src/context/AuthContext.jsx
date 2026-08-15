import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

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

    // 1. Ao carregar a página, verifica se já existe sessão salva
    useEffect(() => {
        const loadStorageData = () => {
            try {
                const storedToken = sessionStorage.getItem('token');
                const storedUser = sessionStorage.getItem('user');

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                }
            } catch (error) {
                console.error("Erro ao carregar sessão:", error);
                sessionStorage.clear();
            } finally {
                setLoading(false); // Terminou de carregar
            }
        };

        loadStorageData();
    }, []);

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

    // 3. Função de Logout
    const logout = () => {
        console.log("Logout realizado.");
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        
        setToken(null);
        setUser(null);
        // Redireciona forçado para garantir limpeza
        window.location.href = '/login';
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