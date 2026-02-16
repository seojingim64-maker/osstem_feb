import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { VITA_SHADES, SHADE_ORDER } from '../utils/colorUtils';
import { motion } from 'framer-motion';

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

export default function Simulation({ result, onBack }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [selectedShade, setSelectedShade] = useState(result?.shade || 'A1');
    const shades = SHADE_ORDER;
    const lastLandmarksRef = useRef(null);
    const shadeRef = useRef(selectedShade);
    const [hasError, setHasError] = useState(false);

    // DEBUG: Monitor shade changes
    useEffect(() => {
        console.log("Selected Shade Changed:", selectedShade);
    }, [selectedShade]);

    useEffect(() => { shadeRef.current = selectedShade; }, [selectedShade]);

    // Define onResults safely using useCallback or stable reference
    const onResults = useCallback((results) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            lastLandmarksRef.current = results.multiFaceLandmarks[0];
        } else {
            lastLandmarksRef.current = null;
        }
    }, []);

    useEffect(() => {
        let faceMesh;
        let cameraStream;

        const init = async () => {
            try {
                faceMesh = new FaceMesh({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });

                faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                faceMesh.onResults(onResults);

                // Start Camera
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: 1280, height: 720 }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = cameraStream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play().catch(e => console.error("Play error:", e));
                        requestAnimationFrame(processFrame);
                    };
                }
            } catch (error) {
                console.error("Simulation Init Error:", error);
                setHasError(true);
            }
        };

        const processFrame = async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
                // Keep checking if just paused momentarily
                if (videoRef.current && !videoRef.current.ended) {
                    requestAnimationFrame(processFrame);
                }
                return;
            }

            try {
                if (faceMesh) {
                    await faceMesh.send({ image: videoRef.current });
                }
            } catch (error) {
                console.error("FaceMesh Send Error:", error);
            }

            requestAnimationFrame(processFrame);
        };

        init();

        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            if (faceMesh) {
                faceMesh.close();
            }
        };
    }, [onResults]);


    const [isComparing, setIsComparing] = useState(false);

    // Helper refs for off-screen canvas (to avoid re-creating every frame)
    const scratchCanvasRef = useRef(null);

    // Separate render loop for drawing video and overlay to canvas
    useEffect(() => {
        let animationFrameId;

        const render = () => {
            if (canvasRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                const ctx = canvasRef.current.getContext('2d');
                const width = canvasRef.current.width;
                const height = canvasRef.current.height;

                // Ensure scratch canvas exists and matches size
                if (!scratchCanvasRef.current) {
                    scratchCanvasRef.current = document.createElement('canvas');
                }
                if (scratchCanvasRef.current.width !== width || scratchCanvasRef.current.height !== height) {
                    scratchCanvasRef.current.width = width;
                    scratchCanvasRef.current.height = height;
                }
                const sCtx = scratchCanvasRef.current.getContext('2d');

                // 1. Draw Video
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(videoRef.current, 0, 0, width, height);

                // 2. Overlay Teeth Filter (only if NOT comparing)
                if (lastLandmarksRef.current && !isComparing) {
                    const landmarks = lastLandmarksRef.current;

                    // Helper to calculate centroid
                    let cx = 0, cy = 0, count = 0;
                    const addPoint = (idx) => { cx += landmarks[idx].x; cy += landmarks[idx].y; count++; };
                    UPPER_INNER_LIP.forEach(addPoint); LOWER_INNER_LIP.forEach(addPoint);
                    cx /= count; cy /= count;

                    // Helper to map and shrink point
                    const mapPoint = (idx) => {
                        const pt = landmarks[idx];
                        // Shrink factor: 0.88 (conservative) + Blur will expand it back slightly
                        const factor = 0.88;
                        const dx = pt.x - cx;
                        const dy = pt.y - cy;
                        return {
                            x: (cx + dx * factor) * width,
                            y: (cy + dy * factor) * height
                        };
                    };

                    // ---- TEETH CLIPPING MASK ----
                    ctx.save();
                    ctx.beginPath();

                    // Trace the inner mouth (Teeth area)
                    const start = mapPoint(UPPER_INNER_LIP[0]);
                    ctx.moveTo(start.x, start.y);
                    UPPER_INNER_LIP.forEach(idx => { const p = mapPoint(idx); ctx.lineTo(p.x, p.y); });
                    LOWER_INNER_LIP.forEach(idx => { const p = mapPoint(idx); ctx.lineTo(p.x, p.y); });

                    ctx.closePath();
                    ctx.clip();

                    // ---- APPLY SIMPLE WHITENING (No Complex Blends) ----
                    const shade = shadeRef.current;
                    const shadeRgb = VITA_SHADES[shade].rgb;

                    // 1. Brighten the teeth base (Draw video again with brightness)
                    ctx.save();
                    ctx.filter = 'brightness(1.5) saturate(0.6)'; // Brighten and de-saturate slightly
                    ctx.drawImage(videoRef.current, 0, 0, width, height);
                    ctx.restore();

                    // 2. Apply Shade Color (Simple Paint Over)
                    let targetColor;
                    if (shade === 'B1') {
                        targetColor = 'rgb(255, 255, 255)';
                    } else if (shade === 'C4') {
                        targetColor = 'rgb(93, 64, 55)';
                    } else {
                        targetColor = `rgb(${shadeRgb[0]}, ${shadeRgb[1]}, ${shadeRgb[2]})`;
                    }

                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over'; // Standard blending
                    ctx.fillStyle = targetColor;
                    // Adjust opacity based on shade brightness
                    if (shade === 'B1') {
                        ctx.globalAlpha = 0.4; // White needs less opacity to look natural-ish (or 0.5 for effect)
                    } else if (shade === 'C4') {
                        ctx.globalAlpha = 0.6; // Dark needs more to be visible
                    } else {
                        ctx.globalAlpha = 0.45;
                    }
                    ctx.fillRect(0, 0, width, height);
                    ctx.restore();

                    // 3. Optional Gloss/Highlight (Screen)
                    if (shade === 'B1') {
                        ctx.save();
                        ctx.globalCompositeOperation = 'screen';
                        ctx.fillStyle = '#FFFFFF';
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(0, 0, width, height);
                        ctx.restore();
                    }

                    ctx.restore(); // End Clip
                }

                // (Debug overlays removed)
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [isComparing]); // Re-bind when comparing state changes

    const goToProduct = () => {
        // UTM params
        const url = "https://www.osstem.com/product/beautis?utm_source=shade_analyzer&utm_medium=web&utm_campaign=simulation"; // Hypothetical URL
        window.location.href = url;
    };

    if (hasError) {
        return (
            <div className="full-screen flex-center" style={{ flexDirection: 'column', padding: '24px', background: '#f2f4f6' }}>
                <h3 className="h2" style={{ color: 'var(--error)' }}>카메라/AI 로딩 오류</h3>
                <p className="p" style={{ marginBottom: '24px' }}>잠시 후 다시 시도해주세요.</p>
                <button onClick={onBack} className="btn-primary">돌아가기</button>
            </div>
        );
    }

    return (
        <div className="full-screen" style={{ backgroundColor: '#000' }}>
            <video
                ref={videoRef}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                autoPlay
                playsInline
                muted
            />

            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="full-screen"
                style={{ transform: 'scaleX(-1)', objectFit: 'cover' }}
            />

            {/* UI Overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '20px', zIndex: 10, display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={onBack} style={{ color: 'white', fontSize: '16px', background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer' }}>
                    ← 다시 측정하기
                </button>

                {/* Compare Button */}
                <button
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                    style={{
                        color: 'white',
                        fontSize: '14px',
                        background: isComparing ? 'var(--primary)' : 'rgba(0,0,0,0.5)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                    }}
                >
                    {isComparing ? '원본 화면' : '비교하기 (누르고 계세요)'}
                </button>
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'white', borderRadius: '24px 24px 0 0', padding: '24px', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className="h2">VITA Shade Simulation</h3>
                    <span style={{ fontSize: '14px', color: '#666' }}>{selectedShade}</span>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    paddingBottom: '16px',
                    marginBottom: '16px',
                    scrollbarWidth: 'none', // Hide scrollbar for cleaner look
                    msOverflowStyle: 'none'
                }}>
                    {shades.map(s => (
                        <button
                            key={s}
                            onClick={() => setSelectedShade(s)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                flexShrink: 0
                            }}
                        >
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                backgroundColor: `rgb(${VITA_SHADES[s].rgb.join(',')})`,
                                border: selectedShade === s ? '3px solid var(--primary)' : '1px solid #eee',
                                boxShadow: selectedShade === s ? '0 0 0 2px white inset' : 'none',
                                marginBottom: '4px',
                                transition: 'all 0.2s ease'
                            }} />
                            <span style={{
                                fontSize: '12px',
                                color: selectedShade === s ? 'var(--primary)' : '#888',
                                fontWeight: selectedShade === s ? 'bold' : 'normal'
                            }}>
                                {s}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Product Recommendation Card */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open('https://vussen.co.kr/category/vutees/74/', '_blank')}
                    style={{
                        width: '100%',
                        backgroundColor: '#FF7A00', // Updated Orange Theme
                        borderRadius: '20px',
                        padding: '20px',
                        border: 'none',
                        boxShadow: '0 8px 20px rgba(255, 122, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        textAlign: 'left'
                    }}
                >
                    <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: 'white',
                        marginBottom: '6px',
                        letterSpacing: '-0.5px'
                    }}>
                        효과 높은 자가 미백제, 뷰티스 홈
                    </div>
                    <div style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.9)',
                        fontWeight: '500',
                        lineHeight: '1.4'
                    }}>
                        뷰티스 특허성분 함유로 우수한 미백효과<br />
                        (최대 7단계, A3.5 → A2)
                    </div>

                    {/* Glossy sheen effect overlay */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(45deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 60%)',
                        pointerEvents: 'none'
                    }} />
                </motion.button>
            </div>
        </div>
    );
}
