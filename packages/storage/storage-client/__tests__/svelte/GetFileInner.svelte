<script lang="ts">
    import { createQuery } from "@tanstack/svelte-query";
    import { derived, get, readable, writable } from "svelte/store";
    import { onDestroy } from "svelte";
    import { buildUrl, extractFileMetaFromHeaders, storageQueryKeys } from "../../src/core";
    import type { CreateGetFileOptions, CreateGetFileReturn } from "../../src/svelte/create-get-file";
    import type { FileMeta } from "../../src/react/types";

    export let result: CreateGetFileReturn | undefined = undefined;
    export let options: CreateGetFileOptions;

    // According to TanStack Query Svelte docs, createQuery MUST be called at component top level
    // We need to call it directly in the component, not in a utility function
    // Use reactive statement to recreate when options change
    $: if (options) {
        const { enabled = true, endpoint, id, onError, onSuccess, transform } = options;

        // Convert to stores if needed (same logic as createGetFile)
        const idStore = typeof id === "object" && "subscribe" in id ? id : writable(id as string);
        const transformStore = typeof transform === "object" && "subscribe" in transform ? transform : writable(transform);
        const enabledStore = typeof enabled === "object" && "subscribe" in enabled ? enabled : writable(enabled as boolean);

        // Create derived stores for reactive query options
        const enabledDerived = derived([enabledStore, idStore], ([$enabled, $id]) => $enabled && !!$id);

        const query = createQuery(() => {
            const currentId = get(idStore);
            const currentTransform = get(transformStore);

            return {
                enabled: get(enabledDerived),
                queryFn: async () => {
                    const url = buildUrl(endpoint, currentId, currentTransform);
                    const response = await fetch(url, {
                        method: "GET",
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => {
                            return {
                                error: {
                                    code: "RequestFailed",
                                    message: response.statusText,
                                },
                            };
                        });

                        throw new Error(errorData.error?.message || `Failed to get file: ${response.status} ${response.statusText}`);
                    }

                    const blob = await response.blob();
                    const meta = extractFileMetaFromHeaders(currentId, response.headers);

                    return { blob, meta };
                },
                queryKey: storageQueryKeys.files.detail(endpoint, currentId, currentTransform),
            };
        });


        // Check if data/error are stores or accessors
        const dataStore = typeof query.data === 'function' ? query.data : readable(query.data, (set) => { set(query.data); return () => {}; });
        const errorStore = typeof query.error === 'function' ? query.error : readable(query.error || undefined, (set) => { set(query.error || undefined); return () => {}; });
        const isLoadingStore = typeof query.isLoading === 'function' ? query.isLoading : readable(query.isLoading, (set) => { set(query.isLoading); return () => {}; });

        // Extract metadata from response if available
        const meta = derived(dataStore, ($data) => $data?.meta || undefined);

        // Subscribe to data and error changes to call callbacks
        let unsubscribeData: (() => void) | undefined;
        let unsubscribeError: (() => void) | undefined;

        if (onSuccess || onError) {
            unsubscribeData = dataStore.subscribe(($data) => {
                if ($data && onSuccess) {
                    const currentMeta = get(meta);
                    onSuccess($data.blob, currentMeta);
                }
            });

            unsubscribeError = errorStore.subscribe(($error) => {
                if ($error && onError) {
                    onError($error as Error);
                }
            });

            onDestroy(() => {
                unsubscribeData?.();
                unsubscribeError?.();
            });
        }

        result = {
            data: derived(dataStore, ($data) => $data?.blob),
            error: derived(errorStore, ($error) => ($error as Error) || undefined),
            isLoading: isLoadingStore,
            meta,
            refetch: () => {
                query.refetch();
            },
        };
    }
</script>

