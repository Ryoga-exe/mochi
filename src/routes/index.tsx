import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main>
      <h1>mochi</h1>
      <p>持ち物と、その居場所を管理する。</p>
    </main>
  );
}
