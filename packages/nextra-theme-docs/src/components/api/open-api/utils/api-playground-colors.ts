export const getMethodBgColor = (method?: string): string => {
    switch (method?.toUpperCase()) {
        case "GET": {
            return "bg-emerald-400/10";
        }
        case "POST": {
            return "bg-sky-400/10";
        }
        case "PUT": {
            return "bg-amber-400/10";
        }
        case "DELETE": {
            return "bg-rose-50";
        }
        case "PATCH": {
            return "bg-orange-400/10";
        }
        default: {
            return "bg-slate-400/10";
        }
    }
};

export const getMethodBgHoverColor = (method?: string): string => {
    switch (method?.toUpperCase()) {
        case "GET": {
            return "hover:bg-green-800 disabled:bg-green-700";
        }
        case "POST": {
            return "hover:bg-blue-800 disabled:bg-blue-700";
        }
        case "PUT": {
            return "hover:bg-yellow-800 disabled:bg-yellow-700";
        }
        case "DELETE": {
            return "hover:bg-red-800 disabled:bg-red-700";
        }
        case "PATCH": {
            return "hover:bg-orange-800 disabled:bg-orange-700";
        }
        default: {
            return "hover:bg-slate-800 disabled:bg-slate-700";
        }
    }
};

export const getMethodTextColor = (method?: string): string => {
    switch (method?.toUpperCase()) {
        case "GET": {
            return "text-emerald-500 dark:text-emerald-400";
        }
        case "POST": {
            return "text-sky-500 dark:text-sky-400";
        }
        case "PUT": {
            return "text-amber-500 dark:text-amber-400";
        }
        case "DELETE": {
            return "text-red-500 dark:text-rose-400";
        }
        case "PATCH": {
            return "text-orange-600 dark:text-orange-500";
        }
        default: {
            return "text-slate-600 dark:text-slate-500";
        }
    }
};

export const getMethodRingColor = (method?: string): string => {
    switch (method?.toUpperCase()) {
        case "GET": {
            return "ring-1 ring-inset ring-emerald-300 dark:ring-emerald-400/30";
        }
        case "POST": {
            return "ring-1 ring-inset ring-sky-300 dark:ring-sky-400/30";
        }
        case "PUT": {
            return "ring-1 ring-inset ring-amber-300 bg-amber-400/10 dark:ring-amber-400/30";
        }
        case "DELETE": {
            return "ring-1 ring-inset ring-rose-200 bg-rose-50 dark:ring-rose-500/20";
        }
        case "PATCH": {
            return "ring-1 ring-inset ring-orange-600 dark:ring-orange-500";
        }
        default: {
            return "ring-1 ring-inset ring-slate-600 dark:ring-slate-500";
        }
    }
};

export const getMethodBorderColor = (method?: string): string => {
    switch (method?.toUpperCase()) {
        case "GET": {
            return "border-emerald-400";
        }
        case "POST": {
            return "border-sky-400";
        }
        case "PUT": {
            return "border-amber-400";
        }
        case "DELETE": {
            return "border-rose-50";
        }
        case "PATCH": {
            return "border-orange-400";
        }
        default: {
            return "border-slate-400";
        }
    }
};
