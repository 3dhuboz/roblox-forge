interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-800/60 ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900/60 p-5 ${className}`}>
      <Skeleton className="h-12 w-12 rounded-lg" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <SkeletonText lines={2} className="mt-3" />
    </div>
  );
}

export function SkeletonChatMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`mb-4 flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className={`max-w-[70%] ${isUser ? "text-right" : ""}`}>
        <Skeleton className={`h-16 rounded-xl ${isUser ? "w-48" : "w-64"}`} />
      </div>
    </div>
  );
}

export function SkeletonStageCard() {
  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/50">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mx-3 my-3 h-[180px] rounded-lg" />
      <div className="flex gap-1 px-3 pb-3">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
    </div>
  );
}
