import { motion } from 'framer-motion';

export default function Landing({ onStart }) {
    return (
        <div className="full-screen flex-center" style={{ flexDirection: 'column', padding: '24px', justifyContent: 'space-between', paddingBottom: '40px', paddingTop: '100px' }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Toss-like spring curve
                style={{ textAlign: 'center', width: '100%' }}
            >
                <h1 className="h1" style={{ fontSize: '32px', marginBottom: '12px' }}>
                    3초 만에 확인하는<br />
                    <span style={{ color: 'var(--primary)' }}>나의 치아 톤</span>
                </h1>
                <p className="p" style={{ opacity: 0.8 }}>AI가 정밀하게 분석해 드릴게요.</p>
            </motion.div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    style={{
                        width: '120px',
                        height: '120px',
                        background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
                        borderRadius: '50%',
                        marginBottom: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(49, 130, 246, 0.15)'
                    }}
                >
                    {/* Placeholder for a tooth icon or illustration */}
                    <span style={{ fontSize: '48px' }}>🦷</span>
                </motion.div>
            </div>

            <motion.button
                className="btn-primary"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(50);
                    onStart();
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                style={{
                    boxShadow: '0 4px 14px rgba(49, 130, 246, 0.3)',
                    height: '56px',
                    fontSize: '17px'
                }}
            >
                내 치아 색상 확인하기
            </motion.button>
        </div>
    );
}
