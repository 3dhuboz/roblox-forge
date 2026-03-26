// Fix @react-three/fiber v9 + React 19 JSX type conflict
// R3F overrides the global JSX namespace which breaks standard React element typing
// This file explicitly re-declares the extension to prevent type pollution
import type {} from "@react-three/fiber";

