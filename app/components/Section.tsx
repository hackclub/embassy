interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  divider?: boolean;
}

export default function Section({
  title,
  description,
  children,
  action,
  className = "",
  divider = true,
}: SectionProps) {
  return (
    <section className={`mb-8 ${divider ? "pb-6 border-b border-govuk-grey-2" : ""} ${className}`}>
      <header className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mb-1 text-xl font-bold truncate">{title}</h2>
          {description && (
            <p className="max-w-2xl text-govuk-grey-4 text-sm">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0 mt-1 sm:mt-0">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}