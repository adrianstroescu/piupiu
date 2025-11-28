import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Socket.IO connection
const socket = io();
const otherPlayers = {};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(8, 5, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera from going below floor
controls.minDistance = 2; // Minimum zoom distance
controls.maxDistance = 50; // Maximum zoom distance
controls.enabled = false; // Disable orbit controls for driving mode

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(-5, 5, -5);
scene.add(pointLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d2d44,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create racing track
function createTrack() {
    const trackGroup = new THREE.Group();
    
    // Track surface - figure-8 style
    const trackMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1
    });
    
    // Main straight sections
    const straight1 = new THREE.Mesh(
        new THREE.BoxGeometry(60, 0.05, 8),
        trackMaterial
    );
    straight1.position.set(0, 0.03, 0);
    straight1.receiveShadow = true;
    trackGroup.add(straight1);
    
    const straight2 = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.05, 40),
        trackMaterial
    );
    straight2.position.set(25, 0.03, 0);
    straight2.receiveShadow = true;
    trackGroup.add(straight2);
    
    const straight3 = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.05, 40),
        trackMaterial
    );
    straight3.position.set(-25, 0.03, 0);
    straight3.receiveShadow = true;
    trackGroup.add(straight3);
    
    // Track borders
    const borderMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x440000,
        emissiveIntensity: 0.3
    });
    
    // Add border markers
    for (let i = -28; i <= 28; i += 4) {
        const marker1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.3),
            borderMaterial
        );
        marker1.position.set(i, 0.25, -4.5);
        trackGroup.add(marker1);
        
        const marker2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.3),
            borderMaterial
        );
        marker2.position.set(i, 0.25, 4.5);
        trackGroup.add(marker2);
    }
    
    // Side barriers
    for (let i = -18; i <= 18; i += 4) {
        const marker3 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.3),
            borderMaterial
        );
        marker3.position.set(-28.5, 0.25, i);
        trackGroup.add(marker3);
        
        const marker4 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.3),
            borderMaterial
        );
        marker4.position.set(28.5, 0.25, i);
        trackGroup.add(marker4);
    }
    
    scene.add(trackGroup);
}

createTrack();

// Mouse tracking
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let mouseWorldPosition = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Create a plane at the car's height to intersect with
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    raycaster.ray.intersectPlane(plane, mouseWorldPosition);
});

// Keyboard controls for driving
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

// Projectiles array
const projectiles = [];
let canShoot = true;
const shootCooldown = 200; // milliseconds

// Auto-shoot every second
setInterval(() => {
    if (carMesh) {
        shootProjectile();
    }
}, 1000);

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = true;
    if (key === 'a' || key === 'arrowleft') keys.a = true;
    if (key === 's' || key === 'arrowdown') keys.s = true;
    if (key === 'd' || key === 'arrowright') keys.d = true;
    if (key === ' ') keys.space = true;
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keys.w = false;
    if (key === 'a' || key === 'arrowleft') keys.a = false;
    if (key === 's' || key === 'arrowdown') keys.s = false;
    if (key === 'd' || key === 'arrowright') keys.d = false;
    if (key === ' ') keys.space = false;
});

// Shooting with mouse click
window.addEventListener('click', () => {
    if (canShoot && carMesh) {
        shootProjectile();
        canShoot = false;
        setTimeout(() => {
            canShoot = true;
        }, shootCooldown);
    }
});

// Shoot projectile function
function shootProjectile() {
    const projectileGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffaa00,
        emissiveIntensity: 2,
        metalness: 0.5,
        roughness: 0.3
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    // Position at gun barrel
    const gunOffset = new THREE.Vector3(
        Math.sin(carMesh.rotation.y) * 2.5,
        1.5,
        Math.cos(carMesh.rotation.y) * 2.5
    );
    
    projectile.position.copy(carMesh.position).add(gunOffset);
    projectile.castShadow = true;
    scene.add(projectile);
    
    // Projectile velocity in car's forward direction
    const velocity = {
        x: Math.sin(carMesh.rotation.y) * 0.8,
        z: Math.cos(carMesh.rotation.y) * 0.8
    };
    
    projectiles.push({
        mesh: projectile,
        velocity: velocity,
        life: 200 // frames before auto-removal
    });
    
    // Send shoot event to server
    socket.emit('playerShoot', {
        x: projectile.position.x,
        z: projectile.position.z,
        velocityX: velocity.x,
        velocityZ: velocity.z
    });
    
    // Add muzzle flash
    const flash = new THREE.PointLight(0xffaa00, 3, 10);
    flash.position.copy(projectile.position);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 50);
}

