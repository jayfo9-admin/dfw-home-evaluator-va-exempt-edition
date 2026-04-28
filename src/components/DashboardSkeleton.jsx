export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3">
            <div className="h-3 w-16 bg-muted rounded mb-2" />
            <div className="h-8 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-7 w-32 bg-muted rounded mb-1" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-40 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
      </div>
      {/* Rows */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 4 ? "border-b border-border" : ""}`}>
            <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-muted rounded mb-1.5" />
              <div className="h-3 w-72 bg-muted rounded" />
            </div>
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}