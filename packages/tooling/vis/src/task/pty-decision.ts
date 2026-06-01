/**
 * Resolution for whether a single task spawn should use a PTY,
 * extracted from the run handler so it can be unit-tested without
 * standing up the whole cerebro toolbox.
 *
 * Three signals, in priority order (highest wins):
 *
 * 1. `task.pty: true`  -> always PTY, regardless of workspace.
 * 2. `task.pty: false` -> never PTY, regardless of workspace.
 * 3. fall-through: `interactive` AND `workspacePty` is not `false`.
 *
 * Used at two sites in `commands/run/handler.ts`:
 * - the pre-spawn `runConcurrently` config builder (no lifecycle
 *   hooks present yet) — there `interactive` is just
 *   `Boolean(lifecycleHooks)`.
 * - the in-flight executor's `isPty` decision — there `interactive`
 *   is `Boolean(stdinRegistry)` plus the workspace opt-in.
 *
 * The function intentionally collapses both forms by taking
 * `interactive` as a pre-computed boolean; callers thread their
 * own meaning of "the workspace would otherwise want PTY".
 */
export interface PtyDecisionInputs {
    /**
     * Pre-resolved workspace-level interactivity signal — the
     * value the caller would use absent any task-level override.
     * For the run-config builder, this is `Boolean(lifecycleHooks)`.
     * For the executor, it's `Boolean(stdinRegistry)` plus the
     * workspace opt-in.
     */
    interactive: boolean;

    /**
     * Per-task PTY override carried over from
     * `TargetConfiguration.pty`. `true` forces PTY, `false`
     * suppresses, `undefined` falls through.
     */
    taskPty: boolean | undefined;

    /**
     * Workspace-level `visOptions.pty`. When the task doesn't
     * override, the fall-through requires `interactive` to be
     * true and `workspacePty` to not be `false`.
     */
    workspacePty: boolean | undefined;
}

export const decidePty = ({ interactive, taskPty, workspacePty }: PtyDecisionInputs): boolean => {
    if (taskPty === true) {
        return true;
    }

    if (taskPty === false) {
        return false;
    }

    return interactive && workspacePty !== false;
};
