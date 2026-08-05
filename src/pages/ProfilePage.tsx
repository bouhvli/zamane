import { useState } from "react";
import type { ComponentType } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoaderData, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { Check, ChevronDown, Copy, Loader2, LogOut, Monitor, Moon, ShieldCheck, Sun, SunMoon, User, Users } from "lucide-react";
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
import { cn } from "@/components/ui/utils";

const displayNameFormSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
});
type DisplayNameFormValues = z.infer<typeof displayNameFormSchema>;

/** First+last initial from a name, falling back gracefully — for avatars. */
function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

// A consistent settings-group heading: an icon tile + title + one-line
// description. Repeating the same treatment for every section lets the eye
// scan the page as a list of like things (Gestalt similarity) and labels the
// icons rather than leaving them to guess (Refactoring UI: supercharge + label).
function SectionHeading({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <h2 className="font-sans text-base font-semibold leading-tight text-foreground">{title}</h2>
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

// A three-way segmented control rather than a plain on/off switch — the app
// already defaults new sessions to "system" (main.tsx), so a binary toggle
// would have nowhere to represent that state and would force a light/dark
// pick on everyone who never asked for one.
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const active = theme ?? "system";

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex w-full gap-1 rounded-full bg-muted p-1">
      {THEME_OPTIONS.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isActive
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(26,15,20,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const displayName = user.displayName || user.email.split("@")[0];
  const partnerName = partner ? partner.displayName || partner.email.split("@")[0] : null;

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
      nameForm.reset({ displayName: values.displayName ?? "" });
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
      <PageHeader title="Profile" />

      <div className="mx-auto max-w-md space-y-5 px-4 pb-12">
        {/* Identity — the "who am I" anchor. Leading with it gives the page a
            calm, personal peak before the settings work begins (Peak-End). */}
        <Card className="gap-0 p-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {group && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  partner ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Users className="size-3.5" />
                {partner ? `Connected with ${partnerName}` : "Waiting for your partner"}
              </span>
            </div>
          )}
        </Card>

        {/* Account */}
        <Card className="gap-0 p-5">
          <SectionHeading icon={User} title="Account" description="Your name as your partner sees it" />
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onSaveName)} className="mt-4 space-y-4" noValidate>
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
              {/* Disabled until the name actually changes — no-op saves are
                  friction, not a feature (constraints / design for error). */}
              <Button
                type="submit"
                className="w-full"
                disabled={nameForm.formState.isSubmitting || !nameForm.formState.isDirty}
              >
                {nameForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </form>
          </Form>
        </Card>

        {/* Appearance */}
        <Card className="gap-0 p-5">
          <SectionHeading icon={SunMoon} title="Appearance" description="Light, dark, or match your device" />
          <div className="mt-4">
            <ThemeSwitch />
          </div>
        </Card>

        {/* Partner / connection */}
        {group && (
          <Card className="gap-0 p-5">
            <SectionHeading
              icon={Users}
              title="Partner"
              description={partner ? "Your shared space" : "Invite someone to share with"}
            />
            <div className="mt-4">
              {partner ? (
                <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                  >
                    {initials(partnerName!)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{partnerName}</p>
                    <p className="truncate text-sm text-muted-foreground">{partner.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share this code so your partner can join your shared space.
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <span className="font-mono text-xl font-bold tracking-[0.2em] text-foreground">
                      {group.inviteCode}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Security — collapsed by default; most visits never need it, so it
            stays out of the way until asked for (progressive disclosure). */}
        <Card className="gap-0 p-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <SectionHeading
                icon={ShieldCheck}
                title="Security"
                description="Change your password"
                className="flex-1"
              />
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
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

        {/* Sign out — a terminal action, so it lives at the end, set apart, and
            tinted with the destructive hue so it never gets hit by accident. */}
        <Button
          variant="outline"
          className="mt-1 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Log out
        </Button>

        <p className="pt-1 text-center text-xs text-muted-foreground">Zamane</p>
      </div>
    </div>
  );
}
