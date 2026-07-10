import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { Loader2, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { joinGroupRequestSchema, type JoinGroupRequest } from "@shared/validation";
import { useAuth } from "@/lib/auth-context";
import { createGroup, joinGroup, type Group } from "@/lib/groups-api";
import { ApiError } from "@/lib/api";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type Mode = "choice" | "create" | "join";

export default function OnboardingGroupPage() {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("choice");
  const [group, setGroup] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<JoinGroupRequest>({
    resolver: zodResolver(joinGroupRequestSchema),
    defaultValues: { inviteCode: "" },
  });

  async function handleCreate() {
    setCreating(true);
    setServerError(null);
    try {
      const { group } = await createGroup();
      setGroup(group);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!group) return;
    await navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleContinue() {
    await refreshSession();
    navigate("/home");
  }

  async function onJoinSubmit(values: JoinGroupRequest) {
    setServerError(null);
    try {
      await joinGroup(values.inviteCode);
      await refreshSession();
      toast.success("You're paired up");
      navigate("/home");
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (mode === "create") {
    return (
      <AuthLayout
        title="Create your group"
        description={group ? "Share this code with your partner." : "You'll get a code to invite your partner with."}
      >
        {group ? (
          <div className="flex flex-col items-center gap-4">
            <Card className="w-full items-center gap-2 p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invite code</p>
              <p className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground">{group.inviteCode}</p>
            </Card>
            <Button type="button" variant="outline" className="w-full" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy code"}
            </Button>
            <Button type="button" className="w-full" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
            <Button type="button" className="w-full" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-4 animate-spin" />}
              Create group
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choice")}>
              Back
            </Button>
          </div>
        )}
      </AuthLayout>
    );
  }

  if (mode === "join") {
    return (
      <AuthLayout title="Join your partner" description="Enter the invite code they shared with you.">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onJoinSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invite code</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      autoCapitalize="characters"
                      placeholder="ABC123"
                      className="text-center font-mono text-lg tracking-[0.2em] uppercase"
                      maxLength={6}
                      {...field}
                    />
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
              Join group
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("choice")}>
              Back
            </Button>
          </form>
        </Form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="You and your partner" description="Create a shared space, or join theirs with an invite code.">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMode("create")}
          className="rounded-lg border border-border bg-card p-4 text-left outline-none transition-colors hover:border-primary/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="font-heading text-lg text-foreground">Create a group</p>
          <p className="mt-1 text-sm text-muted-foreground">Start fresh and invite your partner with a code.</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className="rounded-lg border border-border bg-card p-4 text-left outline-none transition-colors hover:border-primary/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <p className="font-heading text-lg text-foreground">Join a group</p>
          <p className="mt-1 text-sm text-muted-foreground">Already got a code from your partner? Enter it here.</p>
        </button>
      </div>
    </AuthLayout>
  );
}
