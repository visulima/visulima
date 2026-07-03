const extractQueryFromHttpUrl = (url: string): string => {
    try {
        const urlObject = new URL(url);

        return urlObject.search;
    } catch {
        return "";
    }
};

export default extractQueryFromHttpUrl;
