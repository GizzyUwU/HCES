import { For, onMount, Show } from "solid-js";
import { createMutation, createQuery } from "@tanstack/solid-query";
import { A, useNavigate } from "@solidjs/router";
import server, { isApiError, resolveErrorMessage } from "../backend";
import { useQueryClient } from "@tanstack/solid-query";
import logo from "@/public/orpheus-hces.webp";
import { useToast } from "@/app";
import { createSignal } from "solid-js";
function Dashboard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [label, setLabel] = createSignal("");

  onMount(async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ["sessionCheck"],
        queryFn: async () => {
          const result = await server.api.v1.web.login.sessionCheck.get();
          if (!result.data) {
            toast("Failed to pass session check due to server error.");
            return {
              ok: false,
            };
          }
          return result.data;
        },
        retry: false,
      });
      if (!data || !data.ok) return nav("/");
    } catch (e) {
      toast("Session check failed — please log in again.");
      nav("/");
    }
  });

  const queryKeys = createQuery(() => ({
    queryKey: ["apiKeys"],
    queryFn: async () => {
      const result = await server.api.v1.web.apiKeys.get();
      if (!result.data) {
        toast("Failed to query for API Keys");
        return [];
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return [];
      }
      return result.data;
    },
  }));

  const createKey = createMutation(() => ({
    mutationFn: async () => {
      const result = await server.api.v1.web.apiKeys.post({
        label: label() || undefined,
      });
      if (!result.data) {
        toast("Failed to query for API Keys");
        return null;
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return null;
      }
      return result.data;
    },
    onSuccess: () => {
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(err instanceof Error ? err.message : "Failed to create API key");
      }
    },
  }));

  const deleteKey = createMutation(() => ({
    mutationFn: async (id: string) => {
      const result = await server.api.v1.web.apiKeys.delete({
        id,
      });
      if (!result.data) {
        toast("Failed to query for API Keys");
        return null;
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return null;
      }
      return result.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
      createKey.reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(err instanceof Error ? err.message : "Failed to create API key");
      }
    },
  }));

  return (
    <div class="bg-dark h-screen text-white overflow-y-hidden">
      <nav class="border-b border-b-darkless min-h-[56px] flex items-center relative ">
        <div class="-ml-px mt-2 absolute">
          <img src={logo} title="HCES" class="text-2 h-5" />
        </div>
        <div class="flex gap-2 ml-[120px]">
          <A
            href="/stats"
            class="no-underline text-white hover:text-secondary-dark"
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
        <button class="no-underline text-white hover:text-secondary-dark ml-auto mr-3 cursor-pointer">
          Logout
        </button>
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
          <table class="bg-darkless rounded">
            <thead>
              <tr>
                <th class="p-2 text-left">Prefix</th>
                <th class="p-2 text-left">Label</th>
                <th class="p-2 text-left">Last Used</th>
                <th class="p-2 text-left">Created At</th>
                <th class="p-2 text-left">Delete</th>
              </tr>
            </thead>
            <tbody>
              <For each={queryKeys.data!}>
                {(key, i) => (
                  <tr>
                    <td
                      classList={{
                        "border-none": i() === queryKeys.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {key.prefix}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryKeys.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {key.label ?? "—"}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryKeys.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {key.lastUsed
                        ? new Date(key.lastUsed).toLocaleString()
                        : "Never"}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryKeys.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {new Date(key.createdAt).toLocaleString()}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryKeys.data!.length - 1,
                        "align-middle": true,
                        "p-2": true,
                        "items-center": true,
                      }}
                    >
                      <button
                        class="cursor-pointer inline-flex items-center justify-center text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={deleteKey.isPending}
                        onClick={() => deleteKey.mutate(key.id)}
                        title="Delete API key"
                      >
                        Delete?
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
            <Show when={!queryKeys.data || queryKeys.data.length === 0}>
              <td colSpan={5} class="text-center text-white border-none p-2">
                No API Keys found
              </td>
            </Show>
          </table>
        </Show>
        <div class="border border-darkless rounded overflow-hidden">
          <div class="p-4 flex flex-col gap">
            <Show when={createKey.isSuccess}>
              <div class="text-center">Here is your API Key!</div>
              <div class="text-center text-primary">{createKey.data?.key}</div>
            </Show>
            <label for="api-key-label" class="text-sm text-white/70">
              Label
            </label>
            <input
              id="api-key-label"
              class="hc-input bg-darkless p-2 text-white"
              placeholder={
                createKey.isPending ||
                (queryKeys.data && queryKeys.data.length >= 5)
                  ? "You have hit the api key limit"
                  : "Yummy api key"
              }
              value={label()}
              disabled={
                createKey.isPending ||
                (queryKeys.data && queryKeys.data.length >= 5)
              }
              onInput={(e) => setLabel(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !createKey.isPending) {
                  createKey.mutate();
                }
              }}
            />
          </div>

          <div class="bg-darkless p-3 flex items-center gap-3">
            <p class="text-white text-sm">
              You'll need an API key to use any public endpoint provided!
            </p>
            <button
              class="button hc-btn-primary ml-auto"
              disabled={
                createKey.isPending ||
                (queryKeys.data && queryKeys.data.length >= 5)
              }
              onClick={() => createKey.mutate()}
            >
              New API Key
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
