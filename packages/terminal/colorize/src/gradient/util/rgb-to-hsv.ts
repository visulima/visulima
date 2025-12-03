export const rgbToHsv = ({ b, g, r }: { b: number; g: number; r: number }): { h: number; s: number; v: number } => {
    let rdif;
    let gdif;
    let bdif;
    let h = 0;
    let s = 0;

    // eslint-disable-next-line no-param-reassign
    r /= 255;
    // eslint-disable-next-line no-param-reassign
    g /= 255;
    // eslint-disable-next-line no-param-reassign
    b /= 255;

    const v = Math.max(r, g, b);
    const diff = v - Math.min(r, g, b);
    const diffc = (c: number) => (v - c) / 6 / diff + 1 / 2;

    if (diff !== 0) {
        s = diff / v;
        rdif = diffc(r);
        gdif = diffc(g);
        bdif = diffc(b);

        // eslint-disable-next-line unicorn/prefer-switch
        if (v === r) {
            h = bdif - gdif;
        } else if (v === g) {
            h = 1 / 3 + rdif - bdif;
        } else if (v === b) {
            h = 2 / 3 + gdif - rdif;
        }

        if (h < 0) {
            h += 1;
        } else if (h > 1) {
            h -= 1;
        }
    }

    return {
        h: h * 360,
        s,
        v,
    };
};
