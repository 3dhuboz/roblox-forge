/**
 * Shared custom node components for the visual script editor.
 * Three variants: TriggerNode (green), ActionNode (blue), LogicNode (orange).
 * Each renders ports, a label, and inline value editors.
 */

import { memo, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { NODE_TYPES } from "../../../lib/nodeTypes";
import type { PortType } from "../../../lib/nodeTypes";
import { useVisualScriptStore } from "../../../stores/visualScriptStore";

interface NodeData {
  nodeType: string;
  values: Record<string, string | number | boolean>;
}

const PORT_COLORS: Record<PortType, string> = {
  signal: "#a3a3a3",
  player: "#22c55e",
  part: "#3b82f6",
  number: "#f59e0b",
  string: "#ec4899",
  bool: "#a855f7",
};

const CATEGORY_STYLES = {
  trigger: {
    border: "border-green-500/50",
    header: "bg-green-600",
    headerText: "text-white",
  },
  action: {
    border: "border-blue-500/50",
    header: "bg-blue-600",
    headerText: "text-white",
  },
  logic: {
    border: "border-orange-500/50",
    header: "bg-orange-600",
    headerText: "text-white",
  },
};

function BaseScriptNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const typeDef = NODE_TYPES[nodeData.nodeType];
  const updateNodeValue = useVisualScriptStore((s) => s.updateNodeValue);

  const style = CATEGORY_STYLES[typeDef?.category ?? "action"];

  const handleValueChange = useCallback(
    (inputId: string, value: string | number | boolean) => {
      updateNodeValue(id, inputId, value);
    },
    [id, updateNodeValue],
  );

  if (!typeDef) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-950 p-3 text-xs text-red-300">
        Unknown node: {nodeData.nodeType}
      </div>
    );
  }

  const nonSignalInputs = typeDef.inputs.filter((p) => p.type !== "signal");
  const signalInput = typeDef.inputs.find((p) => p.type === "signal");

  return (
    <div
      className={`min-w-[160px] rounded-lg border ${style.border} bg-gray-900 shadow-lg ${
        selected ? "ring-2 ring-white/30" : ""
      }`}
    >
      {/* Header */}
      <div className={`rounded-t-lg px-3 py-1.5 ${style.header}`}>
        <p className={`text-[11px] font-bold ${style.headerText}`}>
          {typeDef.label}
        </p>
      </div>

      {/* Body */}
      <div className="relative px-3 py-2">
        {/* Signal input handle (left) */}
        {signalInput && (
          <Handle
            type="target"
            position={Position.Left}
            id="signal"
            style={{
              background: PORT_COLORS.signal,
              width: 10,
              height: 10,
              top: 8,
            }}
          />
        )}

        {/* Data input ports with inline editors */}
        {nonSignalInputs.map((port) => {
          const val = nodeData.values?.[port.id] ?? port.defaultValue ?? "";
          return (
            <div key={port.id} className="relative mb-1.5 flex items-center gap-2">
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{
                  background: PORT_COLORS[port.type],
                  width: 8,
                  height: 8,
                  left: -4,
                }}
              />
              <span className="text-[10px] text-gray-400 w-12 shrink-0">
                {port.label}
              </span>
              {port.type === "number" ? (
                <input
                  type="number"
                  value={val as number}
                  onChange={(e) =>
                    handleValueChange(port.id, parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : port.type === "bool" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleValueChange(port.id, !val);
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    val ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {val ? "true" : "false"}
                </button>
              ) : (
                <input
                  type="text"
                  value={val as string}
                  onChange={(e) => handleValueChange(port.id, e.target.value)}
                  className="w-full rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          );
        })}

        {/* Output ports (right side) */}
        {typeDef.outputs.map((port, i) => (
          <div
            key={port.id}
            className="relative flex items-center justify-end mb-1"
          >
            <span className="text-[10px] text-gray-500 mr-1">{port.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              style={{
                background: PORT_COLORS[port.type],
                width: 8,
                height: 8,
                right: -4,
                top: "auto",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TriggerNode = memo(BaseScriptNode);
export const ActionNode = memo(BaseScriptNode);
export const LogicNode = memo(BaseScriptNode);
