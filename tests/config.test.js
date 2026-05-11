const { test } = require('node:test');
const assert = require('node:assert/strict');
const WingScaleConfig = require('../wing-scale-config.js');

test('WingScaleConfig has all required top-level sections', function() {
    assert.ok(typeof WingScaleConfig.prng === 'function', 'prng is a function');
    assert.ok(typeof WingScaleConfig.palettes === 'object', 'palettes is an object');
    assert.ok(typeof WingScaleConfig.geometry === 'object', 'geometry is an object');
    assert.ok(typeof WingScaleConfig.wave === 'object', 'wave is an object');
    assert.ok(typeof WingScaleConfig.pitch === 'object', 'pitch is an object');
    assert.ok(typeof WingScaleConfig.pressureWave === 'object', 'pressureWave is an object');
});

test('WingScaleConfig.prng is a deterministic seeded factory', function() {
    const r1 = WingScaleConfig.prng(42);
    const a = r1(), b = r1();
    const r2 = WingScaleConfig.prng(42);
    assert.strictEqual(r2(), a, 'same seed produces same first value');
    assert.strictEqual(r2(), b, 'same seed produces same second value');
    const r3 = WingScaleConfig.prng(99);
    assert.notStrictEqual(r3(), a, 'different seed produces different value');
});

test('WingScaleConfig.palettes entries have required color fields', function() {
    const required = ['colorA', 'colorB', 'background', 'backgroundB', 'iridColor'];
    Object.keys(WingScaleConfig.palettes).forEach(function(name) {
        const p = WingScaleConfig.palettes[name];
        required.forEach(function(field) {
            assert.ok(typeof p[field] === 'number', name + '.' + field + ' is a number');
        });
    });
});

test('WingScaleConfig.geometry fields are positive numbers', function() {
    const g = WingScaleConfig.geometry;
    ['scaleThickness', 'spacing', 'verticalSpacing', 'shingleZStep', 'baseScaleCount'].forEach(function(k) {
        assert.ok(typeof g[k] === 'number' && g[k] > 0, 'geometry.' + k + ' is a positive number');
    });
});
