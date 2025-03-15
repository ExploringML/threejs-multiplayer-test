import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// todo:
//
// - [] remove the client cube when the window is closed. it does do this currently, but not unless you hit refresh.
// - [] add a message to the chat when a user connects or disconnects
// - [] when a new client connects ask them for a name, or generate a random one by default that they can select

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

// Debug all HTMX events
document.addEventListener('htmx:afterSettle', function (event) {
	console.log('🔄 HTMX afterSettle:', event.detail);
});

document.addEventListener('htmx:wsAfterMessage', function (event) {
	console.log('📨 HTMX wsAfterMessage:', event.detail);

	// Check if this message contains our client ID
	if (event.detail.message && !myClientId) {
		// Try to extract client ID from the message using regex
		const match = event.detail.message.match(/value="([^"]+)"[^>]+id="client-id"/);
		if (match) {
			myClientId = match[1];
			console.log('✅ Found client ID in websocket message:', myClientId);

			// Force an initial position update
			const msgInput = document.getElementById('msg');
			if (msgInput) {
				msgInput.value = `POS:0,0.5,0`;
				const form = msgInput.closest('form');
				if (form) {
					console.log('📡 Sending initial position update');
					form.dispatchEvent(new Event('submit'));
				}
			}
		}
	}

	// Look for position updates
	const positionsElement = document.getElementById('position-updates');
	if (positionsElement) {
		const positionsJson = positionsElement.textContent || '';
		if (positionsJson && positionsJson.includes('{')) {
			console.log('Received position update:', positionsJson.substring(0, 100) + '...');
			updateAllCubesPositions(positionsJson);
		}
	}
});

document.addEventListener('htmx:afterSwap', function (event) {
	console.log('🔄 HTMX afterSwap:', event.detail);
});

// Listen for client ID assignment - multiple methods
document.addEventListener('htmx:oobAfterSwap', function (event) {
	console.log('🔄 HTMX oobAfterSwap event:', event.detail);

	if (event.detail.elt && event.detail.elt.id === 'client-id') {
		console.log('Found client-id element:', event.detail.elt);

		// Try multiple methods to get the client ID
		const value = event.detail.elt.value;
		const text = event.detail.elt.textContent;
		const dataValue = event.detail.elt.getAttribute('data-value');

		if (!myClientId) {  // Only set if not already set
			myClientId = value || text || dataValue;

			if (myClientId) {
				console.log('✅ My client ID assigned:', myClientId);

				// Force an initial position update to ensure our cube gets created
				const msgInput = document.getElementById('msg');
				if (msgInput) {
					msgInput.value = `POS:0,0.5,0`;  // Send initial position
					const form = msgInput.closest('form');
					if (form) {
						console.log('📡 Sending initial position update');
						form.dispatchEvent(new Event('submit'));
					}
				}
			} else {
				console.error('❌ Failed to get client ID from element:', event.detail.elt);
			}
		}
	}
});

// Process position updates received from WebSocket
function updateAllCubesPositions(positionsJson) {
	try {
		const positionsData = JSON.parse(positionsJson);
		console.log('Received positions data:', positionsData);
		console.log('🔍 Checking for myClientId:', myClientId, 'in', Object.keys(positionsData));

		for (const [userId, userData] of Object.entries(positionsData)) {
			const positionString = userData.position;
			const color = userData.color;

			if (positionString.startsWith('POS:')) {
				const [x, y, z] = positionString.substring(4).split(',').map(Number);
				console.log(`User ${userId} position: ${x}, ${y}, ${z}`);

				if (!userCubes[userId]) {
					console.log(`Creating new cube for user ${userId} with color ${color}`);
					userCubes[userId] = createCube(userId, color);
				}

				userCubes[userId].position.set(x, y, z);

				if (userId === myClientId && !myCube) {
					console.log(`✅ Assigning my cube! My ID: ${myClientId}`);
					myCube = userCubes[userId];
					lastSentPosition = { x, y, z };
					console.log('myCube assigned:', myCube);
				}
			}
		}

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
			console.log('Cube moved to:', myCube.position);
			sendPositionUpdate();
		}
	}

	renderer.render(scene, camera);
}