const findLanguageBasedOnExtension = (file: string): string => {
    const extension = file.split(".").pop();

    switch (extension) {
        case "js": {
            return "javascript";
        }
        case "jsx": {
            return "jsx";
        }
        case "ts": {
            return "typescript";
        }
        case "tsx": {
            return "tsx";
        }
        case "json": {
            return "json";
        }
        case "jsonc": {
            return "jsonc";
        }
        case "json5": {
            return "json5";
        }
        case "xml": {
            return "xml";
        }
        case "sql": {
            return "sql";
        }
        default: {
            return "javascript";
        }
    }
};

export default findLanguageBasedOnExtension;
