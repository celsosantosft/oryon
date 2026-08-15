import React from 'react';
import { styles } from '../../utils/ClientPortalStyles';

export const TrackingTab = ({ order, currentStepIndex, STATUS_STEPS_CONFIG }) => {
    return (
        <div className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={styles.cardPremium}>
                <h3 style={styles.cardTitle}>Status de Produção</h3>
                {order.status === 'Cancelado' ? (
                    <div style={{ padding: '20px', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '12px', fontWeight: '700', textAlign: 'center' }}>Este pedido foi cancelado.</div>
                ) : (
                    <div style={{ marginTop: '24px' }}>
                        {STATUS_STEPS_CONFIG.map((stepObj, index) => {
                            const isCompleted = currentStepIndex >= index;
                            const isCurrent = currentStepIndex === index;
                            const isLast = index === STATUS_STEPS_CONFIG.length - 1;
                            const StepIcon = stepObj.icon;
                            
                            return (
                                <div key={stepObj.name} style={styles.timelineItem}>
                                    {!isLast && <div style={styles.timelineLine(isCompleted)}></div>}
                                    <div style={isCurrent ? styles.timelineDotCurrent : (isCompleted ? styles.timelineDotCompleted : styles.timelineDotPending)}>
                                        <StepIcon />
                                    </div>
                                    <div style={styles.timelineTextWrapper}>
                                        <span style={isCurrent ? styles.timelineTextCurrent : (isCompleted ? styles.timelineTextCompleted : styles.timelineTextPending)}>{stepObj.name}</span>
                                        {isCurrent && <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: '800', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status Atual</span>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};