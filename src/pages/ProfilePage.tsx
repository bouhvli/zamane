import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoaderData, useNavigate } from "react-router";
import { Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { changePasswordFormSchema, type ChangePasswordFormValues } from "@shared/validation";
import { useAuth } from "@/lib/auth-context";
import type { Group } from "@/lib/groups-api";
import { updateProfile, changePassword } from "@/lib/profile-api";
import { ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const displayNameFormSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
});
type DisplayNameFormValues = z.infer<typeof displayNameFormSchema>;

export default function ProfilePage() {
  const { user, logout, refreshSession } = useAuth();
  const navigate = useNavigate();
  const { group } = useLoaderData() as { group: Group | null };
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const nameForm = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameFormSchema),
    defaultValues: { displayName: user?.displayName ?? "" },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  if (!user) return null;

  const members = group?.members ?? [];
  const partner = members.find((member) => member.id !== user.id);

  async function handleCopy() {
    if (!group) return;
    await navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    toast.success("Logged out");
    navigate("/login");
  }

  async function onSaveName(values: DisplayNameFormValues) {
    try {
      await updateProfile(values.displayName || undefined);
      await refreshSession();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function onChangePassword(values: ChangePasswordFormValues) {
    setPasswordError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed");
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader title={user.displayName || user.email.split("@")[0]} description={user.email} />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        <Card className="gap-0 p-4">
          <h2 className="mb-3 font-sans text-lg font-semibold text-foreground">Account</h2>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onSaveName)} className="space-y-4" noValidate>
              <FormField
                control={nameForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={nameForm.formState.isSubmitting}>
                {nameForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save name
              </Button>
            </form>
          </Form>
        </Card>

        {group && (
          <Card className="gap-0 p-4">
            <h2 className="mb-3 font-sans text-lg font-semibold text-foreground">Partner</h2>
            {partner ? (
              <p className="text-sm text-foreground">
                You and {partner.displayName || partner.email.split("@")[0]}
              </p>
            ) : (
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-foreground">Share this code with your partner</p>
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground">{group.inviteCode}</p>
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy code"}
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="gap-0 p-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <h2 className="font-sans text-lg font-semibold text-foreground">Change password</h2>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4" noValidate>
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {passwordError && (
                <p role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
                  <Button type="submit" className="w-full" disabled={passwordForm.formState.isSubmitting}>
                    {passwordForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Change password
                  </Button>
                </form>
              </Form>
            </div>
          </details>
        </Card>

        <Button variant="outline" className="w-full" onClick={handleLogout} disabled={loggingOut}>
          Log out
        </Button>
      </div>
    </div>
  );
}
