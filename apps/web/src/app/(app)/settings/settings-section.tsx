interface SettingsSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/** One bordered card on the settings page (mobile's settings screen uses the same sections). */
export function SettingsSection({ id, title, children }: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      <h2 id={id} className="text-label font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
