// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// Accepts a 32-bit integer seed; returns a function that produces floats [0,1).
// ---------------------------------------------------------------------------
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
        z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
        return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// URL hash parameter parsing
// Parse #key=value&... pairs from window.location.hash.
// ---------------------------------------------------------------------------
function parseHashParams() {
    const params = {};
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return params;
    raw.split('&').forEach(function(pair) {
        const idx = pair.indexOf('=');
        if (idx > 0) params[pair.slice(0, idx)] = pair.slice(idx + 1);
    });
    return params;
}

const hashParams = parseHashParams();

// Seed: use #seed=N if present; otherwise generate randomly and write to hash.
let SEED;
if (hashParams.seed !== undefined && /^\d+$/.test(hashParams.seed)) {
    SEED = parseInt(hashParams.seed, 10);
} else {
    SEED = Math.floor(Math.random() * 4294967296);
    // Write seed into hash so the current view is reproducible.
    const newHash = Object.assign({}, hashParams, { seed: SEED });
    window.location.hash = Object.keys(newHash).map(function(k) {
        return k + '=' + newHash[k];
    }).join('&');
}

const seededRandom = mulberry32(SEED);

// ---------------------------------------------------------------------------
// URL hash parameters: density, speed, palette (seed is parsed above)
// ---------------------------------------------------------------------------
const DENSITY_DEFAULT = 1.0;
const SPEED_DEFAULT   = 1.0;
const PALETTE_DEFAULT = 'original';
const PALETTES = {
    'original':     { colorA: 0xeeb792, colorB: 0x20766b, sideTint: 0x969696, background: 0xafeeee },
    'morpho':       { colorA: 0x00aaff, colorB: 0x0a1080, sideTint: 0x3a5a80, background: 0x08082e },
    'monarch':      { colorA: 0xff8c00, colorB: 0x1a0a00, sideTint: 0x7a3500, background: 0xfff0d0 },
    'luna':         { colorA: 0xc8f0a0, colorB: 0x1a5c2a, sideTint: 0x4a8040, background: 0xe8f5e0 },
    'painted-lady': { colorA: 0xd4622a, colorB: 0xf0d898, sideTint: 0x8b4513, background: 0xe8e0d0 }
};
const VALID_PALETTES = Object.keys(PALETTES);

let DENSITY = DENSITY_DEFAULT;
let SPEED   = SPEED_DEFAULT;
let PALETTE = PALETTE_DEFAULT;

if (hashParams.density !== undefined) {
    const d = parseFloat(hashParams.density);
    if (!isNaN(d) && d >= 0.25 && d <= 4.0) {
        DENSITY = d;
    } else {
        console.warn('[wing-scale] density out of range [0.25, 4.0]; using default', DENSITY_DEFAULT);
    }
}
if (hashParams.speed !== undefined) {
    const s = parseFloat(hashParams.speed);
    if (!isNaN(s) && s >= 0.1 && s <= 10.0) {
        SPEED = s;
    } else {
        console.warn('[wing-scale] speed out of range [0.1, 10.0]; using default', SPEED_DEFAULT);
    }
}
if (hashParams.palette !== undefined) {
    if (VALID_PALETTES.indexOf(hashParams.palette) !== -1) {
        PALETTE = hashParams.palette;
    } else {
        console.warn('[wing-scale] unknown palette "' + hashParams.palette + '"; using default "' + PALETTE_DEFAULT + '"');
    }
}
const activePalette = PALETTES[PALETTE];

// ---------------------------------------------------------------------------
// Mouse/touch oscillation influence — SPEC 7.1
// ---------------------------------------------------------------------------
const MOUSE_INFLUENCE_RADIUS = 1.5;  // world-space units; falloff distance from pointer
const MOUSE_AMPLITUDE_BOOST  = 0.5;  // fractional increase to rotation range at pointer center

// ---------------------------------------------------------------------------
// Scroll/gesture zoom — SPEC 7.2
// ---------------------------------------------------------------------------
const USER_ZOOM_CLAMP = 0.15;  // max absolute zoom delta from user input
let userZoomDelta = 0;

// ---------------------------------------------------------------------------
// Video export presets — triggered by pressing E.
// 'reveal'  strategy: resets animation to t=0, captures the full zoom-out arc.
// 'drift'   strategy: skips to post-zoom drift phase, captures a looping steady state.
// ---------------------------------------------------------------------------
const EXPORT_15S = { frames: 900,  fps: 60, strategy: 'reveal', label: '15s reveal' };
const EXPORT_30S = { frames: 1800, fps: 60, strategy: 'drift',  label: '30s drift'  };
const ACTIVE_EXPORT_PRESET = EXPORT_15S; // swap to EXPORT_30S to change default

