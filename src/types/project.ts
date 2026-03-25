export interface ProjectInfo {
  name: string;
  path: string;
  template: string;
  createdAt: string;
}

export interface InstanceNode {
  className: string;
  name: string;
  properties: Record<string, unknown>;
  children: InstanceNode[];
  tags?: string[];
  scriptSource?: string;
}

export interface ProjectState {
  name: string;
  path: string;
  template: string;
  hierarchy: InstanceNode;
  scripts: ScriptFile[];
  stageCount: number;
}

export interface ScriptFile {
  relativePath: string;
  name: string;
  scriptType: "server" | "client" | "module";
  content: string;
}
