import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

const GOALS_STORAGE_KEY = 'production_goals';
const OBJECTIVES_STORAGE_KEY = 'oryon_objectives_v2';

const THEME = {
    background: '#EEF4FF',
    card: '#FFFFFF',
    border: '#D9E2F2',
    text: {
        primary: '#0F172A',
        secondary: '#475569',
        muted: '#94A3B8'
    }
};

const OBJECTIVE_COLORS = ['#0EA5E9', '#9333EA', '#65A30D', '#F97316', '#DC2626', '#38BDF8', '#B784E3', '#84CC16', '#FBBF24', '#FF4D4F'];

const Icons = {
    Target: ({ size = 24 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
    ),
    Settings: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    Dollar: ({ size = 22 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Box: ({ size = 22 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7L12 3 4 7l8 4 8-4zM4 17l8 4 8-4M4 12l8 4 8-4" />
        </svg>
    ),
    Activity: ({ size = 22 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
    ),
    Edit: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    ),
    Save: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
    ),
    Close: ({ size = 20 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    Plus: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
    ),
    Calendar: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    ),
    ArrowLeft: ({ size = 20 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
    ),
    ChevronRight: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
    ),
    More: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
    ),
    Trash: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7H5m2 0V5a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v6m4-6v6m4-6v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
        </svg>
    ),
    Check: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    ),
    Deposit: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
        </svg>
    ),
    Spark: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
        </svg>
    ),
    Custom: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
        </svg>
    ),
    Emergency: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" d="M12 8v8M9 11h6" />
        </svg>
    ),
    Car: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 16l1.5-4.5A2 2 0 018.4 10h7.2a2 2 0 011.9 1.5L19 16" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16h16v3H4zM7 19h.01M17 19h.01" />
        </svg>
    ),
    House: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4 11 8-6 8 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 10v10h12V10" />
        </svg>
    ),
    Renovation: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5 5 14l5 5 9-9-5-5z" />
            <path strokeLinecap="round" d="m12 7 5 5" />
        </svg>
    ),
    Travel: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 16l20-6-6 8-4-2-2 4-2-5-6 1z" />
        </svg>
    ),
    Medical: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" />
        </svg>
    ),
    Debt: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path strokeLinecap="round" d="M7 12h10M15 9l2 3-2 3" />
        </svg>
    ),
    Note: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
        </svg>
    ),
    Bank: ({ size = 18 }) => (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M12 4l9 4H3l9-4z" />
        </svg>
    )
};

const OBJECTIVE_ICON_COMPONENTS = {
    custom: Icons.Custom,
    emergency: Icons.Emergency,
    car: Icons.Car,
    house: Icons.House,
    renovation: Icons.Renovation,
    travel: Icons.Travel,
    medical: Icons.Medical,
    debt: Icons.Debt
};

const OBJECTIVE_ICON_OPTIONS = [
    { key: 'debt', label: 'Dívida' },
    { key: 'emergency', label: 'Reserva' },
    { key: 'car', label: 'Carro' },
    { key: 'house', label: 'Casa' },
    { key: 'renovation', label: 'Reforma' },
    { key: 'travel', label: 'Viagem' },
    { key: 'medical', label: 'Saúde' },
    { key: 'custom', label: 'Livre' }
];

const OBJECTIVE_TEMPLATES = [
    { key: 'custom', label: 'Objetivo personalizado', color: '#111111', iconKey: 'custom', name: '', description: '' },
    { key: 'emergency', label: 'Fundo de emergência', color: '#166534', iconKey: 'emergency', name: 'Fundo de emergência', description: 'Reserva para imprevistos e caixa de segurança.' },
    { key: 'car', label: 'Novo carro', color: '#9333EA', iconKey: 'car', name: 'Novo carro', description: 'Planejamento para compra ou troca do carro.' },
    { key: 'house', label: 'Nova casa', color: '#0F766E', iconKey: 'house', name: 'Nova casa', description: 'Entrada, documentação e estrutura para moradia.' },
    { key: 'renovation', label: 'Reforma', color: '#F59E0B', iconKey: 'renovation', name: 'Reforma', description: 'Melhorias, obra e acabamento.' },
    { key: 'travel', label: 'Viagem nas férias', color: '#DC2626', iconKey: 'travel', name: 'Viagem nas férias', description: 'Passagens, hospedagem e despesas da viagem.' },
    { key: 'medical', label: 'Gastos médicos', color: '#0EA5E9', iconKey: 'medical', name: 'Gastos médicos', description: 'Consultas, exames, cirurgias e medicamentos.' },
    { key: 'debt', label: 'Pagar uma dívida', color: '#65A30D', iconKey: 'debt', name: 'Pagar uma dívida', description: 'Quitar parcelas ou renegociação com foco em folga de caixa.' }
];

const SORT_OPTIONS = [
    { value: 'deadline', label: 'Prazo mais próximo' },
    { value: 'recent', label: 'Mais recentes' },
    { value: 'progress', label: 'Maior progresso' },
    { value: 'amount', label: 'Maior valor' }
];

const defaultTargets = {
    revenue: 25000,
    revenue_annual: 300000,
    pieces: 500,
    efficiency: 95
};

const readStoredTargets = () => {
    if (typeof window === 'undefined') return defaultTargets;

    try {
        const saved = window.localStorage.getItem(GOALS_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : {};
        return {
            revenue: Number(parsed.revenue || defaultTargets.revenue),
            revenue_annual: Number(parsed.revenue_annual || defaultTargets.revenue_annual),
            pieces: Number(parsed.pieces || defaultTargets.pieces),
            efficiency: Number(parsed.efficiency || defaultTargets.efficiency)
        };
    } catch {
        return defaultTargets;
    }
};

const readStoredObjectives = () => {
    if (typeof window === 'undefined') return [];

    try {
        const saved = window.localStorage.getItem(OBJECTIVES_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

const persistTargetsCache = (targets) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(targets));
};

const persistObjectivesCache = (objectives) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OBJECTIVES_STORAGE_KEY, JSON.stringify(objectives));
};

const todayInputValue = () => new Date().toISOString().split('T')[0];

const buildFutureDate = (daysAhead = 30) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
};

const CALENDAR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const safeDateValue = (value) => {
    const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatHeroDate = (value) =>
    new Intl.DateTimeFormat('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })
        .format(safeDateValue(value))
        .replace(/\./g, '')
        .toUpperCase();

const formatMonthLabel = (value) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(safeDateValue(value));

const buildCalendarGrid = (viewDate) => {
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const firstWeekday = monthStart.getDay();
    const cursor = new Date(monthStart);
    cursor.setDate(cursor.getDate() - firstWeekday);

    return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => {
        const day = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
        return day;
    }));
};

const dateToInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const sanitizeMoneyInput = (value) => {
    const numeric = String(value || '').replace(/[^\d,]/g, '');
    const firstComma = numeric.indexOf(',');
    if (firstComma === -1) return numeric;
    return numeric.slice(0, firstComma + 1) + numeric.slice(firstComma + 1).replace(/,/g, '');
};

const parseMoneyValue = (value) => {
    const numeric = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
};

const moneyValueToInput = (value) => (
    value === '' || value === null || typeof value === 'undefined'
        ? ''
        : Number(value).toFixed(2).replace('.', ',')
);

const createObjectiveDraft = (templateKey = 'custom', accountId = '') => {
    const template = OBJECTIVE_TEMPLATES.find((item) => item.key === templateKey) || OBJECTIVE_TEMPLATES[0];
    return {
        templateKey: template.key,
        name: template.name,
        description: template.description,
        targetAmount: '',
        initialAmount: '',
        dueDate: buildFutureDate(30),
        color: template.color,
        iconKey: template.iconKey,
        financialAccountId: accountId ? String(accountId) : ''
    };
};

const isDefaultTargets = (targets) =>
    Number(targets?.revenue || 0) === defaultTargets.revenue
    && Number(targets?.revenue_annual || 0) === defaultTargets.revenue_annual
    && Number(targets?.pieces || 0) === defaultTargets.pieces
    && Number(targets?.efficiency || 0) === defaultTargets.efficiency;

const normalizeObjective = (objective) => ({
    id: Number(objective.id),
    templateKey: objective.templateKey || objective.template_key || 'custom',
    name: objective.name || 'Objetivo sem nome',
    description: objective.description || '',
    targetAmount: Number(objective.targetAmount ?? objective.target_amount ?? 0),
    initialAmount: Number(objective.initialAmount ?? objective.initial_amount ?? 0),
    dueDate: objective.dueDate || objective.due_date || buildFutureDate(30),
    color: objective.color || OBJECTIVE_COLORS[0],
    iconKey: objective.iconKey || objective.icon_key || 'custom',
    status: objective.status || 'active',
    financialAccountId: objective.financialAccountId || objective.financial_account_id || null,
    accountName: objective.accountName || objective.account_name || '',
    accountColor: objective.accountColor || objective.account_color || '',
    createdAt: objective.createdAt || objective.created_at || new Date().toISOString(),
    updatedAt: objective.updatedAt || objective.updated_at || new Date().toISOString(),
    deposits: Array.isArray(objective.deposits)
        ? objective.deposits.map((deposit) => ({
            id: Number(deposit.id),
            amount: Number(deposit.amount || 0),
            date: deposit.date || deposit.deposit_date || todayInputValue(),
            note: deposit.note || '',
            createdAt: deposit.createdAt || deposit.created_at || new Date().toISOString()
        }))
        : []
});