// ---------------------------------------------------------------------------
// Parameters to adjust the animation
// ---------------------------------------------------------------------------
let number_of_clones = Math.round(3750 * DENSITY); // base 3750 scales, scaled by density
let spacing = 0.48; // Set the spacing between clones
let verticalSpacing = 0.49; // Set the vertical spacing between clones
let scaleThickness = 0.15; // Set the thickness of the butterfly scale


// Set up the basic Three.js scene, camera, and renderer.
let scene = new THREE.Scene(); // Create a new scene
let camera = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.1, 1000); // Set up the camera with appropriate parameters
camera.position.x = 0; // Move the camera to the left
camera.position.y = 0;
let renderer = new THREE.WebGLRenderer({ antialias: true }); // Create a renderer that will draw our scene
renderer.setSize(window.innerWidth, window.innerHeight); // Set the size of the rendering view
document.body.appendChild(renderer.domElement); // Attach the renderer to the HTML document
renderer.setClearColor(activePalette.background);

// Lighting: directional (top-right illumination) + ambient (prevents pure-black shadows).
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));


// Set up ccapture.js to record the animation
const capturer = new CCapture({
    format: 'webm', // or 'png' for image sequence
    framerate: 60,
    verbose: true,
  });
let isCapturing = false;

// Export preset state
let isExporting = false;
let exportFrameCount = 0;
let exportPreset = null;
const exportCapturer = new CCapture({ format: 'webm', framerate: 60, verbose: false });

// Export frame-counter overlay — shows progress during preset export.
const exportIndicator = (function() {
    const el = document.getElementById('export-indicator') || document.createElement('div');
    el.id = 'export-indicator';
    el.style.cssText = [
        'position:fixed', 'bottom:28px', 'left:8px',
        'font-family:monospace', 'font-size:11px',
        'color:#e03030', 'opacity:0.8', 'pointer-events:none',
        'z-index:100', 'user-select:none', 'display:none'
    ].join(';');
    document.body.appendChild(el);
    return el;
}());

function startExport(preset) {
    if (isExporting) return;
    isExporting = true;
    exportPreset = preset;
    exportFrameCount = 0;
    exportIndicator.style.display = 'block';
    exportIndicator.textContent = 'EXP 0 / ' + preset.frames + ' (' + preset.label + ')';

    if (preset.strategy === 'reveal') {
        // Reset animation to t=0 so the export captures the full zoom-out arc.
        rotationStartTime = Date.now() + rotationDelay;
        camera.zoom = startZoom;
        camera.rotation.x = startRotation;
        camera.rotation.z = startRotation;
        camera.updateProjectionMatrix();
    } else {
        // 'drift' strategy: fake the clock so the camera is already past the zoom-out.
        rotationStartTime = Date.now() - rotationDelay - rotationDuration - 1;
    }
    exportCapturer.start();
}

function tickExport() {
    if (!isExporting) return;
    exportCapturer.capture(renderer.domElement);
    exportFrameCount++;
    exportIndicator.textContent = 'EXP ' + exportFrameCount + ' / ' + exportPreset.frames + ' (' + exportPreset.label + ')';
    if (exportFrameCount >= exportPreset.frames) {
        exportCapturer.stop();
        exportCapturer.save();
        isExporting = false;
        exportPreset = null;
        exportIndicator.style.display = 'none';
    }
}

// Add the keydown event listener
window.addEventListener('keydown', function(event) {
    if (event.key === 'c' || event.key === 'C') {
        isCapturing = !isCapturing;

        if (isCapturing) {
            capturer.start();
        } else {
            capturer.stop();
            capturer.save();
        }
    }
    if (event.key === 'r' || event.key === 'R') {
        rotationStartTime = Date.now() + rotationDelay;
        camera.zoom = startZoom;
        camera.rotation.x = startRotation;
        camera.rotation.z = startRotation;
        camera.updateProjectionMatrix();
    }
    if (event.key === 'e' || event.key === 'E') {
        startExport(ACTIVE_EXPORT_PRESET);
    }
});


// Define the geometry and material for the scale mesh.

