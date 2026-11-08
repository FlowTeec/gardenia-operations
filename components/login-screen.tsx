import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
import { APPLICATION_NAME } from "@/lib/brand";

export function LoginScreen({ ready }: { ready: boolean }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex min-h-14 items-center gap-3 border-t-2 border-b border-t-brand bg-card px-4 py-2 sm:px-8">
          <BrandLogo height={40} />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-snug tracking-tight sm:text-base">{APPLICATION_NAME}</h1>
            <p className="text-xs text-muted-foreground">Al Ain South Storage Facility</p>
          </div>
      </header>
      <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="flex flex-col justify-between gap-8 border-b px-6 py-10 sm:px-10 lg:border-r lg:border-b-0 lg:px-14">
          <div className="flex max-w-xl flex-col gap-4">
            <p className="text-sm font-medium text-muted-foreground">Internal company system</p>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Team leaders request materials. Supervisors and the operation manager approve
              them. The store prepares approved requests and issues them from stock.
            </p>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
            <LoginForm ready={ready} />
          </div>
        </section>
      </main>
    </div>
  );
}
