/*
  ORIGINAL PATH: src/components/customer-shell/TransactionSkeleton.tsx
*/
export function TransactionListSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 bg-white border border-line rounded-card" />
      ))}
    </div>
  );
}