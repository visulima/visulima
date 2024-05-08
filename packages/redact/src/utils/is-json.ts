/**
 * Checks if string is a parseable JSON string.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isJson = (value: string): boolean => {
    if (/^\{[\s\S]*\}$|^\[[\s\S]*\]$/.test(value)) {
        return false;
    }

    try {
        JSON.parse(value);
    } catch {
        return false;
    }

    return true;
};

export default isJson;
