// Parameters to adjust the animation
let number_of_clones = 3750; // Number of clones to create, 955
let spacing = 0.48; // Set the spacing between clones
let verticalSpacing = 0.49; // Set the vertical spacing between clones
let scaleThickness = 0.15; // Set the thickness of the butterfly scale
const scaleColor1 = 0xeeb792
const scaleColor2 = 0x20766b


// Set up the basic Three.js scene, camera, and renderer.
let scene = new THREE.Scene(); // Create a new scene
let camera = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.1, 1000); // Set up the camera with appropriate parameters
camera.position.x = 0; // Move the camera to the left
camera.position.y = 0;
let renderer = new THREE.WebGLRenderer({ antialias: true }); // Create a renderer that will draw our scene
renderer.setSize(window.innerWidth, window.innerHeight); // Set the size of the rendering view
document.body.appendChild(renderer.domElement); // Attach the renderer to the HTML document
renderer.setClearColor(0xafeeee); //0xe1e1e1


// Set up ccapture.js to record the animation
const capturer = new CCapture({
    format: 'webm', // or 'png' for image sequence
    framerate: 60,
    verbose: true,
  });
let isCapturing = false;
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
});


// Define the geometry and material for the basic rectangular prism mesh.
// Color gradient
function hexToNormalizedRGB(hex) {
    return {
      r: ((hex >> 16) & 255) / 255,
      g: ((hex >> 8) & 255) / 255,
      b: (hex & 255) / 255
    };
  }
const scaleColor1Norm = hexToNormalizedRGB(scaleColor1);
const scaleColor2Norm = hexToNormalizedRGB(scaleColor2);
const scaleUniforms = {
    colorA: { value: new THREE.Vector3(scaleColor1Norm.r, scaleColor1Norm.g, scaleColor1Norm.b) },
    colorB: { value: new THREE.Vector3(scaleColor2Norm.r, scaleColor2Norm.g, scaleColor2Norm.b) }
  };
  // Create a shader
  const scaleVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const scaleFragmentShader = `
    uniform vec3 colorA;
    uniform vec3 colorB;
    varying vec2 vUv;
    void main() {
      vec3 color = mix(colorA, colorB, vUv.x);
      gl_FragColor = vec4(color, 1.0);
    }
  `;
  const scaleMaterial = new THREE.ShaderMaterial({
    vertexShader: scaleVertexShader,
    fragmentShader: scaleFragmentShader,
    uniforms: scaleUniforms,
    side: THREE.BackSide
  });
// Custom butterfly scale geometry
var scaleGeometry = new THREE.Geometry();

// Define the vertices of the scale shape
scaleGeometry.vertices.push(
    // Front face
    new THREE.Vector3(-0.35, 0, 0),  // Vertex 0
    new THREE.Vector3(-0.2, 0.15, 0), // Vertex 1
    new THREE.Vector3(-0.45, 0.25, 0),  // Vertex 2
    new THREE.Vector3(0.25, 0.18, 0),    // Vertex 3
    new THREE.Vector3(0.125, 0, 0), // Vertex 4
    new THREE.Vector3(0.25, -0.18, 0), // Vertex 5
    new THREE.Vector3(-0.45, -0.25, 0), // Vertex 6
    new THREE.Vector3(-0.2, -0.15, 0), // Vertex 7
    // Back face
    new THREE.Vector3(-0.35, 0, -scaleThickness),  // Vertex 8
    new THREE.Vector3(-0.2, 0.15, -scaleThickness), // Vertex 9
    new THREE.Vector3(-0.45, 0.25, -scaleThickness),  // Vertex 10
    new THREE.Vector3(0.25, 0.18, -scaleThickness),    // Vertex 11
    new THREE.Vector3(0.125, 0, -scaleThickness), // Vertex 12
    new THREE.Vector3(0.25, -0.18, -scaleThickness), // Vertex 13
    new THREE.Vector3(-0.45, -0.25, -scaleThickness), // Vertex 14
    new THREE.Vector3(-0.2, -0.15, -scaleThickness) // Vertex 15
);

