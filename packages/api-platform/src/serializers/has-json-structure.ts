const hasJsonStructure = (string_: any): boolean => {
    if (typeof string_ !== "string") {
        return false;
    }

    try {
        const result = JSON.parse(string_);
        const type = Object.prototype.toString.call(result);

        return type === "[object Object]" || type === "[object Array]";
    } catch {
        return false;
    }
};

export default hasJsonStructure;
