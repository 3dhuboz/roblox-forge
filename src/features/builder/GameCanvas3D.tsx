import { useRef, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

// ── Color/material helpers ──

function getElementColor(el: CanvasElement): string {
  const map: Record<string, string> = {
    ground: "#8B7355", grass: "#4ade80", water: "#3b82f6", lava: "#ef4444",
    sand: "#d4a574", ice: "#93c5fd", platform: "#6366f1", "moving-platform": "#06b6d4",
    disappearing: "#fbbf24", bouncy: "#f472b6", conveyor: "#8b5cf6",
    killbrick: "#ef4444", spinner: "#f97316", laser: "#ff0040", spikes: "#9ca3af",
    enemy: "#dc2626", pet: "#f472b6", npc: "#22c55e", boss: "#7c3aed", shopkeeper: "#eab308",
    tree: "#16a34a", rock: "#6b7280", lamp: "#fbbf24", bush: "#15803d",
    fence: "#92400e", checkpoint: "#22c55e", teleporter: "#8b5cf6",
    "boost-pad": "#06b6d4", coin: "#eab308", gem: "#8b5cf6", spawn: "#10b981",
  };
  return map[el.type] || el.color;
}

function getElementHeight(type: string): number {
  const map: Record<string, number> = {
    ground: 0.5, grass: 0.5, water: 0.3, lava: 0.3, sand: 0.5, ice: 0.3,
    platform: 0.3, "moving-platform": 0.3, disappearing: 0.3, bouncy: 0.4, conveyor: 0.2,
    killbrick: 0.3, spinner: 0.8, laser: 3, spikes: 0.5,
    enemy: 1.8, pet: 0.8, npc: 1.8, boss: 2.5, shopkeeper: 1.8,
    tree: 3, rock: 1, lamp: 2.5, bush: 0.8, fence: 1.2,
    checkpoint: 2.5, teleporter: 1.5, "boost-pad": 0.15, coin: 0.6, gem: 0.6, spawn: 0.1,
  };
  return map[type] || 1;
}

function getElementScale(type: string): [number, number, number] {
  const h = getElementHeight(type);
  const map: Record<string, [number, number, number]> = {
    ground: [4, h, 4], grass: [4, h, 4], water: [4, h, 4], lava: [3, h, 3],
    sand: [4, h, 4], ice: [4, h, 3],
    platform: [3, h, 1.5], "moving-platform": [3, h, 1.5], disappearing: [2, h, 1.5],
    bouncy: [2, h, 1.5], conveyor: [3, h, 1.5],
    killbrick: [1.5, h, 1.5], spinner: [0.3, h, 2], laser: [0.2, h, 0.2], spikes: [2, h, 1],
    enemy: [0.8, h, 0.8], pet: [0.6, h, 0.6], npc: [0.8, h, 0.8],
    boss: [1.2, h, 1.2], shopkeeper: [0.8, h, 0.8],
    tree: [0.4, h, 0.4], rock: [1.2, h, 1], lamp: [0.3, h, 0.3], bush: [1, h, 1],
    fence: [3, h, 0.2], checkpoint: [0.3, h, 0.3], teleporter: [1, h, 1],
    "boost-pad": [2, h, 1], coin: [0.5, h, 0.5], gem: [0.4, h, 0.4], spawn: [2, h, 2],
  };
  return map[type] || [1, h, 1];
}

// ── 3D Element Component ──

function Element3D({ el }: { el: CanvasElement }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedId, selectElement, tool, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const color = getElementColor(el);
  const scale = getElementScale(el.type);
  const [hovered, setHovered] = useState(false);

  // Convert 2D canvas position to 3D world position
  // x maps to X axis, y maps to Z axis (depth into screen)
  const worldX = (el.x - 700) / 50;  // Center around 0
  const worldZ = (el.y - 350) / 50;
  const worldY = scale[1] / 2; // Sit on ground

  const handleClick = (e: React.MouseEvent | any) => {
    e.stopPropagation();
    if (tool === "delete") {
      removeElement(el.id);
      return;
    }
    selectElement(el.id);
  };

  // Special geometry for certain types
  const isTree = el.type === "tree";
  const isCoin = el.type === "coin" || el.type === "gem";
  const isCharacter = el.category === "character";
  const isSpawn = el.type === "spawn";
  const isCheckpoint = el.type === "checkpoint";
  const isLamp = el.type === "lamp";
  const isRock = el.type === "rock";
  const isBush = el.type === "bush";

  if (isTree) {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        {/* Trunk */}
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.2, 2, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Foliage */}
        <mesh position={[0, 2.5, 0]} castShadow>
          <sphereGeometry args={[0.9, 8, 8]} />
          <meshStandardMaterial color="#22c55e" flatShading />
        </mesh>
        <mesh position={[0.3, 2.8, 0.2]} castShadow>
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshStandardMaterial color="#16a34a" flatShading />
        </mesh>
        {isSelected && (
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[2, 4, 2]} />
            <meshBasicMaterial color="#818cf8" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  if (isRock) {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0.4, 0]} castShadow rotation={[0, 0.5, 0]}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#6b7280" flatShading />
        </mesh>
        {isSelected && (
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.8, 1.8, 1.8]} />
            <meshBasicMaterial color="#818cf8" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  if (isBush) {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <sphereGeometry args={[0.6, 8, 6]} />
          <meshStandardMaterial color="#15803d" flatShading />
        </mesh>
        <mesh position={[0.3, 0.3, 0.2]} castShadow>
          <sphereGeometry args={[0.4, 8, 6]} />
          <meshStandardMaterial color="#22c55e" flatShading />
        </mesh>
      </group>
    );
  }

  if (isLamp) {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 2.4, 6]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color="#fde047" emissive="#fbbf24" emissiveIntensity={2} />
        </mesh>
        <pointLight position={[0, 2.3, 0]} intensity={3} distance={5} color="#fbbf24" />
      </group>
    );
  }

  if (isCheckpoint) {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.06, 2.4, 6]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
        {/* Flag */}
        <mesh position={[0.3, 2.1, 0]} castShadow>
          <boxGeometry args={[0.5, 0.35, 0.05]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
        {isSelected && (
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[1.2, 3, 1.2]} />
            <meshBasicMaterial color="#818cf8" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  if (isCharacter) {
    const bodyColor = color;
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        {/* Body */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[0.6, 1, 0.4]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.1, 1.45, 0.26]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[0.1, 1.45, 0.26]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {isSelected && (
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[1.2, 2.2, 1.2]} />
            <meshBasicMaterial color="#818cf8" transparent opacity={0.15} wireframe />
          </mesh>
        )}
        {/* Label */}
        <Html position={[0, 2.2, 0]} center>
          <div className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white pointer-events-none">
            {el.label}
          </div>
        </Html>
      </group>
    );
  }

  if (isCoin) {
    return (
      <group position={[worldX, 0.5, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  if (isSpawn) {
    return (
      <group position={[worldX, 0.05, worldZ]} onClick={handleClick}
        onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 1, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  // Default: 3D box
  return (
    <group position={[worldX, worldY, worldZ]} onClick={handleClick}
      onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh castShadow receiveShadow ref={meshRef}>
        <boxGeometry args={scale} />
        <meshStandardMaterial
          color={hovered ? "#a5b4fc" : color}
          transparent={el.type === "water" || el.type === "ice"}
          opacity={el.type === "water" ? 0.7 : el.type === "ice" ? 0.8 : 1}
          metalness={el.type === "ice" ? 0.5 : 0.1}
          roughness={el.type === "ice" ? 0.1 : 0.8}
          emissive={el.type === "lava" ? "#ff3300" : el.type === "killbrick" ? "#ff0000" : el.type === "teleporter" ? "#7c3aed" : "#000000"}
          emissiveIntensity={el.type === "lava" ? 0.5 : el.type === "killbrick" ? 0.3 : el.type === "teleporter" ? 0.4 : 0}
          flatShading
        />
      </mesh>
      {/* Grass top layer for ground/grass */}
      {(el.type === "grass" || el.type === "ground") && (
        <mesh position={[0, scale[1] / 2 + 0.02, 0]} receiveShadow>
          <boxGeometry args={[scale[0], 0.04, scale[2]]} />
          <meshStandardMaterial color="#4ade80" />
        </mesh>
      )}
      {/* Selection wireframe */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[scale[0] + 0.1, scale[1] + 0.1, scale[2] + 0.1]} />
          <meshBasicMaterial color="#818cf8" transparent opacity={0.2} wireframe />
        </mesh>
      )}
    </group>
  );
}

// ── Ground Plane Click Handler ──

function GroundPlane() {
  const { tool, placingItem, addElement, selectElement } = useCanvasStore();

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    const point = e.point;
    if (tool === "place" && placingItem) {
      // Convert 3D world position back to 2D canvas coords
      const canvasX = point.x * 50 + 700;
      const canvasZ = point.z * 50 + 350;
      addElement(placingItem, canvasX, canvasZ);
      return;
    }
    selectElement(null);
  }, [tool, placingItem, addElement, selectElement]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}
      receiveShadow onClick={handleClick}>
      <planeGeometry args={[40, 28]} />
      <meshStandardMaterial color="#4a8c3f" />
    </mesh>
  );
}

