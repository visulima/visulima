const hasJsonStructure = (data: unknown): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    try {
        const result = JSON.parse(data);
        const type = Object.prototype.toString.call(result);

        return type === "[object Object]" || type === "[object Array]";
    } catch {
        return false;
    }
};

export default hasJsonStructure;