// Color gradient helpers
function hexToNormalizedRGB(hex) {
    return {
        r: ((hex >> 16) & 255) / 255,
        g: ((hex >> 8) & 255) / 255,
        b: (hex & 255) / 255
    };
}
const paletteColorANorm = hexToNormalizedRGB(activePalette.colorA);
const paletteColorBNorm = hexToNormalizedRGB(activePalette.colorB);
const scaleUniforms = {
    colorA: { value: new THREE.Vector3(paletteColorANorm.r, paletteColorANorm.g, paletteColorANorm.b) },
    colorB: { value: new THREE.Vector3(paletteColorBNorm.r, paletteColorBNorm.g, paletteColorBNorm.b) }
};
const scaleVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const scaleFragmentShader = `
    uniform vec3 colorA;
    uniform vec3 colorB;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        float lightFactor = 0.5 + 0.5 * diffuse;
        vec3 color = mix(colorA, colorB, vUv.x) * lightFactor;
        gl_FragColor = vec4(color, 1.0);
    }
`;
const scaleMaterial = new THREE.ShaderMaterial({
    vertexShader: scaleVertexShader,
    fragmentShader: scaleFragmentShader,
    uniforms: scaleUniforms,
    side: THREE.DoubleSide
});
const sideMaterial = new THREE.MeshBasicMaterial({ color: activePalette.sideTint, side: THREE.DoubleSide });

// Custom butterfly scale geometry — BufferGeometry, DoubleSide.
// 16 base vertices: front ring (z=0) and back ring (z=-scaleThickness).
// x coordinates are pre-offset by -0.4 so the pivot point sits at x=0 of each instance,
// matching the original clone.position.set(-0.4, 0, 0) behavior.
//
// Front vertices (0-7):       Back vertices (8-15, same x/y, z=-scaleThickness):
//   0: (-0.75,  0.00, 0)        8: (-0.75,  0.00, -t)
//   1: (-0.60,  0.15, 0)        9: (-0.60,  0.15, -t)
//   2: (-0.85,  0.25, 0)       10: (-0.85,  0.25, -t)
//   3: (-0.15,  0.18, 0)       11: (-0.15,  0.18, -t)
//   4: (-0.275, 0.00, 0)       12: (-0.275, 0.00, -t)
//   5: (-0.15, -0.18, 0)       13: (-0.15, -0.18, -t)
//   6: (-0.85, -0.25, 0)       14: (-0.85, -0.25, -t)
//   7: (-0.60, -0.15, 0)       15: (-0.60, -0.15, -t)

const t = scaleThickness; // shorthand

// Helper to build a flat [x,y,z, u,v] entry for the frontBack geometry
function fbv(x, y, z, u, v) { return [x, y, z, u, v]; }
// Helper for side geometry: flat [x,y,z]
function sv(x, y, z) { return [x, y, z]; }

