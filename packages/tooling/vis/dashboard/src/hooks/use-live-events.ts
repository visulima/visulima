import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { queryKeys } from "@/lib/api";

export type LiveStatus = "connecting" | "open" | "closed";

/**
 * Subscribes to `/api/events` SSE once per mount. On every `change`
 * event the Hono server pushes (debounced to 200ms over file-system
 * events in `.task-runner/runs/`), we invalidate the overview and
 * runs queries so the UI picks up the new data without polling.
 *
 * Heartbeat events are ignored — their only job is to keep the
 * connection alive through proxies.
 */
export const useLiveEvents = (): LiveStatus => {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<LiveStatus>("connecting");

    useEffect(() => {
        const source = new EventSource("/api/events");

        source.addEventListener("open", () => setStatus("open"));
        source.addEventListener("ready", () => setStatus("open"));
        source.addEventListener("error", () => {
            setStatus(source.readyState === EventSource.CLOSED ? "closed" : "connecting");
        });

        source.addEventListener("change", () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
            queryClient.invalidateQueries({ queryKey: queryKeys.runs() });
            queryClient.invalidateQueries({ queryKey: queryKeys.cache() });
        });

        return () => {
            source.close();
        };
    }, [queryClient]);

    return status;
};
