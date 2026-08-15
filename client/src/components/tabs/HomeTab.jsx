import React, { useMemo } from 'react';
import { Icons } from '../Icons';
import { styles } from '../../utils/ClientPortalStyles';

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
}).format(Number(value || 0));

const getLineQuantity = (sizes) => Object.values(sizes || {}).reduce((total, qty) => total + (Number(qty) || 0), 0);

export const HomeTab = ({ order, API_BASE_URL, needsArtApproval, artIsApproved, onApproveArt }) => {
    const productLines = useMemo(() => (
        Array.isArray(order?.product_lines) ? order.product_lines : []
    ), [order?.product_lines]);

    const hasDetailedLines = productLines.length > 0;
    const hasGeneralNotes = Boolean(String(order?.observacao || '').trim());
    const isQuote = String(order?.tracking_code || '').startsWith('#ORC-');

    return (
        <div className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={styles.cardPremium}>
                <h3 style={styles.cardTitle}>Sua Arte e Layout</h3>

                {hasDetailedLines ? (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {productLines.map((line, index) => {
                            const quantity = getLineQuantity(line.sizes_json);
                            const hasImage = Boolean(line.layout_path);

                            return (
                                <div
                                    key={line.id || `${line.product_type || 'produto'}-${index}`}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.68)',
                                        border: '1px solid rgba(226, 232, 240, 0.9)',
                                        borderRadius: '18px',
                                        overflow: 'hidden',
                                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)'
                                    }}
                                >
                                    {hasImage ? (
                                        <img
                                            src={`${API_BASE_URL}/uploads/${line.layout_path}`}
                                            alt={line.product_type || `Produto ${index + 1}`}
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                                maxHeight: '320px',
                                                objectFit: 'contain',
                                                display: 'block',
                                                backgroundColor: 'rgba(15, 23, 42, 0.02)'
                                            }}
                                        />
                                    ) : (
                                        <div style={{ ...styles.noMockup, margin: 0, borderRadius: 0 }}>
                                            Layout deste item ainda não foi enviado.
                                        </div>
                                    )}

                                    <div style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                                    Produto {index + 1}
                                                </div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: '#0F172A', lineHeight: 1.35 }}>
                                                    {line.product_type || 'Produto personalizado'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Subtotal
                                                </div>
                                                <div style={{ fontSize: '1rem', color: '#0F172A', fontWeight: '800' }}>
                                                    {formatMoney(line.total_price)}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#1D4ED8', border: '1px solid rgba(37, 99, 235, 0.16)', borderRadius: '999px', padding: '6px 12px', fontSize: '0.82rem', fontWeight: '700' }}>
                                                {quantity} peça(s)
                                            </div>
                                            {line.fabric_type ? (
                                                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.04)', color: '#475569', border: '1px solid rgba(203, 213, 225, 0.9)', borderRadius: '999px', padding: '6px 12px', fontSize: '0.82rem', fontWeight: '700' }}>
                                                    {line.fabric_type}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : order.layout_path ? (
                    <img src={`${API_BASE_URL}/uploads/${order.layout_path}`} alt="Arte do Fardamento" style={styles.mockupImage} />
                ) : (
                    <div style={styles.noMockup}>Nenhuma imagem vinculada a este pedido ainda.</div>
                )}

                {hasGeneralNotes ? (
                    <div
                        style={{
                            marginTop: '16px',
                            border: '1px solid rgba(253, 224, 71, 0.55)',
                            background: 'linear-gradient(135deg, rgba(254, 249, 195, 0.95), rgba(255, 247, 237, 0.92))',
                            borderRadius: '16px',
                            padding: '16px'
                        }}
                    >
                        <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            {isQuote ? 'Observações Gerais do Orçamento' : 'Observações Gerais'}
                        </div>
                        <div style={{ color: '#78350F', fontSize: '0.92rem', lineHeight: 1.6, fontWeight: '600', whiteSpace: 'pre-wrap' }}>
                            {order.observacao}
                        </div>
                    </div>
                ) : null}
                
                {needsArtApproval && (
                    <button onClick={onApproveArt} className="btn-amber" style={{ marginTop: '16px' }}>
                        <Icons.Check /> Aprovar Arte e Layout
                    </button>
                )}

                {artIsApproved && (
                    <div style={{ marginTop: '24px', backgroundColor: '#ECFDF5', padding: '16px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065F46', marginBottom: '4px' }}>
                            <Icons.Check /> <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Termo de Responsabilidade Assinado (Arte)</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#065F46', lineHeight: '1.5', margin: 0 }}>Você aprovou eletronicamente esta arte. A produção foi autorizada a seguir o layout acima.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
