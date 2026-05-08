/**
 * React hook for color blindness simulation and compensation.
 *
 * Returns a `transformColor` function that maps hex colors through
 * a color blindness matrix, plus the active matrix for direct use.
 */
import { useCallback, useMemo } from "react";

import type { ColorBlindnessType, ColorMatrix } from "../color-matrix";
import { COLOR_BLINDNESS_COMPENSATION, COLOR_BLINDNESS_SIMULATION, IDENTITY_MATRIX, transformHexColor } from "../color-matrix";

export type UseColorBlindnessOptions = {
    /**
     * Use compensation mode (shift colors to distinguishable range)
     * instead of simulation mode (show how colors appear to affected users).
     * Not available for achromatopsia.
     * @default false
     */
    readonly compensate?: boolean;

    /**
     * Type of color vision deficiency to simulate or compensate for.
     * @default "none"
     */
    readonly mode?: ColorBlindnessType | "none";
};

export type UseColorBlindnessResult = {
    /** Whether a transform is active (mode is not "none"). */
    readonly isActive: boolean;
    /** The active color matrix. */
    readonly matrix: ColorMatrix;
    /** Transform a hex color string through the active matrix. */
    readonly transformColor: (hex: string) => string;
};

/**
 * Hook for color blindness simulation and compensation.
 *
 * ```tsx
 * const { transformColor } = useColorBlindness({ mode: "deuteranopia" });
 * &lt;Text color={transformColor("#ff0000")}>This text&lt;/Text>
 * ```
 */
const useColorBlindness = (options: UseColorBlindnessOptions = {}): UseColorBlindnessResult => {
    const { compensate = false, mode = "none" } = options;

    const matrix = useMemo((): ColorMatrix => {
        if (mode === "none") {
            return IDENTITY_MATRIX;
        }

        if (compensate && mode !== "achromatopsia") {
            return COLOR_BLINDNESS_COMPENSATION[mode];
        }

        return COLOR_BLINDNESS_SIMULATION[mode];
    }, [mode, compensate]);

    const isActive = mode !== "none";

    const transformColor = useCallback(
        (hex: string): string => {
            if (!isActive) {
                return hex;
            }

            return transformHexColor(hex, matrix);
        },
        [isActive, matrix],
    );

    return useMemo(() => {
        return { isActive, matrix, transformColor };
    }, [isActive, matrix, transformColor]);
};

export default useColorBlindness;

export { useColorBlindness };
