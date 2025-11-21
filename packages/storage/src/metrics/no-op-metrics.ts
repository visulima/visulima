/* eslint-disable class-methods-use-this, import/prefer-default-export */

/**
 * No-op metrics implementation.
 * Used when metrics are not provided, ensuring no overhead when metrics are disabled.
 */

import type { Metrics } from "../utils/types";

/**
 * No-op metrics that does nothing.
 * Used as a default when metrics are not provided.
 */
class NoOpMetrics implements Metrics {
    public increment(_name: string, _value?: number, _attributes?: Record<string, string | number>): void {
        // No-op
    }

    public timing(_name: string, _duration: number, _attributes?: Record<string, string | number>): void {
        // No-op
    }

    public gauge(_name: string, _value: number, _attributes?: Record<string, string | number>): void {
        // No-op
    }
}

export default NoOpMetrics;
