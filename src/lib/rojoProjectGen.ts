/**
 * Generates a valid Rojo default.project.json from the current project state.
 * Uses $path directory references so Rojo auto-discovers all scripts.
 */

export function generateRojoProject(gameName: string): string {
  const project = {
    name: gameName,
    tree: {
      $className: "DataModel",
      Workspace: {
        $className: "Workspace",
        $path: "workspace",
      },
      ServerScriptService: {
        $className: "ServerScriptService",
        $path: "src/server",
      },
      StarterPlayer: {
        $className: "StarterPlayer",
        StarterPlayerScripts: {
          $className: "StarterPlayerScripts",
          $path: "src/client",
        },
      },
      ReplicatedStorage: {
        $className: "ReplicatedStorage",
        $path: "src/shared",
      },
      Lighting: {
        $className: "Lighting",
        $properties: {
          Ambient: [0.5, 0.5, 0.5],
          Brightness: 2,
          ClockTime: 14,
          FogEnd: 10000,
        },
      },
      SoundService: {
        $className: "SoundService",
      },
    },
  };

  return JSON.stringify(project, null, 2);
}
