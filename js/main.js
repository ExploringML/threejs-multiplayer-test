import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 8;
camera.position.y = 2;
camera.lookAt(0, 0, 0);

// scene
const scene = new THREE.Scene();

// geometry - cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0.5, 0); // Position the cube on top of the floor
scene.add(cube);

// floor
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshBasicMaterial({
	color: 0x999999,
	side: THREE.DoubleSide,
	wireframe: false
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = Math.PI / 2; // Rotate to be horizontal
floor.position.y = 0; // Position below the cube
scene.add(floor);

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Movement variables
const moveSpeed = 0.1;
const keysPressed = {};
let lastSentPosition = { x: cube.position.x, y: cube.position.y, z: cube.position.z };

// WebSocket helper function to send position updates
function sendPositionUpdate() {
	// Get the current position
	const currentPosition = {
		x: cube.position.x.toFixed(2),
		y: cube.position.y.toFixed(2),
		z: cube.position.z.toFixed(2)
	};

	// Only send if position has changed significantly
	if (Math.abs(lastSentPosition.x - cube.position.x) > 0.0001 ||
		Math.abs(lastSentPosition.y - cube.position.y) > 0.0001 ||
		Math.abs(lastSentPosition.z - cube.position.z) > 0.0001) {

		// Update last sent position
		lastSentPosition = { x: cube.position.x, y: cube.position.y, z: cube.position.z };

		// Format as a special message
		const positionMessage = `POS:${currentPosition.x},${currentPosition.y},${currentPosition.z}`;

		// Find the message input (hidden or not) and use HTMX's WebSocket to send the message
		const msgInput = document.getElementById('msg');
		if (msgInput) {
			msgInput.value = positionMessage;
			// Trigger a submit event on the form to send the message via WebSocket
			const form = msgInput.closest('form');
			if (form) form.dispatchEvent(new Event('submit'));
		}
	}
}

// keyboard event listeners
document.addEventListener('keydown', (event) => {
	keysPressed[event.key] = true;
});
document.addEventListener('keyup', (event) => {
	keysPressed[event.key] = false;
});

// orbitcontrols
const controls = new OrbitControls(camera, renderer.domElement);

// handle window resize
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// Process position updates received from WebSocket
function updateCubePosition(positionString) {
	if (positionString.startsWith('POS:')) {
		console.log('Processing position update:', positionString);
		const [x, y, z] = positionString.substring(4).split(',').map(Number);
		console.log('Parsed position:', x, y, z);

		// Update cube position directly - removed the check that was preventing updates
		cube.position.set(x, y, z);
		console.log('Cube position updated to:', cube.position.x, cube.position.y, cube.position.z);
	}
}

// todo: don't update the client that triggers the change, only other clients
// Listen for position updates from other clients
document.addEventListener('htmx:wsAfterMessage', function (event) {
	console.log('WebSocket message received');

	// Look for the specific position update element
	const positionElement = document.getElementById('position-update');
	if (positionElement) {
		const positionContent = positionElement.textContent || '';
		console.log('Found position update element:', positionContent);

		if (positionContent.startsWith('POS:')) {
			updateCubePosition(positionContent);
		}
	}
});

// animate loop
function animate() {
	// Handle keyboard movement
	let moved = false;
	if (keysPressed['ArrowUp'] || keysPressed['w']) { cube.position.z -= moveSpeed; moved = true; }
	if (keysPressed['ArrowDown'] || keysPressed['s']) { cube.position.z += moveSpeed; moved = true; }
	if (keysPressed['ArrowLeft'] || keysPressed['a']) { cube.position.x -= moveSpeed; moved = true; }
	if (keysPressed['ArrowRight'] || keysPressed['d']) { cube.position.x += moveSpeed; moved = true; }

	// If the cube moved, send an update
	if (moved) {
		sendPositionUpdate();
	}

	renderer.render(scene, camera);
}