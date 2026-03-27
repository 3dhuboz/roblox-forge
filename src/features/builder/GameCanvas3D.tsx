import { useRef, useCallback, useState, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

// ── Roblox BrickColor-inspired palette ──

function getElementColor(el: CanvasElement): string {
  const map: Record<string, string> = {
    ground: "#7c5c3c", grass: "#4b974b", water: "#0078d7", lava: "#e8302a",
    sand: "#dac08c", ice: "#b4d2e7", platform: "#a0a0a0", "moving-platform": "#00a2ff",
    disappearing: "#f5cd30", bouncy: "#ff6eb4", conveyor: "#8b5cf6",
    killbrick: "#ff0000", spinner: "#ff8c00", laser: "#ff0040", spikes: "#a0a0a0",
    enemy: "#c80000", pet: "#ff82ab", npc: "#00af00", boss: "#6b00c8", shopkeeper: "#ffb900",
    tree: "#287f28", rock: "#898989", lamp: "#f0c000", bush: "#1e7a1e",
    fence: "#6e3b12", checkpoint: "#00ff00", teleporter: "#aa00ff",
    "boost-pad": "#00d4ff", coin: "#ffd700", gem: "#aa55ff", spawn: "#42b842",
  };
  return map[el.type] || el.color;
}

// Roblox "Plastic" material properties
const PLASTIC = { metalness: 0.0, roughness: 0.35 };
const SMOOTH_PLASTIC = { metalness: 0.05, roughness: 0.15 };
const NEON = { metalness: 0.0, roughness: 0.1 };

function getElementScale(type: string): [number, number, number] {
  // Sizes in Roblox studs (1 stud ≈ 0.3 in our world units)
  const map: Record<string, [number, number, number]> = {
    ground: [4, 0.4, 4], grass: [4, 0.4, 4], water: [5, 0.2, 5], lava: [4, 0.3, 4],
    sand: [4, 0.4, 4], ice: [4, 0.2, 4],
    platform: [4, 0.4, 2], "moving-platform": [4, 0.4, 2], disappearing: [3, 0.4, 2],
    bouncy: [3, 0.4, 2], conveyor: [4, 0.3, 2],
    killbrick: [2, 0.4, 2], spinner: [0.4, 1.2, 3], laser: [0.2, 4, 0.2], spikes: [3, 0.8, 2],
    enemy: [1, 1, 1], pet: [0.8, 0.8, 0.8], npc: [1, 1, 1],
    boss: [1.5, 1.5, 1.5], shopkeeper: [1, 1, 1],
    tree: [1, 1, 1], rock: [1.5, 1, 1.2], lamp: [0.4, 3, 0.4], bush: [1.2, 0.8, 1.2],
    fence: [4, 1.2, 0.2], checkpoint: [0.3, 3, 0.3], teleporter: [1.5, 0.3, 1.5],
    "boost-pad": [3, 0.15, 2], coin: [0.5, 0.5, 0.1], gem: [0.4, 0.6, 0.4], spawn: [2, 0.2, 2],
  };
  return map[type] || [1, 1, 1];
}

// ── Roblox Stud texture (procedural) ──

function useStudTexture() {
  const texture = useRef<THREE.CanvasTexture | null>(null);
  if (!texture.current) {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 64, 64);
    // Draw 4 studs in a 2x2 grid
    for (const [sx, sy] of [[16, 16], [48, 16], [16, 48], [48, 48]]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fill();
    }
    texture.current = new THREE.CanvasTexture(c);
    texture.current.wrapS = texture.current.wrapT = THREE.RepeatWrapping;
  }
  return texture.current;
}

// ── Roblox-style Part (box with plastic material) ──

function RobloxPart({ size, color: col, position: pos, emissive, emissiveIntensity, opacity, castShadow: cs = true, receiveShadow: rs = true, materialProps }: {
  size: [number, number, number];
  color: string;
  position?: [number, number, number];
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  materialProps?: Record<string, any>;
}) {
  return (
    <mesh position={pos || [0, 0, 0]} castShadow={cs} receiveShadow={rs}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={col}
        {...PLASTIC}
        transparent={opacity !== undefined && opacity < 1}
        opacity={opacity ?? 1}
        emissive={emissive || "#000000"}
        emissiveIntensity={emissiveIntensity || 0}
        {...materialProps}
      />
    </mesh>
  );
}

// ── Roblox R6 Character ──

