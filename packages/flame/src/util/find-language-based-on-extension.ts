const findLanguageBasedOnExtension = (file: string): string => {
    const extension = file.split(".").pop();

    switch (extension) {
        case "js": {
            return "javascript";
        }
        case "json": {
            return "json";
        }
        case "json5": {
            return "json5";
        }
        case "jsonc": {
            return "jsonc";
        }
        case "jsx": {
            return "jsx";
        }
        case "sql": {
            return "sql";
        }
        case "ts": {
            return "typescript";
        }
        case "tsx": {
            return "tsx";
        }
        case "xml": {
            return "xml";
        }
        default: {
            return "javascript";
        }
    }
};

export default findLanguageBasedOnExtension;
