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

// Map Roblox Material enums to Three.js material overrides
function getMaterialProps(el: CanvasElement): {
  materialProps?: Record<string, any>;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
} {
  const material = ((el.logic?.material as string) || (el.properties?.material as string) || "").toLowerCase();
  const color = getElementColor(el);

  // Neon: self-illuminating glow
  if (material === "neon" || el.type === "neon" || el.type === "killbrick" || el.type === "laser") {
    return {
      materialProps: { ...NEON },
      emissive: color,
      emissiveIntensity: 0.8,
    };
  }
  // Glass: transparent with slight sheen
  if (material === "glass" || el.type === "ice") {
    return {
      materialProps: { metalness: 0.1, roughness: 0.05 },
      opacity: 0.45,
    };
  }
  // Metal: high metalness, low roughness
  if (material === "metal" || material === "diamondplate" || material === "corrodedmetal") {
    return {
      materialProps: { metalness: 0.85, roughness: 0.25 },
    };
  }
  // Wood: warm rough surface
  if (material === "wood" || material === "woodplanks") {
    return {
      materialProps: { metalness: 0.0, roughness: 0.7 },
    };
  }
  // SmoothPlastic
  if (material === "smoothplastic") {
    return { materialProps: { ...SMOOTH_PLASTIC } };
  }
  // Foil: reflective
  if (material === "foil") {
    return {
      materialProps: { metalness: 0.95, roughness: 0.1 },
    };
  }
  return {};
}

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

  // ── HOUSE: Basic residential building
  if (el.type === "house") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Floor */}
        <RobloxPart size={[3, 0.1, 3]} color="#808080" position={[0, 0.05, 0]} />
        {/* Back wall */}
        <RobloxPart size={[3, 2.5, 0.2]} color="#c4a882" position={[0, 1.25, -1.4]} />
        {/* Left wall */}
        <RobloxPart size={[0.2, 2.5, 3]} color="#c4a882" position={[-1.4, 1.25, 0]} />
        {/* Right wall */}
        <RobloxPart size={[0.2, 2.5, 3]} color="#c4a882" position={[1.4, 1.25, 0]} />
        {/* Front wall left */}
        <RobloxPart size={[1, 2.5, 0.2]} color="#c4a882" position={[-0.9, 1.25, 1.4]} />
        {/* Front wall right */}
        <RobloxPart size={[1, 2.5, 0.2]} color="#c4a882" position={[0.9, 1.25, 1.4]} />
        {/* Door frame top */}
        <RobloxPart size={[0.8, 0.5, 0.2]} color="#c4a882" position={[0, 2.25, 1.4]} />
        {/* Roof */}
        <mesh position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[3.4, 0.15, 3.4]} />
          <meshStandardMaterial color="#8b4513" {...PLASTIC} />
        </mesh>
        {/* Roof peak */}
        <mesh position={[0, 3.3, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[2.2, 1, 4]} />
          <meshStandardMaterial color="#8b4513" {...PLASTIC} />
        </mesh>
        {isSelected && (
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[3.8, 3.8, 3.8]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe />
          </mesh>
        )}
        <Html position={[0, 4, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── SHOP: Clean upgrade shop — open-front market stall style
  if (el.type === "shop-building") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Floor slab */}
        <RobloxPart size={[3.2, 0.12, 2.8]} color="#808080" position={[0, 0.06, 0]} />

        {/* Back wall (full) */}
        <RobloxPart size={[3, 2.6, 0.2]} color="#daa520" position={[0, 1.36, -1.3]} />
        {/* Left wall (full) */}
        <RobloxPart size={[0.2, 2.6, 2.4]} color="#c89428" position={[-1.4, 1.36, 0]} />
        {/* Right wall (full) */}
        <RobloxPart size={[0.2, 2.6, 2.4]} color="#c89428" position={[1.4, 1.36, 0]} />

        {/* Front — open counter (no front wall, just a counter) */}
        <RobloxPart size={[3, 0.8, 0.3]} color="#8b6914" position={[0, 0.52, 1.15]} />

        {/* Shelves on back wall */}
        <RobloxPart size={[2.4, 0.1, 0.4]} color="#6b4226" position={[0, 1.8, -1.1]} />
        <RobloxPart size={[2.4, 0.1, 0.4]} color="#6b4226" position={[0, 1.2, -1.1]} />
        {/* Items on shelves */}
        <mesh position={[-0.6, 1.95, -1.0]}>
          <boxGeometry args={[0.3, 0.25, 0.25]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} {...SMOOTH_PLASTIC} />
        </mesh>
        <mesh position={[0, 1.95, -1.0]}>
          <boxGeometry args={[0.25, 0.3, 0.25]} />
          <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.2} {...SMOOTH_PLASTIC} />
        </mesh>
        <mesh position={[0.6, 1.95, -1.0]}>
          <boxGeometry args={[0.3, 0.2, 0.25]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} {...SMOOTH_PLASTIC} />
        </mesh>
        <mesh position={[-0.4, 1.35, -1.0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 8]} />
          <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.4, 1.35, -1.0]}>
          <boxGeometry args={[0.35, 0.2, 0.2]} />
          <meshStandardMaterial color="#06b6d4" {...SMOOTH_PLASTIC} />
        </mesh>

        {/* Awning (front overhang, angled down) */}
        <mesh position={[0, 2.55, 0.8]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[3.4, 0.06, 1.6]} />
          <meshStandardMaterial color="#cc2222" {...PLASTIC} />
        </mesh>
        {/* Awning white stripe */}
        <mesh position={[0, 2.52, 1.2]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[3.4, 0.03, 0.25]} />
          <meshStandardMaterial color="#ffffff" {...PLASTIC} />
        </mesh>

        {/* Sign on front of awning */}
        <mesh position={[0, 2.78, 1.52]}>
          <boxGeometry args={[2.2, 0.4, 0.08]} />
          <meshStandardMaterial color="#1a0a00" {...PLASTIC} />
        </mesh>
        <mesh position={[0, 2.78, 1.58]}>
          <boxGeometry args={[1.8, 0.28, 0.02]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.6} {...NEON} />
        </mesh>

        {/* Roof */}
        <mesh position={[0, 2.72, 0]} castShadow>
          <boxGeometry args={[3.4, 0.1, 3]} />
          <meshStandardMaterial color="#5a3a1a" {...PLASTIC} />
        </mesh>

        {/* Interior light */}
        <pointLight position={[0, 2, 0]} intensity={2} distance={3.5} color="#ffeedd" />

        {isSelected && (
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[3.8, 3.4, 3.4]} />
            <meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe />
          </mesh>
        )}
        <Html position={[0, 3.4, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── CAVE: Arch entrance with dark interior
  if (el.type === "cave") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Base rock */}
        <mesh position={[0, 1.2, -0.5]} castShadow>
          <boxGeometry args={[4, 2.4, 2.5]} />
          <meshStandardMaterial color="#4a4a4a" {...PLASTIC} flatShading />
        </mesh>
        {/* Top rock */}
        <mesh position={[0, 2.6, -0.3]} castShadow>
          <boxGeometry args={[3.5, 0.8, 2]} />
          <meshStandardMaterial color="#555555" {...PLASTIC} flatShading />
        </mesh>
        {/* Dark interior */}
        <mesh position={[0, 1, 0.7]}>
          <boxGeometry args={[2, 1.8, 0.1]} />
          <meshBasicMaterial color="#111111" />
        </mesh>
        {/* Entrance arch hint (top) */}
        <mesh position={[0, 2, 0.75]} castShadow>
          <boxGeometry args={[2.5, 0.4, 0.3]} />
          <meshStandardMaterial color="#3a3a3a" {...PLASTIC} flatShading />
        </mesh>
        <Html position={[0, 3.2, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── TOWER: Tall structure
  if (el.type === "tower") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[1.5, 5, 1.5]} color="#808080" position={[0, 2.5, 0]} />
        <RobloxPart size={[1.8, 0.3, 1.8]} color="#696969" position={[0, 5.15, 0]} />
        {/* Battlements */}
        {[[-0.6, 0, -0.6], [0.6, 0, -0.6], [-0.6, 0, 0.6], [0.6, 0, 0.6]].map(([bx, _, bz], i) => (
          <RobloxPart key={`bat${i}`} size={[0.3, 0.5, 0.3]} color="#696969" position={[bx, 5.55, bz]} />
        ))}
      </group>
    );
  }

  // ── BRIDGE: Flat walkway with rails
  if (el.type === "bridge") {
    return (
      <group position={[worldX, 0.5, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[5, 0.2, 2]} color="#8b7355" position={[0, 0, 0]} />
        {/* Rails */}
        <RobloxPart size={[5, 0.6, 0.1]} color="#6b5335" position={[0, 0.4, -0.95]} />
        <RobloxPart size={[5, 0.6, 0.1]} color="#6b5335" position={[0, 0.4, 0.95]} />
      </group>
    );
  }

  // ── WALL: Simple barrier
  if (el.type === "wall") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[4, 2.5, 0.4]} color="#696969" position={[0, 1.25, 0]} />
      </group>
    );
  }

  // ── ARENA: Flat area with walls around it
  if (el.type === "arena") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Floor */}
        <RobloxPart size={[6, 0.1, 6]} color="#8b0000" position={[0, 0.05, 0]} />
        {/* Walls */}
        <RobloxPart size={[6, 1.5, 0.2]} color="#a00000" position={[0, 0.75, -2.9]} />
        <RobloxPart size={[6, 1.5, 0.2]} color="#a00000" position={[0, 0.75, 2.9]} />
        <RobloxPart size={[0.2, 1.5, 6]} color="#a00000" position={[-2.9, 0.75, 0]} />
        <RobloxPart size={[0.2, 1.5, 6]} color="#a00000" position={[2.9, 0.75, 0]} />
        <Html position={[0, 2, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── TYCOON PLOT: Flat green pad with boundary
  if (el.type === "tycoon-plot") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[5, 0.1, 5]} color="#228b22" position={[0, 0.05, 0]} />
        {/* Boundary lines */}
        <RobloxPart size={[5, 0.3, 0.05]} color="#ffff00" position={[0, 0.2, -2.47]} />
        <RobloxPart size={[5, 0.3, 0.05]} color="#ffff00" position={[0, 0.2, 2.47]} />
        <RobloxPart size={[0.05, 0.3, 5]} color="#ffff00" position={[-2.47, 0.2, 0]} />
        <RobloxPart size={[0.05, 0.3, 5]} color="#ffff00" position={[2.47, 0.2, 0]} />
        <Html position={[0, 1, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-yellow-300 pointer-events-none shadow">Tycoon Plot</div>
        </Html>
      </group>
    );
  }

  // ── MACHINE: Tycoon dropper/conveyor machine
  if (el.type === "machine") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[1.2, 1.5, 1.2]} color="#b0b0b0" position={[0, 0.75, 0]} />
        <RobloxPart size={[0.8, 0.3, 0.8]} color="#ffd700" position={[0, 1.65, 0]} />
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 8]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={0.5} {...NEON} />
        </mesh>
      </group>
    );
  }

  // ── RACE TRACK: Dark road segment with lines
  if (el.type === "race-track") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[6, 0.1, 3]} color="#333333" position={[0, 0.05, 0]} />
        {/* Center dashed line */}
        {[-2, -1, 0, 1, 2].map((lx, i) => (
          <RobloxPart key={`line${i}`} size={[0.6, 0.02, 0.1]} color="#ffffff" position={[lx, 0.12, 0]} />
        ))}
        {/* Edge lines */}
        <RobloxPart size={[6, 0.02, 0.08]} color="#ffffff" position={[0, 0.12, -1.4]} />
        <RobloxPart size={[6, 0.02, 0.08]} color="#ffffff" position={[0, 0.12, 1.4]} />
      </group>
    );
  }

  // ── DROPPER: Tall tower that drops items (core tycoon piece)
  if (el.type === "dropper") {
    const dropRef = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => {
      if (dropRef.current) {
        // Animate a small "drop" item bobbing
        dropRef.current.position.y = 2.8 + Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.5;
      }
    });
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Base */}
        <RobloxPart size={[1.6, 0.4, 1.6]} color="#888888" position={[0, 0.2, 0]} />
        {/* Pillar */}
        <RobloxPart size={[0.8, 3, 0.8]} color="#999999" position={[0, 1.7, 0]} />
        {/* Hopper top (wider) */}
        <RobloxPart size={[1.8, 0.6, 1.8]} color="#aaaaaa" position={[0, 3.5, 0]} />
        {/* Hopper funnel inside */}
        <mesh position={[0, 3.3, 0]}>
          <cylinderGeometry args={[0.6, 0.2, 0.5, 8]} />
          <meshStandardMaterial color="#777777" {...PLASTIC} />
        </mesh>
        {/* Dropping item (animated) */}
        <mesh ref={dropRef} position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.4} {...SMOOTH_PLASTIC} />
        </mesh>
        {/* Label */}
        <Html position={[0, 4.2, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">
            Dropper
          </div>
        </Html>
        {selectBox && <group position={[0, 2, 0]}><mesh><boxGeometry args={[2.2, 4.2, 2.2]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe /></mesh></group>}
      </group>
    );
  }

  // ── CONVEYOR BELT: Moves items from dropper to collector
  if (el.type === "conveyor-belt") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Belt surface */}
        <RobloxPart size={[5, 0.15, 1.5]} color="#333333" position={[0, 0.35, 0]} />
        {/* Side rails */}
        <RobloxPart size={[5, 0.3, 0.1]} color="#666666" position={[0, 0.35, -0.75]} />
        <RobloxPart size={[5, 0.3, 0.1]} color="#666666" position={[0, 0.35, 0.75]} />
        {/* Legs */}
        <RobloxPart size={[0.15, 0.25, 0.15]} color="#555555" position={[-2.2, 0.12, -0.6]} />
        <RobloxPart size={[0.15, 0.25, 0.15]} color="#555555" position={[-2.2, 0.12, 0.6]} />
        <RobloxPart size={[0.15, 0.25, 0.15]} color="#555555" position={[2.2, 0.12, -0.6]} />
        <RobloxPart size={[0.15, 0.25, 0.15]} color="#555555" position={[2.2, 0.12, 0.6]} />
        {/* Belt stripes (indicate movement direction) */}
        {[-1.8, -0.9, 0, 0.9, 1.8].map((bx, i) => (
          <RobloxPart key={`stripe${i}`} size={[0.08, 0.02, 1.3]} color="#555555" position={[bx, 0.44, 0]} />
        ))}
        {/* Direction arrow on belt */}
        <Html position={[0, 0.6, 0]} center>
          <div className="text-[14px] text-yellow-400/60 font-bold pointer-events-none">→→→</div>
        </Html>
        {selectBox && <group position={[0, 0.3, 0]}><mesh><boxGeometry args={[5.2, 0.8, 1.8]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe /></mesh></group>}
      </group>
    );
  }

  // ── COLLECTOR / SELL ZONE: Where items get sold for cash
  if (el.type === "collector") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Base pad (glowing green like Roblox sell pads) */}
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 0.2, 2]} />
          <meshStandardMaterial color="#00cc00" emissive="#00ff00" emissiveIntensity={0.5} {...NEON} />
        </mesh>
        {/* Border */}
        <RobloxPart size={[2.2, 0.3, 0.1]} color="#009900" position={[0, 0.15, -1.05]} />
        <RobloxPart size={[2.2, 0.3, 0.1]} color="#009900" position={[0, 0.15, 1.05]} />
        <RobloxPart size={[0.1, 0.3, 2]} color="#009900" position={[-1.05, 0.15, 0]} />
        <RobloxPart size={[0.1, 0.3, 2]} color="#009900" position={[1.05, 0.15, 0]} />
        {/* $ symbol floating */}
        <Html position={[0, 0.8, 0]} center>
          <div className="text-[18px] font-black pointer-events-none" style={{ color: "#00ff00", textShadow: "0 0 10px #00ff0088" }}>$</div>
        </Html>
        <Html position={[0, 1.3, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-green-400 pointer-events-none shadow">
            Sell Zone
          </div>
        </Html>
        {selectBox && <group position={[0, 0.1, 0]}><mesh><boxGeometry args={[2.4, 0.5, 2.4]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe /></mesh></group>}
      </group>
    );
  }

  // ── UPGRADE BUTTON: Step-on pad to buy upgrades (Roblox tycoon staple)
  if (el.type === "upgrade-button") {
    const cost = el.logic?.upgradeCost ?? 500;
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Yellow pad */}
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.15, 1.2]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={0.3} {...SMOOTH_PLASTIC} />
        </mesh>
        {/* Price display — reads from logic.upgradeCost */}
        <Html position={[0, 0.6, 0]} center>
          <div className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-black pointer-events-none shadow-lg"
            style={{ background: "linear-gradient(180deg, #ffcc00, #ff9900)", color: "#000", border: "2px solid #cc8800" }}>
            💰 ${cost}
          </div>
        </Html>
        {selectBox && <group position={[0, 0.08, 0]}><mesh><boxGeometry args={[2, 0.4, 1.4]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe /></mesh></group>}
      </group>
    );
  }

  // ── PORTAL: Glowing doorway
  if (el.type === "portal") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Frame */}
        <RobloxPart size={[0.3, 3, 0.3]} color="#555555" position={[-0.85, 1.5, 0]} />
        <RobloxPart size={[0.3, 3, 0.3]} color="#555555" position={[0.85, 1.5, 0]} />
        <RobloxPart size={[2, 0.3, 0.3]} color="#555555" position={[0, 3, 0]} />
        {/* Portal effect */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[1.4, 2.7, 0.15]} />
          <meshStandardMaterial color="#9400d3" emissive="#7700cc" emissiveIntensity={1} transparent opacity={0.6} {...NEON} />
        </mesh>
        <pointLight position={[0, 1.5, 0.5]} intensity={3} distance={4} color="#9400d3" />
      </group>
    );
  }

  // ── TUNNEL: Walk-through tube
  if (el.type === "tunnel") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Arch */}
        <mesh position={[0, 1, 0]} castShadow>
          <torusGeometry args={[1.2, 0.3, 8, 12, Math.PI]} />
          <meshStandardMaterial color="#555555" {...PLASTIC} />
        </mesh>
        {/* Base walls */}
        <RobloxPart size={[0.3, 2, 1.5]} color="#555555" position={[-1.2, 1, 0]} />
        <RobloxPart size={[0.3, 2, 1.5]} color="#555555" position={[1.2, 1, 0]} />
      </group>
    );
  }

  // ── MARKET STALL: Small vendor booth
  if (el.type === "market-stall") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Counter */}
        <RobloxPart size={[2, 0.9, 0.8]} color="#cd853f" position={[0, 0.45, 0]} />
        {/* Poles */}
        <mesh position={[-0.9, 1.2, -0.3]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
          <meshStandardMaterial color="#8b6914" {...PLASTIC} />
        </mesh>
        <mesh position={[0.9, 1.2, -0.3]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
          <meshStandardMaterial color="#8b6914" {...PLASTIC} />
        </mesh>
        {/* Canopy */}
        <RobloxPart size={[2.4, 0.1, 1.2]} color="#ff6347" position={[0, 2.4, 0]} />
      </group>
    );
  }

  // ── CLICK ORB: Glowing interactive sphere
  if (el.type === "click-orb") {
    return (
      <group position={[worldX, 1.2, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh castShadow>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ccff" emissiveIntensity={0.8} transparent opacity={0.85} {...NEON} />
        </mesh>
        <pointLight position={[0, 0, 0]} intensity={3} distance={3} color="#00ffff" />
        {selectBox}
        <Html position={[0, 1.2, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── PRESTIGE PAD: Golden glowing platform
  if (el.type === "prestige-pad") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.4, 0.2, 8]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.6} {...NEON} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffd700" emissiveIntensity={1} transparent opacity={0.5} {...NEON} />
        </mesh>
        <pointLight position={[0, 0.8, 0]} intensity={4} distance={4} color="#ffd700" />
        {selectBox && <group position={[0, 0.1, 0]}><mesh><cylinderGeometry args={[1.6, 1.6, 0.5, 8]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.12} wireframe /></mesh></group>}
        <Html position={[0, 1, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-yellow-300 pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── ZONE PORTAL: Colored archway
  if (el.type === "zone-portal") {
    const portalColor = el.color || "#8b5cf6";
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[0.25, 3.2, 0.25]} color="#444444" position={[-1, 1.6, 0]} />
        <RobloxPart size={[0.25, 3.2, 0.25]} color="#444444" position={[1, 1.6, 0]} />
        <RobloxPart size={[2.2, 0.25, 0.25]} color="#444444" position={[0, 3.2, 0]} />
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[1.6, 2.9, 0.12]} />
          <meshStandardMaterial color={portalColor} emissive={portalColor} emissiveIntensity={0.8} transparent opacity={0.55} {...NEON} />
        </mesh>
        <pointLight position={[0, 1.6, 0.5]} intensity={3} distance={4} color={portalColor} />
        <Html position={[0, 3.8, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── SPINNER: Rotating hazard bar
  if (el.type === "spinner") {
    const spinRef = useRef<THREE.Group>(null);
    useFrame(({ clock }) => {
      if (spinRef.current) spinRef.current.rotation.y = clock.elapsedTime * 2;
    });
    return (
      <group position={[worldX, 0.5, worldZ]} onClick={handleClick} {...hoverHandlers}>
        {/* Center pole */}
        <RobloxPart size={[0.3, 1, 0.3]} color="#666666" position={[0, 0, 0]} />
        {/* Spinning arms */}
        <group ref={spinRef} position={[0, 0.6, 0]}>
          <mesh castShadow>
            <boxGeometry args={[3, 0.2, 0.3]} />
            <meshStandardMaterial color="#ff8c00" emissive="#ff6600" emissiveIntensity={0.4} {...SMOOTH_PLASTIC} />
          </mesh>
        </group>
        <Html position={[0, 1.5, 0]} center>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-orange-400 pointer-events-none shadow">{el.label}</div>
        </Html>
      </group>
    );
  }

  // ── BOOST PAD: Glowing cyan pad with arrows
  if (el.type === "boost-pad") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[2, 0.12, 1]} />
          <meshStandardMaterial color="#06b6d4" emissive="#00e5ff" emissiveIntensity={0.5} {...NEON} />
        </mesh>
        <Html position={[0, 0.5, 0]} center>
          <div className="text-[14px] font-bold pointer-events-none" style={{ color: "#00e5ff", textShadow: "0 0 8px #00e5ff88" }}>→→→</div>
        </Html>
      </group>
    );
  }

  // ── FENCE: Wooden rail
  if (el.type === "fence") {
    return (
      <group position={[worldX, 0, worldZ]} onClick={handleClick} {...hoverHandlers}>
        <RobloxPart size={[0.15, 0.8, 0.15]} color="#6e3b12" position={[-0.8, 0.4, 0]} />
        <RobloxPart size={[0.15, 0.8, 0.15]} color="#6e3b12" position={[0.8, 0.4, 0]} />
        <RobloxPart size={[1.8, 0.1, 0.1]} color="#8b5a2b" position={[0, 0.65, 0]} />
        <RobloxPart size={[1.8, 0.1, 0.1]} color="#8b5a2b" position={[0, 0.35, 0]} />
      </group>
    );
  }

  // ── DEFAULT: Standard Roblox Part (material-aware)
  const yPos = scale[1] / 2;
  const matProps = getMaterialProps(el);
  return (
    <group position={[worldX, yPos, worldZ]} onClick={handleClick} {...hoverHandlers}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={scale} />
        <meshStandardMaterial
          color={hovered ? "#7db8f0" : color}
          {...PLASTIC}
          {...matProps.materialProps}
          transparent={matProps.opacity !== undefined && matProps.opacity < 1}
          opacity={matProps.opacity ?? 1}
          emissive={matProps.emissive || "#000000"}
          emissiveIntensity={matProps.emissiveIntensity || 0}
        />
      </mesh>
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

// Drop handling is done on the wrapper div in GameCanvas3D

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
// Click to select. When selected, click+drag to move on ground plane.

function DraggableElement3D({ el }: { el: CanvasElement }) {
  const { selectedId, selectElement, tool, moveElement, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const groupRef = useRef<THREE.Group>(null);
  const three = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());

  // Get orbit controls from R3F state (OrbitControls has makeDefault)
  const getControls = () => (three as any).controls as any;

  // During drag: raycast mouse onto ground plane and move element
  useFrame(() => {
    if (!isDragging) return;
    three.raycaster.setFromCamera(three.pointer, three.camera);
    const hit = new THREE.Vector3();
    three.raycaster.ray.intersectPlane(dragPlane.current, hit);
    if (hit) {
      const newX = hit.x * 50 + 700 - dragOffset.current.x;
      const newZ = hit.z * 50 + 350 - dragOffset.current.z;
      moveElement(el.id, Math.round(newX / 20) * 20, Math.round(newZ / 20) * 20);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (tool === "delete") {
      removeElement(el.id);
      return;
    }
    selectElement(el.id);
  };

  const handlePointerDown = (e: any) => {
    if (tool !== "select" && tool !== "move") return;
    if (!isSelected) return;
    e.stopPropagation();

    // Calculate drag offset so element doesn't jump to cursor
    three.raycaster.setFromCamera(three.pointer, three.camera);
    const hit = new THREE.Vector3();
    three.raycaster.ray.intersectPlane(dragPlane.current, hit);
    if (hit) {
      dragOffset.current.set(hit.x * 50 + 700 - el.x, 0, hit.z * 50 + 350 - el.y);
    }

    // Disable orbit controls so camera doesn't move while dragging
    const controls = getControls();
    if (controls) controls.enabled = false;

    setIsDragging(true);

    const handleUp = () => {
      setIsDragging(false);
      // Re-enable orbit controls
      if (controls) controls.enabled = true;
      // Save undo state
      const { elements, undoStack } = useCanvasStore.getState();
      useCanvasStore.setState({ undoStack: [...undoStack, elements], redoStack: [] });
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = isSelected ? "grab" : "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
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
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={50}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        panSpeed={1.5}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        screenSpacePanning={false}
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
  const { elements, addElement, setTool, setPlacingItem } = useCanvasStore();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/palette-item");
    if (!data) return;
    const item: PaletteItem = JSON.parse(data);
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normZ = (e.clientY - rect.top) / rect.height;
    addElement(item, normX * 1400, normZ * 700);
    setTool("select");
    setPlacingItem(null);
  }, [addElement, setTool, setPlacingItem]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  return (
    <div className="relative flex-1" onDrop={handleDrop} onDragOver={handleDragOver}>
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
          <span className="font-bold text-indigo-300">Left-drag</span> orbit · <span className="font-bold text-indigo-300">Right-drag</span> pan · <span className="font-bold text-indigo-300">Scroll</span> zoom · <span className="font-bold text-indigo-300">WASD</span> move · <span className="font-bold text-indigo-300">Q/E</span> up/down
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
