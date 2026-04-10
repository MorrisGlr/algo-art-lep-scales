'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { hexToNormalizedRGB, gridDimensions, clamp, scaleRotY } = require('../utils.js');

// ---------------------------------------------------------------------------
// hexToNormalizedRGB
// ---------------------------------------------------------------------------

test('hexToNormalizedRGB: original palette colorA (0xeeb792)', function() {
    const { r, g, b } = hexToNormalizedRGB(0xeeb792);
    assert.ok(Math.abs(r - 0xee / 255) < 1e-9, 'r channel');
    assert.ok(Math.abs(g - 0xb7 / 255) < 1e-9, 'g channel');
    assert.ok(Math.abs(b - 0x92 / 255) < 1e-9, 'b channel');
});

test('hexToNormalizedRGB: pure white (0xffffff) → all 1.0', function() {
    const { r, g, b } = hexToNormalizedRGB(0xffffff);
    assert.strictEqual(r, 1);
    assert.strictEqual(g, 1);
    assert.strictEqual(b, 1);
});

test('hexToNormalizedRGB: pure black (0x000000) → all 0.0', function() {
    const { r, g, b } = hexToNormalizedRGB(0x000000);
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
});

test('hexToNormalizedRGB: channels are independent (0xff0000 → r=1, g=0, b=0)', function() {
    const { r, g, b } = hexToNormalizedRGB(0xff0000);
    assert.strictEqual(r, 1);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
});

// ---------------------------------------------------------------------------
// gridDimensions
// ---------------------------------------------------------------------------

test('gridDimensions: 3750 scales at default spacing produces square-ish grid', function() {
    const { cols, rows, gridWidth, gridHeight } = gridDimensions(3750, 0.48, 0.49);
    // cols = ceil(sqrt(3750)) = ceil(61.24…) = 62
    assert.strictEqual(cols, 62);
    // rows = ceil(3750 / 62) = ceil(60.48…) = 61
    assert.strictEqual(rows, 61);
    assert.ok(Math.abs(gridWidth  - 61 * 0.48) < 1e-9, 'gridWidth');
    assert.ok(Math.abs(gridHeight - 60 * 0.49) < 1e-9, 'gridHeight');
});

test('gridDimensions: 1 scale → cols=1, rows=1, widths=0', function() {
    const { cols, rows, gridWidth, gridHeight } = gridDimensions(1, 0.48, 0.49);
    assert.strictEqual(cols, 1);
    assert.strictEqual(rows, 1);
    assert.strictEqual(gridWidth,  0);
    assert.strictEqual(gridHeight, 0);
});

test('gridDimensions: perfect square count (4) → 2×2 grid', function() {
    const { cols, rows } = gridDimensions(4, 1, 1);
    assert.strictEqual(cols, 2);
    assert.strictEqual(rows, 2);
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test('clamp: value within range is unchanged', function() {
    assert.strictEqual(clamp(0.5, 0, 1), 0.5);
});

test('clamp: value below min is clamped to min', function() {
    assert.strictEqual(clamp(-0.2, 0, 1), 0);
});

test('clamp: value above max is clamped to max', function() {
    assert.strictEqual(clamp(1.5, 0, 1), 1);
});

// ---------------------------------------------------------------------------
// scaleRotY
// ---------------------------------------------------------------------------

test('scaleRotY: sine=0 → 15° (mid-range, no amplitude boost)', function() {
    const rotY = scaleRotY(0);
    assert.ok(Math.abs(rotY - 15 * Math.PI / 180) < 1e-9);
});

test('scaleRotY: sine=1 → 45° (max forward tilt)', function() {
    const rotY = scaleRotY(1);
    assert.ok(Math.abs(rotY - 45 * Math.PI / 180) < 1e-9);
});

test('scaleRotY: sine=-1 → -15° (max back tilt)', function() {
    const rotY = scaleRotY(-1);
    assert.ok(Math.abs(rotY - (-15) * Math.PI / 180) < 1e-9);
});

test('scaleRotY: amplitudeScale=2 doubles the swing around the 15° midpoint', function() {
    // With scale=2: sineValue*30*2 + 15 = sineValue*60+15
    // sine=1 → 75°; sine=-1 → -45°
    const rotYMax = scaleRotY(1, 2);
    const rotYMin = scaleRotY(-1, 2);
    assert.ok(Math.abs(rotYMax - 75 * Math.PI / 180) < 1e-9, 'max with boost');
    assert.ok(Math.abs(rotYMin - (-45) * Math.PI / 180) < 1e-9, 'min with boost');
});
