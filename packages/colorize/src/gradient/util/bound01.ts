// Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
// <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
const isOnePointZero = (n: number | string) => typeof n === "string" && n.includes(".") && Number.parseFloat(n) === 1;

// Check to see if string passed in is a percentage
const isPercentage = (n: number | string) => typeof n === "string" && n.includes("%");

// Take input from [0, n] and return it as [0, 1]
export const bound01 = (n: number | string, max: number): number => {
    if (isOnePointZero(n)) {
        // eslint-disable-next-line no-param-reassign
        n = "100%";
    }

    const processPercent = isPercentage(n);

    // eslint-disable-next-line no-param-reassign
    n = Math.min(max, Math.max(0, Number.parseFloat(n + "")));

    // Automatically convert percentage into number
    if (processPercent) {
        // eslint-disable-next-line no-param-reassign
        n = Number.parseInt(n * max + "", 10) / 100;
    }

    // Handle floating point rounding errors
    if (Math.abs(n - max) < 0.000_001) {
        return 1;
    }

    // Convert into [0, 1] range if it isn't already
    return (n % max) / Number.parseFloat(max + "");
};