// Create faces using the vertices
scaleGeometry.faces.push(
    // Front face
    new THREE.Face3(0, 3, 4),
    new THREE.Face3(0, 1, 3),
    new THREE.Face3(1, 2, 3),
    new THREE.Face3(0, 4, 5),
    new THREE.Face3(0, 5, 7),
    new THREE.Face3(6, 7, 5),
    // Back face
    new THREE.Face3(8, 11, 12),
    new THREE.Face3(8, 9, 11),
    new THREE.Face3(9, 10, 11),
    new THREE.Face3(8, 12, 13),
    new THREE.Face3(8, 13, 15),
    new THREE.Face3(14, 15, 13)
    // Side faces, six side faces total.
    // new THREE.Face3(1, 7, 8),
    // new THREE.Face3(1, 8, 2),
    // new THREE.Face3(2, 8, 9),
    // new THREE.Face3(2, 9, 3),
    // new THREE.Face3(3, 9, 10),
    // new THREE.Face3(3, 10, 4),
    // new THREE.Face3(4, 10, 11),
    // new THREE.Face3(4, 11, 5),
    // new THREE.Face3(5, 11, 6),
    // new THREE.Face3(6, 0, 5),
    // new THREE.Face3(6, 0, 7),
    // new THREE.Face3(7, 0, 1)
);
scaleGeometry.computeFaceNormals();
// Manually set UV coordinates for each face
scaleGeometry.faceVertexUvs[0] = [];
scaleGeometry.faces.forEach(face => {
    scaleGeometry.faceVertexUvs[0].push([
        new THREE.Vector2(0.5, 0.9), // UV for vertex 0
        new THREE.Vector2(0.2, 0.5), // UV for the second vertex of the face
        new THREE.Vector2(0.9, 0.5)  // UV for the third vertex of the face
        // Adjust these values to spread the UVs around vertex 0's UV
    ]);
});
scaleGeometry.uvsNeedUpdate = true;

// let geometry = new THREE.BoxGeometry(0.75, 0.25, 0.1); // Define the shape of the mesh (a thin rectangular prism)
// let testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
let scaleMesh = new THREE.Mesh(scaleGeometry, scaleMaterial); // Create the mesh by combining the geometry and material


// Clone and arrange the meshes in a grid-like pattern.
// Clone and arrange the meshes in a grid-like pattern.
let clones = []; // Array to store all the cloned meshes
let pivots = []; // Array to store pivots for each clone
let rows = Math.ceil(Math.sqrt(number_of_clones)); // Determine the number of rows in the grid

// Calculate the total width and height of the grid to center it
let gridWidth = (rows - 1) * spacing;
let gridHeight = (Math.ceil(number_of_clones / rows) - 1) * verticalSpacing; // Use verticalSpacing here

for (let i = 0; i < number_of_clones; i++) {
    let clone = scaleMesh.clone(); // Create a clone of the original mesh
    let pivot = new THREE.Object3D(); // Create a pivot for each clone
    pivot.add(clone); // Add the clone to its pivot
    clone.position.set(-0.4, 0, 0); // Position the clone relative to the pivot

    // Calculate the row and column for each clone
    let row = Math.floor(i / rows);
    let col = i % rows;

    // Set the position of the pivot to arrange clones in a grid on the X and Y axes
    // Adjust positions to center the grid
    let xPosition = (col * spacing) - (gridWidth / 2);
    let yPosition = (row * verticalSpacing) - (gridHeight / 2); // Use verticalSpacing here
    pivot.position.set(xPosition, yPosition, 0); // Z coordinate is constant

    pivots.push(pivot); // Store the pivot
    scene.add(pivot); // Add the pivot (with the clone) to the scene
}

// Define the animation loop.
let startRotation = camera.rotation.z; // Starting rotation
let endRotationz = startRotation + Math.PI / 2; // Target rotation (90 degrees in radians)
let endRotationx = startRotation + Math.PI / 7; // Target rotation (45 degrees in radians)
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
            camera.zoom = startZoom + fraction * (endZoom - startZoom);
            camera.updateProjectionMatrix(); // Important to update the camera's projection matrix
            // Interpolate camera position
            //camera.position.lerpVectors(startPosition, endPosition, fraction);
        } else {
            camera.rotation.z = endRotationz; // Ensure it ends at the exact target rotation
            camera.rotation.x = endRotationx; // Ensure it ends at the exact target rotation
            camera.zoom = endZoom; // Ensure it ends at the exact target zoom
        }
    }

    // Animate each pivot (and thus each clone) with a flapping motion.
    pivots.forEach((pivot, index) => {
        // Set the rotation of each pivot.
        // Using a sine function for a smooth, oscillating rotation that simulates flapping
        // The sine function oscillates between -1 and 1
        let sineValue = Math.sin(Date.now() * 0.0015 + index);
        // Convert the sine output to range from -15 to 45 degrees
        // The range between -15 and 45 degrees is 60 degrees (45 - (-15))
        // When sineValue is -1, we want the rotation to be -15 degrees
        // When sineValue is 1, we want the rotation to be 45 degrees
        pivot.rotation.y = (sineValue * 30 + 15) * (Math.PI / 180); // Convert degrees to radians
    });

    renderer.setSize(1080, 1920);
    renderer.render(scene, camera); // Render the scene from the perspective of the camera
    if (isCapturing) {
        capturer.capture(renderer.domElement);
    }
}

animate(); // Start the animation

console.log("scaleColor1 normalized RGB:", scaleColor1Norm);
console.log("scaleColor2 normalized RGB:", scaleColor2Norm);