import React from 'react';
import { Icons } from '../Icons';
import { styles } from '../../utils/ClientPortalStyles';

export const ListTab = ({
    isQuote, isLocked, items, activeItems, confirmedItems, availableSizes, summaryCounts, 
    lastAddedItem, handleRemoveItem, handleItemChange, handleConfirmItem, 
    handleSubmit, handleEditItem
}) => {
    return (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <style>{`
                .responsive-names-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%; box-sizing: border-box; }
                @media (min-width: 768px) { .responsive-names-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
                .card-bottom-row { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; box-sizing: border-box; flex-wrap: wrap; gap: 8px; }
            `}</style>

            {/* ⭐ AVISO DE VENDA QUENTE ⭐ */}
            {isQuote && !isLocked ? (
                <div style={{...styles.infoAlert, width: '100%', boxSizing: 'border-box', backgroundColor: '#EFF6FF', color: '#1E3A8A', borderColor: '#BFDBFE'}}>
                    <strong>Modo Orçamento:</strong> Preencha a lista do seu time para adiantar o processo! Assim que o negócio for fechado, sua produção iniciará rapidamente.
                </div>
            ) : isLocked ? (
                <div style={{...styles.receiptBox, width: '100%', boxSizing: 'border-box'}}>
                    <div style={styles.receiptHeader}><Icons.Lock /> <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Lista Finalizada e Termo Assinado</span></div>
                    <p style={styles.receiptText}><strong>Você confirmou a responsabilidade por esta lista.</strong> A produção seguirá exatamente a grafia dos nomes, números e tamanhos exibidos abaixo.</p>
                </div>
            ) : (
                <div style={{...styles.infoAlert, width: '100%', boxSizing: 'border-box'}}>
                    <strong>Dica importante:</strong> Não é permitido o uso de vírgulas nos nomes.
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                <h3 style={{...styles.cardTitle, margin: 0, maxWidth: '100%'}}>Relação Nominal</h3>
                <span style={styles.itemCount}>{items.length} peça(s)</span>
            </div>

            {/* ⭐ FORMULÁRIOS LIBERADOS PARA ORÇAMENTO! ⭐ */}
            {!isLocked && activeItems.map((item, index) => {
                const isFilled = item.size !== '';
                return (
                    <div key={item.id} style={{ ...styles.glassCard, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <div style={{...styles.itemCardHeader, width: '100%', boxSizing: 'border-box', flexWrap: 'wrap'}}>
                            <span style={{ ...styles.itemBadge, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#2563EB', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Camisa {confirmedItems.length + index + 1} </span>
                            {items.length > 1 && <button onClick={() => handleRemoveItem(item.id)} style={styles.glassBtnRed}><Icons.Trash /></button>}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ flex: '1 1 100%', minWidth: 0, boxSizing: 'border-box' }}>
                                <label style={styles.label}>Nome</label>
                                <input type="text" placeholder="Ex: SILVA" value={item.player_name} onChange={(e) => handleItemChange(item.id, 'player_name', e.target.value.toUpperCase())} style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0, boxSizing: 'border-box' }}>
                                <label style={styles.label}>Nº</label>
                                <input type="number" placeholder="10" value={item.player_number} onChange={(e) => handleItemChange(item.id, 'player_number', e.target.value)} style={{ ...styles.input, width: '100%', textAlign: 'center', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0, boxSizing: 'border-box' }}>
                                <label style={styles.label}>Tam.</label>
                                <select value={item.size} onChange={(e) => handleItemChange(item.id, 'size', e.target.value)} style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}>
                                    <option value="">...</option>
                                    {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                            <button onClick={() => handleConfirmItem(item.id)} disabled={!isFilled} className="btn-secondary-green" style={{ flex: '1 1 100%', minWidth: 0, padding: '10px 16px', gap: '10px', boxSizing: 'border-box' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isFilled ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.05) 100%)' : 'rgba(203, 213, 225, 0.4)', border: isFilled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(203, 213, 225, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.Add /></div>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Adicionar Camisa</span>
                            </button>
                            {confirmedItems.length > 0 && (
                                <button onClick={handleSubmit} className="btn-secondary" style={{ flex: '1 1 100%', minWidth: 0, padding: '14px 16px', gap: '8px', boxSizing: 'border-box' }}>
                                    <Icons.SendPaperPlane /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Enviar Lista ({confirmedItems.length})</span>
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {!isLocked && lastAddedItem && (
                <div className="animate-fade-in" style={{ ...styles.lastAddedGlass, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)', backdropFilter: 'blur(8px)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.Check /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Último Adicionado</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastAddedItem.player_name || 'S/ Nome'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: '10px', padding: '6px', minWidth: '35px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Nº</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>{lastAddedItem.player_number || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', padding: '6px', minWidth: '35px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', marginBottom: '2px' }}>Tam</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1D4ED8', lineHeight: '1' }}>{lastAddedItem.size}</span>
                        </div>
                    </div>
                </div>
            )}

            {confirmedItems.length > 0 && (
                <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
                    <h3 style={{...styles.cardTitle, maxWidth: '100%'}}>Lista Adicionada ({confirmedItems.length})</h3>
                    {availableSizes.map(size => {
                        const sizeItems = confirmedItems.filter(item => item.size === size);
                        if (sizeItems.length === 0) return null;
                        return (
                            <div key={size} style={{ marginBottom: '32px', width: '100%', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', width: '100%', boxSizing: 'border-box' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TAMANHO {size}</h4>
                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(203, 213, 225, 0.6) 0%, rgba(226,232,240,0) 100%)' }}></div>
                                </div>
                                <div className="responsive-names-grid">
                                    {sizeItems.map((item) => (
                                        <div key={item.id} className="animate-fade-in" style={{ ...styles.glassItemCard, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', padding: '12px' }}>
                                            <div style={{ minWidth: 0, width: '100%', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Nome</div>
                                                <div style={{ fontSize: '0.90rem', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.player_name || 'S/ Nome'}</div>
                                            </div>
                                            <div className="card-bottom-row">
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div><div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Nº</div><div style={{ fontSize: '1rem', fontWeight: '900', color: '#0F172A' }}>{item.player_number || '-'}</div></div>
                                                    <div><div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', marginBottom: '2px' }}>Tam</div><div style={{ fontSize: '1rem', fontWeight: '900', color: '#2563EB' }}>{item.size}</div></div>
                                                </div>
                                                {/* ⭐ EDIÇÃO LIBERADA SE NÃO ESTIVER TRANCADO ⭐ */}
                                                {!isLocked && (
                                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                        <button onClick={() => handleEditItem(item)} style={{...styles.glassBtnBlue, padding: '4px'}}><Icons.Edit /></button>
                                                        <button onClick={() => handleRemoveItem(item.id)} style={{...styles.glassBtnRed, padding: '4px'}}><Icons.Trash /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};