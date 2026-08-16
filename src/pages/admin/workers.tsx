import { For, Show } from "solid-js";
import { createMutation, createQuery } from "@tanstack/solid-query";
import server, { isApiError, resolveErrorMessage } from "@/backend";
import { useQueryClient } from "@tanstack/solid-query";
import { useToast } from "@/app";
import { createSignal } from "solid-js";
import { useAuth } from "@/authGuard";

function Workers() {
  const queryClient = useQueryClient();
  const { ready } = useAuth();
  const toast = useToast();
  const [label, setLabel] = createSignal("");

  const queryWorkers = createQuery(() => ({
    queryKey: ["workers"],
    enabled: ready(),
    queryFn: async () => {
      const result = await server.api.v1.web.workers.get();
      if (!result.data) {
        toast("Failed to query for workers");
        return [];
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return [];
      }
      return result.data;
    },
  }));

  const createKey = createMutation(() => ({
    enabled: ready(),
    mutationFn: async () => {
      const result = await server.api.v1.web.workers.post({
        label: label() || undefined,
      });
      if (!result.data) {
        toast("Failed to create a worker");
        return null;
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return null;
      }
      return result.data;
    },
    onSuccess: () => {
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(err instanceof Error ? err.message : "Failed to create worker");
      }
    },
  }));

  const deleteKey = createMutation(() => ({
    enabled: ready(),
    mutationFn: async (id: string) => {
      const result = await server.api.v1.web.workers.delete({
        id,
      });
      if (!result.data) {
        toast("Failed to delete worker");
        return null;
      } else if (isApiError(result.data)) {
        toast(resolveErrorMessage(result.data.err, "Internal server error"));
        return null;
      }
      return result.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["workers"],
      });
      createKey.reset();
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(err instanceof Error ? err.message : "Failed to delete worker");
      }
    },
  }));
 
  return (
    <div class="bg-dark h-screen text-white overflow-y-hidden">
      <main class="hc-container mt-4 h-screen text-white">
        <h1 class="hc-text-heading text-4">Oooo Workers!</h1>
        <Show when={queryWorkers.isLoading}>
          <p class="text-white">Loading...</p>
        </Show>
        <Show when={queryWorkers.isError}>
          <p class="text-white">Error: {queryWorkers.error?.message}</p>
        </Show>
        <Show when={queryWorkers.isSuccess}>
          <table class="bg-darkless rounded">
            <thead>
              <tr>
                <th class="p-2 text-left">Prefix</th>
                <th class="p-2 text-left">Label</th>
                <th class="p-2 text-left" title="Connected or when it last connected">Status</th>
                <th class="p-2 text-left">Version</th>
                <th class="p-2 text-left">Created At</th>
                <th class="p-2 text-left">Delete</th>
              </tr>
            </thead>
            <tbody>
              <For each={queryWorkers.data!}>
                {(worker, i) => (
                  <tr>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {worker.prefix}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {worker.label ?? "—"}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {worker.connected
                        ? "Connected!"
                        : worker.lastConnectedAt
                          ? new Date(worker.lastConnectedAt).toLocaleString()
                          : "Never connected before"}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {worker.versionSHA ? worker.versionSHA : "No version set"}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "p-2": true,
                      }}
                    >
                      {new Date(worker.createdAt).toLocaleString()}
                    </td>
                    <td
                      classList={{
                        "border-none": i() === queryWorkers.data!.length - 1,
                        "align-middle": true,
                        "p-2": true,
                        "items-center": true,
                      }}
                    >
                      <button
                        class="cursor-pointer inline-flex items-center justify-center text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={deleteKey.isPending}
                        onClick={() => deleteKey.mutate(worker.id)}
                        title="Delete worker"
                      >
                        Delete?
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
            <Show when={!queryWorkers.data || queryWorkers.data.length === 0}>
              <td colSpan={6} class="text-center text-white border-none p-2">
                No workers found
              </td>
            </Show>
          </table>
        </Show>
        <div class="border border-darkless rounded overflow-hidden">
          <div class="p-4 flex flex-col gap">
            <Show when={createKey.isSuccess}>
              <div class="text-center">Here is your worker secret!</div>
              <div class="text-center text-primary">{createKey.data?.key}</div>
            </Show>
            <label for="api-key-label" class="text-sm text-white/70">
              Label
            </label>
            <input
              id="api-key-label"
              class="hc-input bg-darkless p-2 text-white"
              placeholder={
                createKey.isPending
                  ? "Pending a creation of  a worker rn"
                  : "Yummy workers"
              }
              value={label()}
              disabled={
                createKey.isPending
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
              Workers are used to distribute requests to services over multiple
              different networks to avoid any ratelimits!
            </p>
            <button
              class="button hc-btn-primary ml-auto"
              disabled={
                createKey.isPending ||
                (queryWorkers.data && queryWorkers.data.length >= 5)
              }
              onClick={() => createKey.mutate()}
            >
              New Worker
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Workers;