function R6Character({ bodyColor, headColor, pos, label }: {
  bodyColor: string;
  headColor?: string;
  pos: [number, number, number];
  label: string;
}) {
  const hc = headColor || "#f5c076"; // Default "Bright yellow" head
  return (
    <group position={pos}>
      {/* Head (1.2 x 1.2 x 1.2 in Roblox, scaled down) */}
      <RobloxPart size={[0.6, 0.6, 0.6]} color={hc} position={[0, 1.65, 0]} />
      {/* Face - eyes */}
      <mesh position={[-0.12, 1.7, 0.31]}>
        <circleGeometry args={[0.06, 8]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.12, 1.7, 0.31]}>
        <circleGeometry args={[0.06, 8]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
      {/* Smile */}
      <mesh position={[0, 1.55, 0.31]}>
        <planeGeometry args={[0.2, 0.04]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>
      {/* Torso (2x2x1 in Roblox) */}
      <RobloxPart size={[0.6, 0.7, 0.35]} color={bodyColor} position={[0, 1, 0]} />
      {/* Left Arm */}
      <RobloxPart size={[0.25, 0.7, 0.25]} color={bodyColor} position={[-0.42, 1, 0]} />
      {/* Right Arm */}
      <RobloxPart size={[0.25, 0.7, 0.25]} color={bodyColor} position={[0.42, 1, 0]} />
      {/* Left Leg */}
      <RobloxPart size={[0.28, 0.7, 0.28]} color={bodyColor} position={[-0.16, 0.35, 0]} />
      {/* Right Leg */}
      <RobloxPart size={[0.28, 0.7, 0.28]} color={bodyColor} position={[0.16, 0.35, 0]} />
      {/* Label */}
      <Html position={[0, 2.3, 0]} center>
        <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">
          {label}
        </div>
      </Html>
    </group>
  );
}

// ── Animated Water ──

function WaterBlock({ pos, size }: { pos: [number, number, number]; size: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 1.5) * 0.03;
    }
  });
  return (
    <mesh ref={meshRef} position={pos} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#0078d7"
        transparent
        opacity={0.6}
        {...SMOOTH_PLASTIC}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── 3D Element Component (Roblox style) ──

function Element3D({ el }: { el: CanvasElement }) {
  const { selectedId, selectElement, tool, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const color = getElementColor(el);
  const scale = getElementScale(el.type);
  const [hovered, setHovered] = useState(false);

  const worldX = (el.x - 700) / 50;
  const worldZ = (el.y - 350) / 50;

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (tool === "delete") { removeElement(el.id); return; }
    selectElement(el.id);
  };

  const selectBox = isSelected ? (
    <mesh>
      <boxGeometry args={[scale[0] + 0.15, scale[1] + 0.15, scale[2] + 0.15]} />
      <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
    </mesh>
  ) : null;

  const hoverHandlers = {
    onPointerOver: () => setHovered(true),
    onPointerOut: () => setHovered(false),
  };

  // ── TREE: Cylinder trunk + sphere foliage (classic Roblox free-model tree)
  if (el.type === "tree") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.18, 2.4, 8]} />
          <meshStandardMaterial color="#6b3a1f" {...PLASTIC} />
        </mesh>
        <mesh position={[0, 2.8, 0]} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#287f28" {...PLASTIC} />
        </mesh>
        <mesh position={[0.4, 3.1, 0.3]} castShadow>
          <sphereGeometry args={[0.65, 10, 8]} />
          <meshStandardMaterial color="#1e6b1e" {...PLASTIC} />
        </mesh>
        <mesh position={[-0.3, 3, -0.3]} castShadow>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshStandardMaterial color="#34a034" {...PLASTIC} />
        </mesh>
      </group>
    );
  }

  // ── CHARACTERS: R6 blocky Roblox avatars
  if (el.category === "character") {
    const headColors: Record<string, string> = {
      enemy: "#c80000", pet: "#ff82ab", npc: "#f5c076", boss: "#6b00c8", shopkeeper: "#f5c076",
    };
    return (
      <group onClick={handleClick} {...hoverHandlers}>
        <R6Character bodyColor={color} headColor={headColors[el.type]} pos={[worldX, 0, worldZ]} label={el.label} />
        {isSelected && (
          <mesh position={[worldX, 1, worldZ]}>
            <boxGeometry args={[1.2, 2.4, 0.8]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // ── WATER: Transparent animated block
  if (el.type === "water") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <WaterBlock pos={[0, 0.1, 0]} size={scale} />
        {selectBox && <group position={[0, 0.1, 0]}>{selectBox}</group>}
      </group>
    );
  }

  // ── LAVA: Glowing red block
  if (el.type === "lava") {
    return (
      <group position={[worldX, scale[1] / 2, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh castShadow>
          <boxGeometry args={scale} />
          <meshStandardMaterial color="#e8302a" emissive="#ff4400" emissiveIntensity={0.8} {...NEON} />
        </mesh>
        <pointLight position={[0, 0.5, 0]} intensity={2} distance={4} color="#ff4400" />
        {selectBox}
      </group>
    );
  }

  // ── SPAWN: Roblox SpawnLocation pad (gray base + green team color)
  if (el.type === "spawn") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Base pad */}
        <RobloxPart size={[2, 0.2, 2]} color="#898989" position={[0, 0.1, 0]} />
        {/* Team color diamond */}
        <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshStandardMaterial color="#42b842" {...SMOOTH_PLASTIC} />
        </mesh>
        {isSelected && (
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[2.2, 0.4, 2.2]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // ── CHECKPOINT: Pole + flag
  if (el.type === "checkpoint") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 3, 8]} />
          <meshStandardMaterial color="#c0c0c0" {...SMOOTH_PLASTIC} />
        </mesh>
        <RobloxPart size={[0.6, 0.4, 0.05]} color="#00ff00" position={[0.35, 2.7, 0]} />
        {isSelected && (
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[1.2, 3.2, 0.6]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // ── COIN: Spinning gold cylinder
  if (el.type === "coin") {
    const coinRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
      if (coinRef.current) coinRef.current.rotation.y = clock.elapsedTime * 2;
    });
    return (
      <group position={[worldX, 0.8, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh ref={coinRef} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.7} roughness={0.15} />
        </mesh>
      </group>
    );
  }

  // ── GEM: Spinning purple diamond
  if (el.type === "gem") {
    const gemRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
      if (gemRef.current) gemRef.current.rotation.y = clock.elapsedTime * 1.5;
    });
    return (
      <group position={[worldX, 0.8, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh ref={gemRef} castShadow rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#aa55ff" metalness={0.5} roughness={0.1} emissive="#6600cc" emissiveIntensity={0.3} />
        </mesh>
      </group>
    );
  }

  // ── ROCK: Irregular blocky shape
  if (el.type === "rock") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 0.4, 0]} castShadow rotation={[0, 0.4, 0]}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#898989" {...PLASTIC} flatShading />
        </mesh>
        {isSelected && (
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[1.6, 1.6, 1.6]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.15} wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // ── BUSH: Green spheres cluster
  if (el.type === "bush") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshStandardMaterial color="#1e7a1e" {...PLASTIC} />
        </mesh>
        <mesh position={[0.3, 0.25, 0.2]} castShadow>
          <sphereGeometry args={[0.35, 8, 6]} />
          <meshStandardMaterial color="#287f28" {...PLASTIC} />
        </mesh>
      </group>
    );
  }

  // ── LAMP: Pole with light (Roblox style)
  if (el.type === "lamp") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 3, 8]} />
          <meshStandardMaterial color="#4a4a4a" {...PLASTIC} />
        </mesh>
        <mesh position={[0, 3.1, 0]}>
          <boxGeometry args={[0.5, 0.25, 0.5]} />
          <meshStandardMaterial color="#f0c000" emissive="#ffd700" emissiveIntensity={1.5} {...NEON} />
        </mesh>
        <pointLight position={[0, 2.8, 0]} intensity={4} distance={6} color="#ffd700" />
      </group>
    );
  }

  // ── KILLBRICK: Bright red Roblox part
  if (el.type === "killbrick") {
    return (
      <group position={[worldX, scale[1] / 2, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh castShadow>
          <boxGeometry args={scale} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.15} {...SMOOTH_PLASTIC} />
        </mesh>
        {selectBox}
      </group>
    );
  }

  // ── TELEPORTER: Glowing purple pad
  if (el.type === "teleporter") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.75, 0.75, 0.3, 16]} />
          <meshStandardMaterial color="#aa00ff" emissive="#7700cc" emissiveIntensity={0.6} {...NEON} />
        </mesh>
        <pointLight position={[0, 0.5, 0]} intensity={2} distance={3} color="#aa00ff" />
      </group>
    );
  }

  // ── DEFAULT: Standard Roblox Part (box with Plastic material)
  const yPos = scale[1] / 2;
  return (
    <group position={[worldX, yPos, worldZ]} onClick={handleClick} {...hoverHandlers}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={scale} />
        <meshStandardMaterial
          color={hovered ? "#7db8f0" : color}
          {...PLASTIC}
          transparent={el.type === "ice"}
          opacity={el.type === "ice" ? 0.75 : 1}
        />
      </mesh>
      {/* Grass overlay on ground/grass parts */}
      {(el.type === "grass" || el.type === "ground") && (
        <mesh position={[0, scale[1] / 2 + 0.015, 0]} receiveShadow>
          <boxGeometry args={[scale[0] - 0.01, 0.03, scale[2] - 0.01]} />
          <meshStandardMaterial color="#4b974b" {...SMOOTH_PLASTIC} />
        </mesh>
      )}
      {selectBox}
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
      <meshStandardMaterial color="#3b8c3b" {...PLASTIC} />
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

// ── Sky Dome ──

function SkyDome() {
  return (
    <mesh>
      <sphereGeometry args={[50, 32, 16]} />
      <meshBasicMaterial side={THREE.BackSide}>
        <canvasTexture
          attach="map"
          image={(() => {
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext("2d")!;
            const g = ctx.createLinearGradient(0, 0, 0, 512);
            g.addColorStop(0, "#1e40af");
            g.addColorStop(0.3, "#3b82f6");
            g.addColorStop(0.5, "#60a5fa");
            g.addColorStop(0.7, "#93c5fd");
            g.addColorStop(0.85, "#bae6fd");
            g.addColorStop(1, "#e0f2fe");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 512, 512);
            return canvas;
          })()}
        />
      </meshBasicMaterial>
    </mesh>
  );
}

