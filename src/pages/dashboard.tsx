import { For, onMount, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { A, useNavigate } from "@solidjs/router";
import server from "../backend";
import { useQueryClient } from "@tanstack/solid-query";
import logo from "@/public/hces.webp";
import { useToast } from "@/app";

function Dashboard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  onMount(async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ["sessionCheck"],
      queryFn: async () => {
        const result = await server.api.v1.web.login.sessionCheck.get();
        if (!result.data)
          return toast("Failed to pass session check due to server error.");
        return result.data;
      },
    });
    if (!data || !data.ok) return nav("/");
  });

  const queryKeys = createQuery(() => ({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const result = await server.api.v1.web.apiKeys.get();
      if (!result.data) return toast("Failed to query for API Keys");
      return result.data;
    },
  }));

  return (
    <div class="bg-dark h-screen text-white overflow-y-hidden">
      <nav class="bg-darkless min-h-[44px] flex items-center">
        <div class="-ml-px mt-1">
          <img src={logo} title="HCES" class="text-2 h-4 rotate-[8deg]" />
        </div>
        <div class="mr-2 ml-auto flex gap-2">
          <A
            href="/stats"
            class="no-underline text-white  hover:text-secondary-dark"
          >
            Statistics
          </A>
          <A
            href="/manage"
            class="no-underline text-white hover:text-secondary-dark"
          >
            Manage
          </A>
        </div>
      </nav>
      <main class="hc-container mt-4 h-screen text-white">
        <h1 class="hc-text-heading text-4">Your API Keys</h1>
        <Show when={queryKeys.isLoading}>
          <p class="text-white">Loading...</p>
        </Show>

        <Show when={queryKeys.isError}>
          <p class="text-white">Error: {queryKeys.error?.message}</p>
        </Show>
        <Show when={queryKeys.isSuccess}>
            <table class="border-[1.5px] border-darkless rounded">
              <thead class="p-2">
                <tr>
                  <th class="py-2 pl-2 pr-3 text-left">Prefix</th>
                  <th class="py-2 px-3 text-left">Label</th>
                  <th class="py-2 px-3 text-left">Last Used</th>
                  <th class="py-2 px-3 text-left">Created At</th>
                </tr>
              </thead>
              <tbody class="p-2">
                <For each={queryKeys.data!}>
                  {(key) => (
                    <tr>
                      <td>
                        <code>{key.prefix}</code>
                      </td>
                      <td>{key.label ?? "—"}</td>
                      <td>
                        {key.lastUsed
                          ? new Date(key.lastUsed).toLocaleString()
                          : "Never"}
                      </td>
                      <td>{new Date(key.createdAt).toLocaleString()}</td>
                    </tr>
                  )}
                </For>
              </tbody>
              <Show when={!queryKeys.data || queryKeys.data.length === 0}>
                <td colSpan={4} class="text-center text-white border-none p-2">
                  No API Keys found
                </td>
              </Show>
            </table>
        </Show>
        <div class="border border-darkless rounded overflow-hidden">
          <div class="p-4 flex flex-col gap">
            <label for="api-key-label" class="text-sm text-white/70">
              Label
            </label>
            <input
              id="api-key-label"
              class="hc-input bg-darkless p-2 text-white"
              placeholder="Yummy api key"
            />
          </div>
        
          <div class="bg-darkless p-3 flex items-center gap-3">
            <p class="text-white text-sm">
              You'll need an API key to use any public endpoint provided!
            </p>
            <button class="button hc-btn-primary ml-auto">
              New API Key
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
