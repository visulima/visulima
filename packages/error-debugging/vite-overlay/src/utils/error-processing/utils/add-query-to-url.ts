const addQueryToUrl = (baseUrl: string, query: string): string => {
    if (!query || baseUrl.includes("?")) {
        return baseUrl;
    }

    return baseUrl + query;
};

export default addQueryToUrl;