// ── Drop Zone (invisible, catches palette drops) ──

function DropOverlay() {
  const { addElement, setTool, setPlacingItem } = useCanvasStore();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/palette-item");
    if (!data) return;
    const item: PaletteItem = JSON.parse(data);
    // Place at center-ish position (user can move it after)
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normZ = (e.clientY - rect.top) / rect.height;
    const canvasX = normX * 1400;
    const canvasZ = normZ * 700;
    addElement(item, canvasX, canvasZ);
    setTool("select");
    setPlacingItem(null);
  }, [addElement, setTool, setPlacingItem]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ pointerEvents: "none" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      ref={(node) => {
        if (node) node.style.pointerEvents = "auto";
      }}
    />
  );
}

// ── Scene Setup ──

function SceneContent() {
  const { elements } = useCanvasStore();

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />

      {/* Sky */}
      <color attach="background" args={["#87CEEB"]} />
      <fog attach="fog" args={["#87CEEB", 25, 60]} />

      {/* Ground */}
      <GroundPlane />

      {/* Grid on ground */}
      <Grid
        args={[40, 28]}
        position={[0, 0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#5a9e4a"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#3d7a2c"
        fadeDistance={30}
        infiniteGrid={false}
      />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={40}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.1}
      />

      {/* Render all elements */}
      {elements.map((el) => (
        <Element3D key={el.id} el={el} />
      ))}
    </>
  );
}

// ── Main Export ──

export function GameCanvas3D() {
  return (
    <div className="relative flex-1">
      <DropOverlay />
      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 100 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <SceneContent />
      </Canvas>

      {/* Part count overlay */}
      <div className="absolute top-3 left-3 rounded-lg bg-black/40 backdrop-blur-sm px-3 py-1.5 text-[11px] text-white/70">
        Scroll to zoom · Right-click drag to rotate · Middle-click to pan
      </div>
    </div>
  );
}
