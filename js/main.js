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

// movement controls
const moveSpeed = 0.1;
const keysPressed = {};

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

// animate loop
function animate() {
	// Handle keyboard movement
	if (keysPressed['ArrowUp'] || keysPressed['w']) {cube.position.z -= moveSpeed;}
	if (keysPressed['ArrowDown'] || keysPressed['s']) {cube.position.z += moveSpeed;}
	if (keysPressed['ArrowLeft'] || keysPressed['a']) {cube.position.x -= moveSpeed;}
	if (keysPressed['ArrowRight'] || keysPressed['d']) {cube.position.x += moveSpeed;}

	renderer.render(scene, camera);
}