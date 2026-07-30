export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3">
        <div className="w-24 h-5 bg-zinc-800 rounded animate-pulse" />
        <div className="flex-1" />
        <div className="w-8 h-8 bg-zinc-800 rounded-full animate-pulse" />
      </div>

      {/* Content area */}
      <div className="flex-1 p-4 space-y-3 max-w-2xl mx-auto w-full">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
