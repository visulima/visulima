export const hsvToRgb = (h: number, s: number, v: number): { b: number; g: number; r: number } => {
    let r = 0;
    let g = 0;
    let b = 0;

    const index = Math.floor(h / 60);
    const f = h / 60 - index;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    if (index % 6 === 0) {
        r = v;
        g = t;
        b = p;
    } else if (index % 6 === 1) {
        r = q;
        g = v;
        b = p;
    } else if (index % 6 === 2) {
        r = p;
        g = v;
        b = t;
    } else if (index % 6 === 3) {
        r = p;
        g = q;
        b = v;
    } else if (index % 6 === 4) {
        r = t;
        g = p;
        b = v;
    } else if (index % 6 === 5) {
        r = v;
        g = p;
        b = q;
    }

    return { b: Math.round(b * 255), g: Math.round(g * 255), r: Math.round(r * 255) };
};