const buildObjectivePayload = (objective, fallbackAccountId = null) => ({
    template_key: objective.templateKey || 'custom',
    name: objective.name.trim(),
    description: objective.description?.trim() || '',
    target_amount: parseMoneyValue(objective.targetAmount),
    initial_amount: parseMoneyValue(objective.initialAmount),
    due_date: objective.dueDate || buildFutureDate(30),
    color: objective.color || OBJECTIVE_COLORS[0],
    icon_key: objective.iconKey || 'custom',
    status: objective.status || 'active',
    financial_account_id: objective.financialAccountId ? Number(objective.financialAccountId) : fallbackAccountId
});

const formatMoney = (value) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(Number(value || 0));

const formatDate = (value) =>
    value
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
        : '-';

const getObjectiveCurrent = (objective) =>
    Number(objective.initialAmount || 0) + (objective.deposits || []).reduce((total, deposit) => total + Number(deposit.amount || 0), 0);

const getObjectiveProgress = (objective) => {
    if (!Number(objective.targetAmount)) return 0;
    return Math.min((getObjectiveCurrent(objective) / Number(objective.targetAmount)) * 100, 100);
};

const getObjectiveStatus = (objective) => {
    if (objective.status === 'completed') return 'completed';
    return getObjectiveCurrent(objective) >= Number(objective.targetAmount || 0) && Number(objective.targetAmount || 0) > 0 ? 'completed' : 'active';
};

const getWeeklyContribution = (objective) => {
    const current = getObjectiveCurrent(objective);
    const remaining = Math.max(Number(objective.targetAmount || 0) - current, 0);
    if (!remaining) return 0;

    const today = new Date(todayInputValue());
    const dueDate = new Date(`${objective.dueDate}T00:00:00`);
    const diffDays = Math.max(1, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));
    return (remaining / diffDays) * 7;
};