// Original UV scheme: every triangle face assigns its three vertices
// UVs (0.5,0.9), (0.2,0.5), (0.9,0.5) in face-vertex order.
// We replicate this exactly by expanding to unindexed geometry (no shared vertices).
// Front faces: (0,3,4), (0,1,3), (1,2,3), (0,4,5), (0,5,7), (6,7,5)
// Back faces:  (8,11,12), (8,9,11), (9,10,11), (8,12,13), (8,13,15), (14,15,13)
const frontBackData = [
    // Front face triangles — (A, B, C) → UVs (0.5,0.9), (0.2,0.5), (0.9,0.5)
    fbv(-0.75, 0,     0, 0.5, 0.9), fbv(-0.15,  0.18, 0, 0.2, 0.5), fbv(-0.275, 0,    0, 0.9, 0.5), // (0,3,4)
    fbv(-0.75, 0,     0, 0.5, 0.9), fbv(-0.60,  0.15, 0, 0.2, 0.5), fbv(-0.15,  0.18, 0, 0.9, 0.5), // (0,1,3)
    fbv(-0.60, 0.15,  0, 0.5, 0.9), fbv(-0.85,  0.25, 0, 0.2, 0.5), fbv(-0.15,  0.18, 0, 0.9, 0.5), // (1,2,3)
    fbv(-0.75, 0,     0, 0.5, 0.9), fbv(-0.275, 0,    0, 0.2, 0.5), fbv(-0.15, -0.18, 0, 0.9, 0.5), // (0,4,5)
    fbv(-0.75, 0,     0, 0.5, 0.9), fbv(-0.15, -0.18, 0, 0.2, 0.5), fbv(-0.60, -0.15, 0, 0.9, 0.5), // (0,5,7)
    fbv(-0.85, -0.25, 0, 0.5, 0.9), fbv(-0.60, -0.15, 0, 0.2, 0.5), fbv(-0.15, -0.18, 0, 0.9, 0.5), // (6,7,5)
    // Back face triangles — same UV pattern, z=-t
    fbv(-0.75, 0,     -t, 0.5, 0.9), fbv(-0.15,  0.18, -t, 0.2, 0.5), fbv(-0.275, 0,    -t, 0.9, 0.5), // (8,11,12)
    fbv(-0.75, 0,     -t, 0.5, 0.9), fbv(-0.60,  0.15, -t, 0.2, 0.5), fbv(-0.15,  0.18, -t, 0.9, 0.5), // (8,9,11)
    fbv(-0.60, 0.15,  -t, 0.5, 0.9), fbv(-0.85,  0.25, -t, 0.2, 0.5), fbv(-0.15,  0.18, -t, 0.9, 0.5), // (9,10,11)
    fbv(-0.75, 0,     -t, 0.5, 0.9), fbv(-0.275, 0,    -t, 0.2, 0.5), fbv(-0.15, -0.18, -t, 0.9, 0.5), // (8,12,13)
    fbv(-0.75, 0,     -t, 0.5, 0.9), fbv(-0.15, -0.18, -t, 0.2, 0.5), fbv(-0.60, -0.15, -t, 0.9, 0.5), // (8,13,15)
    fbv(-0.85, -0.25, -t, 0.5, 0.9), fbv(-0.60, -0.15, -t, 0.2, 0.5), fbv(-0.15, -0.18, -t, 0.9, 0.5), // (14,15,13)
];
const fbPositions = new Float32Array(frontBackData.length * 3);
const fbUvs       = new Float32Array(frontBackData.length * 2);
for (let i = 0; i < frontBackData.length; i++) {
    fbPositions[i*3]   = frontBackData[i][0];
    fbPositions[i*3+1] = frontBackData[i][1];
    fbPositions[i*3+2] = frontBackData[i][2];
    fbUvs[i*2]   = frontBackData[i][3];
    fbUvs[i*2+1] = frontBackData[i][4];
}
const frontBackGeometry = new THREE.BufferGeometry();
frontBackGeometry.setAttribute('position', new THREE.BufferAttribute(fbPositions, 3));
frontBackGeometry.setAttribute('uv',       new THREE.BufferAttribute(fbUvs,       2));
frontBackGeometry.computeVertexNormals();

// Side faces: 8 quads connecting perimeter edges (0→1→2→3→4→5→6→7→0)
// to the corresponding back-ring edges. Each quad = 2 triangles.
// Winding: (fi, fi+1, bi+1), (fi, bi+1, bi) for outward normals.
const perimF = [
    [-0.75, 0,     0], [-0.60, 0.15,  0], [-0.85, 0.25,  0], [-0.15, 0.18,  0],
    [-0.275, 0,    0], [-0.15, -0.18, 0], [-0.85, -0.25, 0], [-0.60, -0.15, 0]
];
const sideData = [];
for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    const [fx0, fy0] = perimF[i];
    const [fx1, fy1] = perimF[next];
    // Triangle A: fi, fi+1, bi+1
    sideData.push(sv(fx0, fy0, 0), sv(fx1, fy1, 0), sv(fx1, fy1, -t));
    // Triangle B: fi, bi+1, bi
    sideData.push(sv(fx0, fy0, 0), sv(fx1, fy1, -t), sv(fx0, fy0, -t));
}
const sidePositions = new Float32Array(sideData.length * 3);
for (let i = 0; i < sideData.length; i++) {
    sidePositions[i*3]   = sideData[i][0];
    sidePositions[i*3+1] = sideData[i][1];
    sidePositions[i*3+2] = sideData[i][2];
}
const sideGeometry = new THREE.BufferGeometry();
sideGeometry.setAttribute('position', new THREE.BufferAttribute(sidePositions, 3));
sideGeometry.computeVertexNormals();


// Build InstancedMesh grid — replaces 3,750 individual clone+pivot pairs with two
// single draw calls (frontBack faces + side faces).
const NUMBER_OF_SCALES = number_of_clones;
const instancedFrontBack = new THREE.InstancedMesh(frontBackGeometry, scaleMaterial, NUMBER_OF_SCALES);
const instancedSide      = new THREE.InstancedMesh(sideGeometry,      sideMaterial,  NUMBER_OF_SCALES);
instancedFrontBack.frustumCulled = false;
instancedSide.frustumCulled      = false;
scene.add(instancedFrontBack);
scene.add(instancedSide);

