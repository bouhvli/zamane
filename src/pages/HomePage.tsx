import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { Check, Copy } from "lucide-react";
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { goals, summary, group } = useLoaderData() as {
    goals: Goal[];
    summary: GoalsSummary;
    group: Group | null;
  };
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    toast.success("Logged out");
    navigate("/login");
  }

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

  return (
    <div>
      <PageHero
        label="HOME"
        value={`Hi, ${greetName}`}
        description={partner ? `You and ${partner.displayName || partner.email.split("@")[0]}` : formattedDate}
        stats={[
          { label: "Active", value: String(summary.activeCount) },
          { label: "Saved this month", value: formatAmount(summary.totalSavedThisMonth) },
          { label: "Completed", value: String(summary.completedCount) },
        ]}
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {group && members.length < 2 && (
          <Card className="items-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-foreground">Share this code with your partner</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground">{group.inviteCode}</p>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </Card>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="font-heading text-lg text-foreground">Goals</p>
            <Button type="button" variant="link" size="sm" onClick={() => navigate("/goals")}>
              View all
            </Button>
          </div>
          {goals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No goals yet — start one together.
            </div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 2).map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={handleLogout} disabled={loggingOut}>
          Log out
        </Button>
      </div>
    </div>
  );
}
