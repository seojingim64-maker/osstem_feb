import { motion } from 'framer-motion';
import { VITA_SHADES, SHADE_ORDER } from '../utils/colorUtils';

export default function Result({ result, onSimulate }) {
    const shades = SHADE_ORDER;

    return (
        <div className="full-screen flex-center" style={{ flexDirection: 'column', padding: '24px', paddingTop: '80px', justifyContent: 'flex-start' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{ textAlign: 'center', marginBottom: '40px' }}
            >
                <p className="p" style={{ fontSize: '18px', marginBottom: '8px' }}>현재 고객님의 치아는</p>
                <h1 className="h1" style={{ fontSize: '42px', color: 'var(--primary)' }}>{result?.shade || 'A2'}</h1>
                <p className="p">단계 입니다.</p>
            </motion.div>

            {/* Visual Shade Guide Representation */}
            <div style={{ width: '100%', marginBottom: '40px', overflowX: 'auto', paddingBottom: '20px' }}>
                <p style={{ marginBottom: '12px', fontSize: '14px', color: '#8b95a1' }}>Shade Guide 위치</p>
                <div style={{ display: 'flex', gap: '8px', padding: '0 4px' }}>
                    {shades.map((shade) => (
                        <div key={shade} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: '32px',
                                height: '40px',
                                backgroundColor: `rgb(${VITA_SHADES[shade].rgb.join(',')})`,
                                borderRadius: '4px',
                                border: result?.shade === shade ? '2px solid var(--primary)' : '1px solid #eee',
                                transform: result?.shade === shade ? 'scale(1.1) translateY(-4px)' : 'scale(1)',
                                transition: 'all 0.3s'
                            }} />
                            <span style={{ fontSize: '12px', marginTop: '4px', fontWeight: result?.shade === shade ? 'bold' : 'normal' }}>{shade}</span>
                            {result?.shade === shade && <div style={{ width: '100%', height: '2px', background: 'var(--primary)', marginTop: '2px' }} />}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ width: '100%', marginTop: 'auto' }}>
                <motion.button
                    className="btn-primary"
                    whileTap={{ scale: 0.96 }}
                    onClick={onSimulate}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    미백 시뮬레이션 해보기
                </motion.button>
            </div>
            <div style={{ padding: '0 24px 24px', textAlign: 'center', marginTop: '16px' }}>
                <p style={{ fontSize: '11px', color: '#999', lineHeight: '1.4' }}>
                    본 결과는 AI를 활용한 시뮬레이션이며, 실제 치과 진단 결과와는 차이가 있을 수 있습니다.<br />
                    정확한 상태는 전문가와 상담하세요.
                </p>
            </div>
        </div>
    );
}
