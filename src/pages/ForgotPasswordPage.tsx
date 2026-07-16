import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { Loader2, MailCheck } from "lucide-react";

import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from "@shared/validation";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type ForgotPasswordResponse = { ok: boolean; message: string; resetLinkDevOnly?: string };

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordRequest) {
    setServerError(null);
    try {
      const data = await apiFetch<ForgotPasswordResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: values,
      });
      setResult(data);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (result) {
    return (
      <AuthLayout
        title="Check your email"
        description={result.message}
        footer={
          <Link to="/login" className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Back to login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
          <MailCheck className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
          {result.resetLinkDevOnly && (
            <div className="w-full border-t border-dashed border-accent/40 pt-3 text-left">
              <p className="text-xs font-medium uppercase tracking-wider text-accent-strong">Dev only — no email vendor configured</p>
              <Link
                to={result.resetLinkDevOnly.replace(window.location.origin, "")}
                className="mt-1 block truncate rounded-sm text-xs text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {result.resetLinkDevOnly}
              </Link>
            </div>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      description="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Back to login
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
