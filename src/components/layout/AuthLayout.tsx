import type { ReactNode } from "react";

import { ZamaneLogo } from "@/components/ZamaneLogo";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 font-sans">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <ZamaneLogo size={0.5} />
        <div>
          <h1 className="font-heading text-3xl text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
