import { Icons } from '../Icons';
import { styles } from '../../utils/ClientPortalStyles';
import { appConfig } from '../../config/appConfig';

export const BulkTab = ({
    preview = false,
    isQuote, summaryCounts, productLines = []
}) => {
    const normalizeSize = (size) => {
        const value = String(size || '').trim().toUpperCase();
        return /^(2|4|6|8|10|12|14)$/.test(value) ? `${value} ANOS` : value;
    };
    const sizeOrder = ['2 ANOS', '4 ANOS', '6 ANOS', '8 ANOS', '10 ANOS', '12 ANOS', '14 ANOS', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'];
    const toGradeEntries = (sizes = {}) => {
        const counts = Object.entries(sizes || {}).reduce((result, [size, quantity]) => {
            const label = normalizeSize(size);
            result[label] = (result[label] || 0) + (Number(quantity) || 0);
            return result;
        }, {});

        return Object.entries(counts)
            .map(([size, quantity]) => ({ size, quantity }))
            .filter(({ quantity }) => quantity > 0)
            .sort((left, right) => {
            const leftRank = sizeOrder.indexOf(left.size);
            const rightRank = sizeOrder.indexOf(right.size);
            if (leftRank === -1 && rightRank === -1) return left.size.localeCompare(right.size, 'pt-BR');
            if (leftRank === -1) return 1;
            if (rightRank === -1) return -1;
            return leftRank - rightRank;
        });
    };

    const detailedGrades = (Array.isArray(productLines) ? productLines : [])
        .map((line, index) => {
            let sizes = line?.sizes_json || {};
            if (typeof sizes === 'string') {
                try { sizes = JSON.parse(sizes); } catch { sizes = {}; }
            }
            const entries = toGradeEntries(sizes);
            return {
                id: line?.id || index,
                index,
                productName: line?.product_type || `Produto ${index + 1}`,
                fabricName: line?.fabric_type || '',
                entries,
                total: entries.reduce((sum, entry) => sum + entry.quantity, 0)
            };
        })
        .filter(({ total }) => total > 0);

    const fallbackEntries = toGradeEntries(summaryCounts);
    const gradeSections = detailedGrades.length > 0
        ? detailedGrades
        : [{ id: 'summary', index: 0, productName: '', fabricName: '', entries: fallbackEntries, total: fallbackEntries.reduce((sum, entry) => sum + entry.quantity, 0) }];
    const totalPieces = gradeSections.reduce((sum, section) => sum + section.total, 0);

    const renderGrid = (entries) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
            {entries.map(({ size, quantity }) => (
                <div key={size} style={{ backgroundColor: '#F4F7FA', border: '1px solid #E9EEF5', borderRadius: '10px', padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.80rem', fontWeight: '800', color: '#54657E', whiteSpace: 'nowrap' }}>{size}</span>
                    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DDE4EE', borderRadius: '6px', padding: '6px', width: '100%', maxWidth: '55px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '800', color: '#475569' }}>{quantity}</div>
                </div>
            ))}
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
                    {gradeSections.map((section) => {
                        const adultEntries = section.entries.filter(({ size }) => !size.includes('ANOS'));
                        const kidsEntries = section.entries.filter(({ size }) => size.includes('ANOS'));
                        return (
                            <section key={section.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                                {detailedGrades.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '2px 2px 12px', borderBottom: '1px solid #E2E8F0' }}>
                                        <div>
                                            <div style={{ color: '#2563EB', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Produto {section.index + 1}</div>
                                            <div style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '800', lineHeight: 1.35 }}>{section.productName}</div>
                                            {section.fabricName && <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600', marginTop: '2px' }}>{section.fabricName}</div>}
                                        </div>
                                        <strong style={{ color: '#0F172A', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{section.total} peça(s)</strong>
                                    </div>
                                )}
                                {kidsEntries.length > 0 && (
                                    <div style={{ marginTop: detailedGrades.length > 0 ? '12px' : 0 }}>
                                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Infantil</h4>
                                        {renderGrid(kidsEntries)}
                                    </div>
                                )}
                                {adultEntries.length > 0 && (
                                    <div style={{ marginTop: kidsEntries.length > 0 ? '16px' : (detailedGrades.length > 0 ? '12px' : 0) }}>
                                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Tamanho Adulto</h4>
                                        {renderGrid(adultEntries)}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>}
            </div>
        </div>
    );
};