// Pre-compute grid positions (same math as former clone loop).
let rows      = Math.ceil(Math.sqrt(NUMBER_OF_SCALES));
let gridWidth  = (rows - 1) * spacing;
let gridHeight = (Math.ceil(NUMBER_OF_SCALES / rows) - 1) * verticalSpacing;

const instancePositions = new Float32Array(NUMBER_OF_SCALES * 3);
for (let i = 0; i < NUMBER_OF_SCALES; i++) {
    let row = Math.floor(i / rows);
    let col = i % rows;
    instancePositions[i*3]   = (col * spacing)        - (gridWidth  / 2);
    instancePositions[i*3+1] = (row * verticalSpacing) - (gridHeight / 2);
    instancePositions[i*3+2] = 0;
}

// Reusable objects for per-frame matrix composition.
const _matrix     = new THREE.Matrix4();
const _position   = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale      = new THREE.Vector3(1, 1, 1);
const _euler      = new THREE.Euler();

// Per-scale oscillation phase offsets — seeded so the same seed always produces
// the same wave pattern. Each offset is a random angle in [0, 2π).
const phaseOffsets = new Float32Array(NUMBER_OF_SCALES);
for (let i = 0; i < NUMBER_OF_SCALES; i++) {
    phaseOffsets[i] = seededRandom() * Math.PI * 2;
}

// Seed overlay — display current seed in bottom-left corner.
(function() {
    let overlay = document.getElementById('seed-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'seed-overlay';
        overlay.style.cssText = [
            'position:fixed', 'bottom:8px', 'left:8px',
            'font-family:monospace', 'font-size:11px',
            'color:#333', 'opacity:0.5', 'pointer-events:none',
            'z-index:100', 'user-select:none'
        ].join(';');
        document.body.appendChild(overlay);
    }
    overlay.textContent = 'seed: ' + SEED;
}());

// ---------------------------------------------------------------------------
// Mouse/touch pointer tracking — SPEC 7.1
// Pointer position stored in grid world-space so per-scale distance is cheap.
// The canvas is centered at origin; divide CSS pixels by spacing to approximate.
// ---------------------------------------------------------------------------
let mouseX = Infinity;
let mouseY = Infinity;

(function() {
    const cvs = renderer.domElement;

    function updateFromEvent(clientX, clientY) {
        const rect = cvs.getBoundingClientRect();
        // Map from CSS pixel (0..rect.width, 0..rect.height) to grid world-space.
        const normX = (clientX - rect.left)  / rect.width  - 0.5;  // -0.5 .. 0.5
        const normY = (clientY - rect.top)   / rect.height - 0.5;

        const cols = Math.ceil(Math.sqrt(number_of_clones));
        const gridW = (cols - 1) * spacing;
        const gridH = (Math.ceil(number_of_clones / cols) - 1) * verticalSpacing;
        mouseX = normX * gridW;
        mouseY = -normY * gridH;  // Y is inverted (screen down = world down)
    }

    window.addEventListener('mousemove', function(e) {
        updateFromEvent(e.clientX, e.clientY);
    });
    window.addEventListener('mouseleave', function() {
        mouseX = Infinity;
        mouseY = Infinity;
    });
    cvs.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
            updateFromEvent(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    cvs.addEventListener('touchend', function() {
        mouseX = Infinity;
        mouseY = Infinity;
    }, { passive: true });
}());

// ---------------------------------------------------------------------------
// Scroll/gesture zoom — SPEC 7.2
// ---------------------------------------------------------------------------
(function() {
    // Desktop: wheel event adjusts userZoomDelta.
    window.addEventListener('wheel', function(e) {
        e.preventDefault();
        userZoomDelta = Math.max(-USER_ZOOM_CLAMP, Math.min(USER_ZOOM_CLAMP,
            userZoomDelta - e.deltaY * 0.0005));
    }, { passive: false });

    // Mobile: pinch via two-finger touch.
    let initialPinchDist = null;
    let initialZoomDelta = 0;

    renderer.domElement.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.sqrt(dx * dx + dy * dy);
            initialZoomDelta = userZoomDelta;
        }
    }, { passive: true });

    renderer.domElement.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2 && initialPinchDist !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDist = Math.sqrt(dx * dx + dy * dy);
            const scale = currentDist / initialPinchDist;
            // pinch-out (scale>1) → zoom in (positive delta)
            const delta = (scale - 1) * USER_ZOOM_CLAMP;
            userZoomDelta = Math.max(-USER_ZOOM_CLAMP, Math.min(USER_ZOOM_CLAMP,
                initialZoomDelta + delta));
        }
    }, { passive: true });

    renderer.domElement.addEventListener('touchend', function(e) {
        if (e.touches.length < 2) {
            initialPinchDist = null;
        }
    }, { passive: true });
}());

