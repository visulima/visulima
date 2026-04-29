/**
 * Pure helper for the watch-mode `p` keybind: narrows a base task set
 * to projects whose name contains a filter string.
 *
 * The filter is normalized — `undefined`, empty, and whitespace-only
 * inputs disable the filter and return the full set. Match is
 * case-insensitive substring against `task.target.project`. Trimming
 * happens here so the keybind dispatcher can forward the raw prompt
 * result without each call site re-implementing the rules.
 */

export interface ProjectFilterResult<T> {
    /** The normalized filter actually applied. `undefined` when no filter is active. */
    filter: string | undefined;
    /** Filtered task list. A fresh array — safe for the caller to mutate. */
    tasks: T[];
}

export const applyProjectFilter = <T extends { target: { project: string } }>(
    baseTasks: readonly T[],
    filter: string | undefined,
): ProjectFilterResult<T> => {
    const normalized = filter?.trim();

    if (!normalized) {
        return { filter: undefined, tasks: [...baseTasks] };
    }

    const needle = normalized.toLowerCase();

    return {
        filter: normalized,
        tasks: baseTasks.filter((task) => task.target.project.toLowerCase().includes(needle)),
    };
};
