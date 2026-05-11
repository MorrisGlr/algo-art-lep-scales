// ---------------------------------------------------------------------------
// WingScaleConfig — domain parameters for the Wing Scale piece.
// Contains all biological/physics constants that describe lepidopteran scale
// morphology and motion. The rendering engine (scales_1.js) reads from this
// object, leaving the engine unchanged when swapping species configurations.
// ---------------------------------------------------------------------------
const WingScaleConfig = {

    // Seeded PRNG — mulberry32.
    // Returns a function that produces floats in [0, 1) from a 32-bit integer seed.
    prng: function mulberry32(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
            z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
            return ((z ^ z >>> 14) >>> 0) / 4294967296;
        };
    },

    // Named color palettes — each inspired by a real lepidopteran species.
    // colorA/colorB drive the UV gradient; background/backgroundB drive the
    // full-screen gradient quad; iridColor is the edge-on iridescence highlight.
    palettes: {
        'original':     { colorA: 0xeeb792, colorB: 0x20766b, background: 0xafeeee, backgroundB: 0x4a9898, iridColor: 0x80eeff },
        'morpho':       { colorA: 0x00aaff, colorB: 0x0a1080, background: 0x08082e, backgroundB: 0x02020f, iridColor: 0xaaddff },
        'monarch':      { colorA: 0xff8c00, colorB: 0x1a0a00, background: 0xfff0d0, backgroundB: 0xd4a840, iridColor: 0xffcc44 },
        'luna':         { colorA: 0xc8f0a0, colorB: 0x1a5c2a, background: 0xe8f5e0, backgroundB: 0x7aaa6a, iridColor: 0xeeffcc },
        'painted-lady': { colorA: 0xd4622a, colorB: 0xf0d898, background: 0xe8e0d0, backgroundB: 0xb08050, iridColor: 0xffbb44 },
        'swallowtail':  { colorA: 0xf5e642, colorB: 0x0d0d0d, background: 0x1a1a0a, backgroundB: 0x050500, iridColor: 0xeeff88 },
        'peacock':      { colorA: 0x00c8b4, colorB: 0x1a0060, background: 0x080830, backgroundB: 0x020218, iridColor: 0x44ffee },
        'emperor':      { colorA: 0x8844cc, colorB: 0x1a0030, background: 0x0e0020, backgroundB: 0x060010, iridColor: 0xcc88ff },
        'brimstone':    { colorA: 0xd4f040, colorB: 0x4a6800, background: 0xf0f8d0, backgroundB: 0xa0c040, iridColor: 0xeeff88 },
        'atlas':        { colorA: 0xc04420, colorB: 0x6a2800, background: 0x2a1008, backgroundB: 0x100400, iridColor: 0xff8844 }
    },

    // Scale geometry — physical dimensions of a single lepidopteran scale mesh.
    geometry: {
        scaleThickness: 0.065,  // depth of the scale body (Z axis)
        spacing:        0.48,   // horizontal distance between scale centers
        verticalSpacing: 0.49,  // vertical distance between scale centers
        shingleZStep:   0.010,  // Z offset per row — upper rows closer to camera
        baseScaleCount: 4500,   // scale count at density=1.0 (multiplied by DENSITY param)
    },

    // Traveling wave — position-based phase produces a coherent diagonal ripple.
    wave: {
        kx: 0.25,  // spatial frequency, X axis (rad / world-unit)
        ky: 0.50,  // spatial frequency, Y axis (rad / world-unit)
    },

    // Secondary pitch oscillation — slow X-axis tilt overlaid on Y-rotation,
    // modeled after the multi-axis flutter of a scale under airflow.
    pitch: {
        speedFactor:  0.37,          // fraction of main oscillation speed
        amplitude:    5,             // degrees
        phaseOffset:  Math.PI / 2,   // 90° out of phase with Y-rotation
    },

    // Pressure wave — expanding ripple emitted on click/tap.
    pressureWave: {
        speed:    4.0,   // world-units per second
        duration: 3500,  // ms until full decay
        strength: 1.8,   // phase amplitude at the wavefront
    },
};

// CommonJS export for Node.js test runner — no-op in the browser.
if (typeof module !== 'undefined') module.exports = WingScaleConfig;
