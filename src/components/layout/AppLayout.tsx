import { Outlet } from "react-router";

import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="pb-bottom-nav">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
