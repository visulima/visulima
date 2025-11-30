/**
 * Semaphore implementation for controlling concurrency.
 */
class Semaphore {
    /**
     * Creates a new Semaphore instance.
     * @param {number} permits The number of permits available.
     */
    constructor(permits) {
        this.permits = permits;
        this.waitQueue = [];
    }

    /**
     * Acquires a permit and executes a task.
     * @param {() => Promise<unknown>} task The task to execute.
     * @returns {Promise<unknown>} The result of the task.
     */
    async acquire(task) {
        await this.waitForPermit();

        try {
            return await task();
        } finally {
            this.release();
        }
    }

    /**
     * Releases a permit.
     */
    release() {
        if (this.waitQueue.length > 0) {
            const nextResolver = this.waitQueue.shift();

            nextResolver();
        } else {
            this.permits += 1;
        }
    }

    /**
     * Waits for a permit to become available.
     * @returns {Promise<void>} Resolves when a permit is available.
     */
    async waitForPermit() {
        if (this.permits > 0) {
            this.permits -= 1;

            return;
        }

        await new Promise((resolve) => {
            this.waitQueue.push(resolve);
        });
    }
}

export default Semaphore;
