import React from 'react';
import { Icons } from '../Icons';

export const FinanceTab = ({ remainingOrder, percentPaid, totalOrder, paidOrder, formatMoney }) => {
    return (
        <div className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{ 
                background: 'linear-gradient(135deg, rgba(241, 245, 249, 0.8) 0%, rgba(226, 232, 240, 0.5) 100%)', 
                backdropFilter: 'saturate(150%) blur(24px)', WebkitBackdropFilter: 'saturate(150%) blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.6)', borderTop: '1px solid rgba(255, 255, 255, 0.9)', 
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1)',
                borderRadius: '24px', padding: '24px', color: '#0F172A', marginBottom: '16px', position: 'relative', overflow: 'hidden' 
            }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03, transform: 'scale(3)', color: '#0F172A' }}>
                    <Icons.Dollar />
                </div>
                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Saldo a Pagar</span>
                <span style={{ display: 'block', fontSize: '2.5rem', fontWeight: '900', color: remainingOrder > 0 ? '#EF4444' : '#10B981', marginBottom: '24px', letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    {formatMoney(remainingOrder)}
                </span>
                
                <div style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: `${percentPaid}%`, background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', height: '100%', borderRadius: '8px', transition: 'width 1s ease-in-out' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', fontWeight: '800' }}>
                    <span>{percentPaid.toFixed(0)}% Pago</span>
                    <span>Total: {formatMoney(totalOrder)}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(241, 245, 249, 0.5) 100%)', backdropFilter: 'saturate(150%) blur(20px)', WebkitBackdropFilter: 'saturate(150%) blur(20px)', borderRadius: '20px', padding: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)', border: '1px solid rgba(255, 255, 255, 0.6)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Wallet />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Total</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0F172A' }}>{formatMoney(totalOrder)}</span>
                </div>
                <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(241, 245, 249, 0.5) 100%)', backdropFilter: 'saturate(150%) blur(20px)', WebkitBackdropFilter: 'saturate(150%) blur(20px)', borderRadius: '20px', padding: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,1)', border: '1px solid rgba(255, 255, 255, 0.6)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)', backdropFilter: 'blur(8px)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Check />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Já Pago</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0F172A' }}>{formatMoney(paidOrder)}</span>
                </div>
            </div>
        </div>
    );
};