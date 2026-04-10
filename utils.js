// utils.js — pure utility functions shared between the browser runtime (scales_1.js)
// and the Node.js test suite (tests/utils.test.js).
// CommonJS exports so node --test can require() them directly.
// The original function bodies remain in scales_1.js; this file is the test target.

'use strict';

/**
 * Convert a 24-bit hex color integer to normalised {r, g, b} floats in [0, 1].
 * @param {number} hex  e.g. 0xeeb792
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToNormalizedRGB(hex) {
    return {
        r: ((hex >> 16) & 255) / 255,
        g: ((hex >> 8)  & 255) / 255,
        b: ( hex        & 255) / 255
    };
}

/**
 * Compute grid layout dimensions for a square-ish grid of N items.
 * @param {number} n            total scale count
 * @param {number} spacing      horizontal spacing between columns
 * @param {number} vertSpacing  vertical spacing between rows
 * @returns {{ rows: number, cols: number, gridWidth: number, gridHeight: number }}
 */
function gridDimensions(n, spacing, vertSpacing) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return {
        cols,
        rows,
        gridWidth:  (cols - 1) * spacing,
        gridHeight: (rows - 1) * vertSpacing
    };
}

/**
 * Clamp a value to [min, max].
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * Map a sine value (-1..1) to Y-axis rotation range (-15°..+45°) in radians.
 * @param {number} sineValue  output of Math.sin(), in [-1, 1]
 * @param {number} amplitudeScale  multiplier on the 30° swing (default 1)
 * @returns {number}  rotation in radians
 */
function scaleRotY(sineValue, amplitudeScale) {
    const scale = (amplitudeScale === undefined) ? 1 : amplitudeScale;
    return (sineValue * 30 * scale + 15) * (Math.PI / 180);
}

module.exports = { hexToNormalizedRGB, gridDimensions, clamp, scaleRotY };
