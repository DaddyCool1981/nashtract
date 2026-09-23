"use client";

import { StoreProvider, useStore } from "@/lib/store";
import { AppShell } from "./AppShell";
import { CreateProjectForm } from "./CreateProjectForm";
import { Dashboard } from "./Dashboard";

function AppContent() {
  const { project } = useStore();
  return <AppShell>{project ? <Dashboard project={project} /> : <CreateProjectForm />}</AppShell>;
}

export function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
