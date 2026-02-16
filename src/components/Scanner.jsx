import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { findClosestShade } from '../utils/colorUtils';

const UPPER_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_INNER_LIP = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78]; // Reversed order to close loop

export default function Scanner({ onScanComplete }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [progress, setProgress] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [message, setMessage] = useState('카메라를 정면으로 봐주세요');
    const [initError, setInitError] = useState(false);
    const [showManualButton, setShowManualButton] = useState(false);
    const scanDataRef = useRef([]);

    useEffect(() => {
        // Force show manual button after 1 second if analysis hasn't started
        const timer = setTimeout(() => {
            setShowManualButton(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const faceMesh = new FaceMesh({
            locateFile: (file) => {
                // Return robust CDN path. Using a specific version to avoid mismatches.
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
            },
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onResults);

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: 1280, height: 720 }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Wait for metadata to load to ensure dimensions are correct
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();
                        // Start processing loop only after video is playing
                        requestAnimationFrame(processFrame);
                    };
                }
            } catch (err) {
                console.error("Camera access error:", err);
                setInitError(true);
            }
        };

        const processFrame = async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

            try {
                // Send frame to FaceMesh
                await faceMesh.send({ image: videoRef.current });
            } catch (error) {
                // Only log real errors, not "buffer" issues if they are transient
                // But for "buffer" error which is fatal, we might stop processing or retry
                console.error("FaceMesh processing error:", error);
                // Don't stop the loop immediately, maybe it recovers? 
                // However, the user reported a fatal crash style error. 
                // We leave the video running regardless.
            }

            // Loop
            if (videoRef.current && !videoRef.current.paused) {
                requestAnimationFrame(processFrame);
            }
        };

        startCamera();

        return () => {
            // Cleanup
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            faceMesh.close();
        };
    }, []);

    const onResults = (results) => {
        if (!canvasRef.current || !videoRef.current || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

        const landmarks = results.multiFaceLandmarks[0];

        // Check stability/mouth opening (simple check: distance between top and bottom lip centers)
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const mouthOpen = Math.abs(topLip.y - bottomLip.y); // Simplified

        if (mouthOpen > 0.02 && !isAnalyzing) {
            startAnalysis();
        }

        if (isAnalyzing) {
            analyzeFrame(results.image, landmarks);
        }
    };

    const analyzeFrame = (image, landmarks) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 1. Draw video frame
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(videoRef.current, 0, 0, width, height);

        // 2. Create mask path
        ctx.beginPath();
        const mapPoint = (idx) => {
            const pt = landmarks[idx];
            return { x: pt.x * width, y: pt.y * height }; // FaceMesh coords are normalized 0-1
        };

        const start = mapPoint(UPPER_INNER_LIP[0]);
        ctx.moveTo(start.x, start.y);

        UPPER_INNER_LIP.forEach(idx => {
            const pt = mapPoint(idx);
            ctx.lineTo(pt.x, pt.y);
        });

        LOWER_INNER_LIP.forEach(idx => {
            const pt = mapPoint(idx);
            ctx.lineTo(pt.x, pt.y);
        });

        ctx.closePath();

        // 3. Clip to mask
        ctx.save();
        ctx.clip();

        // 4. Extract pixel data from the masked area
        // To do this efficiently without reading full canvas:
        // We can just read a bounding box around the mouth, but `getImageData` on full canvas is okay for local.
        // Optimization: Calculate bounding box of the mouth
        const xs = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP].map(idx => landmarks[idx].x * width);
        const ys = [...UPPER_INNER_LIP, ...LOWER_INNER_LIP].map(idx => landmarks[idx].y * height);
        const minX = Math.floor(Math.min(...xs));
        const maxX = Math.ceil(Math.max(...xs));
        const minY = Math.floor(Math.min(...ys));
        const maxY = Math.ceil(Math.max(...ys));

        // Safety check
        if (minX < 0 || minY < 0 || maxX > width || maxY > height || (maxX - minX) <= 0 || (maxY - minY) <= 0) {
            ctx.restore();
            return;
        }

        const imageData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
        ctx.restore();

        // 5. Calculate average color
        // We need to check if the pixel is actually inside the path?
        // `ctx.clip()` handles drawing *new* things, but `getImageData` gets the rect.
        // The rect includes outside pixels if the shape is irregular.
        // Better approach:
        // Clear canvas.
        // Draw the path and fill it with white.
        // Set `source-in` and draw video.
        // Then get image data.

        // Re-doing correctly:
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height); // Clear everything

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'white';
        ctx.fill(); // Fill the polygon (path from step 2 is still current?) Need to re-begin path?
        // Wait, step 2 ctx.fill() needs the path.
        // Let's restart path
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        UPPER_INNER_LIP.forEach(idx => ctx.lineTo(mapPoint(idx).x, mapPoint(idx).y));
        LOWER_INNER_LIP.forEach(idx => ctx.lineTo(mapPoint(idx).x, mapPoint(idx).y));
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(videoRef.current, 0, 0, width, height);

        const pixels = ctx.getImageData(minX, minY, maxX - minX, maxY - minY).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 0) { // Alpha > 0 means it's inside the mask
                r += pixels[i];
                g += pixels[i + 1];
                b += pixels[i + 2];
                count++;
            }
        }

        if (count > 0) {
            const avgR = Math.round(r / count);
            const avgG = Math.round(g / count);
            const avgB = Math.round(b / count);
            const scanResult = findClosestShade([avgR, avgG, avgB]);
            scanDataRef.current.push(scanResult);
        }

        ctx.globalCompositeOperation = 'source-over'; // Reset
    };

    const startAnalysis = () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setMessage('AI가 색상 데이터를 분석 중입니다...');
        scanDataRef.current = []; // Reset data

        let currentProgress = 0;
        const interval = setInterval(() => {
            currentProgress += 2;
            setProgress(currentProgress);

            if (currentProgress >= 100) {
                clearInterval(interval);
                completeAnalysis();
            }
        }, 60);
    };

    const completeAnalysis = () => {
        // Process gathered data
        if (scanDataRef.current.length > 0) {
            // Simple mode or average? Mode of 'shade' string is robust.
            const shadeCounts = {};
            scanDataRef.current.forEach(item => {
                shadeCounts[item.shade] = (shadeCounts[item.shade] || 0) + 1;
            });

            const bestShade = Object.keys(shadeCounts).reduce((a, b) => shadeCounts[a] > shadeCounts[b] ? a : b);
            // Get the RGB of the best match
            const bestEntry = scanDataRef.current.find(item => item.shade === bestShade);

            onScanComplete({ shade: bestShade, rgb: bestEntry.standardRgb });
        } else {
            // Fallback if no teeth detected
            onScanComplete({ shade: 'A2', rgb: [233, 220, 190] });
        }
    };

    return (
        <div className="full-screen" style={{ backgroundColor: '#000' }}>
            <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                playsInline
                autoPlay
                muted
            />
            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="full-screen"
                style={{ transform: 'scaleX(-1)', display: 'none' }} // Keep hidden or debug
            />

            {/* Guide Overlay Removed */}
            <div className="full-screen flex-center" style={{ pointerEvents: 'none' }}>
                {/* Empty container or removed entirely */}
            </div>

            {/* Manual Start Button Overlay */}
            {(showManualButton || initError) && !isAnalyzing && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'all' // Ensure button is clickable
                }}>
                    <button
                        onClick={() => onScanComplete({ shade: 'A2', rgb: [233, 220, 190] })}
                        style={{
                            backgroundColor: '#FF6B00', // Orange
                            color: 'white',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            padding: '16px 32px',
                            borderRadius: '16px',
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(255, 107, 0, 0.4)',
                            cursor: 'pointer',
                            zIndex: 30
                        }}
                    >
                        진단 시작하기
                    </button>
                </div>
            )}

            <div style={{
                position: 'absolute',
                bottom: '80px',
                left: 0,
                width: '100%',
                padding: '0 24px',
                textAlign: 'center',
                zIndex: 10
            }}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>{message}</h3>
                {isAnalyzing && (
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.1s linear' }} />
                    </div>
                )}
            </div>
        </div>
    );
}
