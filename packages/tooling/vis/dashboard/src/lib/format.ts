export const formatMs = (ms: number | undefined | null): string => {
    if (ms === undefined || ms === null) {
        return "—";
    }

    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }

    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    if (ms < 3_600_000) {
        return `${(ms / 60_000).toFixed(1)}m`;
    }

    return `${(ms / 3_600_000).toFixed(1)}h`;
};

export const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));

    return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
};

export const formatPercent = (ratio: number | undefined | null): string => {
    if (ratio === undefined || ratio === null) {
        return "—";
    }

    return `${(ratio * 100).toFixed(1)}%`;
};

export const formatDate = (iso: string | undefined | null): string => {
    if (!iso) {
        return "—";
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString();
};

export const formatRelative = (iso: string | undefined | null): string => {
    if (!iso) {
        return "—";
    }

    const ts = new Date(iso).getTime();

    if (Number.isNaN(ts)) {
        return "—";
    }

    const delta = Math.max(0, Date.now() - ts);
    const seconds = Math.floor(delta / 1000);

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ago`;
    }

    if (seconds < 86_400) {
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    return `${Math.floor(seconds / 86_400)}d ago`;
};
