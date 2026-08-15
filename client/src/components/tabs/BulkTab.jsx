import React from 'react';
import { Icons } from '../Icons';
import { styles } from '../../utils/ClientPortalStyles';

export const BulkTab = ({
    isQuote, isLocked, isUsingNominalList, hasAdminSizes, availableSizes, summaryCounts, 
    totalConfirmed, bulkSizes, setBulkSizes, handleBulkSubmit
}) => {
    const adultSizes = availableSizes.filter(s => !s.includes('ANOS'));
    const kidsSizes = availableSizes.filter(s => s.includes('ANOS'));
    const totalPieces = Object.values(bulkSizes).reduce((acc, val) => acc + (parseInt(val) || 0), 0);
    const isReadOnlyGrade = isLocked || isUsingNominalList || hasAdminSizes;

    const renderGrid = (sizesList, isSummary) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
            {sizesList.map(size => {
                if (isSummary) {
                    const count = summaryCounts[size] || 0;
                    if (count === 0) return null; 
                    return (
                        <div key={size} style={{ backgroundColor: '#F4F7FA', border: '1px solid #E9EEF5', borderRadius: '10px', padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: '800', color: '#54657E', whiteSpace: 'nowrap' }}>{size}</span>
                            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DDE4EE', borderRadius: '6px', padding: '6px', width: '100%', maxWidth: '55px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '800', color: '#475569' }}>{count}</div>
                        </div>
                    );
                } else {
                    return (
                        <div key={size} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', whiteSpace: 'nowrap' }}>{size}</span>
                            <input type="number" min="0" placeholder="0" value={bulkSizes[size] || ''} onChange={(e) => setBulkSizes({...bulkSizes, [size]: e.target.value})} 
                                style={{ width: '90%', maxWidth: '55px', padding: '6px 0', textAlign: 'center', fontSize: '0.95rem', fontWeight: '700', borderRadius: '6px', border: '1px solid #CBD5E1', outline: 'none', color: '#0F172A', backgroundColor: '#FFFFFF' }} 
                            />
                        </div>
                    );
                }
            })}
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
            
            {hasAdminSizes && !isLocked && !isUsingNominalList ? (
                <div style={{...styles.receiptBox, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0'}}>
                    <div style={styles.receiptHeader}><Icons.Check /> <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Grade já registrada</span></div>
                    <p style={styles.receiptText}><strong>As quantidades deste {isQuote ? 'orçamento' : 'pedido'} já foram informadas pela Atos.</strong> Não é necessário enviar ou aprovar a grade novamente.</p>
                </div>
            ) : isQuote && !isLocked ? (
                <div style={{...styles.infoAlert, backgroundColor: '#EFF6FF', color: '#1E3A8A', borderColor: '#BFDBFE'}}>
                    <strong>Modo Orçamento:</strong> Você já pode preencher a grade de quantidades para adiantar o processo!
                </div>
            ) : isLocked ? (
                <div style={styles.receiptBox}>
                    <div style={styles.receiptHeader}><Icons.Lock /> <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Lista Finalizada</span></div>
                    <p style={styles.receiptText}><strong>Você assumiu a responsabilidade por esta grade.</strong> A produção seguirá as quantidades abaixo.</p>
                </div>
            ) : isUsingNominalList ? (
                <div style={styles.infoAlert}>
                    <strong>Resumo Automático:</strong> Como você preencheu a <strong>Lista Nominal</strong>, esta aba serve apenas de visualização.
                </div>
            ) : (
                <div style={styles.infoAlert}>
                    <strong>Atenção:</strong> Preencha esta aba se suas camisas não precisam de nomes ou números.
                </div>
            )}
             
            <div style={styles.glassCard}>
                <h3 style={styles.cardTitle}>{hasAdminSizes && !isUsingNominalList ? 'Grade registrada' : isQuote ? 'Grade do Orçamento' : isLocked ? 'Sua Grade Oficial' : (isUsingNominalList ? 'Resumo da Grade Nominal' : 'Montar Grade Fechada')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    {adultSizes.length > 0 && (
                        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Adulto</h4>
                            {renderGrid(adultSizes, isReadOnlyGrade)}
                        </div>
                    )}
                    {kidsSizes.length > 0 && (
                        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Infantil</h4>
                            {renderGrid(kidsSizes, isReadOnlyGrade)}
                        </div>
                    )}
                </div>

                {!isReadOnlyGrade && (
                    <button onClick={handleBulkSubmit} className="btn-secondary" style={{ marginTop: '20px', width: '100%', padding: '16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <Icons.SendPaperPlane /> Enviar Grade ({totalPieces} peças)
                    </button>
                )}
            </div>
        </div>
    );
};
