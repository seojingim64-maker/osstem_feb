import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Permission({ onGranted }) {
    const [error, setError] = useState(null);

    const requestCamera = async () => {
        try {
            if (navigator.vibrate) navigator.vibrate(50);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            // Stop the tracks immediately, we just needed permission
            stream.getTracks().forEach(track => track.stop());
            onGranted();
        } catch (err) {
            console.error(err);
            setError('카메라 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
        }
    };

    return (
        <div className="full-screen flex-center" style={{ flexDirection: 'column', padding: '24px', justifyContent: 'space-between', paddingBottom: '40px', paddingTop: '100px' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ textAlign: 'center', width: '100%' }}
            >
                <h2 className="h1" style={{ fontSize: '28px', whiteSpace: 'pre-line' }}>
                    정확한 측정을 위해{'\n'}카메라를 켤게요
                </h2>
                <p className="p" style={{ marginTop: '12px' }}>
                    치아 색상 분석을 위해{'\n'}카메라 접근 권한이 필요합니다.
                </p>
            </motion.div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyItems: 'center', width: '100%', justifyContent: 'center' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: '#f2f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <span style={{ fontSize: '32px' }}>📷</span>
                </motion.div>
            </div>

            <div style={{ width: '100%' }}>
                {error && <p style={{ color: 'var(--error)', marginBottom: '16px', textAlign: 'center', fontSize: '14px' }}>{error}</p>}
                <motion.button
                    className="btn-primary"
                    whileTap={{ scale: 0.96 }}
                    onClick={requestCamera}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    카메라 켜기
                </motion.button>
            </div>
        </div>
    );
}
