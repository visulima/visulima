import type { RawImageData, SixelColor } from "./types";

// TODO: Consider a more generic Heap/Priority Queue implementation if not available or too complex to inline
// For now, a simple array + sort might be used if performance allows for typical image sizes,
// or a minimal heap can be implemented.

interface QuantizationCube {
    bMax: number;
    bMin: number;

    // Represents a region of colors in the RGBA space
    colors: SixelColor[]; // Actual SixelColor objects (0-255 scale)
    gMax: number;
    gMin: number;
    pixelCounts: number[]; // Corresponding pixel counts for each color in `colors`
    rMax: number;
    rMin: number;
    // Alpha channel can be considered if needed, Sixel is typically opaque or uses a limited transparency model

    score: number; // Heuristic score for splitting priority
    sliceChannel: "b" | "g" | "r";
    totalPixelCount: number; // Total pixels represented by this cube
}

/**
 * Simplistic Heap implementation for QuantizationCubes (max-heap by score).
 */
class CubePriorityQueue {
    private readonly heap: QuantizationCube[] = [];

    push(cube: QuantizationCube): void {
        this.heap.push(cube);
        this.heap.sort((a, b) => b.score - a.score); // Simple sort for now, replace with heapify if perf critical
    }

    pop(): QuantizationCube | undefined {
        if (this.heap.length === 0) return undefined;
        // Sorting ensures the highest score is at the beginning if we want a true pop from end of sorted by score descending
        // Or, if always sorted, can just pop. Current sort is b.score - a.score, so largest is first.
        return this.heap.shift(); // Pop the one with highest score (if sorted descending)
    }

    len(): number {
        return this.heap.length;
    }
}

/**
 * Performs color quantization using the Median Cut algorithm.
 *
 * @param imageData The raw image data (RGBA, 0-255 per channel).
 * @param maxColors The desired number of colors in the output palette (e.g., 16, 256).
 * @returns An array of SixelColor representing the quantized palette.
 */
export function medianCutQuantize(imageData: RawImageData, maxColors: number): SixelColor[] {
    if (maxColors <= 0) return [];

    const uniqueColorsMap = new Map<string, { color: SixelColor; count: number }>();

    // 1. Collect unique colors and their counts
    for (let index = 0; index < imageData.data.length; index += 4) {
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        // const a = imageData.data[i + 3]; // Alpha typically ignored or handled separately for Sixel

        const key = `${r}-${g}-${b}`;
        const entry = uniqueColorsMap.get(key);
        if (entry) {
            entry.count++;
        } else {
            uniqueColorsMap.set(key, { color: { b, g, r }, count: 1 });
        }
    }

    const uniqueColorEntries = [...uniqueColorsMap.values()];

    if (uniqueColorEntries.length <= maxColors) {
        return uniqueColorEntries.map((entry) => entry.color);
    }

    const pq = new CubePriorityQueue();
    const initialCube = createQuantizationCube(uniqueColorEntries);

    if (!initialCube) {
        return []; // Should not happen if uniqueColorEntries is not empty
    }
    pq.push(initialCube);

    while (pq.len() < maxColors && pq.len() > 0) {
        // pq.len() > 0 to prevent infinite loop if pop fails
        const cubeToSplit = pq.pop();
        if (!cubeToSplit) break; // Should not happen if pq.len() > 0 was true

        // Combine colors and their counts for sorting
        const combinedEntries: { color: SixelColor; count: number }[] = [];
        for (let index = 0; index < cubeToSplit.colors.length; index++) {
            combinedEntries.push({ color: cubeToSplit.colors[index], count: cubeToSplit.pixelCounts[index] });
        }

        // Sort colors in the cube along its sliceChannel
        const channel = cubeToSplit.sliceChannel;
        combinedEntries.sort((a, b) => a.color[channel] - b.color[channel]);

        // Find median cut point (balancing pixel counts)
        let medianIndex = 0;
        let countSoFar = 0;
        const targetCount = Math.floor(cubeToSplit.totalPixelCount / 2);

        for (const [index, combinedEntry] of combinedEntries.entries()) {
            countSoFar += combinedEntry.count;
            if (countSoFar >= targetCount) {
                medianIndex = index;
                break;
            }
        }
        // Ensure at least one color in each new cube if possible, unless original cube had only one color
        if (combinedEntries.length > 1 && medianIndex === combinedEntries.length - 1) medianIndex--;
        if (combinedEntries.length > 1 && medianIndex < 0) medianIndex = 0; // Should not happen with logic above

        const leftEntries = combinedEntries.slice(0, medianIndex + 1);
        const rightEntries = combinedEntries.slice(medianIndex + 1);

        if (leftEntries.length > 0) {
            const leftCube = createQuantizationCube(leftEntries);
            if (leftCube) pq.push(leftCube);
        }
        if (rightEntries.length > 0) {
            const rightCube = createQuantizationCube(rightEntries);
            if (rightCube) pq.push(rightCube);
        }
    }

    // 5. When queue.len() == maxColors, calculate average color for each cube in the queue.
    const finalPalette: SixelColor[] = [];
    let count = 0;
    while (count < maxColors) {
        const cube = pq.pop(); // Pop will get from the internal heap, which might not be maxColors if loop exited early
        if (!cube) break;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let currentCubeTotalPixels = 0;
        for (let index = 0; index < cube.colors.length; index++) {
            const color = cube.colors[index];
            const pixelCount = cube.pixelCounts[index];
            rSum += color.r * pixelCount;
            gSum += color.g * pixelCount;
            bSum += color.b * pixelCount;
            currentCubeTotalPixels += pixelCount;
        }

        if (currentCubeTotalPixels > 0) {
            finalPalette.push({
                b: Math.round(bSum / currentCubeTotalPixels),
                g: Math.round(gSum / currentCubeTotalPixels),
                r: Math.round(rSum / currentCubeTotalPixels),
            });
        }
        count++;
    }

    return finalPalette;
}

function createQuantizationCube(colorEntries: { color: SixelColor; count: number }[]): QuantizationCube | null {
    if (colorEntries.length === 0) return null;

    let rMin = 255;
    let rMax = 0;
    let gMin = 255;
    let gMax = 0;
    let bMin = 255;
    let bMax = 0;
    let totalPixelCount = 0;

    const colors: SixelColor[] = [];
    const pixelCounts: number[] = [];

    for (const entry of colorEntries) {
        colors.push(entry.color);
        pixelCounts.push(entry.count);
        totalPixelCount += entry.count;

        rMin = Math.min(rMin, entry.color.r);
        rMax = Math.max(rMax, entry.color.r);
        gMin = Math.min(gMin, entry.color.g);
        gMax = Math.max(gMax, entry.color.g);
        bMin = Math.min(bMin, entry.color.b);
        bMax = Math.max(bMax, entry.color.b);
    }

    const dR = rMax - rMin;
    const dG = gMax - gMin;
    const dB = bMax - bMin;

    let sliceChannel: "b" | "g" | "r" = "r";
    let maxRange = dR;

    if (dG >= maxRange) {
        maxRange = dG;
        sliceChannel = "g";
    }
    if (dB >= maxRange) {
        maxRange = dB;
        sliceChannel = "b";
    }

    // Score: range * total pixel count (as in Go version)
    const score = maxRange * totalPixelCount;

    return {
        bMax,
        bMin,
        colors,
        gMax,
        gMin,
        pixelCounts,
        rMax,
        rMin,
        score,
        sliceChannel,
        totalPixelCount,
    };
}
