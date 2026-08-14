"use client";

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-10 text-text-secondary">
      <i className={`ti ${icon} text-4xl text-text-tertiary block mb-3`} aria-hidden="true" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
