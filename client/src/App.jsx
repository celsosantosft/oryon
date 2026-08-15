import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './context/AuthContext';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Users = lazy(() => import('./pages/Users'));
const Orders = lazy(() => import('./pages/Orders'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Reports = lazy(() => import('./pages/Reports'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WeeklyDeliveries = lazy(() => import('./pages/WeeklyDeliveries'));
const Products = lazy(() => import('./pages/Products'));
const Clients = lazy(() => import('./pages/Clients'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
const DesignDashboard = lazy(() => import('./pages/DesignDashboard'));
const CutterDashboard = lazy(() => import('./pages/CutterDashboard'));
const Goals = lazy(() => import('./pages/Goals'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
const FinanceTransactions = lazy(() => import('./pages/FinanceTransactions'));
const FinanceExpenseReport = lazy(() => import('./pages/FinanceExpenseReport'));
const FinanceSettings = lazy(() => import('./pages/FinanceSettings'));
const FinanceMarketing = lazy(() => import('./pages/FinanceMarketing'));
const WhatsappDashboard = lazy(() => import('./pages/WhatsappDashboard'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const PortalHome = lazy(() => import('./pages/PortalHome'));

const getRouteFallbackStyle = () => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const useDarkShell = pathname === '/login' || pathname.startsWith('/portal');

    return {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: useDarkShell ? 'linear-gradient(135deg, #091A2D 0%, #0D1F33 100%)' : '#f8fafc',
        color: useDarkShell ? '#e2e8f0' : '#1e293b',
        fontWeight: 700
    };
};

const RouteFallback = () => (
    <div style={getRouteFallbackStyle()}>
        Carregando...
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { token, loading } = useAuth();
    if (loading) return null; 
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const SmartHomeRoute = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === 'designer') return <Navigate to="/design" replace />;
    if (user.role === 'gerente_producao') return <Navigate to="/production" replace />;
    if (String(user.role || '').toLowerCase() === 'corte') return <Navigate to="/corte" replace />;
    return <Dashboard />;
};

const CutterRoute = ({ children }) => {
    const { user } = useAuth();
    const allowedRoles = ['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte'];
    const role = String(user?.role || '').toLowerCase();

    if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
    return children;
};

function App() {
    return (
        <Suspense fallback={<RouteFallback />}>
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/portal" element={<PortalHome />} />
                <Route path="/portal/:code" element={<ClientPortal />} />

                <Route path="/whatsapp" element={
                    <ProtectedRoute>
                        <WhatsappDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/*" element={
                    <ProtectedRoute>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<SmartHomeRoute />} />
                                
                                <Route path="/users" element={<Users />} />
                                <Route path="/orders" element={<Orders />} />
                                <Route path="/quotes" element={<Quotes />} /> 
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/deliveries" element={<WeeklyDeliveries />} />
                                <Route path="/products" element={<Products />} /> 
                                <Route path="/clients" element={<Clients />} />
                                <Route path="/design" element={<DesignDashboard />} />
                                <Route path="/production" element={<ProductionDashboard />} />
                                <Route path="/corte" element={
                                    <CutterRoute>
                                        <CutterDashboard />
                                    </CutterRoute>
                                } />

                                <Route path="/finance/dashboard" element={<FinanceDashboard />} />
                                <Route path="/finance/transactions" element={<FinanceTransactions />} />
                                <Route path="/finance/expenses" element={<FinanceExpenseReport />} />
                                <Route path="/finance/settings" element={<FinanceSettings />} />
                                <Route path="/finance/marketing" element={<FinanceMarketing />} />
                                
                                <Route path="/goals" element={<Navigate to="/finance/goals" replace />} />
                                <Route path="/finance/goals" element={<Goals />} />
                                
                                <Route path="/finance" element={<Navigate to="/finance/dashboard" replace />} />

                                <Route path="*" element={<h1 style={{ textAlign: 'center', marginTop: '50px', color: '#64748B' }}>404 | Módulo não encontrado</h1>} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
