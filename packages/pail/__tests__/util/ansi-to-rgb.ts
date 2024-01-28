export const ansiToRgb = (ansi: number): [number, number, number] => {
    let r = 0;
    let g = 0;
    let b = 0;

    if (ansi >= 30 && ansi <= 37) {
        // eslint-disable-next-line no-bitwise
        r = ((ansi - 30) & 1) * 127;
        // eslint-disable-next-line no-bitwise
        g = ((ansi - 30) & 2) * 63;
        // eslint-disable-next-line no-bitwise
        b = ((ansi - 30) & 4) * 31;
    }

    return [r, g, b];
};

test("should handle ansi code to rgb", () => {
    expect.assertions(3);

    expect(ansiToRgb(40)).toStrictEqual([0, 0, 0]); // black
    expect(ansiToRgb(31)).toStrictEqual([127, 0, 0]); // red
    expect(ansiToRgb(32)).toStrictEqual([0, 126, 0]); // green
});
