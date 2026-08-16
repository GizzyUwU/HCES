import { Match, Switch } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { useAuth } from "@/authGuard";
import { useNavigate } from "@solidjs/router";

function Admin() {
  const nav = useNavigate()
  const { ready, user } = useAuth();
  const querySlackInfo = createQuery(() => ({
    queryKey: ["slackInfo"],
    enabled: ready() && !!user()?.slackId?.length,
    queryFn: async () =>
      fetch("https://cachet.dunkirk.sh/users/" + user()!.slackId).then((res) =>
        res.json(),
      ),
  }));

  return (
    <div class="bg-dark h-screen text-white overflow-y-hidden">
      <main class="hc-container mt-4 h-screen text-white">
        <Switch>
          <Match when={!user()?.slackId?.length}>
            <h1 class="hc-text-heading text-2">Hai admin!</h1>
            <h2 class="hc-text-heading text-1">What can I do for you today?</h2>
          </Match>
          <Match when={querySlackInfo.isPending}>Loading...</Match>
          <Match when={querySlackInfo.isError}>
            Error: {querySlackInfo.error!.message}
          </Match>
          <Match when={querySlackInfo.isSuccess}>
            <h1 class="hc-text-heading text-3">
              Hai {querySlackInfo.data!.displayName}!
            </h1>
            <h2 class="text-2 text-white/70">What can I do for you today?</h2>
          </Match>
        </Switch>
        <div class="flex flex-wrap gap-2 mt-2">
          <button
            class="button hc-btn-primary disabled:opacity-40 disabled:cursor-not-allowed gap-4"
            onClick={() => nav("/admin/workers")}
            title="Workers"
          >
            Workers
          </button>
        </div>
      </main>
    </div>
  );
}

export default Admin;