// Define the animation loop.
let startRotation = camera.rotation.z; // Starting rotation
let endRotationz = startRotation + Math.PI / 2; // Target rotation (90 degrees in radians)
let endRotationx = startRotation + Math.PI / 7; // Target rotation (45 degrees in radians)
const DRIFT_AMPLITUDE = 0.009; // micro-drift amplitude after zoom-out (radians, ≈ ±0.5°)
const DRIFT_SPEED_X   = 0.0003; // drift oscillation rate on X axis
const DRIFT_SPEED_Z   = 0.0002; // drift oscillation rate on Z axis
let rotationDuration = 13000; // Duration in milliseconds, adjust as needed
let rotationDelay = 750; // Delay in millisecond
let rotationStartTime = Date.now() + rotationDelay; // Start time of the camera rotation
let startZoom = camera.zoom;
let endZoom = 0.17; // Adjust this value to zoom out more or less
//let startPosition = camera.position.clone(); // Starting position (current position of the camera)
//let endPosition = new THREE.Vector3(0, 0, 10); // Target position (coordinates near your 3D shapes)
// Replace 'x, y, z' with the desired coordinates
function animate() {
    requestAnimationFrame(animate); // Request the next frame of the animation

    // Camera rotation logic
    let currentTime = Date.now();
    if (currentTime >= rotationStartTime) {
        // Start rotating the camera after the delay
        let elapsedTime = currentTime - rotationStartTime;
        if (elapsedTime < rotationDuration) {
            let fraction = elapsedTime / rotationDuration;
            camera.rotation.z = startRotation + fraction * (endRotationz - startRotation);
            camera.rotation.x = startRotation + fraction * (endRotationx - startRotation);
            camera.zoom = startZoom + fraction * (endZoom - startZoom) + userZoomDelta;
            camera.updateProjectionMatrix(); // Important to update the camera's projection matrix
            // Interpolate camera position
            //camera.position.lerpVectors(startPosition, endPosition, fraction);
        } else {
            const driftNow = Date.now();
            camera.rotation.z = endRotationz + Math.sin(driftNow * DRIFT_SPEED_Z) * DRIFT_AMPLITUDE;
            camera.rotation.x = endRotationx + Math.cos(driftNow * DRIFT_SPEED_X) * DRIFT_AMPLITUDE;
            camera.zoom = endZoom + userZoomDelta;
        }
    }

    // Animate each scale instance with sinusoidal Y-rotation (wing-flapping motion).
    // sineValue oscillates between -1 and 1; mapped to -15°…+45° rotation range.
    // Amplitude is boosted for scales near the pointer (SPEC 7.1).
    const now = Date.now();
    for (let i = 0; i < NUMBER_OF_SCALES; i++) {
        const sineValue = Math.sin(now * 0.0015 * SPEED + phaseOffsets[i]);
        const dx = instancePositions[i*3]   - mouseX;
        const dy = instancePositions[i*3+1] - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const amplitudeScale = 1 + MOUSE_AMPLITUDE_BOOST * Math.max(0, 1 - dist / MOUSE_INFLUENCE_RADIUS);
        const rotY = (sineValue * 30 * amplitudeScale + 15) * (Math.PI / 180);
        _position.set(instancePositions[i*3], instancePositions[i*3+1], instancePositions[i*3+2]);
        _euler.set(0, rotY, 0);
        _quaternion.setFromEuler(_euler);
        _matrix.compose(_position, _quaternion, _scale);
        instancedFrontBack.setMatrixAt(i, _matrix);
        instancedSide.setMatrixAt(i, _matrix);
    }
    instancedFrontBack.instanceMatrix.needsUpdate = true;
    instancedSide.instanceMatrix.needsUpdate      = true;

    renderer.setSize(1080, 1920);
    renderer.render(scene, camera);
    if (isCapturing) {
        capturer.capture(renderer.domElement);
    }
    tickExport();
}

animate();