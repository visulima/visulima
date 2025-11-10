import type { Tracer } from "@opentelemetry/api";

import type { BaseConfig, EmailOptions } from "../../types";
import type { Provider, ProviderFactory } from "../provider";

/**
 * OpenTelemetry configuration
 */
export interface OpenTelemetryConfig extends BaseConfig {
    /**
     * The provider to wrap with OpenTelemetry instrumentation
     * Can be a Provider instance or ProviderFactory function
     */
    provider: Provider | ProviderFactory;

    /**
     * Whether to record email content in spans (default: false)
     * When false, only metadata is recorded
     */
    recordContent?: boolean;

    /**
     * Service name for OpenTelemetry spans (default: "email")
     */
    serviceName?: string;

    /**
     * Optional OpenTelemetry tracer instance
     * If not provided, uses the global tracer
     */
    tracer?: Tracer;
}

/**
 * OpenTelemetry-specific email options
 */
export interface OpenTelemetryEmailOptions extends EmailOptions {
    // No additional options beyond base EmailOptions
}
