import Link from 'next/link';

interface AuthCardProps {
  title: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
}

/** The login/register card: brand, title, form, and a footer card linking to the other screen. */
export function AuthCard({
  title,
  children,
  footerText,
  footerLinkText,
  footerHref,
}: AuthCardProps) {
  return (
    <main className="flex w-full max-w-auth-card flex-col gap-3">
      <section className="flex flex-col gap-6 rounded-lg border border-border bg-background px-8 py-10">
        <p className="text-center text-headline font-semibold">
          Instagram Clone
        </p>
        <h1 className="text-center text-body-large font-semibold text-text-secondary">
          {title}
        </h1>
        {children}
      </section>
      <p className="rounded-lg border border-border bg-background px-8 py-5 text-center">
        {footerText}{' '}
        <Link
          href={footerHref}
          className="font-semibold text-primary hover:underline"
        >
          {footerLinkText}
        </Link>
      </p>
    </main>
  );
}
