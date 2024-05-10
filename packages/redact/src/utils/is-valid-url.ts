const isValidUrl = (url: string): boolean => {
    try {
        // eslint-disable-next-line compat/compat,no-new
        new URL(url);

        return true;
    } catch {
        return false;
    }
};

export default isValidUrl;
