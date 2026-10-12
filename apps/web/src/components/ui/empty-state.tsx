interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
}

/** Icon plus one sentence, the same empty state on every list (mobile's `components/ui/empty-state.tsx` is its twin). */
export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-text-secondary">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full border-2 border-text text-text [&_svg]:size-8"
      >
        {icon}
      </span>
      <p className="text-body-large">{message}</p>
    </div>
  );
}
