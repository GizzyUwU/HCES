import { For, Show } from "solid-js";
import { createMutation, createQuery } from "@tanstack/solid-query";
import server, { isApiError, resolveErrorMessage } from "@/backend";
import { useQueryClient } from "@tanstack/solid-query";
import { useToast } from "@/app";
import { createSignal } from "solid-js";
import { useAuth } from "../authGuard";

function Dashboard() {
  const queryClient = useQueryClient();
  const { ready } = useAuth();
  const toast = useToast();
  const [label, setLabel] = createSignal("");
  const [showDelModel, setDelModel] = createSignal<boolean>(false);
  const [confirmAdele, setConfirmAdele] = createSignal<string>("");

  const queryKeys = createQuery(() => ({
    queryKey: ["apiKeys"],
    enabled: ready(),
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
    enabled: ready(),
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
    enabled: ready(),
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
  const deleteAcc = createMutation(() => ({
    mutationFn: async () => {
      const result = await server.api.v1.web.account.delete();
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.ok) window.location.href = "/";
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(
          err instanceof Error ? err.message : "Failed to delete the account",
        );
      }
    },
  }));
  return (
    <div class="bg-dark h-screen text-white overflow-y-hidden">
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
        <button
          class="button hc-btn-primary ml-auto mt-2 min-w-full"
          // disabled={
          //   createKey.isPending ||
          //   (queryKeys.data && queryKeys.data.length >= 5)
          // }
          onClick={() => setDelModel(true)}
        >
          Delete Account?
        </button>
      </main>
      <Show when={showDelModel()}>
        <div class="fixed inset-0 bg-dark/80 flex items-center justify-center z-50">
          <div class="hc-container bg-darkless rounded p-4 w-full flex flex-col gap-3">
            <h2 class="hc-text-heading text-2">Delete your account?</h2>
            <p class="text-white/70 text-sm">
              This can't be undone. Type{" "}
              <span class="text-white">Delete it!</span> to confirm.
            </p>
            <input
              class="hc-input bg-dark p-2 text-white"
              placeholder="Delete it!"
              value={confirmAdele()}
              onInput={(e) => setConfirmAdele(e.currentTarget.value)}
            />
            <div class="flex gap-2 justify-end mt-2">
              <button
                class="button"
                onClick={() => {
                  setDelModel(false);
                  setConfirmAdele("");
                }}
              >
                Cancel
              </button>
              <button
                class="button hc-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={
                  confirmAdele() !== "Delete it!" || deleteAcc.isPending
                }
                onClick={() => deleteAcc.mutate()}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default Dashboard;
