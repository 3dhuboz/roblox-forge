export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  changes?: AiChange[];
}

export interface AiChange {
  type: string;
  description: string;
  path?: string;
  elementData?: {
    type: string;
    category: string;
    label: string;
    icon: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  };
}

export interface AiResponse {
  message: string;
  changes: AiChange[];
}

export type AiCommandType =
  | "add_stage"
  | "modify_script"
  | "set_property"
  | "add_part"
  | "remove_instance"
  | "update_config";

export interface AiCommand {
  type: AiCommandType;
  [key: string]: unknown;
}
