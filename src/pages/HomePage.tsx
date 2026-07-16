import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { Check, Copy, Heart, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import type { Goal, GoalsSummary } from "@/lib/goals-api";
import type { Group } from "@/lib/groups-api";
import { formatAmount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/layout/PageHero";
import { GoalCard } from "@/components/goals/GoalCard";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { goals, summary, group } = useLoaderData() as {
    goals: Goal[];
    summary: GoalsSummary;
    group: Group | null;
  };
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!group) return;
    await navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) return null;

  const members = group?.members ?? [];
  const partner = members.find((member) => member.id !== user.id);
  const greetName = user.displayName || user.email.split("@")[0];
  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  // A brand-new couple has nothing to summarize yet — three "0" stat chips
  // teach nothing and read as filler, so the row is dropped entirely rather
  // than shown empty. The Goals section's CTA card below carries the
  // "here's what to do next" job instead.
  const isBrandNew = goals.length === 0;

  return (
    <div>
      <PageHero
        label="HOME"
        value={`Hi, ${greetName}`}
        description={partner ? `You and ${partner.displayName || partner.email.split("@")[0]}` : formattedDate}
        stats={
          isBrandNew
            ? undefined
            : [
                { label: "Active", value: String(summary.activeCount) },
                { label: "Saved this month", value: formatAmount(summary.totalSavedThisMonth) },
                { label: "Completed", value: String(summary.completedCount) },
              ]
        }
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {group && members.length < 2 && (
          <Card className="relative gap-3 overflow-hidden p-6 text-center">
            <div className="pointer-events-none absolute -top-12 right-0 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex flex-col items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Heart className="size-5" fill="currentColor" />
              </span>
              <p className="text-sm font-medium text-foreground">Share this code with your partner</p>
              <p className="w-full rounded-lg bg-muted/60 px-4 py-3 font-mono text-2xl font-bold tracking-[0.25em] text-foreground">
                {group.inviteCode}
              </p>
              <p className="text-xs text-muted-foreground">Use this to connect your partner's account to yours.</p>
              <Button type="button" className="w-full" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
          </Card>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-lg font-semibold text-foreground">Goals</p>
            <Button type="button" variant="link" size="sm" onClick={() => navigate("/goals")}>
              View all
            </Button>
          </div>
          {goals.length === 0 ? (
            <div className="space-y-1.5">
              <p className="px-1 text-sm text-muted-foreground">No goals yet</p>
              <Link
                to="/goals/new"
                className="group flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-card p-4 transition-[color,background-color,border-color,transform] active:scale-[0.98] hover:border-primary hover:bg-primary/5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="size-5" />
                </span>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground">Create your first goal together</span>
                  <span className="text-xs text-muted-foreground">Start saving toward something as a team</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 2).map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
