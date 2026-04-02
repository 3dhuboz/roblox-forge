import { useState, useEffect } from "react";
import { Coins, Plus, Trash2, Sparkles, ShoppingCart, DollarSign, ChevronDown, ChevronRight, Save, Loader2, Check } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToastStore } from "../../stores/toastStore";
import {
  type MonetizationConfig,
  type GamePassDefinition,
  type DevProductDefinition,
  type CurrencyConfig,
  getDefaultMonetizationConfig,
  generateMonetizationScript,
} from "../../lib/monetization";
import { projectCommands } from "../../services/tauriCommands";

export function MonetizationPanel({ projectPath }: { projectPath: string }) {
  const { project } = useProjectStore();
  const template = project?.template || "obby";
  const [config, setConfig] = useState<MonetizationConfig>(() => getDefaultMonetizationConfig(template));
  const [expandedSection, setExpandedSection] = useState<"passes" | "products" | "currency" | null>("passes");
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  useEffect(() => {
    setConfig(getDefaultMonetizationConfig(template));
  }, [template]);

  const toggleSection = (s: "passes" | "products" | "currency") => {
    setExpandedSection(expandedSection === s ? null : s);
  };

  // GamePass CRUD
  const addGamePass = () => {
    setConfig((c) => ({
      ...c,
      gamePasses: [...c.gamePasses, { id: 0, name: "New Pass", price: 99, description: "", benefits: [] }],
    }));
  };

  const updateGamePass = (index: number, updates: Partial<GamePassDefinition>) => {
    setConfig((c) => ({
      ...c,
      gamePasses: c.gamePasses.map((gp, i) => (i === index ? { ...gp, ...updates } : gp)),
    }));
  };

  const removeGamePass = (index: number) => {
    setConfig((c) => ({
      ...c,
      gamePasses: c.gamePasses.filter((_, i) => i !== index),
    }));
  };

  // DevProduct CRUD
  const addDevProduct = () => {
    setConfig((c) => ({
      ...c,
      devProducts: [...c.devProducts, { id: 0, name: "New Product", price: 25, description: "", action: "give_coins" as const, actionValue: 100 }],
    }));
  };

  const updateDevProduct = (index: number, updates: Partial<DevProductDefinition>) => {
    setConfig((c) => ({
      ...c,
      devProducts: c.devProducts.map((dp, i) => (i === index ? { ...dp, ...updates } : dp)),
    }));
  };

  const removeDevProduct = (index: number) => {
    setConfig((c) => ({
      ...c,
      devProducts: c.devProducts.filter((_, i) => i !== index),
    }));
  };

  // Currency CRUD
  const addCurrency = () => {
    setConfig((c) => ({
      ...c,
      currencies: [...c.currencies, { name: "NewCurrency", startingAmount: 0, icon: "coin" }],
    }));
  };

  const updateCurrency = (index: number, updates: Partial<CurrencyConfig>) => {
    setConfig((c) => ({
      ...c,
      currencies: c.currencies.map((cu, i) => (i === index ? { ...cu, ...updates } : cu)),
    }));
  };

  const removeCurrency = (index: number) => {
    if (config.currencies.length <= 1) return;
    setConfig((c) => ({
      ...c,
      currencies: c.currencies.filter((_, i) => i !== index),
    }));
  };

  const handleGenerateScript = async () => {
    setIsSaving(true);
    try {
      const script = generateMonetizationScript(config);
      await projectCommands.writeFile(
        projectPath,
        "src/server/MonetizationHandler.server.luau",
        script,
      );
      // Also save config as JSON for persistence
      await projectCommands.writeFile(
        projectPath,
        "monetization.json",
        JSON.stringify(config, null, 2),
      );
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 3000);
      useToastStore.getState().addToast("success", "Monetization script generated!");
    } catch (e) {
      useToastStore.getState().addToast("error", `Failed to generate: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-[380px] border-l border-gray-800/40 bg-gray-950 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/40">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-green-400" />
          <span className="text-[12px] font-bold text-white">Monetization</span>
        </div>
        <button
          onClick={handleGenerateScript}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-green-600/20 px-2.5 py-1 text-[10px] font-semibold text-green-300 hover:bg-green-600/30 disabled:opacity-40"
        >
          {isSaving ? <Loader2 size={11} className="animate-spin" /> : savedRecently ? <Check size={11} /> : <Save size={11} />}
          {isSaving ? "Generating..." : savedRecently ? "Saved!" : "Generate Script"}
        </button>
      </div>

      {/* Info banner */}
      <div className="mx-3 mt-2 rounded-lg bg-indigo-900/20 border border-indigo-700/30 px-3 py-2">
        <p className="text-[10px] text-indigo-300 leading-relaxed">
          Configure your game's economy. Set up GamePasses and Developer Products, then generate the server script.
          You'll need to create the actual passes on the <span className="font-semibold">Roblox Creator Hub</span> and update the IDs here.
        </p>
      </div>

      {/* Currencies Section */}
      <div className="mt-3">
        <button onClick={() => toggleSection("currency")} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800/40">
          {expandedSection === "currency" ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
          <Coins size={13} className="text-yellow-400" />
          <span className="text-[11px] font-semibold text-white">Currencies</span>
          <span className="text-[10px] text-gray-500">({config.currencies.length})</span>
        </button>

        {expandedSection === "currency" && (
          <div className="px-3 pb-2 space-y-2">
            {config.currencies.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-900/60 px-2.5 py-2">
                <input
                  value={c.name}
                  onChange={(e) => updateCurrency(i, { name: e.target.value })}
                  className="flex-1 bg-transparent text-[11px] text-white outline-none border-b border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                  placeholder="Name"
                />
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">Start:</span>
                  <input
                    type="number"
                    value={c.startingAmount}
                    onChange={(e) => updateCurrency(i, { startingAmount: Number(e.target.value) })}
                    className="w-14 bg-gray-800 rounded text-[11px] text-white text-center outline-none border border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                  />
                </div>
                <button onClick={() => removeCurrency(i)} disabled={config.currencies.length <= 1} className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-20">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <button onClick={addCurrency} className="flex items-center gap-1.5 w-full justify-center rounded-lg border border-dashed border-gray-700 py-1.5 text-[10px] text-gray-400 hover:border-yellow-600 hover:text-yellow-400">
              <Plus size={11} /> Add Currency
            </button>
          </div>
        )}
      </div>

      {/* GamePasses Section */}
      <div>
        <button onClick={() => toggleSection("passes")} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800/40">
          {expandedSection === "passes" ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
          <Sparkles size={13} className="text-purple-400" />
          <span className="text-[11px] font-semibold text-white">GamePasses</span>
          <span className="text-[10px] text-gray-500">({config.gamePasses.length})</span>
        </button>

        {expandedSection === "passes" && (
          <div className="px-3 pb-2 space-y-2">
            {config.gamePasses.map((gp, i) => (
              <div key={i} className="rounded-lg bg-gray-900/60 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={gp.name}
                    onChange={(e) => updateGamePass(i, { name: e.target.value })}
                    className="flex-1 bg-transparent text-[11px] font-semibold text-white outline-none border-b border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                    placeholder="Pass name"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-green-400">R$</span>
                    <input
                      type="number"
                      value={gp.price}
                      onChange={(e) => updateGamePass(i, { price: Number(e.target.value) })}
                      className="w-12 bg-gray-800 rounded text-[11px] text-white text-center outline-none border border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                    />
                  </div>
                  <button onClick={() => removeGamePass(i)} className="p-1 text-gray-600 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
                <input
                  value={gp.description}
                  onChange={(e) => updateGamePass(i, { description: e.target.value })}
                  className="w-full bg-transparent text-[10px] text-gray-400 outline-none border-b border-gray-800 focus:border-indigo-500 px-1 py-0.5"
                  placeholder="Description..."
                />
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">ID:</span>
                  <input
                    type="number"
                    value={gp.id}
                    onChange={(e) => updateGamePass(i, { id: Number(e.target.value) })}
                    className="w-20 bg-gray-800 rounded text-[10px] text-gray-300 outline-none border border-gray-700 focus:border-indigo-500 px-1.5 py-0.5"
                    placeholder="From Creator Hub"
                  />
                  {gp.id === 0 && <span className="text-[9px] text-orange-400">Set real ID after creating on Creator Hub</span>}
                </div>
              </div>
            ))}
            <button onClick={addGamePass} className="flex items-center gap-1.5 w-full justify-center rounded-lg border border-dashed border-gray-700 py-1.5 text-[10px] text-gray-400 hover:border-purple-600 hover:text-purple-400">
              <Plus size={11} /> Add GamePass
            </button>
          </div>
        )}
      </div>

      {/* Developer Products Section */}
      <div>
        <button onClick={() => toggleSection("products")} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800/40">
          {expandedSection === "products" ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
          <ShoppingCart size={13} className="text-blue-400" />
          <span className="text-[11px] font-semibold text-white">Developer Products</span>
          <span className="text-[10px] text-gray-500">({config.devProducts.length})</span>
        </button>

        {expandedSection === "products" && (
          <div className="px-3 pb-2 space-y-2">
            {config.devProducts.map((dp, i) => (
              <div key={i} className="rounded-lg bg-gray-900/60 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={dp.name}
                    onChange={(e) => updateDevProduct(i, { name: e.target.value })}
                    className="flex-1 bg-transparent text-[11px] font-semibold text-white outline-none border-b border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                    placeholder="Product name"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-green-400">R$</span>
                    <input
                      type="number"
                      value={dp.price}
                      onChange={(e) => updateDevProduct(i, { price: Number(e.target.value) })}
                      className="w-12 bg-gray-800 rounded text-[11px] text-white text-center outline-none border border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                    />
                  </div>
                  <button onClick={() => removeDevProduct(i)} className="p-1 text-gray-600 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={dp.action}
                    onChange={(e) => updateDevProduct(i, { action: e.target.value as DevProductDefinition["action"] })}
                    className="flex-1 bg-gray-800 rounded text-[10px] text-gray-300 outline-none border border-gray-700 focus:border-indigo-500 px-1.5 py-1"
                  >
                    <option value="give_coins">Give Currency</option>
                    <option value="double_xp">Double XP</option>
                    <option value="extra_life">Extra Life</option>
                    <option value="speed_boost">Speed Boost</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-500">Value:</span>
                    <input
                      type="number"
                      value={dp.actionValue}
                      onChange={(e) => updateDevProduct(i, { actionValue: Number(e.target.value) })}
                      className="w-14 bg-gray-800 rounded text-[10px] text-white text-center outline-none border border-gray-700 focus:border-indigo-500 px-1 py-0.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-500">ID:</span>
                  <input
                    type="number"
                    value={dp.id}
                    onChange={(e) => updateDevProduct(i, { id: Number(e.target.value) })}
                    className="w-20 bg-gray-800 rounded text-[10px] text-gray-300 outline-none border border-gray-700 focus:border-indigo-500 px-1.5 py-0.5"
                    placeholder="From Creator Hub"
                  />
                  {dp.id === 0 && <span className="text-[9px] text-orange-400">Set real ID after creating on Creator Hub</span>}
                </div>
              </div>
            ))}
            <button onClick={addDevProduct} className="flex items-center gap-1.5 w-full justify-center rounded-lg border border-dashed border-gray-700 py-1.5 text-[10px] text-gray-400 hover:border-blue-600 hover:text-blue-400">
              <Plus size={11} /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}
