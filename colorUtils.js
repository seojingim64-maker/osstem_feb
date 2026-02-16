// VITA Classical Shade Guide (Approximate RGB values)
// These are illustrative values. In a real app, these should be calibrated.
export const VITA_SHADES = {
    'A1': { rgb: [238, 227, 203], r: 238, g: 227, b: 203 },
    'A2': { rgb: [233, 220, 190], r: 233, g: 220, b: 190 },
    'A3': { rgb: [227, 212, 180], r: 227, g: 212, b: 180 },
    'A3.5': { rgb: [220, 200, 170], r: 220, g: 200, b: 170 },
    'A4': { rgb: [210, 190, 160], r: 210, g: 190, b: 160 },
    'B1': { rgb: [235, 228, 205], r: 235, g: 228, b: 205 },
    'B2': { rgb: [230, 220, 195], r: 230, g: 220, b: 195 },
    'B3': { rgb: [225, 210, 180], r: 225, g: 210, b: 180 },
    'B4': { rgb: [220, 200, 160], r: 220, g: 200, b: 160 },
    'C1': { rgb: [220, 220, 210], r: 220, g: 220, b: 210 },
    'C2': { rgb: [210, 210, 200], r: 210, g: 210, b: 200 },
    'C3': { rgb: [200, 200, 190], r: 200, g: 200, b: 190 },
    'C4': { rgb: [190, 190, 180], r: 190, g: 190, b: 180 },
    'D2': { rgb: [225, 220, 210], r: 225, g: 220, b: 210 },
    'D3': { rgb: [215, 210, 200], r: 215, g: 210, b: 200 },
    'D4': { rgb: [205, 200, 190], r: 205, g: 200, b: 190 },
};

export const SHADE_ORDER = [
    'B1', 'A1', 'B2', 'D2', 'A2', 'C1', 'C2', 'D4', 'A3', 'D3', 'B3', 'A3.5', 'B4', 'C3', 'A4', 'C4'
];

// Calculate Euclidean distance between two colors
function colorDistance(rgb1, rgb2) {
    return Math.sqrt(
        Math.pow(rgb1[0] - rgb2[0], 2) +
        Math.pow(rgb1[1] - rgb2[1], 2) +
        Math.pow(rgb1[2] - rgb2[2], 2)
    );
}

export function findClosestShade(rgb) {
    let minDistance = Infinity;
    let closestShade = 'A2'; // Default fallback

    Object.entries(VITA_SHADES).forEach(([shade, data]) => {
        const dist = colorDistance(rgb, data.rgb);
        if (dist < minDistance) {
            minDistance = dist;
            closestShade = shade;
        }
    });

    return { shade: closestShade, standardRgb: VITA_SHADES[closestShade].rgb, diff: minDistance };
}

export function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
