import { useCanvasStore } from "../../stores/canvasStore";
import { Trash2, Copy } from "lucide-react";

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="w-16 flex-shrink-0 text-[11px] text-gray-400">{label}</span>
      <div className="flex flex-1 items-center rounded bg-gray-800 border border-gray-700 overflow-hidden">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 bg-transparent px-2 py-1 text-[11px] text-white focus:outline-none min-w-0"
        />
        {suffix && <span className="pr-2 text-[10px] text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, readOnly }: { label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="w-16 flex-shrink-0 text-[11px] text-gray-400">{label}</span>
      {readOnly ? (
        <span className="flex-1 rounded bg-gray-800/50 border border-gray-700/50 px-2 py-1 text-[11px] text-gray-400 truncate">{value}</span>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 min-w-0"
        />
      )}
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="w-16 flex-shrink-0 text-[11px] text-gray-400">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${value ? "bg-indigo-600" : "bg-gray-700"}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span className="text-[10px] text-gray-500">{value ? "On" : "Off"}</span>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="w-16 flex-shrink-0 text-[11px] text-gray-400">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 rounded border border-gray-700 bg-transparent cursor-pointer"
        />
        <span className="text-[11px] text-gray-400 font-mono">{value}</span>
      </div>
    </div>
  );
}

export function PropertyInspector() {
  const { getSelected, updateElement, removeElement, duplicateElement } = useCanvasStore();
  const selected = getSelected();

  if (!selected) {
    return (
      <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-[300px] flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Properties</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-gray-600 text-[12px] gap-2">
          <span>Select an element to view properties</span>
        </div>
      </div>
    );
  }

  const update = (changes: Parameters<typeof updateElement>[1]) => updateElement(selected.id, changes);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-[300px] flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-semibold text-white truncate">{selected.label}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-500">{selected.type}</span>
            <span className="rounded bg-indigo-600/20 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-400 uppercase">{selected.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => duplicateElement(selected.id)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="Duplicate"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => removeElement(selected.id)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-600/20 hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <SectionLabel label="Transform" />
        <NumberField label="X" value={selected.x} onChange={(v) => update({ x: v })} />
        <NumberField label="Y" value={selected.y} onChange={(v) => update({ y: v })} />
        <NumberField label="Width" value={selected.width} onChange={(v) => update({ width: v })} />
        <NumberField label="Height" value={selected.height} onChange={(v) => update({ height: v })} />
        <NumberField label="Rotation" value={selected.rotation} onChange={(v) => update({ rotation: v })} suffix="°" />

        <SectionLabel label="Appearance" />
        <ColorField label="Color" value={selected.color} onChange={(v) => update({ color: v })} />
        <ToggleField label="Visible" value={selected.visible} onChange={(v) => update({ visible: v })} />
        <ToggleField label="Locked" value={selected.locked} onChange={(v) => update({ locked: v })} />

        <SectionLabel label="Info" />
        <TextField label="Label" value={selected.label} onChange={(v) => update({ label: v })} />
        <TextField label="Type" value={selected.type} readOnly />
        <div className="flex items-center gap-2 px-3 py-0.5">
          <span className="w-16 flex-shrink-0 text-[11px] text-gray-400">Category</span>
          <span className="rounded bg-indigo-600/20 px-2 py-1 text-[10px] font-semibold text-indigo-400 uppercase">{selected.category}</span>
        </div>
      </div>
    </div>
  );
}
