import { Icons } from '../Icons';
import { styles } from '../../utils/ClientPortalStyles';
import { appConfig } from '../../config/appConfig';

export const BulkTab = ({
    preview = false,
    isQuote, availableSizes, summaryCounts
}) => {
    const adultSizes = availableSizes.filter(s => !s.includes('ANOS') && Number(summaryCounts[s]) > 0);
    const kidsSizes = availableSizes.filter(s => s.includes('ANOS') && Number(summaryCounts[s]) > 0);
    const totalPieces = Object.values(summaryCounts).reduce((acc, val) => acc + (Number(val) || 0), 0);

    const renderGrid = (sizesList) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
            {sizesList.map(size => {
                const count = Number(summaryCounts[size]) || 0;
                if (count === 0) return null;
                return (
                    <div key={size} style={{ backgroundColor: '#F4F7FA', border: '1px solid #E9EEF5', borderRadius: '10px', padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.80rem', fontWeight: '800', color: '#54657E', whiteSpace: 'nowrap' }}>{size}</span>
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DDE4EE', borderRadius: '6px', padding: '6px', width: '100%', maxWidth: '55px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '800', color: '#475569' }}>{count}</div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={`animate-fade-in${preview ? ' portal-tab portal-bulk-tab' : ''}`} style={{ width: '100%', boxSizing: 'border-box' }}>
            
            <div style={{...styles.receiptBox, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE'}}>
                <div style={styles.receiptHeader}><Icons.Lock /> <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>Somente visualização</span></div>
                <p style={styles.receiptText}>A grade deste {isQuote ? 'orçamento' : 'pedido'} é definida pela {appConfig.brandName} e não pode ser alterada pelo portal.</p>
            </div>
             
            <div className={preview ? 'portal-card' : undefined} style={styles.glassCard}>
                <h3 style={styles.cardTitle}>{isQuote ? 'Grade do Orçamento' : 'Grade do Pedido'}</h3>
                {totalPieces === 0 ? (
                    <p style={{ color: '#64748B', margin: '16px 0 0', textAlign: 'center', fontWeight: '600' }}>A grade ainda não foi informada.</p>
                ) : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    {adultSizes.length > 0 && (
                        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Adulto</h4>
                            {renderGrid(adultSizes)}
                        </div>
                    )}
                    {kidsSizes.length > 0 && (
                        <div style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Infantil</h4>
                            {renderGrid(kidsSizes)}
                        </div>
                    )}
                </div>}
            </div>
        </div>
    );
};
