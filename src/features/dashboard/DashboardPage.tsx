import { useState } from "react";
import {
  BarChart3,
  Users,
  Coins,
  TrendingUp,
  Eye,
  Clock,
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  Gamepad2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

interface GameStat {
  id: string;
  name: string;
  visits: number;
  visitsDelta: number;
  activePlayers: number;
  favorites: number;
  favoritesDelta: number;
  likes: number;
  likesPercent: number;
  estimatedRobux: number;
  robuxDelta: number;
  lastUpdated: string;
}

const MOCK_GAMES: GameStat[] = [
  {
    id: "1",
    name: "Space Obby Adventure",
    visits: 12847,
    visitsDelta: 8.3,
    activePlayers: 23,
    favorites: 342,
    favoritesDelta: 12.1,
    likes: 87,
    likesPercent: 87,
    estimatedRobux: 4520,
    robuxDelta: 15.2,
    lastUpdated: "2 min ago",
  },
  {
    id: "2",
    name: "Lava Obby Challenge",
    visits: 5621,
    visitsDelta: -2.1,
    activePlayers: 8,
    favorites: 128,
    favoritesDelta: 3.4,
    likes: 72,
    likesPercent: 72,
    estimatedRobux: 1890,
    robuxDelta: -4.5,
    lastUpdated: "5 min ago",
  },
];

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta?: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} shadow-sm`}
        >
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-[13px] font-medium text-gray-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      {delta !== undefined && (
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {delta >= 0 ? (
            <>
              <ArrowUpRight size={14} className="text-green-400" />
              <span className="text-green-400">+{delta}%</span>
            </>
          ) : (
            <>
              <ArrowDownRight size={14} className="text-red-400" />
              <span className="text-red-400">{delta}%</span>
            </>
          )}
          <span className="text-gray-500">this week</span>
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-10 items-end gap-0.5">
      {data.map((val, i) => (
        <div
          key={i}
          className="w-2 rounded-t bg-indigo-500/70"
          style={{ height: `${(val / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { auth } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In real app these would come from Roblox API calls
  const games = auth ? MOCK_GAMES : [];
  const totalVisits = games.reduce((sum, g) => sum + g.visits, 0);
  const totalPlayers = games.reduce((sum, g) => sum + g.activePlayers, 0);
  const totalRobux = games.reduce((sum, g) => sum + g.estimatedRobux, 0);
  const totalFavorites = games.reduce((sum, g) => sum + g.favorites, 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  // Mock 7-day visit data
  const weeklyVisits = [820, 1050, 940, 1200, 1380, 1100, 1450];
  const weeklyRobux = [310, 420, 380, 510, 590, 460, 620];

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800/40 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">My Stats</h1>
            <p className="text-sm text-gray-400">See how your games are doing!</p>
          </div>
        </div>
        {auth && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-2 text-sm text-gray-300 hover:border-gray-600 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Updating..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!auth ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/60">
              <BarChart3 size={28} className="text-gray-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-300">
                See How Your Games Are Doing
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Log in to Roblox to see how many people are playing your games,
                how much Robux you've earned, and more!
              </p>
              <p className="mt-3 rounded-lg bg-gray-800/40 px-4 py-2 text-xs text-gray-500">
                Go to the Share tab and log in first
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Eye}
                label="Total Visits"
                value={totalVisits.toLocaleString()}
                delta={5.6}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <StatCard
                icon={Users}
                label="Playing Now"
                value={totalPlayers.toString()}
                color="bg-gradient-to-br from-green-500 to-green-600"
              />
              <StatCard
                icon={Coins}
                label="Robux Earned"
                value={`R$${totalRobux.toLocaleString()}`}
                delta={9.1}
                color="bg-gradient-to-br from-yellow-500 to-amber-600"
              />
              <StatCard
                icon={Heart}
                label="Favorites"
                value={totalFavorites.toLocaleString()}
                delta={7.8}
                color="bg-gradient-to-br from-purple-500 to-purple-600"
              />
            </div>

            {/* Weekly charts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-gray-300">
                    Visits This Week
                  </h3>
                  <TrendingUp size={16} className="text-green-400" />
                </div>
                <div className="mt-4">
                  <MiniBarChart data={weeklyVisits} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-gray-600">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-gray-300">
                    Robux This Week
                  </h3>
                  <Coins size={16} className="text-yellow-400" />
                </div>
                <div className="mt-4">
                  <MiniBarChart data={weeklyRobux} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-gray-600">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </div>

            {/* Per-game breakdown */}
            <div>
              <h3 className="mb-3 text-[13px] font-bold text-gray-300">
                Your Games
              </h3>
              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                          <Gamepad2 size={20} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{game.name}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock size={11} />
                            Updated {game.lastUpdated}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-yellow-400">
                          R${game.estimatedRobux.toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-xs">
                          {game.robuxDelta >= 0 ? (
                            <>
                              <ArrowUpRight
                                size={12}
                                className="text-green-400"
                              />
                              <span className="text-green-400">
                                +{game.robuxDelta}%
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight
                                size={12}
                                className="text-red-400"
                              />
                              <span className="text-red-400">
                                {game.robuxDelta}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Visits</p>
                        <p className="text-sm font-bold text-white">
                          {game.visits.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Playing</p>
                        <p className="text-sm font-bold text-white">
                          {game.activePlayers}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Favorites</p>
                        <p className="text-sm font-bold text-white">
                          {game.favorites}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Likes</p>
                        <p className="text-sm font-bold text-white">
                          {game.likesPercent}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="rounded-2xl border border-indigo-900/40 bg-indigo-950/20 p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h3 className="text-[13px] font-bold text-indigo-300">
                  Tips for You
                </h3>
              </div>
              <div className="mt-3 space-y-2.5 text-[13px] text-gray-300">
                <p>
                  "Space Obby Adventure" is getting more popular! Try adding
                  more stages to keep players coming back.
                </p>
                <p>
                  "Lava Obby Challenge" might be too hard for some players.
                  Adding checkpoints between stages 3 and 4 could help!
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">
              Stats update every 5 minutes. Robux numbers are estimates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
