/**
 * Generates a downloadable ZIP file containing a complete Rojo project.
 * This is the REAL output of the browser version — not a fake build.
 *
 * The ZIP can be extracted and built with: rojo build default.project.json -o game.rbxl
 * Then opened in Roblox Studio for testing/publishing.
 */

import JSZip from "jszip";
import type { CanvasElement } from "../stores/canvasStore";
import { serializeCanvasToModelJson, generateTerrainScript } from "./canvasSerializer";
import { generateAllBehaviorScripts } from "./behaviorScriptGen";
import { generateRojoProject } from "./rojoProjectGen";
import { getTemplateScripts } from "./templateScripts";
import { compileGraphToLuau } from "./luauCodeGen";

interface ExportOptions {
  gameName: string;
  template: string;
  elements: CanvasElement[];
  visualScriptGraphs?: Array<{
    name: string;
    nodes: unknown[];
    edges: unknown[];
  }>;
}

export async function exportProjectZip(options: ExportOptions): Promise<Blob> {
  const { gameName, template, elements, visualScriptGraphs } = options;
  const zip = new JSZip();

  // 1. default.project.json — the Rojo manifest
  zip.file("default.project.json", generateRojoProject(gameName));

  // 2. workspace/CanvasWorld.model.json — all placed parts
  if (elements.length > 0) {
    const modelJson = serializeCanvasToModelJson(elements);
    zip.file("workspace/CanvasWorld.model.json", modelJson);
  }

  // 3. Template scripts — the production game logic
  const templateScripts = getTemplateScripts(template);
  for (const script of templateScripts) {
    zip.file(script.relativePath, script.content);
  }

  // 4. Generated behavior scripts — from canvas element properties
  const behaviorScripts = generateAllBehaviorScripts(elements, template);
  for (const script of behaviorScripts) {
    zip.file(script.path, script.content);
  }

  // 5. Terrain fill script
  const terrainScript = generateTerrainScript(elements);
  if (terrainScript) {
    zip.file("src/server/TerrainFill.server.luau", terrainScript);
  }

  // 6. Compiled visual scripts
  if (visualScriptGraphs && visualScriptGraphs.length > 0) {
    for (const graph of visualScriptGraphs) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const luau = compileGraphToLuau(graph.nodes as any, graph.edges as any, graph.name);
        if (luau.trim()) {
          zip.file(`src/server/VisualScripts/${graph.name}.server.luau`, luau);
        }
      } catch (e) {
        console.warn(`Failed to compile visual script "${graph.name}":`, e);
      }
    }
  }

  // 7. README with instructions
  zip.file("README.txt", `${gameName} — Built with RobloxForge
================================================

This is a Rojo project. To build and play your game:

1. Install Rojo (if you haven't already):
   https://rojo.space/docs/v7/getting-started/installation/

2. Open a terminal in this folder and run:
   rojo build default.project.json -o game.rbxl

3. Open game.rbxl in Roblox Studio

4. Click Play to test your game!

5. When ready, publish from Studio: File > Publish to Roblox

================================================
Project structure:
  default.project.json  — Rojo project manifest
  workspace/            — 3D parts and models
  src/server/           — Server scripts (game logic)
  src/client/           — Client scripts (UI/HUD)
  src/shared/           — Shared modules (config, utilities)
`);

  // Generate the ZIP blob
  return zip.generateAsync({ type: "blob" });
}

/**
 * Triggers a browser download of the ZIP file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
