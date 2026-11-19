export const formatCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 15);
    if (!digits) return '';

    return (Number(digits) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

export const parseCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return 0;
    return Number((Number(digits) / 100).toFixed(2));
};

export const formatCurrencyValueInput = (value) => Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
