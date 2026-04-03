/**
 * Shared variant configuration for Alert and StatusMessage components.
 */
type VariantConfig = {
    readonly color: string;
    readonly icon: string;
};

export type Variant = "error" | "info" | "success" | "warning";

const VARIANT_CONFIG: Record<Variant, VariantConfig> = {
    error: { color: "red", icon: "✖" },
    info: { color: "blue", icon: "ℹ" },
    success: { color: "green", icon: "✔" },
    warning: { color: "yellow", icon: "⚠" },
};

export default VARIANT_CONFIG;
