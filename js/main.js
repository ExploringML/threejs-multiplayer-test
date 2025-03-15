import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 8;
camera.position.y = 2;
camera.lookAt(0, 0, 0);

// scene
const scene = new THREE.Scene();

// Store my client ID when received from server
let myClientId = null;

// Keep track of all cubes by user ID
const userCubes = {};

// Create a cube for a user with a specific color
function createCube(userId, color = 0xffff00) {
	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial({ color: parseInt(color) });
	const cube = new THREE.Mesh(geometry, material);
	cube.position.set(0, 0.5, 0); // Default position on top of the floor
	scene.add(cube);
	return cube;
}

// My local cube - will be assigned properly when we get our client ID
let myCube = null;

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
let lastSentPosition = { x: 0, y: 0.5, z: 0 };

// WebSocket helper function to send position updates
function sendPositionUpdate() {
	// If we don't have a cube yet but have a client ID, create our cube
	if (!myCube && myClientId) {
		// Don't create a cube here - wait for the server to tell us our position
		console.log('Waiting for server to assign position for client ID:', myClientId);
		return;
	}

	// Only send updates if we have a cube
	if (!myCube) return;

	// Get the current position
	const currentPosition = {
		x: myCube.position.x.toFixed(2),
		y: myCube.position.y.toFixed(2),
		z: myCube.position.z.toFixed(2)
	};

	// Update last sent position
	lastSentPosition = { x: myCube.position.x, y: myCube.position.y, z: myCube.position.z };

	// Format as a special message
	const positionMessage = `POS:${currentPosition.x},${currentPosition.y},${currentPosition.z}`;
	console.log('Sending position update:', positionMessage);

	// Find the message input and use HTMX's WebSocket to send the message
	const msgInput = document.getElementById('msg');
	if (msgInput) {
		msgInput.value = positionMessage;
		// Trigger a submit event on the form to send the message via WebSocket
		const form = msgInput.closest('form');
		if (form) form.dispatchEvent(new Event('submit'));
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
function updateAllCubesPositions(positionsJson) {
	try {
		// Parse the JSON data containing all user positions
		const positionsData = JSON.parse(positionsJson);
		console.log('Received positions data:', positionsData);

		// Process each user's data
		for (const [userId, userData] of Object.entries(positionsData)) {
			const positionString = userData.position;
			const color = userData.color;

			if (positionString.startsWith('POS:')) {
				const [x, y, z] = positionString.substring(4).split(',').map(Number);
				console.log(`User ${userId} position: ${x}, ${y}, ${z}`);

				// If this user doesn't have a cube yet, create one
				if (!userCubes[userId]) {
					console.log(`Creating new cube for user ${userId} with color ${color}`);
					userCubes[userId] = createCube(userId, color);

					// Position the new cube at the server-specified location
					userCubes[userId].position.set(x, y, z);

					// If this is my cube, store a reference to it
					if (userId === myClientId) {
						console.log(`This is my cube! My ID: ${myClientId}`);
						myCube = userCubes[userId];

						// Update the last sent position to match the server's initial position
						lastSentPosition = { x, y, z };
					}
				}
				// Only update other users' cubes from the server
				else if (userId !== myClientId) {
					userCubes[userId].position.set(x, y, z);
				}
			}
		}

		// Check for users who have disconnected and remove their cubes
		for (const userId in userCubes) {
			if (!positionsData[userId]) {
				console.log(`Removing cube for disconnected user ${userId}`);
				scene.remove(userCubes[userId]);
				delete userCubes[userId];
			}
		}
	} catch (error) {
		console.error('Error processing positions:', error, positionsJson);
	}
}

// Listen for client ID assignment
document.addEventListener('htmx:oobAfterSwap', function (event) {
	if (event.detail.elt && event.detail.elt.id === 'client-id') {
		myClientId = event.detail.elt.value;
		console.log('My client ID:', myClientId);

		// Don't force a position update here anymore - wait for server to send position
	}
});

// Listen for position updates from the server
document.addEventListener('htmx:wsAfterMessage', function (event) {
	// Look for the specific position updates element
	const positionsElement = document.getElementById('position-updates');
	if (positionsElement) {
		const positionsJson = positionsElement.textContent || '';
		if (positionsJson && positionsJson.includes('{')) {  // Ensure it's valid JSON
			console.log('Received position update:', positionsJson.substring(0, 100) + '...');
			updateAllCubesPositions(positionsJson);
		}
	}
});

// animate loop
function animate() {
	// Only handle movement if we have our own cube
	if (myCube) {
		// Handle keyboard movement
		let moved = false;
		if (keysPressed['ArrowUp'] || keysPressed['w']) { myCube.position.z -= moveSpeed; moved = true; }
		if (keysPressed['ArrowDown'] || keysPressed['s']) { myCube.position.z += moveSpeed; moved = true; }
		if (keysPressed['ArrowLeft'] || keysPressed['a']) { myCube.position.x -= moveSpeed; moved = true; }
		if (keysPressed['ArrowRight'] || keysPressed['d']) { myCube.position.x += moveSpeed; moved = true; }

		// If the cube moved, send an update
		if (moved) {
			sendPositionUpdate();
		}
	}

	renderer.render(scene, camera);
}