const MetricCard = ({ title, current, target, unit = '', type = 'number', icon, isEfficiency = false, colorTheme = 'blue' }) => {
    const rawPercentage = target > 0 ? (current / target) * 100 : 0;
    const displayPercentage = Math.round(rawPercentage);

    const formatValue = (value) => {
        if (type === 'money') return formatMoney(value);
        return Number(value || 0).toLocaleString('pt-BR');
    };

    const palettes = {
        purple: { border: '#DDD6FE', accent: '#8B5CF6', badgeBg: '#EDE9FE', textDark: '#6D28D9' },
        blue: { border: '#BFDBFE', accent: '#3B82F6', badgeBg: '#EFF6FF', textDark: '#1D4ED8' },
        amber: { border: '#FDE68A', accent: '#F59E0B', badgeBg: '#FEF3C7', textDark: '#B45309' }
    };

    let theme = palettes[colorTheme] || palettes.blue;
    let accentColor = theme.accent;
    let progressBarColor = theme.accent;
    let badgeBg = theme.badgeBg;
    let badgeText = theme.textDark;
    let cardBorder = theme.border;

    if (isEfficiency) {
        if (displayPercentage < 70) {
            accentColor = '#DC2626';
            badgeBg = '#FEE2E2';
            badgeText = '#991B1B';
            cardBorder = '#FECACA';
        } else if (displayPercentage < 90) {
            accentColor = '#D97706';
            badgeBg = '#FEF3C7';
            badgeText = '#B45309';
            cardBorder = '#FDE68A';
        } else {
            accentColor = '#10B981';
            badgeBg = '#D1FAE5';
            badgeText = '#065F46';
            cardBorder = '#A7F3D0';
        }
    } else if (displayPercentage >= 100) {
        progressBarColor = '#10B981';
        badgeText = '#10B981';
    }

    return (
        <div
            className="objective-hover-card"
            style={{
                backgroundColor: '#FAFAFA',
                padding: '24px',
                borderRadius: '16px',
                border: `1px solid ${cardBorder}`,
                boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
                    <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0F172A', marginTop: '6px', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                        {isEfficiency ? `${displayPercentage}%` : formatValue(current)}
                    </div>
                </div>
                <div style={{ color: accentColor, backgroundColor: badgeBg, padding: '12px', borderRadius: '12px', display: 'flex' }}>{icon}</div>
            </div>

            <div>
                {!isEfficiency ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '700' }}>
                            <span style={{ color: '#94A3B8' }}>Meta: {formatValue(target)} {unit}</span>
                            <span style={{ color: badgeText }}>{displayPercentage}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div
                                style={{
                                    width: `${Math.min(displayPercentage, 100)}%`,
                                    height: '100%',
                                    backgroundColor: progressBarColor,
                                    borderRadius: '4px',
                                    transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: badgeBg, borderRadius: '10px', border: `1px solid ${cardBorder}` }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
                        <span style={{ fontSize: '0.95rem', fontWeight: '800', color: badgeText }}>{displayPercentage >= 90 ? 'Excelente' : displayPercentage >= 70 ? 'Atenção' : 'Crítico'}</span>
                        <span style={{ fontSize: '0.85rem', color: badgeText, marginLeft: 'auto', fontWeight: '700' }}>Meta: {target}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusPill = ({ status }) => {
    const config = status === 'completed'
        ? { bg: '#EDE9FE', color: '#6D28D9', label: 'Concluído' }
        : { bg: '#EEF2FF', color: '#4338CA', label: 'Em andamento' };

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '999px', backgroundColor: config.bg, color: config.color, fontWeight: '800', fontSize: '0.76rem' }}>
            {status === 'completed' ? <Icons.Check size={14} /> : <Icons.Spark size={14} />}
            {config.label}
        </span>
    );
};

const ObjectiveCard = ({ objective, onOpen }) => {
    const current = getObjectiveCurrent(objective);
    const progress = getObjectiveProgress(objective);
    const IconComponent = OBJECTIVE_ICON_COMPONENTS[objective.iconKey] || Icons.Custom;
    const status = getObjectiveStatus(objective);

    return (
        <button type="button" className="objective-hover-card" onClick={() => onOpen(objective.id)} style={{ ...styles.objectiveCard, textAlign: 'left' }}>
            <div style={styles.objectiveCardHeader}>
                <div style={styles.objectiveTitleWrap}>
                    <span style={{ ...styles.objectiveIconBubble, backgroundColor: objective.color }}>
                        <IconComponent size={16} />
                    </span>
                    <div>
                        <div style={styles.objectiveTitle}>{objective.name}</div>
                        <StatusPill status={status} />
                    </div>
                </div>
                <span style={styles.objectiveArrow}><Icons.ChevronRight size={18} /></span>
            </div>

            <div style={styles.objectiveTrack}>
                <div style={{ ...styles.objectiveFill, width: `${Math.min(progress, 100)}%`, backgroundColor: objective.color }} />
            </div>

            <div style={styles.objectiveProgressRow}>
                <strong style={styles.objectiveSaved}>{formatMoney(current)} guardados</strong>
                <span style={styles.objectivePercent}>{progress.toFixed(2)}%</span>
            </div>

            <div style={styles.objectiveMetaRow}>
                <span style={styles.objectiveMetaItem}><Icons.Target size={15} /> {formatMoney(objective.targetAmount)}</span>
                <span style={styles.objectiveMetaItem}><Icons.Calendar size={15} /> {formatDate(objective.dueDate)}</span>
            </div>
            <div style={{ ...styles.objectiveMetaRow, marginTop: '10px' }}>
                <span style={styles.objectiveMetaItem}><Icons.Bank size={15} /> {objective.accountName || 'Sem conta'}</span>
            </div>
        </button>
    );
};

const MoneyField = ({ label, icon, value, onChange, helperText, allowZero = false }) => {
    const numericValue = parseMoneyValue(value);
    const invalid = !allowZero && numericValue <= 0;

    return (
        <label style={styles.moneyFieldBlock}>
            <span style={styles.fieldTitle}>{label}</span>
            <div style={{ ...styles.moneyFieldShell, borderBottomColor: invalid ? '#F97316' : '#CBD5E1' }}>
                <div style={styles.moneyFieldRow}>
                    <span style={styles.fieldPrefix}>{icon}</span>
                    <span style={styles.moneyCurrency}>R$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
                        onBlur={() => {
                            if (!String(value || '').trim()) return;
                            onChange(moneyValueToInput(parseMoneyValue(value)));
                        }}
                        placeholder="0,00"
                        style={styles.moneyFieldInput}
                    />
                </div>
            </div>
            {helperText ? (
                <span style={{ ...styles.moneyFieldHint, color: invalid ? '#F97316' : '#94A3B8' }}>
                    {invalid ? helperText : '\u00A0'}
                </span>
            ) : null}
        </label>
    );
};

const CalendarPopover = ({ value, onChange, onClose }) => {
    const selectedDate = safeDateValue(value);
    const [viewDate, setViewDate] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    useEffect(() => {
        const nextSelectedDate = safeDateValue(value);
        setViewDate(new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1));
    }, [value]);

    const weeks = useMemo(() => buildCalendarGrid(viewDate), [viewDate]);
    const selectedValue = dateToInputValue(selectedDate);
    const todayValue = todayInputValue();

    return (
        <div style={styles.calendarPopover}>
            <div style={styles.calendarHero}>
                <span style={styles.calendarYear}>{selectedDate.getFullYear()}</span>
                <strong style={styles.calendarHeroTitle}>{formatHeroDate(value)}</strong>
            </div>

            <div style={styles.calendarToolbar}>
                <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.calendarNavButton}>
                    <Icons.ArrowLeft size={16} />
                </button>
                <span style={styles.calendarMonthLabel}>{formatMonthLabel(dateToInputValue(viewDate))}</span>
                <button type="button" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.calendarNavButton}>
                    <Icons.ChevronRight size={16} />
                </button>
            </div>

            <div style={styles.calendarWeekdays}>
                {CALENDAR_WEEKDAYS.map((day) => (
                    <span key={day} style={styles.calendarWeekday}>{day}</span>
                ))}
            </div>

            <div style={styles.calendarGrid}>
                {weeks.flat().map((day) => {
                    const dateValue = dateToInputValue(day);
                    const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                    const isSelected = dateValue === selectedValue;
                    const isToday = dateValue === todayValue;

                    return (
                        <button
                            key={dateValue}
                            type="button"
                            onClick={() => {
                                onChange(dateValue);
                                onClose();
                            }}
                            style={{
                                ...styles.calendarDay,
                                ...(isCurrentMonth ? null : styles.calendarDayOutside),
                                ...(isToday ? styles.calendarDayToday : null),
                                ...(isSelected ? styles.calendarDaySelected : null)
                            }}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const DateField = ({ label, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const handleOutsideClick = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open]);

    return (
        <div ref={wrapperRef} style={{ ...styles.fieldBlock, position: 'relative' }}>
            <span style={styles.fieldTitle}>{label}</span>
            <button type="button" onClick={() => setOpen((current) => !current)} style={styles.dateFieldButton}>
                <span style={styles.fieldPrefix}><Icons.Calendar size={16} /></span>
                <span style={styles.dateFieldValue}>{formatDate(value)}</span>
            </button>
            {open ? <CalendarPopover value={value} onChange={onChange} onClose={() => setOpen(false)} /> : null}
        </div>
    );
};

const AccountManagerModal = ({
    open,
    accounts,
    draft,
    editingAccountId,
    onClose,
    onDraftChange,
    onSubmit,
    onEdit,
    onDelete,
    onReset
}) => {
    const colorInputRef = useRef(null);

    if (!open) return null;

    return (
        <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, maxWidth: '920px' }}>
                <div style={styles.modalHeader}>
                    <div>
                        <h3 style={styles.modalTitle}>Gerenciar bancos</h3>
                        <p style={styles.modalSubtitle}>Adicione, edite e organize as contas usadas nos seus objetivos.</p>
                    </div>
                    <button type="button" onClick={onClose} style={styles.modalCloseButton}>
                        <Icons.Close size={18} />
                    </button>
                </div>

                <div className="objective-detail-grid" style={styles.accountManagerGrid}>
                    <div style={styles.accountFormCard}>
                        <div style={styles.sectionHeader}>
                            <div>
                                <h4 style={{ ...styles.sectionTitle, fontSize: '1rem', marginBottom: '4px' }}>
                                    {editingAccountId ? 'Editar banco' : 'Adicionar banco'}
                                </h4>
                                <p style={styles.sectionSubtitle}>Escolha nome, cor e se essa conta será a principal.</p>
                            </div>
                            {editingAccountId ? (
                                <button type="button" onClick={onReset} style={styles.secondaryAction}>
                                    <Icons.Plus size={14} /> Novo banco
                                </button>
                            ) : null}
                        </div>

                        <label style={styles.fieldBlock}>
                            <span style={styles.fieldTitle}>Nome do banco</span>
                            <div style={styles.fieldLine}>
                                <span style={styles.fieldPrefix}><Icons.Bank size={16} /></span>
                                <input type="text" value={draft.name} onChange={(event) => onDraftChange('name', event.target.value)} placeholder="Ex.: Itaú, Inter, Caixa" style={styles.fieldInput} />
                            </div>
                        </label>

                        <div style={styles.paletteSection}>
                            <span style={styles.fieldTitle}>Cor do banco</span>
                            <div style={styles.paletteRow}>
                                {OBJECTIVE_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => onDraftChange('color', color)}
                                        style={{
                                            ...styles.colorDot,
                                            backgroundColor: color,
                                            boxShadow: draft.color === color ? `0 0 0 4px rgba(255,255,255,0.96), 0 0 0 6px ${color}33` : 'none'
                                        }}
                                    >
                                        {draft.color === color ? <Icons.Check size={14} /> : null}
                                    </button>
                                ))}
                                <button type="button" onClick={() => colorInputRef.current?.click()} style={styles.addPaletteButton}>
                                    <Icons.Plus size={16} />
                                </button>
                                <input ref={colorInputRef} type="color" value={draft.color} onChange={(event) => onDraftChange('color', event.target.value)} style={{ display: 'none' }} />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => onDraftChange('isDefault', !draft.isDefault)}
                            style={{
                                ...styles.defaultToggle,
                                borderColor: draft.isDefault ? '#C4B5FD' : '#D9E2F2',
                                backgroundColor: draft.isDefault ? '#F5F3FF' : '#FFFFFF',
                                color: draft.isDefault ? '#6D28D9' : '#475569'
                            }}
                        >
                            <span style={{ ...styles.defaultIndicator, backgroundColor: draft.isDefault ? '#6D28D9' : '#CBD5E1' }} />
                            Definir como banco principal
                        </button>

                        <button type="button" onClick={onSubmit} style={styles.modalSubmitButton}>
                            {editingAccountId ? 'SALVAR BANCO' : 'ADICIONAR BANCO'}
                        </button>
                    </div>

                    <div style={styles.accountListCard}>
                        <h4 style={{ ...styles.sectionTitle, fontSize: '1rem' }}>Bancos cadastrados</h4>
                        <div style={styles.accountList}>
                            {accounts.map((account) => (
                                <div key={account.id} style={styles.accountRow}>
                                    <div style={styles.accountInfo}>
                                        <span style={{ ...styles.accountColorDot, backgroundColor: account.color || '#2563EB' }} />
                                        <div>
                                            <strong style={styles.accountName}>{account.name}</strong>
                                            <div style={styles.accountMetaRow}>
                                                {account.is_default ? <span style={styles.accountBadge}>Principal</span> : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.accountActions}>
                                        <button type="button" onClick={() => onEdit(account)} style={styles.accountIconButton}>
                                            <Icons.Edit size={14} />
                                        </button>
                                        <button type="button" onClick={() => onDelete(account)} style={{ ...styles.accountIconButton, color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
                                            <Icons.Trash size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CreateObjectiveModal = ({
    open,
    step,
    draft,
    accounts,
    onOpenAccountManager,
    onClose,
    onTemplateSelect,
    onChange,
    onSubmit,
    onBack,
    isEditing
}) => {
    const colorInputRef = useRef(null);

    if (!open) return null;

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
                <div style={styles.modalHeader}>
                    <div>
                        <h3 style={styles.modalTitle}>Criar objetivo</h3>
                        {step === 'form' && !isEditing ? <p style={styles.modalSubtitle}>Configure o objetivo com o mesmo padrão visual do seu painel.</p> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {step === 'form' && !isEditing ? (
                            <button type="button" onClick={onBack} style={styles.modalGhostButton}>Modelos</button>
                        ) : null}
                        <button type="button" onClick={onClose} style={styles.modalCloseButton}>
                            <Icons.Close size={18} />
                        </button>
                    </div>
                </div>

                {step === 'template' ? (
                    <div style={styles.templateList}>
                        {OBJECTIVE_TEMPLATES.map((template) => {
                            const IconComponent = OBJECTIVE_ICON_COMPONENTS[template.iconKey] || Icons.Custom;
                            return (
                                <button key={template.key} type="button" onClick={() => onTemplateSelect(template.key)} style={styles.templateItem}>
                                    <span style={{ ...styles.templateIcon, backgroundColor: template.color }}>
                                        <IconComponent size={16} />
                                    </span>
                                    <span style={styles.templateLabel}>{template.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div style={styles.modalFormWrap}>
                        <div className="objective-form-grid">
                            <MoneyField
                                label="Valor do objetivo"
                                icon={<Icons.Target size={16} />}
                                value={draft.targetAmount}
                                onChange={(value) => onChange('targetAmount', value)}
                                helperText="Deve ter um valor diferente de 0"
                            />

                            <MoneyField
                                label="Valor inicial do objetivo"
                                icon={<Icons.Plus size={16} />}
                                value={draft.initialAmount}
                                onChange={(value) => onChange('initialAmount', value)}
                                allowZero={true}
                            />
                        </div>

                        <label style={styles.fieldBlock}>
                            <span style={styles.fieldTitle}>Nome do objetivo</span>
                            <div style={styles.fieldLine}>
                                <span style={styles.fieldPrefix}><Icons.Note size={16} /></span>
                                <input type="text" value={draft.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Ex.: Pagar uma dívida" style={styles.fieldInput} />
                            </div>
                        </label>

                        <DateField label="Data" value={draft.dueDate} onChange={(value) => onChange('dueDate', value)} />

                        <label style={styles.fieldBlock}>
                            <div style={styles.fieldTitleRow}>
                                <span style={styles.fieldTitle}>Conta</span>
                                <button type="button" onClick={onOpenAccountManager} style={styles.inlineTextButton}>Gerenciar bancos</button>
                            </div>
                            <div style={styles.fieldLine}>
                                <span style={styles.fieldPrefix}><Icons.Bank size={16} /></span>
                                <select value={draft.financialAccountId} onChange={(event) => onChange('financialAccountId', event.target.value)} style={styles.fieldSelect}>
                                    {accounts.map((account) => (
                                        <option key={account.id} value={String(account.id)}>{account.name}</option>
                                    ))}
                                </select>
                            </div>
                        </label>

                        <div style={styles.paletteSection}>
                            <span style={styles.fieldTitle}>Cor</span>
                            <div style={styles.paletteRow}>
                                {OBJECTIVE_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => onChange('color', color)}
                                        style={{
                                            ...styles.colorDot,
                                            backgroundColor: color,
                                            boxShadow: draft.color === color ? `0 0 0 4px rgba(255,255,255,0.96), 0 0 0 6px ${color}33` : 'none'
                                        }}
                                    >
                                        {draft.color === color ? <Icons.Check size={14} /> : null}
                                    </button>
                                ))}
                                <button type="button" onClick={() => colorInputRef.current?.click()} style={styles.addPaletteButton}>
                                    <Icons.Plus size={16} />
                                </button>
                                <input ref={colorInputRef} type="color" value={draft.color} onChange={(event) => onChange('color', event.target.value)} style={{ display: 'none' }} />
                            </div>
                        </div>

                        <div style={styles.paletteSection}>
                            <span style={styles.fieldTitle}>Ícone</span>
                            <div style={styles.paletteRow}>
                                {OBJECTIVE_ICON_OPTIONS.map((item) => {
                                    const IconComponent = OBJECTIVE_ICON_COMPONENTS[item.key] || Icons.Custom;
                                    const isActive = draft.iconKey === item.key;

                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => onChange('iconKey', item.key)}
                                            style={{
                                                ...styles.iconDot,
                                                backgroundColor: isActive ? draft.color : '#D1D5DB',
                                                color: '#FFFFFF'
                                            }}
                                        >
                                            <IconComponent size={15} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <label style={styles.fieldBlock}>
                            <span style={styles.fieldTitle}>Descrição</span>
                            <div style={styles.fieldLine}>
                                <span style={styles.fieldPrefix}><Icons.Note size={16} /></span>
                                <input type="text" value={draft.description} onChange={(event) => onChange('description', event.target.value)} placeholder="Descrição do objetivo" style={styles.fieldInput} />
                            </div>
                        </label>

                        <button type="button" onClick={onSubmit} style={styles.modalSubmitButton}>
                            {isEditing ? 'SALVAR OBJETIVO' : 'CRIAR OBJETIVO'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const AddDepositModal = ({ open, depositDraft, onChange, onClose, onSubmit }) => {
    if (!open) return null;

    return (
        <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, maxWidth: '480px' }}>
                <div style={styles.modalHeader}>
                    <div>
                        <h3 style={styles.modalTitle}>Adicionar depósito</h3>
                        <p style={styles.modalSubtitle}>Registre os aportes feitos para este objetivo.</p>
                    </div>
                    <button type="button" onClick={onClose} style={styles.modalCloseButton}>
                        <Icons.Close size={18} />
                    </button>
                </div>

                <div style={styles.modalFormWrap}>
                    <MoneyField
                        label="Valor do depósito"
                        icon={<Icons.Deposit size={16} />}
                        value={depositDraft.amount}
                        onChange={(value) => onChange('amount', value)}
                        helperText="Deve ter um valor diferente de 0"
                    />

                    <DateField label="Data" value={depositDraft.date} onChange={(value) => onChange('date', value)} />

                    <label style={styles.fieldBlock}>
                        <span style={styles.fieldTitle}>Observação</span>
                        <div style={styles.fieldLine}>
                            <span style={styles.fieldPrefix}><Icons.Note size={16} /></span>
                            <input type="text" value={depositDraft.note} onChange={(event) => onChange('note', event.target.value)} placeholder="Ex.: primeiro aporte do mês" style={styles.fieldInput} />
                        </div>
                    </label>

                    <button type="button" onClick={onSubmit} style={styles.modalSubmitButton}>
                        ADICIONAR DEPÓSITO
                    </button>
                </div>
            </div>
        </div>
    );
};

const Goals = () => {
    const { token, API_BASE_URL } = useAuth();
    const [metrics, setMetrics] = useState({
        revenueMonthly: 0,
        revenueAnnual: 0,
        piecesMonthly: 0,
        efficiencyMonthly: 0
    });
    const [targets, setTargets] = useState(readStoredTargets);
    const [tempTargets, setTempTargets] = useState(readStoredTargets);
    const [objectiveAccounts, setObjectiveAccounts] = useState([]);
    const [isEditingTargets, setIsEditingTargets] = useState(false);
    const [loadingObjectives, setLoadingObjectives] = useState(true);

    const [objectives, setObjectives] = useState(() => readStoredObjectives().map(normalizeObjective));
    const [objectiveTab, setObjectiveTab] = useState('active');
    const [sortMode, setSortMode] = useState('deadline');
    const [activeObjectiveId, setActiveObjectiveId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createStep, setCreateStep] = useState('template');
    const [editingObjectiveId, setEditingObjectiveId] = useState(null);
    const [draftObjective, setDraftObjective] = useState(createObjectiveDraft());
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState(null);
    const [accountDraft, setAccountDraft] = useState({ name: '', color: '#2563EB', isDefault: false });
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [depositDraft, setDepositDraft] = useState({ amount: '', date: todayInputValue(), note: '' });
    const [detailMenuOpen, setDetailMenuOpen] = useState(false);

    const authConfig = useMemo(() => ({
        headers: { Authorization: `Bearer ${token}` }
    }), [token]);

    useEffect(() => {
        persistObjectivesCache(objectives);
    }, [objectives]);

    useEffect(() => {
        persistTargetsCache(targets);
    }, [targets]);

    useEffect(() => {
        if (!token) return;

        const fetchMetrics = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/orders`, authConfig);
                const activeOrders = response.data.orders.filter((order) => order.status !== 'Cancelado');
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const orderDate = (order) => {
                    const baseDate = order.created_at || order.delivery_date || null;
                    if (!baseDate) return null;
                    const parsed = new Date(baseDate);
                    return Number.isNaN(parsed.getTime()) ? null : parsed;
                };

                const monthlyOrders = activeOrders.filter((order) => {
                    const parsed = orderDate(order);
                    return parsed && parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear;
                });

                const annualOrders = activeOrders.filter((order) => {
                    const parsed = orderDate(order);
                    return parsed && parsed.getFullYear() === currentYear;
                });

                const sumRevenue = (orders) => orders.reduce((sum, order) => sum + parseFloat(order.total_price || 0), 0);
                const sumPieces = (orders) => orders.reduce((sum, order) => {
                    let sizes = order.sizes_json || {};
                    if (typeof sizes === 'string') {
                        try {
                            sizes = JSON.parse(sizes || '{}');
                        } catch {
                            sizes = {};
                        }
                    }
                    return sum + Object.values(sizes).reduce((partial, value) => partial + (Number(value) || 0), 0);
                }, 0);

                const lateOrders = monthlyOrders.filter((order) => {
                    const today = todayInputValue();
                    const isCompleted = order.status === 'Entregue/Concluído' || order.status === 'Pronto para Envio';
                    return !isCompleted && order.delivery_date < today;
                }).length;

                const efficiency = monthlyOrders.length > 0
                    ? Math.round(((monthlyOrders.length - lateOrders) / monthlyOrders.length) * 100)
                    : 100;

                setMetrics({
                    revenueMonthly: sumRevenue(monthlyOrders),
                    revenueAnnual: sumRevenue(annualOrders),
                    piecesMonthly: sumPieces(monthlyOrders),
                    efficiencyMonthly: efficiency
                });
            } catch (error) {
                console.error('Erro ao carregar métricas.', error);
            }
        };

        fetchMetrics();
    }, [API_BASE_URL, authConfig, token]);

    const fetchGoalSystemData = async (preferredObjectiveId = null) => {
        if (!token) return;
        setLoadingObjectives(true);

        try {
            const [settingsResponse, accountsResponse, objectivesResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/finance/goal-settings`, authConfig),
                axios.get(`${API_BASE_URL}/api/finance/objective-accounts`, authConfig),
                axios.get(`${API_BASE_URL}/api/finance/objectives`, authConfig)
            ]);

            const fetchedAccounts = accountsResponse.data || [];
            const defaultAccountId = fetchedAccounts[0]?.id ? String(fetchedAccounts[0].id) : '';
            setObjectiveAccounts(fetchedAccounts);

            const serverTargets = {
                revenue: Number(settingsResponse.data?.revenue || defaultTargets.revenue),
                revenue_annual: Number(settingsResponse.data?.revenue_annual || defaultTargets.revenue_annual),
                pieces: Number(settingsResponse.data?.pieces || defaultTargets.pieces),
                efficiency: Number(settingsResponse.data?.efficiency || defaultTargets.efficiency)
            };

            const cachedTargets = readStoredTargets();
            const hasCachedTargets = typeof window !== 'undefined' && Boolean(window.localStorage.getItem(GOALS_STORAGE_KEY));
            let nextTargets = serverTargets;

            if (hasCachedTargets && isDefaultTargets(serverTargets) && !isDefaultTargets(cachedTargets)) {
                await axios.put(`${API_BASE_URL}/api/finance/goal-settings`, cachedTargets, authConfig);
                nextTargets = cachedTargets;
            }

            setTargets(nextTargets);
            setTempTargets(nextTargets);

            let fetchedObjectives = Array.isArray(objectivesResponse.data)
                ? objectivesResponse.data.map(normalizeObjective)
                : [];

            const cachedObjectives = readStoredObjectives().map(normalizeObjective);
            const hasCachedObjectives = typeof window !== 'undefined' && Boolean(window.localStorage.getItem(OBJECTIVES_STORAGE_KEY));

            if (hasCachedObjectives && fetchedObjectives.length === 0 && cachedObjectives.length > 0) {
                for (const objective of cachedObjectives) {
                    const createdResponse = await axios.post(
                        `${API_BASE_URL}/api/finance/objectives`,
                        buildObjectivePayload(objective, defaultAccountId ? Number(defaultAccountId) : null),
                        authConfig
                    );

                    const createdObjectiveId = createdResponse.data?.id;
                    if (createdObjectiveId && objective.deposits?.length) {
                        for (const deposit of objective.deposits) {
                            await axios.post(
                                `${API_BASE_URL}/api/finance/objectives/${createdObjectiveId}/deposits`,
                                {
                                    amount: Number(deposit.amount || 0),
                                    deposit_date: deposit.date || todayInputValue(),
                                    note: deposit.note || ''
                                },
                                authConfig
                            );
                        }
                    }
                }

                const migratedObjectives = await axios.get(`${API_BASE_URL}/api/finance/objectives`, authConfig);
                fetchedObjectives = Array.isArray(migratedObjectives.data) ? migratedObjectives.data.map(normalizeObjective) : [];
            }

            setObjectives(fetchedObjectives);
            setDraftObjective((current) => ({
                ...current,
                financialAccountId: fetchedAccounts.some((account) => String(account.id) === String(current.financialAccountId))
                    ? current.financialAccountId
                    : defaultAccountId
            }));

            const nextActiveId = preferredObjectiveId ?? activeObjectiveId;
            if (nextActiveId && fetchedObjectives.some((objective) => objective.id === nextActiveId)) {
                setActiveObjectiveId(nextActiveId);
            } else if (preferredObjectiveId === null && !fetchedObjectives.some((objective) => objective.id === activeObjectiveId)) {
                setActiveObjectiveId(null);
            }
        } catch (error) {
            console.error('Erro ao sincronizar objetivos.', error);
        } finally {
            setLoadingObjectives(false);
        }
    };

    useEffect(() => {
        fetchGoalSystemData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const selectedObjective = useMemo(
        () => objectives.find((objective) => objective.id === activeObjectiveId) || null,
        [activeObjectiveId, objectives]
    );

    const visibleObjectives = useMemo(() => {
        const filtered = objectives.filter((objective) => {
            const status = getObjectiveStatus(objective);
            return objectiveTab === 'completed' ? status === 'completed' : status === 'active';
        });

        const sorted = [...filtered];
        sorted.sort((first, second) => {
            if (sortMode === 'recent') return new Date(second.createdAt) - new Date(first.createdAt);
            if (sortMode === 'progress') return getObjectiveProgress(second) - getObjectiveProgress(first);
            if (sortMode === 'amount') return Number(second.targetAmount || 0) - Number(first.targetAmount || 0);
            return new Date(first.dueDate) - new Date(second.dueDate);
        });
        return sorted;
    }, [objectiveTab, objectives, sortMode]);

    const handleAnnualChange = (value) => {
        const annualValue = Number(value);
        setTempTargets((current) => ({
            ...current,
            revenue_annual: annualValue,
            revenue: Math.round(annualValue / 12)
        }));
    };

    const handleMonthlyChange = (value) => {
        const monthlyValue = Number(value);
        setTempTargets((current) => ({
            ...current,
            revenue: monthlyValue,
            revenue_annual: monthlyValue * 12
        }));
    };

    const handleSaveGoals = async () => {
        await axios.put(`${API_BASE_URL}/api/finance/goal-settings`, tempTargets, authConfig);
        setTargets(tempTargets);
        await Swal.fire({ title: 'Metas salvas', icon: 'success', timer: 1200, showConfirmButton: false });
        setIsEditingTargets(false);
    };

    const resetAccountDraft = () => {
        setEditingAccountId(null);
        setAccountDraft({
            name: '',
            color: '#2563EB',
            isDefault: objectiveAccounts.length === 0
        });
    };

    const openAccountManager = () => {
        resetAccountDraft();
        setShowAccountModal(true);
    };

    const handleAccountDraftChange = (field, value) => {
        setAccountDraft((current) => ({ ...current, [field]: value }));
    };

    const handleEditAccount = (account) => {
        setEditingAccountId(account.id);
        setAccountDraft({
            name: account.name || '',
            color: account.color || '#2563EB',
            isDefault: Boolean(account.is_default)
        });
    };

    const handleSaveAccount = async () => {
        const payload = {
            name: accountDraft.name.trim(),
            color: accountDraft.color || '#2563EB',
            is_default: accountDraft.isDefault
        };

        if (!payload.name) {
            await Swal.fire('Nome obrigatório', 'Informe o nome do banco.', 'warning');
            return;
        }

        try {
            if (editingAccountId) {
                await axios.put(`${API_BASE_URL}/api/finance/objective-accounts/${editingAccountId}`, payload, authConfig);
                await Swal.fire({ title: 'Banco atualizado', icon: 'success', timer: 1200, showConfirmButton: false });
            } else {
                await axios.post(`${API_BASE_URL}/api/finance/objective-accounts`, payload, authConfig);
                await Swal.fire({ title: 'Banco adicionado', icon: 'success', timer: 1200, showConfirmButton: false });
            }

            await fetchGoalSystemData(activeObjectiveId);
            resetAccountDraft();
        } catch (error) {
            await Swal.fire('Não foi possível salvar', error.response?.data?.error || 'Tente novamente.', 'error');
        }
    };

    const handleDeleteAccount = async (account) => {
        const result = await Swal.fire({
            title: `Excluir ${account.name}?`,
            text: 'Os objetivos vinculados serão movidos para outra conta principal.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Excluir',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/finance/objective-accounts/${account.id}`, authConfig);
            await fetchGoalSystemData(activeObjectiveId);
            resetAccountDraft();
            await Swal.fire({ title: 'Banco removido', icon: 'success', timer: 1200, showConfirmButton: false });
        } catch (error) {
            await Swal.fire('Não foi possível excluir', error.response?.data?.error || 'Tente novamente.', 'error');
        }
    };

    const resetObjectiveDraft = () => {
        const defaultAccountId = objectiveAccounts[0]?.id ? String(objectiveAccounts[0].id) : '';
        setDraftObjective(createObjectiveDraft('custom', defaultAccountId));
        setCreateStep('template');
        setEditingObjectiveId(null);
    };

    const openCreateObjective = () => {
        resetObjectiveDraft();
        setShowCreateModal(true);
    };

    const closeCreateObjective = () => {
        setShowCreateModal(false);
        resetObjectiveDraft();
    };

    const handleTemplateSelect = (templateKey) => {
        const defaultAccountId = objectiveAccounts[0]?.id ? String(objectiveAccounts[0].id) : '';
        setDraftObjective(createObjectiveDraft(templateKey, defaultAccountId));
        setCreateStep('form');
    };

    const handleDraftChange = (field, value) => {
        setDraftObjective((current) => ({ ...current, [field]: value }));
    };

    const handleSaveObjective = async () => {
        const name = draftObjective.name.trim();
        const targetAmount = parseMoneyValue(draftObjective.targetAmount);

        if (!name) {
            await Swal.fire('Nome obrigatório', 'Informe um nome para o objetivo.', 'warning');
            return;
        }

        if (!targetAmount || targetAmount <= 0) {
            await Swal.fire('Valor inválido', 'Defina um valor maior que zero para o objetivo.', 'warning');
            return;
        }

        const defaultAccountId = objectiveAccounts[0]?.id ? Number(objectiveAccounts[0].id) : null;
        const payload = buildObjectivePayload(
            {
                ...draftObjective,
                name,
                targetAmount,
                initialAmount: parseMoneyValue(draftObjective.initialAmount)
            },
            defaultAccountId
        );

        if (editingObjectiveId) {
            const response = await axios.put(`${API_BASE_URL}/api/finance/objectives/${editingObjectiveId}`, payload, authConfig);
            await fetchGoalSystemData(response.data?.id || editingObjectiveId);
            await Swal.fire({ title: 'Objetivo atualizado', icon: 'success', timer: 1200, showConfirmButton: false });
        } else {
            const response = await axios.post(`${API_BASE_URL}/api/finance/objectives`, payload, authConfig);
            const createdId = response.data?.id || null;
            setObjectiveTab('active');
            await fetchGoalSystemData(createdId);
            await Swal.fire({ title: 'Objetivo criado', icon: 'success', timer: 1200, showConfirmButton: false });
        }

        closeCreateObjective();
    };

    const handleEditObjective = (objective) => {
        setEditingObjectiveId(objective.id);
        setDraftObjective({
            templateKey: objective.templateKey,
            name: objective.name,
            description: objective.description,
            targetAmount: moneyValueToInput(objective.targetAmount),
            initialAmount: moneyValueToInput(objective.initialAmount),
            dueDate: objective.dueDate,
            color: objective.color,
            iconKey: objective.iconKey,
            financialAccountId: objective.financialAccountId ? String(objective.financialAccountId) : ''
        });
        setCreateStep('form');
        setShowCreateModal(true);
        setDetailMenuOpen(false);
    };

    const handleToggleObjectiveStatus = async (objective) => {
        await axios.put(
            `${API_BASE_URL}/api/finance/objectives/${objective.id}`,
            {
                ...buildObjectivePayload(objective, objectiveAccounts[0]?.id || null),
                status: getObjectiveStatus(objective) === 'completed' ? 'active' : 'completed'
            },
            authConfig
        );

        setObjectiveTab(getObjectiveStatus(objective) === 'completed' ? 'active' : 'completed');
        setDetailMenuOpen(false);
        await fetchGoalSystemData(objective.id);
    };

    const handleDeleteObjective = async (objective) => {
        const result = await Swal.fire({
            title: 'Excluir objetivo?',
            text: 'Os depósitos vinculados também serão removidos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Excluir',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        await axios.delete(`${API_BASE_URL}/api/finance/objectives/${objective.id}`, authConfig);
        if (activeObjectiveId === objective.id) setActiveObjectiveId(null);
        setDetailMenuOpen(false);
        await fetchGoalSystemData();
        await Swal.fire({ title: 'Objetivo removido', icon: 'success', timer: 1200, showConfirmButton: false });
    };

    const handleOpenDepositModal = () => {
        setDepositDraft({ amount: '', date: todayInputValue(), note: '' });
        setShowDepositModal(true);
    };

    const handleDepositChange = (field, value) => {
        setDepositDraft((current) => ({ ...current, [field]: value }));
    };

    const handleSaveDeposit = async () => {
        if (!selectedObjective) return;

        const amount = parseMoneyValue(depositDraft.amount);
        if (!amount || amount <= 0) {
            await Swal.fire('Valor inválido', 'Informe um valor de depósito maior que zero.', 'warning');
            return;
        }

        await axios.post(
            `${API_BASE_URL}/api/finance/objectives/${selectedObjective.id}/deposits`,
            {
                amount,
                deposit_date: depositDraft.date || todayInputValue(),
                note: depositDraft.note.trim()
            },
            authConfig
        );

        setShowDepositModal(false);
        await fetchGoalSystemData(selectedObjective.id);
        await Swal.fire({ title: 'Depósito registrado', icon: 'success', timer: 1200, showConfirmButton: false });
    };

    const handleDeleteDeposit = async (objectiveId, depositId) => {
        const result = await Swal.fire({
            title: 'Remover depósito?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Remover',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        await axios.delete(`${API_BASE_URL}/api/finance/objective-deposits/${depositId}`, authConfig);
        await fetchGoalSystemData(objectiveId);
    };

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: `1px solid ${THEME.border}`,
        fontSize: '1rem',
        color: THEME.text.primary,
        outline: 'none',
        backgroundColor: '#FFFFFF',
        fontFamily: "'Inter', sans-serif"
    };

    const objectiveCurrent = selectedObjective ? getObjectiveCurrent(selectedObjective) : 0;
    const objectiveProgress = selectedObjective ? getObjectiveProgress(selectedObjective) : 0;
    const objectiveWeekly = selectedObjective ? getWeeklyContribution(selectedObjective) : 0;
    const SelectedIcon = selectedObjective ? (OBJECTIVE_ICON_COMPONENTS[selectedObjective.iconKey] || Icons.Custom) : Icons.Custom;

    return (
        <div style={styles.page}>
            <style>{`
                .objective-hover-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .objective-hover-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);
                }

                @media (max-width: 960px) {
                    .objective-form-grid,
                    .objective-detail-grid,
                    .objective-toolbar-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

            <header style={styles.header}>
                <div>
                    <h1 style={styles.pageTitle}>
                        <span style={{ color: '#6D28D9', display: 'flex', alignItems: 'center' }}><Icons.Target size={28} /></span>
                        Objetivos
                    </h1>
                    <p style={styles.pageSubtitle}>Metas mensais, objetivos financeiros e acompanhamentos em andamento.</p>
                </div>
                <button type="button" onClick={openAccountManager} style={styles.primaryAction}>
                    <Icons.Bank size={16} /> Adicionar banco
                </button>
            </header>

            <section style={styles.sectionShell}>
                <div style={styles.sectionHeader}>
                    <div>
                        <h2 style={styles.sectionTitle}>Metas mensais</h2>
                        <p style={styles.sectionSubtitle}>Configuração sincronizada no banco para o painel inteiro.</p>
                    </div>
                    <button type="button" onClick={() => { setIsEditingTargets((current) => !current); setTempTargets(targets); }} style={styles.secondaryAction}>
                        {isEditingTargets ? <Icons.Close size={16} /> : <Icons.Edit size={16} />}
                        {isEditingTargets ? 'Cancelar' : 'Editar metas'}
                    </button>
                </div>

                <div style={{
                    maxHeight: isEditingTargets ? '600px' : '0px',
                    opacity: isEditingTargets ? 1 : 0,
                    overflow: 'hidden',
                    transform: isEditingTargets ? 'translateY(0)' : 'translateY(-16px)',
                    transition: 'all 0.35s ease',
                    marginBottom: isEditingTargets ? '24px' : '0px'
                }}>
                    <div style={styles.editCard}>
                        <h4 style={styles.editCardTitle}><Icons.Settings size={16} /> Configurar metas mensais</h4>

                        <div className="objective-form-grid" style={styles.metricEditGrid}>
                            <div>
                                <label style={styles.metricLabel}>Meta anual de faturamento</label>
                                <input type="number" value={tempTargets.revenue_annual} onChange={(event) => handleAnnualChange(event.target.value)} style={inputStyle} />
                            </div>
                            <div>
                                <label style={styles.metricLabel}>Meta mensal de faturamento</label>
                                <input type="number" value={tempTargets.revenue} onChange={(event) => handleMonthlyChange(event.target.value)} style={inputStyle} />
                            </div>
                            <div>
                                <label style={styles.metricLabel}>Meta de peças</label>
                                <input type="number" value={tempTargets.pieces} onChange={(event) => setTempTargets((current) => ({ ...current, pieces: Number(event.target.value) }))} style={inputStyle} />
                            </div>
                            <div>
                                <label style={styles.metricLabel}>Eficiência mínima</label>
                                <input type="number" value={tempTargets.efficiency} onChange={(event) => setTempTargets((current) => ({ ...current, efficiency: Number(event.target.value) }))} style={inputStyle} />
                            </div>
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '20px' }}>
                            <button type="button" onClick={handleSaveGoals} style={styles.saveTargetsButton}>
                                <Icons.Save size={16} /> Salvar alterações
                            </button>
                        </div>
                    </div>
                </div>

                <div className="objective-toolbar-grid" style={styles.metricsGrid}>
                    <MetricCard title="Faturamento anual" current={metrics.revenueAnnual} target={targets.revenue_annual} type="money" icon={<Icons.Dollar />} colorTheme="purple" />
                    <MetricCard title="Faturamento mensal" current={metrics.revenueMonthly} target={targets.revenue} type="money" icon={<Icons.Dollar />} colorTheme="blue" />
                    <MetricCard title="Produção de peças" current={metrics.piecesMonthly} target={targets.pieces} unit="unid." icon={<Icons.Box />} colorTheme="amber" />
                    <MetricCard title="Qualidade operacional" current={metrics.efficiencyMonthly} target={targets.efficiency} unit="%" icon={<Icons.Activity />} isEfficiency={true} />
                </div>
            </section>

            <section style={styles.sectionShell}>
                {!selectedObjective ? (
                    <>
                        <div style={styles.sectionHeader}>
                            <div>
                                <h2 style={styles.sectionTitle}>Objetivos</h2>
                                <p style={styles.sectionSubtitle}>Crie objetivos patrimoniais, financeiros e acompanhe depósitos até concluir.</p>
                            </div>
                            <div style={styles.objectivesToolbar}>
                                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} style={styles.sortSelect}>
                                    {SORT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={openCreateObjective} style={styles.primaryAction}>
                                    <Icons.Plus size={16} /> Criar novo
                                </button>
                            </div>
                        </div>

                        <div style={styles.segmentWrap}>
                            <button
                                type="button"
                                onClick={() => setObjectiveTab('active')}
                                style={{
                                    ...styles.segmentButton,
                                    ...(objectiveTab === 'active' ? styles.segmentButtonActive : {})
                                }}
                            >
                                Em andamento
                            </button>
                            <button
                                type="button"
                                onClick={() => setObjectiveTab('completed')}
                                style={{
                                    ...styles.segmentButton,
                                    ...(objectiveTab === 'completed' ? styles.segmentButtonActive : {})
                                }}
                            >
                                Concluídos
                            </button>
                        </div>

                        {loadingObjectives ? (
                            <div style={styles.emptyObjectives}>
                                <strong style={{ fontSize: '1rem', color: '#0F172A' }}>Carregando objetivos...</strong>
                            </div>
                        ) : visibleObjectives.length > 0 ? (
                            <div className="objective-toolbar-grid" style={styles.objectivesGrid}>
                                {visibleObjectives.map((objective) => (
                                    <ObjectiveCard key={objective.id} objective={objective} onOpen={setActiveObjectiveId} />
                                ))}
                            </div>
                        ) : (
                            <div style={styles.emptyObjectives}>
                                <div style={styles.emptyBubble}><Icons.Target size={26} /></div>
                                <strong style={{ fontSize: '1rem', color: '#0F172A' }}>
                                    {objectiveTab === 'completed' ? 'Nenhum objetivo concluído ainda.' : 'Nenhum objetivo em andamento.'}
                                </strong>
                                <p style={{ margin: 0, color: '#64748B', maxWidth: '420px', textAlign: 'center', lineHeight: 1.6 }}>
                                    {objectiveTab === 'completed'
                                        ? 'Quando um objetivo atingir a meta ou for marcado como concluído, ele aparece aqui.'
                                        : 'Crie o primeiro objetivo e comece a acompanhar depósitos, prazo e progresso em um só lugar.'}
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div style={styles.detailHeader}>
                            <button type="button" onClick={() => setActiveObjectiveId(null)} style={styles.backButton}>
                                <Icons.ArrowLeft size={18} /> Voltar
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>{selectedObjective.name}</h2>
                                <StatusPill status={getObjectiveStatus(selectedObjective)} />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <button type="button" onClick={() => setDetailMenuOpen((current) => !current)} style={styles.secondaryAction}>
                                    <Icons.More size={16} /> Opções
                                </button>

                                {detailMenuOpen ? (
                                    <div style={styles.detailMenu}>
                                        <button type="button" onClick={() => handleEditObjective(selectedObjective)} style={styles.detailMenuItem}>
                                            <Icons.Edit size={15} /> Editar objetivo
                                        </button>
                                        <button type="button" onClick={() => handleToggleObjectiveStatus(selectedObjective)} style={styles.detailMenuItem}>
                                            <Icons.Check size={15} /> {getObjectiveStatus(selectedObjective) === 'completed' ? 'Reativar objetivo' : 'Marcar como concluído'}
                                        </button>
                                        <button type="button" onClick={() => handleDeleteObjective(selectedObjective)} style={{ ...styles.detailMenuItem, color: '#DC2626' }}>
                                            <Icons.Trash size={15} /> Excluir objetivo
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="objective-detail-grid" style={styles.detailGrid}>
                            <div style={styles.detailCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '18px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ ...styles.objectiveIconBubble, backgroundColor: selectedObjective.color, width: '44px', height: '44px' }}>
                                            <SelectedIcon size={18} />
                                        </span>
                                        <div>
                                            <strong style={{ display: 'block', fontSize: '1rem', color: '#0F172A' }}>{selectedObjective.name}</strong>
                                            <span style={{ color: '#64748B', fontSize: '0.86rem' }}>{selectedObjective.description || 'Objetivo sem descrição adicional.'}</span>
                                            <span style={{ display: 'block', marginTop: '8px', color: '#475569', fontSize: '0.86rem', fontWeight: '700' }}>
                                                <Icons.Bank size={14} /> {selectedObjective.accountName || 'Sem conta definida'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <strong style={{ display: 'block', color: '#0F172A', fontSize: '1.15rem' }}>{formatMoney(selectedObjective.targetAmount)}</strong>
                                        <span style={{ ...styles.objectiveMetaItem, justifyContent: 'flex-end' }}><Icons.Calendar size={14} /> {formatDate(selectedObjective.dueDate)}</span>
                                    </div>
                                </div>

                                <div style={{
                                    ...styles.progressRing,
                                    background: `conic-gradient(${selectedObjective.color} ${Math.min(objectiveProgress, 100)}%, #E5E7EB 0%)`
                                }}>
                                    <div style={styles.progressRingInner}>
                                        <strong style={{ fontSize: '1.4rem', color: '#0F172A' }}>{Math.round(objectiveProgress)}%</strong>
                                        <span style={{ color: '#64748B', fontSize: '0.86rem' }}>concluído</span>
                                    </div>
                                </div>

                                <div style={styles.detailMetrics}>
                                    <div style={styles.detailMetricBox}>
                                        <span style={styles.detailMetricLabel}>Guardado até agora</span>
                                        <strong style={styles.detailMetricValue}>{formatMoney(objectiveCurrent)}</strong>
                                    </div>
                                    <div style={styles.detailMetricBox}>
                                        <span style={styles.detailMetricLabel}>Falta para concluir</span>
                                        <strong style={styles.detailMetricValue}>{formatMoney(Math.max(selectedObjective.targetAmount - objectiveCurrent, 0))}</strong>
                                    </div>
                                </div>

                                <div style={styles.suggestionBox}>
                                    <span style={{ color: '#6D28D9', display: 'flex', alignItems: 'center' }}><Icons.Spark size={16} /></span>
                                    <span>
                                        Para atingir seu objetivo no prazo, você precisa poupar por semana <strong>{formatMoney(objectiveWeekly)}</strong>.
                                    </span>
                                </div>
                            </div>

                            <div style={styles.detailCard}>
                                <div style={styles.depositHeader}>
                                    <h3 style={{ ...styles.sectionTitle, fontSize: '1.05rem', marginBottom: 0 }}>Depósitos</h3>
                                    <button type="button" onClick={handleOpenDepositModal} style={styles.depositAction}>
                                        <Icons.Plus size={16} />
                                    </button>
                                </div>

                                {selectedObjective.deposits.length > 0 ? (
                                    <div style={styles.depositList}>
                                        {selectedObjective.deposits
                                            .slice()
                                            .sort((first, second) => new Date(second.date) - new Date(first.date))
                                            .map((deposit) => (
                                                <div key={deposit.id} style={styles.depositRow}>
                                                    <div>
                                                        <strong style={{ display: 'block', color: '#0F172A' }}>{formatMoney(deposit.amount)}</strong>
                                                        <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{deposit.note || 'Depósito manual'}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{formatDate(deposit.date)}</span>
                                                        <button type="button" onClick={() => handleDeleteDeposit(selectedObjective.id, deposit.id)} style={styles.iconOnlyButton}>
                                                            <Icons.Trash size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div style={styles.emptyDeposits}>
                                        Você ainda não adicionou nenhum depósito.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </section>

            <CreateObjectiveModal
                open={showCreateModal}
                step={createStep}
                draft={draftObjective}
                accounts={objectiveAccounts}
                onOpenAccountManager={openAccountManager}
                onClose={closeCreateObjective}
                onTemplateSelect={handleTemplateSelect}
                onChange={handleDraftChange}
                onSubmit={handleSaveObjective}
                onBack={() => setCreateStep('template')}
                isEditing={Boolean(editingObjectiveId)}
            />

            <AccountManagerModal
                open={showAccountModal}
                accounts={objectiveAccounts}
                draft={accountDraft}
                editingAccountId={editingAccountId}
                onClose={() => {
                    setShowAccountModal(false);
                    resetAccountDraft();
                }}
                onDraftChange={handleAccountDraftChange}
                onSubmit={handleSaveAccount}
                onEdit={handleEditAccount}
                onDelete={handleDeleteAccount}
                onReset={resetAccountDraft}
            />

            <AddDepositModal
                open={showDepositModal}
                depositDraft={depositDraft}
                onChange={handleDepositChange}
                onClose={() => setShowDepositModal(false)}
                onSubmit={handleSaveDeposit}
            />
        </div>
    );
};

const styles = {
    page: {
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: "'Inter', sans-serif",
        paddingBottom: '40px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
        flexWrap: 'wrap',
        marginBottom: '28px'
    },
    pageTitle: {
        margin: '0 0 8px 0',
        fontSize: '2rem',
        fontWeight: '800',
        letterSpacing: '-0.03em',
        color: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    pageSubtitle: {
        margin: 0,
        color: '#64748B',
        fontSize: '0.95rem',
        fontWeight: '500'
    },
    primaryAction: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        borderRadius: '16px',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 10px 18px rgba(109, 40, 217, 0.18)'
    },
    secondaryAction: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid #D9E2F2',
        borderRadius: '14px',
        padding: '11px 16px',
        backgroundColor: '#FFFFFF',
        color: '#475569',
        fontWeight: '700',
        cursor: 'pointer'
    },
    sectionShell: {
        backgroundColor: THEME.card,
        border: `1px solid ${THEME.border}`,
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 16px 30px rgba(15, 23, 42, 0.04)',
        marginBottom: '24px'
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '20px'
    },
    sectionTitle: {
        margin: '0 0 6px 0',
        color: '#0F172A',
        fontSize: '1.2rem',
        fontWeight: '800'
    },
    sectionSubtitle: {
        margin: 0,
        color: '#64748B',
        fontSize: '0.9rem',
        lineHeight: 1.5
    },
    editCard: {
        backgroundColor: '#F8FAFC',
        padding: '22px',
        borderRadius: '18px',
        border: '1px solid rgba(109, 40, 217, 0.12)'
    },
    editCardTitle: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        margin: '0 0 18px 0',
        color: '#6D28D9',
        fontSize: '0.96rem',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
    },
    metricEditGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '16px'
    },
    metricLabel: {
        display: 'block',
        marginBottom: '8px',
        color: '#475569',
        fontSize: '0.85rem',
        fontWeight: '700'
    },
    saveTargetsButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '14px',
        cursor: 'pointer',
        fontWeight: '800'
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '20px'
    },
    objectivesToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
    },
    sortSelect: {
        borderRadius: '14px',
        border: '1px solid #D9E2F2',
        backgroundColor: '#FFFFFF',
        color: '#6D28D9',
        fontWeight: '700',
        padding: '11px 14px',
        outline: 'none',
        cursor: 'pointer'
    },
    segmentWrap: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        padding: '6px',
        borderRadius: '999px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9E2F2',
        marginBottom: '24px'
    },
    segmentButton: {
        border: 'none',
        borderRadius: '999px',
        backgroundColor: 'transparent',
        color: '#475569',
        fontWeight: '800',
        padding: '12px 18px',
        cursor: 'pointer',
        transition: 'all 0.22s ease'
    },
    segmentButtonActive: {
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF',
        boxShadow: '0 10px 20px rgba(109, 40, 217, 0.18)'
    },
    objectivesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '18px'
    },
    emptyObjectives: {
        minHeight: '220px',
        borderRadius: '18px',
        border: '1px dashed #D9E2F2',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '14px',
        padding: '24px'
    },
    emptyBubble: {
        width: '54px',
        height: '54px',
        borderRadius: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F3FF',
        color: '#6D28D9'
    },
    objectiveCard: {
        border: '1px solid #D9E2F2',
        borderRadius: '20px',
        padding: '18px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05)',
        cursor: 'pointer'
    },
    objectiveCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '18px'
    },
    objectiveTitleWrap: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
    },
    objectiveIconBubble: {
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    objectiveTitle: {
        color: '#0F172A',
        fontWeight: '800',
        marginBottom: '8px',
        lineHeight: 1.35
    },
    objectiveArrow: {
        color: '#94A3B8',
        display: 'flex',
        alignItems: 'center'
    },
    objectiveTrack: {
        width: '100%',
        height: '10px',
        borderRadius: '999px',
        backgroundColor: '#E5E7EB',
        overflow: 'hidden',
        marginBottom: '10px'
    },
    objectiveFill: {
        height: '100%',
        borderRadius: '999px'
    },
    objectiveProgressRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '14px'
    },
    objectiveSaved: {
        color: '#111827',
        fontSize: '0.88rem'
    },
    objectivePercent: {
        color: '#64748B',
        fontSize: '0.86rem',
        fontWeight: '700'
    },
    objectiveMetaRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap'
    },
    objectiveMetaItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: '#64748B',
        fontSize: '0.85rem'
    },
    detailHeader: {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '22px'
    },
    backButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#334155',
        fontWeight: '800',
        cursor: 'pointer',
        padding: 0
    },
    detailMenu: {
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        zIndex: 10,
        minWidth: '220px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        boxShadow: '0 18px 34px rgba(15, 23, 42, 0.12)',
        padding: '8px'
    },
    detailMenuItem: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        border: 'none',
        backgroundColor: 'transparent',
        borderRadius: '12px',
        color: '#334155',
        fontWeight: '700',
        cursor: 'pointer',
        textAlign: 'left'
    },
    detailGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1.3fr',
        gap: '20px'
    },
    detailCard: {
        borderRadius: '22px',
        border: '1px solid #D9E2F2',
        backgroundColor: '#FFFFFF',
        padding: '22px',
        minHeight: '420px'
    },
    progressRing: {
        width: '190px',
        height: '190px',
        margin: '10px auto 24px',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    progressRingInner: {
        width: '142px',
        height: '142px',
        borderRadius: '999px',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
    },
    detailMetrics: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px',
        marginBottom: '18px'
    },
    detailMetricBox: {
        padding: '14px',
        borderRadius: '16px',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0'
    },
    detailMetricLabel: {
        display: 'block',
        color: '#64748B',
        fontSize: '0.78rem',
        fontWeight: '700',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
    },
    detailMetricValue: {
        color: '#0F172A',
        fontSize: '1.02rem',
        fontWeight: '800'
    },
    suggestionBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '14px',
        borderRadius: '16px',
        backgroundColor: '#F5F3FF',
        color: '#4C1D95',
        lineHeight: 1.6,
        fontSize: '0.9rem'
    },
    depositHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '18px'
    },
    depositAction: {
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: '#4CAF50',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 16px rgba(76, 175, 80, 0.22)'
    },
    depositList: {
        display: 'grid',
        gap: '12px'
    },
    depositRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '14px 16px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        backgroundColor: '#F8FAFC'
    },
    iconOnlyButton: {
        width: '34px',
        height: '34px',
        borderRadius: '10px',
        border: '1px solid #FECACA',
        backgroundColor: '#FEF2F2',
        color: '#DC2626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    emptyDeposits: {
        minHeight: '280px',
        borderRadius: '18px',
        border: '1px dashed #D9E2F2',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748B',
        textAlign: 'center',
        padding: '24px'
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    },
    modalCard: {
        width: '100%',
        maxWidth: '560px',
        maxHeight: '88vh',
        overflowY: 'auto',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '22px',
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.22)'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '14px',
        marginBottom: '18px'
    },
    modalTitle: {
        margin: '0 0 4px 0',
        fontSize: '1.65rem',
        fontWeight: '800',
        color: '#242424'
    },
    modalSubtitle: {
        margin: 0,
        color: '#64748B',
        fontSize: '0.9rem'
    },
    modalGhostButton: {
        border: '1px solid #D9E2F2',
        backgroundColor: '#FFFFFF',
        color: '#6D28D9',
        borderRadius: '12px',
        padding: '9px 12px',
        fontWeight: '700',
        cursor: 'pointer'
    },
    modalCloseButton: {
        width: '38px',
        height: '38px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: '#F8FAFC',
        color: '#64748B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    templateList: {
        display: 'grid',
        gap: '8px'
    },
    templateItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '12px 10px',
        borderRadius: '16px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left'
    },
    templateIcon: {
        width: '30px',
        height: '30px',
        borderRadius: '999px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    templateLabel: {
        color: '#242424',
        fontWeight: '700',
        fontSize: '1rem'
    },
    modalFormWrap: {
        display: 'grid',
        gap: '16px'
    },
    accountManagerGrid: {
        display: 'grid',
        gridTemplateColumns: '0.95fr 1.05fr',
        gap: '18px'
    },
    accountFormCard: {
        borderRadius: '22px',
        border: '1px solid #E9D5FF',
        backgroundColor: '#FCFAFF',
        padding: '22px'
    },
    accountListCard: {
        borderRadius: '22px',
        border: '1px solid #D9E2F2',
        backgroundColor: '#FFFFFF',
        padding: '22px'
    },
    accountList: {
        display: 'grid',
        gap: '12px',
        marginTop: '16px'
    },
    accountRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        backgroundColor: '#F8FAFC'
    },
    accountInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    accountColorDot: {
        width: '18px',
        height: '18px',
        borderRadius: '999px',
        flexShrink: 0
    },
    accountName: {
        display: 'block',
        color: '#0F172A',
        fontSize: '0.96rem'
    },
    accountMetaRow: {
        display: 'flex',
        gap: '8px',
        marginTop: '6px'
    },
    accountBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 10px',
        borderRadius: '999px',
        backgroundColor: '#F5F3FF',
        color: '#6D28D9',
        fontSize: '0.75rem',
        fontWeight: '800'
    },
    accountActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    accountIconButton: {
        width: '34px',
        height: '34px',
        borderRadius: '12px',
        border: '1px solid #D9E2F2',
        backgroundColor: '#FFFFFF',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    defaultToggle: {
        width: '100%',
        border: '1px solid #D9E2F2',
        borderRadius: '16px',
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        fontWeight: '700'
    },
    defaultIndicator: {
        width: '12px',
        height: '12px',
        borderRadius: '999px',
        display: 'inline-block'
    },
    fieldBlock: {
        display: 'block'
    },
    moneyFieldBlock: {
        display: 'grid',
        gap: '6px'
    },
    fieldTitle: {
        display: 'block',
        marginBottom: '8px',
        color: '#6B7280',
        fontSize: '0.78rem',
        fontWeight: '700'
    },
    fieldTitleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '8px'
    },
    inlineTextButton: {
        border: 'none',
        backgroundColor: 'transparent',
        color: '#6D28D9',
        fontWeight: '800',
        cursor: 'pointer',
        padding: 0
    },
    fieldLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        paddingBottom: '10px',
        borderBottom: '1px solid #CBD5E1'
    },
    moneyFieldShell: {
        borderBottom: '1px solid #CBD5E1',
        paddingBottom: '10px'
    },
    moneyFieldRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    moneyCurrency: {
        color: '#6D28D9',
        fontWeight: '500',
        fontSize: '2rem',
        lineHeight: 1
    },
    moneyFieldInput: {
        width: '100%',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        color: '#6D28D9',
        fontSize: '2rem',
        lineHeight: 1,
        fontWeight: '500',
        padding: 0
    },
    moneyFieldHint: {
        fontSize: '0.76rem',
        minHeight: '16px'
    },
    fieldPrefix: {
        color: '#6B7280',
        display: 'flex',
        alignItems: 'center'
    },
    fieldInput: {
        width: '100%',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        color: '#111827',
        fontSize: '1rem',
        fontWeight: '500',
        padding: '6px 0'
    },
    fieldSelect: {
        width: '100%',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        color: '#111827',
        fontSize: '1rem',
        fontWeight: '500',
        padding: '6px 0',
        appearance: 'none',
        cursor: 'pointer'
    },
    dateFieldButton: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 0 10px 0',
        border: 'none',
        borderBottom: '1px solid #CBD5E1',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left'
    },
    dateFieldValue: {
        color: '#111827',
        fontSize: '1rem',
        fontWeight: '500'
    },
    calendarPopover: {
        position: 'absolute',
        top: 'calc(100% + 10px)',
        left: 0,
        zIndex: 30,
        width: '320px',
        borderRadius: '24px',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
        border: '1px solid #E9D5FF'
    },
    calendarHero: {
        padding: '18px 18px 16px',
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF'
    },
    calendarYear: {
        display: 'block',
        fontSize: '0.95rem',
        fontWeight: '700',
        opacity: 0.88,
        marginBottom: '10px'
    },
    calendarHeroTitle: {
        display: 'block',
        fontSize: '2rem',
        fontWeight: '800',
        letterSpacing: '-0.03em'
    },
    calendarToolbar: {
        display: 'grid',
        gridTemplateColumns: '40px 1fr 40px',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 16px 8px'
    },
    calendarNavButton: {
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    calendarMonthLabel: {
        textAlign: 'center',
        color: '#475569',
        fontWeight: '700',
        textTransform: 'capitalize'
    },
    calendarWeekdays: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '0 16px 8px'
    },
    calendarWeekday: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: '0.75rem',
        fontWeight: '700'
    },
    calendarGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '6px',
        padding: '0 16px 16px'
    },
    calendarDay: {
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '14px',
        border: 'none',
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        fontWeight: '700',
        cursor: 'pointer'
    },
    calendarDayOutside: {
        opacity: 0.36
    },
    calendarDayToday: {
        boxShadow: 'inset 0 0 0 1px #C4B5FD'
    },
    calendarDaySelected: {
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF'
    },
    paletteSection: {
        display: 'grid',
        gap: '10px'
    },
    paletteRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
    },
    colorDot: {
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        border: 'none',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    iconDot: {
        width: '36px',
        height: '36px',
        borderRadius: '999px',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    addPaletteButton: {
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        border: 'none',
        backgroundColor: '#D1D5DB',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
    },
    modalSubmitButton: {
        marginTop: '8px',
        border: 'none',
        borderRadius: '999px',
        padding: '15px 18px',
        background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        color: '#FFFFFF',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 12px 24px rgba(109, 40, 217, 0.18)'
    }
};

export default Goals;