// ── Decorative background scenery ──

function BackgroundScenery() {
  // Deterministic positions for background trees and rocks
  const bgTrees = [
    [-15, 0, -10], [-12, 0, -8], [-18, 0, -6], [15, 0, -9], [12, 0, -11],
    [17, 0, -7], [-14, 0, 10], [-16, 0, 8], [14, 0, 9], [16, 0, 11],
    [-10, 0, -12], [10, 0, -12], [0, 0, -13], [5, 0, -11], [-5, 0, -11],
    [-18, 0, 0], [18, 0, 0], [-17, 0, 5], [17, 0, -5],
  ];
  const bgRocks = [
    [-13, 0, -5], [13, 0, -6], [-11, 0, 7], [11, 0, 8],
    [-16, 0, 3], [16, 0, -3], [0, 0, -14], [-8, 0, -13],
  ];

  return (
    <group>
      {bgTrees.map(([x, _y, z], i) => (
        <group key={`bgt${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.15, 1.6, 6]} />
            <meshStandardMaterial color="#6b3a1f" />
          </mesh>
          <mesh position={[0, 1.8 + (i % 3) * 0.2, 0]} castShadow>
            <sphereGeometry args={[0.6 + (i % 2) * 0.2, 6, 6]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#16a34a" : i % 3 === 1 ? "#15803d" : "#22c55e"} flatShading />
          </mesh>
        </group>
      ))}
      {bgRocks.map(([x, _y, z], i) => (
        <mesh key={`bgr${i}`} position={[x, 0.25, z]} rotation={[0, i * 1.2, 0]} castShadow>
          <dodecahedronGeometry args={[0.3 + (i % 3) * 0.15, 0]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#78716c" : "#6b7280"} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ── WASD Keyboard Camera Movement ──

function KeyboardControls() {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame((state, delta) => {
    const speed = keys.current.has("shift") ? 20 : 10;
    const move = speed * delta;
    const k = keys.current;
    if (k.size === 0) return;

    // Get camera's forward and right vectors (projected onto XZ plane)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const offset = new THREE.Vector3();

    // WASD / Arrow keys
    if (k.has("w") || k.has("arrowup")) offset.add(forward.clone().multiplyScalar(move));
    if (k.has("s") || k.has("arrowdown")) offset.add(forward.clone().multiplyScalar(-move));
    if (k.has("a") || k.has("arrowleft")) offset.add(right.clone().multiplyScalar(-move));
    if (k.has("d") || k.has("arrowright")) offset.add(right.clone().multiplyScalar(move));
    if (k.has("e")) offset.y += move;
    if (k.has("q")) offset.y -= move;

    if (offset.lengthSq() === 0) return;

    // Move camera position
    camera.position.add(offset);

    // Move orbit target too so rotation stays centered
    const controls = (state as any).controls;
    if (controls && controls.target) {
      controls.target.add(offset);
    }
  });

  return null;
}

// ── Draggable element wrapper ──

function DraggableElement3D({ el }: { el: CanvasElement }) {
  const { selectedId, tool, moveElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const groupRef = useRef<THREE.Group>(null);
  const { raycaster, camera, pointer } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!isDragging || !groupRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    if (intersect) {
      const newX = intersect.x * 50 + 700 - dragOffset.current.x;
      const newZ = intersect.z * 50 + 350 - dragOffset.current.z;
      moveElement(el.id, Math.round(newX / 20) * 20, Math.round(newZ / 20) * 20);
    }
  });

  const handlePointerDown = (e: any) => {
    if (tool !== "select" && tool !== "move") return;
    if (!isSelected) return;
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    raycaster.setFromCamera(pointer, camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    if (intersect) {
      dragOffset.current.set(intersect.x * 50 + 700 - el.x, 0, intersect.z * 50 + 350 - el.y);
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      const { elements, undoStack } = useCanvasStore.getState();
      useCanvasStore.setState({ undoStack: [...undoStack, elements], redoStack: [] });
    }
  };

  return (
    <group ref={groupRef} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <Element3D el={el} />
    </group>
  );
}

// ── Scene Setup ──

function SceneContent() {
  const { elements } = useCanvasStore();

  return (
    <>
      {/* Lighting — richer setup */}
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#87CEEB", "#4a8c3f", 0.6]} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-8, 10, -8]} intensity={0.3} color="#b0c4de" />

      {/* Sky */}
      <SkyDome />
      <fog attach="fog" args={["#c0daf0", 30, 55]} />

      {/* Ground — larger with edge walls */}
      <GroundPlane />

      {/* Baseplate edge walls to make it feel like a Roblox baseplate */}
      {[
        { pos: [0, -0.5, -14] as [number, number, number], scale: [40, 1, 0.2] as [number, number, number] },
        { pos: [0, -0.5, 14] as [number, number, number], scale: [40, 1, 0.2] as [number, number, number] },
        { pos: [-20, -0.5, 0] as [number, number, number], scale: [0.2, 1, 28] as [number, number, number] },
        { pos: [20, -0.5, 0] as [number, number, number], scale: [0.2, 1, 28] as [number, number, number] },
      ].map((wall, i) => (
        <mesh key={`wall${i}`} position={wall.pos} castShadow>
          <boxGeometry args={wall.scale} />
          <meshStandardMaterial color="#3d7a2c" />
        </mesh>
      ))}

      {/* Grid on ground — Roblox Studio style */}
      <Grid
        args={[40, 28]}
        position={[0, 0.02, 0]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#5a9e4a"
        sectionSize={8}
        sectionThickness={1.2}
        sectionColor="#3d7a2c"
        fadeDistance={40}
        infiniteGrid={false}
      />

      {/* Background scenery — trees and rocks around the edges */}
      <BackgroundScenery />

      {/* Camera controls — orbit + WASD keyboard movement */}
      <KeyboardControls />
      <OrbitControls
        makeDefault
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={45}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Render all user-placed elements */}
      {elements.map((el) => (
        <DraggableElement3D key={el.id} el={el} />
      ))}
    </>
  );
}

// ── Main Export ──

export function GameCanvas3D() {
  const { elements } = useCanvasStore();

  return (
    <div className="relative flex-1">
      <DropOverlay />
      <Canvas
        shadows
        camera={{ position: [14, 12, 14], fov: 45, near: 0.1, far: 120 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <SceneContent />
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-3">
        <div className="rounded-lg bg-black/50 backdrop-blur-sm px-3 py-1.5 text-[11px] text-white/80 shadow">
          <span className="font-bold text-indigo-300">WASD</span> move · <span className="font-bold text-indigo-300">Q/E</span> up/down · <span className="font-bold text-indigo-300">Scroll</span> zoom · <span className="font-bold text-indigo-300">Right-drag</span> rotate · <span className="font-bold text-indigo-300">Shift</span> fast
        </div>
        <div className="rounded-lg bg-black/50 backdrop-blur-sm px-3 py-1.5 text-[11px] text-white/80 shadow">
          <span className="font-bold text-green-300">{elements.length}</span> parts placed
        </div>
      </div>

      {/* Empty state prompt */}
      {elements.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="rounded-xl bg-black/50 backdrop-blur-sm px-6 py-3 text-center border border-white/10 shadow-xl">
            <p className="text-[14px] font-bold text-white">Drag parts from the Toolbox to start building</p>
            <p className="mt-1 text-[12px] text-white/50">Click on the ground to place · Select and drag to move</p>
          </div>
        </div>
      )}
    </div>
  );
}