// Car physics
const carPhysics = {
    speed: 0,
    maxSpeed: 0.3,
    acceleration: 0.008,
    deceleration: 0.004,
    turnSpeed: 0.03,
    brakeForce: 0.015
};

// Custom shader material
const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uMousePosition: { value: new THREE.Vector3(1000, 1000, 1000) },
        uEffectRadius: { value: 2.5 }, // Distance from mouse where effect starts
        uTexture: { value: null },
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(0.1, 0.05, 0.8) } // Deep blue metallic
    },
    transparent: true,
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uMousePosition;
        uniform float uEffectRadius;
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform vec3 uBaseColor;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        void main() {
            // Calculate distance from mouse position
            float dist = distance(vWorldPosition, uMousePosition);
            
            // Create smooth transition - effect starts at mouse position + 10px equivalent (0.1 units)
            float effectStart = 0.1; // 10px equivalent in world space
            float totalRadius = uEffectRadius + effectStart;
            
            // Calculate visibility based on distance (0.05 = 5% visible, 1.0 = fully visible)
            float visibility = 1.0 - smoothstep(effectStart, totalRadius, dist);
            visibility = max(visibility, 0.05); // Minimum 5% visibility
            
            // Metallic car paint effect
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
            
            // Add subtle color variation based on angle
            vec3 baseColor = uBaseColor + fresnel * vec3(0.2, 0.2, 0.4);
            
            // Glow effect - stronger near the mouse
            float glowIntensity = 1.0 - smoothstep(effectStart, effectStart + 0.5, dist);
            vec3 glowColor = vec3(0.3, 0.8, 1.0); // Cyan glow
            
            // Pulsing glow animation
            float pulse = sin(uTime * 3.0) * 0.3 + 0.7;
            glowIntensity *= pulse;
            
            // Add glow to the color
            vec3 finalColor = baseColor + glowColor * glowIntensity * 0.6;
            
            // Add extra brightness to areas near the mouse
            finalColor += vec3(1.0) * glowIntensity * 0.3;
            
            // Use visibility as alpha - areas far from mouse are 5% visible
            gl_FragColor = vec4(finalColor, visibility);
        }
    `
});

// Create a realistic car model
let carMesh;

function createRealisticCar() {
    const carGroup = new THREE.Group();
    
    // Main body - lower part (more rounded)
    const bodyGeometry = new THREE.BoxGeometry(2.2, 0.7, 4.5, 8, 4, 8);
    const positions = bodyGeometry.attributes.position;
    
    // Round the body edges
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Round the corners
        if (Math.abs(x) > 0.9 && Math.abs(z) > 1.8) {
            positions.setY(i, y * 0.7);
        }
        if (Math.abs(z) > 2.0) {
            positions.setX(i, x * 0.85);
        }
    }
    bodyGeometry.computeVertexNormals();
    
    const bodyMesh = new THREE.Mesh(bodyGeometry, shaderMaterial.clone());
    bodyMesh.position.y = 0.8;
    bodyMesh.castShadow = true;
    carGroup.add(bodyMesh);
    
    // Hood
    const hoodGeometry = new THREE.BoxGeometry(2.0, 0.3, 1.8, 4, 2, 4);
    const hoodMesh = new THREE.Mesh(hoodGeometry, shaderMaterial.clone());
    hoodMesh.position.set(0, 1.3, 1.5);
    hoodMesh.rotation.x = -0.1;
    hoodMesh.castShadow = true;
    carGroup.add(hoodMesh);
    
    // Windshield
    const windshieldGeometry = new THREE.BoxGeometry(1.9, 0.8, 0.1);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a2e,
        metalness: 0.1,
        roughness: 0.1,
        transparent: true,
        opacity: 0.4,
        envMapIntensity: 1
    });
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(0, 1.6, 0.5);
    windshield.rotation.x = -0.3;
    windshield.castShadow = true;
    carGroup.add(windshield);
    
    // Roof/Cabin
    const roofGeometry = new THREE.BoxGeometry(1.9, 0.7, 2.2, 4, 2, 4);
    const roofPositions = roofGeometry.attributes.position;
    
    // Round the roof
    for (let i = 0; i < roofPositions.count; i++) {
        const x = roofPositions.getX(i);
        const y = roofPositions.getY(i);
        const z = roofPositions.getZ(i);
        
        if (y > 0 && (Math.abs(x) > 0.5 || Math.abs(z) > 0.5)) {
            roofPositions.setY(i, y * 0.8);
        }
    }
    roofGeometry.computeVertexNormals();
    
    const roofMesh = new THREE.Mesh(roofGeometry, shaderMaterial.clone());
    roofMesh.position.set(0, 1.75, -0.2);
    roofMesh.castShadow = true;
    carGroup.add(roofMesh);
    
    // Rear windshield
    const rearWindshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.7, 0.1),
        glassMaterial
    );
    rearWindshield.position.set(0, 1.6, -1.3);
    rearWindshield.rotation.x = 0.3;
    rearWindshield.castShadow = true;
    carGroup.add(rearWindshield);
    
    // Trunk
    const trunkGeometry = new THREE.BoxGeometry(2.0, 0.3, 1.2);
    const trunkMesh = new THREE.Mesh(trunkGeometry, shaderMaterial.clone());
    trunkMesh.position.set(0, 1.2, -1.9);
    trunkMesh.rotation.x = 0.05;
    trunkMesh.castShadow = true;
    carGroup.add(trunkMesh);
    
    // Side mirrors
    const mirrorGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.25);
    const mirrorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.8,
        roughness: 0.2
    });
    
    [-1, 1].forEach(side => {
        const mirror = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
        mirror.position.set(side * 1.15, 1.5, 0.7);
        mirror.castShadow = true;
        carGroup.add(mirror);
    });
    
    // Headlights
    const headlightGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffee,
        emissive: 0xffffaa,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.1
    });
    
    [-0.6, 0.6].forEach(xPos => {
        const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlight.rotation.x = Math.PI / 2;
        headlight.position.set(xPos, 0.95, 2.3);
        headlight.castShadow = true;
        carGroup.add(headlight);
    });
    
    // Tail lights
    const tailLightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x660000,
        emissiveIntensity: 0.3
    });
    
    [-0.7, 0.7].forEach(xPos => {
        const tailLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.2, 0.05),
            tailLightMaterial
        );
        tailLight.position.set(xPos, 0.95, -2.26);
        tailLight.castShadow = true;
        carGroup.add(tailLight);
    });
    
    // Wheels - more realistic
    const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 32);
    const tireMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1
    });
    
    // Rim
    const rimGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.37, 32);
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.9,
        roughness: 0.2
    });
    
    const wheelPositions = [
        [-1.05, 0.45, 1.6],
        [1.05, 0.45, 1.6],
        [-1.05, 0.45, -1.6],
        [1.05, 0.45, -1.6]
    ];
    
    wheelPositions.forEach(pos => {
        const wheelGroup = new THREE.Group();
        
        const tire = new THREE.Mesh(wheelGeometry, tireMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheelGroup.add(tire);
        
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        wheelGroup.add(rim);
        
        // Brake disc
        const brakeGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32);
        const brakeMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.7,
            roughness: 0.3
        });
        const brake = new THREE.Mesh(brakeGeometry, brakeMaterial);
        brake.rotation.z = Math.PI / 2;
        wheelGroup.add(brake);
        
        wheelGroup.position.set(...pos);
        carGroup.add(wheelGroup);
    });
    
    // Bumpers
    const bumperMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.3,
        roughness: 0.7
    });
    
    const frontBumper = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.25, 0.3),
        bumperMaterial
    );
    frontBumper.position.set(0, 0.5, 2.4);
    frontBumper.castShadow = true;
    carGroup.add(frontBumper);
    
    const rearBumper = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.25, 0.3),
        bumperMaterial
    );
    rearBumper.position.set(0, 0.5, -2.4);
    rearBumper.castShadow = true;
    carGroup.add(rearBumper);
    
    // Gun mounted on hood
    const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 })
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 1.5, 2.0);
    gunBarrel.castShadow = true;
    carGroup.add(gunBarrel);
    
    // Gun base
    const gunBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 })
    );
    gunBase.position.set(0, 1.3, 1.5);
    gunBase.castShadow = true;
    carGroup.add(gunBase);
    
    carGroup.position.y = 0;
    scene.add(carGroup);
    carMesh = carGroup;
    
    return carGroup;
}

// Create the car
createRealisticCar();

console.log('Car created, position:', carMesh ? carMesh.position : 'undefined');

// Multiplayer networking
socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== socket.id) {
            addOtherPlayer(id, players[id]);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo.id, playerInfo);
});

socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].targetPosition.x = playerInfo.x;
        otherPlayers[playerInfo.id].targetPosition.z = playerInfo.z;
        otherPlayers[playerInfo.id].targetRotation = playerInfo.rotation;
    }
});

socket.on('playerShot', (shootData) => {
    // Create projectile from other player
    createRemoteProjectile(shootData);
});

socket.on('npcDestroyed', (npcData) => {
    // Remove NPC for all players
    for (let i = npcCharacters.length - 1; i >= 0; i--) {
        const npc = npcCharacters[i];
        if (Math.abs(npc.mesh.position.x - npcData.x) < 0.1 && 
            Math.abs(npc.mesh.position.z - npcData.z) < 0.1) {
            createExplosion(npc.mesh.position.x, npc.mesh.position.y + 1, npc.mesh.position.z);
            scene.remove(npc.mesh);
            npcCharacters.splice(i, 1);
            break;
        }
    }
});

socket.on('playerDisconnected', (playerId) => {
    if (otherPlayers[playerId]) {
        scene.remove(otherPlayers[playerId].mesh);
        delete otherPlayers[playerId];
    }
});

function addOtherPlayer(id, playerInfo) {
    const otherCar = createRealisticCar();
    otherCar.position.set(playerInfo.x, 0, playerInfo.z);
    otherCar.rotation.y = playerInfo.rotation;
    
    // Change color to distinguish from local player
    otherCar.traverse((child) => {
        if (child.isMesh && child.material.uniforms && child.material.uniforms.uBaseColor) {
            child.material.uniforms.uBaseColor.value = new THREE.Color(0.8, 0.1, 0.1); // Red for other players
        }
    });
    
    otherPlayers[id] = {
        mesh: otherCar,
        targetPosition: new THREE.Vector3(playerInfo.x, 0, playerInfo.z),
        targetRotation: playerInfo.rotation
    };
}

function createRemoteProjectile(shootData) {
    const projectileGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2,
        metalness: 0.5,
        roughness: 0.3
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    projectile.position.set(shootData.x, 1.5, shootData.z);
    projectile.castShadow = true;
    scene.add(projectile);
    
    projectiles.push({
        mesh: projectile,
        velocity: {
            x: shootData.velocityX,
            z: shootData.velocityZ
        },
        life: 200
    });
}

// NPC cars
const npcCars = [];

function createNPCCar(x, z, rotation, color) {
    const carGroup = new THREE.Group();
    
    // Simpler NPC car design
    const npcShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uMousePosition: { value: new THREE.Vector3(1000, 1000, 1000) },
            uEffectRadius: { value: 2.5 },
            uTexture: { value: null },
            uTime: { value: 0 },
            uBaseColor: { value: new THREE.Color(color) }
        },
        transparent: true,
        vertexShader: shaderMaterial.vertexShader,
        fragmentShader: shaderMaterial.fragmentShader
    });
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(2.0, 0.6, 4.0, 4, 2, 4);
    const bodyMesh = new THREE.Mesh(bodyGeometry, npcShaderMaterial.clone());
    bodyMesh.position.y = 0.7;
    bodyMesh.castShadow = true;
    carGroup.add(bodyMesh);
    
    // Roof
    const roofGeometry = new THREE.BoxGeometry(1.7, 0.6, 2.0);
    const roofMesh = new THREE.Mesh(roofGeometry, npcShaderMaterial.clone());
    roofMesh.position.set(0, 1.4, -0.3);
    roofMesh.castShadow = true;
    carGroup.add(roofMesh);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    const wheelPositions = [
        [-0.95, 0.4, 1.4],
        [0.95, 0.4, 1.4],
        [-0.95, 0.4, -1.4],
        [0.95, 0.4, -1.4]
    ];
    
    wheelPositions.forEach(pos => {
        const wheelGroup = new THREE.Group();
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheelGroup.add(wheel);
        wheelGroup.position.set(...pos);
        carGroup.add(wheelGroup);
    });
    
    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = rotation;
    scene.add(carGroup);
    
    // NPC AI data
    const npcData = {
        mesh: carGroup,
        speed: 0.05 + Math.random() * 0.05,
        direction: rotation,
        pathType: Math.random() > 0.5 ? 'horizontal' : 'vertical',
        waitTime: 0,
        color: color
    };
    
    npcCars.push(npcData);
    return carGroup;
}

// Create multiple NPC cars
createNPCCar(-10, 2, 0, 0xff6600); // Orange car
createNPCCar(10, -2, Math.PI, 0x00ff66); // Green car
createNPCCar(-15, -2, 0, 0xff0066); // Pink car
createNPCCar(5, 2, Math.PI, 0xffff00); // Yellow car
createNPCCar(-20, 0, 0, 0x00ffff); // Cyan car
createNPCCar(15, 0, Math.PI, 0xff00ff); // Magenta car

// NPC Characters
const npcCharacters = [];

function createNPC(name, x, z) {
    const npcGroup = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac,
        roughness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.2;
    body.castShadow = true;
    npcGroup.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.y = 2.0;
    head.castShadow = true;
    npcGroup.add(head);
    
    // Hair
    const hairGeometry = new THREE.SphereGeometry(0.28, 16, 16);
    const hairMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.8
    });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 2.1;
    hair.scale.set(1, 1.2, 1);
    hair.castShadow = true;
    npcGroup.add(hair);
    
    // Legs
    const legGeometry = new THREE.CapsuleGeometry(0.12, 0.7, 4, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x4169e1,
        roughness: 0.6
    });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, 0.5, 0);
    leftLeg.castShadow = true;
    npcGroup.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, 0.5, 0);
    rightLeg.castShadow = true;
    npcGroup.add(rightLeg);
    
    // Arms
    const armGeometry = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
    
    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(-0.4, 1.5, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    npcGroup.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(0.4, 1.5, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    npcGroup.add(rightArm);
    
    // Name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = '#ffffff';
    context.font = 'Bold 40px Arial';
    context.textAlign = 'center';
    context.fillText(name, 128, 45);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.position.y = 2.8;
    label.scale.set(2, 0.5, 1);
    npcGroup.add(label);
    
    npcGroup.position.set(x, 0, z);
    scene.add(npcGroup);
    
    npcCharacters.push({
        mesh: npcGroup,
        name: name,
        walkSpeed: 0.02,
        direction: Math.random() * Math.PI * 2,
        animationTime: Math.random() * 100
    });
    
    return npcGroup;
}

// Create NPCs
createNPC('Alexa', -5, 8);
createNPC('Alexa', 8, -6);
createNPC('Alexa', -12, -8);
createNPC('Alexa', 15, 5);
createNPC('Alexa', -18, 3);
createNPC('Alexa', 10, 10);
createNPC('Alexa', -8, -12);
createNPC('Alexa', 20, -8);
createNPC('Alexa', -15, 12);
createNPC('Alexa', 5, -15);

// Update NPC characters
function updateNPCCharacters() {
    npcCharacters.forEach(npc => {
        // If NPC was hit, apply physics
        if (npc.isHit) {
            // Apply gravity
            npc.velocity.y -= 0.3; // Gravity
            
            // Update position based on velocity
            npc.mesh.position.x += npc.velocity.x * 0.016;
            npc.mesh.position.y += npc.velocity.y * 0.016;
            npc.mesh.position.z += npc.velocity.z * 0.016;
            
            // Apply rotation (ragdoll effect)
            npc.mesh.rotation.x += npc.angularVelocity.x;
            npc.mesh.rotation.y += npc.angularVelocity.y;
            npc.mesh.rotation.z += npc.angularVelocity.z;
            
            // Slow down horizontal velocity (air resistance)
            npc.velocity.x *= 0.98;
            npc.velocity.z *= 0.98;
            
            // Don't do normal animation
            return;
        }
        
        // Walking animation
        npc.animationTime += 0.1;
        
        // Move NPC
        npc.mesh.position.x += Math.sin(npc.direction) * npc.walkSpeed;
        npc.mesh.position.z += Math.cos(npc.direction) * npc.walkSpeed;
        
        // Rotate to face walking direction
        npc.mesh.rotation.y = -npc.direction + Math.PI;
        
        // Leg walking animation
        const leftLeg = npc.mesh.children[3];
        const rightLeg = npc.mesh.children[4];
        
        if (leftLeg && rightLeg) {
            leftLeg.rotation.x = Math.sin(npc.animationTime) * 0.5;
            rightLeg.rotation.x = Math.sin(npc.animationTime + Math.PI) * 0.5;
        }
        
        // Arm swinging
        const leftArm = npc.mesh.children[5];
        const rightArm = npc.mesh.children[6];
        
        if (leftArm && rightArm) {
            leftArm.rotation.x = Math.sin(npc.animationTime + Math.PI) * 0.3;
            rightArm.rotation.x = Math.sin(npc.animationTime) * 0.3;
        }
        
        // Random direction change
        if (Math.random() < 0.01) {
            npc.direction += (Math.random() - 0.5) * 0.5;
        }
        
        // Keep in bounds
        if (Math.abs(npc.mesh.position.x) > 25) {
            npc.direction = Math.atan2(0 - npc.mesh.position.x, npc.mesh.position.z);
        }
        if (Math.abs(npc.mesh.position.z) > 25) {
            npc.direction = Math.atan2(npc.mesh.position.x, 0 - npc.mesh.position.z);
        }
    });
}

// Update NPC cars AI
function updateNPCCars() {
    npcCars.forEach(npc => {
        // Simple forward movement
        npc.mesh.position.x += Math.sin(npc.direction) * npc.speed;
        npc.mesh.position.z += Math.cos(npc.direction) * npc.speed;
        
        // Rotate wheels
        npc.mesh.children.forEach(child => {
            if (child.children && child.children.length > 0) {
                child.rotation.x += npc.speed * 10;
            }
        });
        
        // Wrap around when going off track
        if (npc.pathType === 'horizontal') {
            if (npc.mesh.position.x > 30) {
                npc.mesh.position.x = -30;
            } else if (npc.mesh.position.x < -30) {
                npc.mesh.position.x = 30;
            }
        } else {
            if (npc.mesh.position.z > 20) {
                npc.mesh.position.z = -20;
            } else if (npc.mesh.position.z < -20) {
                npc.mesh.position.z = 20;
            }
        }
        
        // Update shader for reveal effect
        npc.mesh.traverse((child) => {
            if (child.isMesh && child.material.uniforms && child.material.uniforms.uMousePosition) {
                child.material.uniforms.uMousePosition.value.copy(mouseWorldPosition);
                child.material.uniforms.uTime.value = performance.now() * 0.001;
            }
        });
    });
}

// Update car driving physics
function updateCarDriving() {
    if (!carMesh) return;
    
    // Acceleration and braking
    if (keys.w) {
        carPhysics.speed = Math.min(carPhysics.speed + carPhysics.acceleration, carPhysics.maxSpeed);
    } else if (keys.s) {
        carPhysics.speed = Math.max(carPhysics.speed - carPhysics.acceleration, -carPhysics.maxSpeed * 0.5);
    } else if (keys.space) {
        // Brake
        if (carPhysics.speed > 0) {
            carPhysics.speed = Math.max(0, carPhysics.speed - carPhysics.brakeForce);
        } else if (carPhysics.speed < 0) {
            carPhysics.speed = Math.min(0, carPhysics.speed + carPhysics.brakeForce);
        }
    } else {
        // Natural deceleration
        if (carPhysics.speed > 0) {
            carPhysics.speed = Math.max(0, carPhysics.speed - carPhysics.deceleration);
        } else if (carPhysics.speed < 0) {
            carPhysics.speed = Math.min(0, carPhysics.speed + carPhysics.deceleration);
        }
    }
    
    // Steering
    if (carPhysics.speed !== 0) {
        if (keys.a) {
            carMesh.rotation.y += carPhysics.turnSpeed * (carPhysics.speed / carPhysics.maxSpeed);
        }
        if (keys.d) {
            carMesh.rotation.y -= carPhysics.turnSpeed * (carPhysics.speed / carPhysics.maxSpeed);
        }
    }
    
    // Move car forward/backward based on rotation
    carMesh.position.x += Math.sin(carMesh.rotation.y) * carPhysics.speed;
    carMesh.position.z += Math.cos(carMesh.rotation.y) * carPhysics.speed;
    
    // Keep car on ground
    carMesh.position.y = 0;
    
    // Check collision with NPCs
    checkNPCCollisions();
    
    // Rotate wheels based on speed
    const wheelRotationSpeed = carPhysics.speed * 10;
    carMesh.children.forEach(child => {
        if (child.children && child.children.length > 0) {
            // This is likely a wheel group
            child.rotation.x += wheelRotationSpeed;
        }
    });
    
    // Update camera to follow car
    const cameraOffset = new THREE.Vector3(
        Math.sin(carMesh.rotation.y) * -10,
        6,
        Math.cos(carMesh.rotation.y) * -10
    );
    
    camera.position.x = carMesh.position.x + cameraOffset.x;
    camera.position.y = carMesh.position.y + cameraOffset.y;
    camera.position.z = carMesh.position.z + cameraOffset.z;
    
    camera.lookAt(carMesh.position.x, carMesh.position.y + 1, carMesh.position.z);
    
    // Update mouse position to follow car for reveal effect
    mouseWorldPosition.copy(carMesh.position);
    
    // Send position to server
    socket.emit('playerMovement', {
        x: carMesh.position.x,
        y: carMesh.position.y,
        z: carMesh.position.z,
        rotation: carMesh.rotation.y
    });
}

// Check collision between car and NPCs
function checkNPCCollisions() {
    if (!carMesh) return;
    
    const carPosition = carMesh.position;
    const collisionDistance = 2.5; // Collision radius
    
    for (let i = npcCharacters.length - 1; i >= 0; i--) {
        const npc = npcCharacters[i];
        const npcPosition = npc.mesh.position;
        
        // Calculate distance between car and NPC
        const distance = Math.sqrt(
            Math.pow(carPosition.x - npcPosition.x, 2) +
            Math.pow(carPosition.z - npcPosition.z, 2)
        );
        
        // If collision detected
        if (distance < collisionDistance && !npc.isHit) {
            // Mark as hit
            npc.isHit = true;
            
            // Create explosion effect
            createExplosion(npcPosition.x, npcPosition.y + 1, npcPosition.z);
            
            // Slight car bounce back
            carPhysics.speed *= 0.5;
            
            console.log(`💥 BOOM! Hit ${npc.name}! NPCs remaining: ${npcCharacters.length - 1}`);
            
            // Remove NPC immediately
            scene.remove(npc.mesh);
            npcCharacters.splice(i, 1);
        }
    }
}

// Create explosion effect
function createExplosion(x, y, z) {
    const particleCount = 50;
    const particles = [];
    
    // Create explosion particles
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5),
            emissive: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5),
            emissiveIntensity: 2
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        particle.position.set(x, y, z);
        
        // Random velocity for each particle
        const velocity = {
            x: (Math.random() - 0.5) * 0.5,
            y: Math.random() * 0.5,
            z: (Math.random() - 0.5) * 0.5
        };
        
        particles.push({ mesh: particle, velocity: velocity, life: 1.0 });
        scene.add(particle);
    }
    
    // Animate explosion particles
    let frame = 0;
    const maxFrames = 60;
    
    const animateExplosion = () => {
        frame++;
        
        particles.forEach((p, index) => {
            // Update position
            p.mesh.position.x += p.velocity.x;
            p.mesh.position.y += p.velocity.y;
            p.mesh.position.z += p.velocity.z;
            
            // Apply gravity
            p.velocity.y -= 0.02;
            
            // Fade out
            p.life -= 1 / maxFrames;
            p.mesh.material.opacity = p.life;
            p.mesh.material.transparent = true;
            
            // Scale down
            const scale = p.life;
            p.mesh.scale.set(scale, scale, scale);
        });
        
        if (frame < maxFrames) {
            requestAnimationFrame(animateExplosion);
        } else {
            // Clean up particles
            particles.forEach(p => {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
            });
        }
    };
    
    animateExplosion();
    
    // Create shockwave ring
    const ringGeometry = new THREE.RingGeometry(0.1, 0.3, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(x, y, z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    
    // Animate shockwave
    let ringFrame = 0;
    const ringMaxFrames = 30;
    
    const animateRing = () => {
        ringFrame++;
        const scale = 1 + (ringFrame / ringMaxFrames) * 10;
        ring.scale.set(scale, scale, 1);
        ring.material.opacity = 1 - (ringFrame / ringMaxFrames);
        
        if (ringFrame < ringMaxFrames) {
            requestAnimationFrame(animateRing);
        } else {
            scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
    };
    
    animateRing();
}

// Update projectiles
function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        
        // Move projectile
        proj.mesh.position.x += proj.velocity.x;
        proj.mesh.position.z += proj.velocity.z;
        
        // Decrease life
        proj.life--;
        
        // Check collision with NPCs
        let hit = false;
        for (let j = npcCharacters.length - 1; j >= 0; j--) {
            const npc = npcCharacters[j];
            
            // Calculate distance between projectile and NPC
            const distance = Math.sqrt(
                Math.pow(proj.mesh.position.x - npc.mesh.position.x, 2) +
                Math.pow(proj.mesh.position.z - npc.mesh.position.z, 2)
            );
            
            if (distance < 2.0) {
                // Hit!
                createExplosion(npc.mesh.position.x, npc.mesh.position.y + 1, npc.mesh.position.z);
                
                // Notify server about NPC hit
                socket.emit('npcHit', {
                    x: npc.mesh.position.x,
                    z: npc.mesh.position.z
                });
                
                scene.remove(npc.mesh);
                npcCharacters.splice(j, 1);
                hit = true;
                console.log(`🎯 Shot ${npc.name}! NPCs remaining: ${npcCharacters.length}`);
                break;
            }
        }
        
        // Remove projectile if hit or life expired or out of bounds
        if (hit || proj.life <= 0 || Math.abs(proj.mesh.position.x) > 50 || Math.abs(proj.mesh.position.z) > 50) {
            scene.remove(proj.mesh);
            proj.mesh.geometry.dispose();
            proj.mesh.material.dispose();
            projectiles.splice(i, 1);
        }
    }
}

// Update shader uniforms for all car meshes
function updateCarShaders() {
    if (carMesh) {
        carMesh.traverse((child) => {
            if (child.isMesh && child.material.uniforms && child.material.uniforms.uMousePosition) {
                child.material.uniforms.uMousePosition.value.copy(mouseWorldPosition);
                child.material.uniforms.uTime.value = performance.now() * 0.001;
                
                // Pass camera position to shader for fresnel effect
                if (child.material.uniforms.uCameraPosition) {
                    child.material.uniforms.uCameraPosition.value.copy(camera.position);
                }
            }
        });
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    updateCarDriving();
    updateCarShaders();
    updateNPCCars();
    updateNPCCharacters();
    updateProjectiles();
    updateOtherPlayers();
    renderer.render(scene, camera);
}

// Update other players positions smoothly
function updateOtherPlayers() {
    Object.keys(otherPlayers).forEach((id) => {
        const player = otherPlayers[id];
        
        // Smooth interpolation
        player.mesh.position.x += (player.targetPosition.x - player.mesh.position.x) * 0.1;
        player.mesh.position.z += (player.targetPosition.z - player.mesh.position.z) * 0.1;
        
        // Smooth rotation
        let rotDiff = player.targetRotation - player.mesh.rotation.y;
        if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        player.mesh.rotation.y += rotDiff * 0.1;
        
        // Update shader for other players
        player.mesh.traverse((child) => {
            if (child.isMesh && child.material.uniforms && child.material.uniforms.uMousePosition) {
                child.material.uniforms.uMousePosition.value.copy(mouseWorldPosition);
                child.material.uniforms.uTime.value = performance.now() * 0.001;
            }
        });
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
