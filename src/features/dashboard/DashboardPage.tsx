import { useState } from "react";
import {
  BarChart3,
  Users,
  Coins,
  TrendingUp,
  Eye,
  Clock,
  ThumbsUp,
  ArrowUpRight,
  ArrowDownRight,
  Gamepad2,
  RefreshCw,
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}
        >
          <Icon size={18} />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      {delta !== undefined && (
        <div className="mt-1 flex items-center gap-1 text-xs">
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
          <span className="text-gray-500">vs last week</span>
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Track your games' performance and earnings.
          </p>
        </div>
        {auth && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:border-gray-600 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!auth ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
            <BarChart3 size={48} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-300">
              Connect Your Roblox Account
            </h3>
            <p className="max-w-md text-center text-sm">
              Link your Roblox account to see real-time analytics for your
              published games — visits, active players, favorites, and estimated
              Robux earnings.
            </p>
            <p className="text-xs text-gray-500">
              Go to Publish → Connect Roblox Account
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                icon={Eye}
                label="Total Visits"
                value={totalVisits.toLocaleString()}
                delta={5.6}
                color="bg-blue-600"
              />
              <StatCard
                icon={Users}
                label="Active Players"
                value={totalPlayers.toString()}
                color="bg-green-600"
              />
              <StatCard
                icon={Coins}
                label="Est. Robux"
                value={`R$${totalRobux.toLocaleString()}`}
                delta={9.1}
                color="bg-yellow-600"
              />
              <StatCard
                icon={ThumbsUp}
                label="Favorites"
                value={totalFavorites.toLocaleString()}
                delta={7.8}
                color="bg-purple-600"
              />
            </div>

            {/* Weekly charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300">
                    Weekly Visits
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

              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300">
                    Weekly Robux
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
              <h3 className="mb-3 text-sm font-semibold text-gray-300">
                Your Games
              </h3>
              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                          <Gamepad2 size={20} />
                        </div>
                        <div>
                          <h4 className="font-semibold">{game.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
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

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      <div className="rounded-lg bg-gray-800 px-3 py-2">
                        <p className="text-xs text-gray-500">Visits</p>
                        <p className="text-sm font-semibold">
                          {game.visits.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-800 px-3 py-2">
                        <p className="text-xs text-gray-500">Playing</p>
                        <p className="text-sm font-semibold">
                          {game.activePlayers}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-800 px-3 py-2">
                        <p className="text-xs text-gray-500">Favorites</p>
                        <p className="text-sm font-semibold">
                          {game.favorites}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-800 px-3 py-2">
                        <p className="text-xs text-gray-500">Like %</p>
                        <p className="text-sm font-semibold">
                          {game.likesPercent}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-5">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-300">
                  AI Insights
                </h3>
              </div>
              <div className="mt-3 space-y-2 text-sm text-gray-300">
                <p>
                  Your "Space Obby Adventure" is trending up — visits increased
                  8.3% this week. Consider adding more stages to keep players
                  engaged longer.
                </p>
                <p>
                  "Lava Obby Challenge" saw a slight dip. The like ratio (72%)
                  suggests some players find it too difficult. Consider adding
                  checkpoints between stages 3 and 4.
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">
              Analytics data refreshes every 5 minutes. Robux earnings are
              estimates based on visit counts and game pass purchases.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
