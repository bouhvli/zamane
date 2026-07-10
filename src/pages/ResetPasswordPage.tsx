import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@shared/validation";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { token, newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token: values.token, newPassword: values.newPassword },
      });
      toast.success("Password updated — please log in");
      navigate("/login");
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        description="This password reset link is missing its token."
        footer={
          <Link
            to="/forgot-password"
            className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-center text-sm text-muted-foreground">
          Make sure you used the full link from the email, or request a new one.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" description="Make it something you'll remember.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
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
            Reset password
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
