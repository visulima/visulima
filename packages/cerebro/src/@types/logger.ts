export type ConfigType = { icon: boolean; label: string; msg: string; type: string };

export interface Logger {
    center: (message: string, fillText: string) => string;
    clear: () => void;
    critical: (message: object | string, label?: string, showIcon?: boolean) => string;
    danger: (message: object | string, label?: string, showIcon?: boolean) => string;
    debug: (message: object | string, label?: string, showIcon?: boolean) => string;
    error: (message: object | string, label?: string, showIcon?: boolean) => string;
    info: (message: object | string, label?: string, showIcon?: boolean) => string;
    isDebug: () => boolean;
    isQuiet: () => boolean;
    isVerbose: () => boolean;
    isVeryVerbose: () => boolean;
    line: (message: string) => string;
    log: (message: object | string, label?: string, showIcon?: boolean) => string;
    note: (message: object | string, label?: string, showIcon?: boolean) => string;
    notice: (message: object | string, label?: string, showIcon?: boolean) => string;
    print: (config: Partial<ConfigType>) => string;
    status: (message: object | string, label?: string, showIcon?: boolean) => string;
    success: (message: object | string, label?: string, showIcon?: boolean) => string;
    warning: (message: object | string, label?: string, showIcon?: boolean) => string;
}
