import { createQuery } from "@tanstack/solid-query";
import { Switch, Match, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSearchParams } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import "@/styles/login.css";
import server from "@/backend";
import { useToast } from "@/app";
import errorMessages from "@/errors";

function Login() {
  const nav = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = createQuery(() => ({
    queryKey: ["redirectURL"],
    queryFn: async () => {
      const result = await server.api.v1.web.login.getRedirectUrl.get();
      if (!result.data) throw new Error("Failed to fetch data");
      return result.data;
    },
    throwOnError: true,
  }));

  const authError = () => {
    const rawCode = searchParams.error;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    return code
      ? (errorMessages[code] ?? "Sign-in failed. Please try again.")
      : null;
  };

  const dismissError = () => setSearchParams({ error: undefined });

  onMount(async () => {
    const message = authError();
    if (message) {
      setSearchParams({ error: undefined }, { replace: true });
      toast(message);
    }
    const data = await queryClient.fetchQuery({
      queryKey: ["sessionCheck"],
      queryFn: async () => {
        const result = await server.api.v1.web.login.sessionCheck.get();
        if (!result.data) throw new Error("Failed to fetch data");
        return result.data;
      },
    });
    if (data.ok) return nav("/dashboard");
  });

  return (
    <div class="bg-dark">
      <Show when={authError()}>
        {(message) => (
          <div class="absolute top-0 inset-x-0 flex justify-center mt-3">
            <div
              class="button bg-orange text-background whitespace-nowrap w-fit!"
              onClick={dismissError}
            >
              {message()}
            </div>
          </div>
        )}
      </Show>
      <div class="h-screen flex flex-col justify-center items-center">
        <h1 class="hc-text-heading text-5 text-white">HCES</h1>
        <h2 class="hc-text-heading text-2 text-secondary-dark">
          Hack Club Event Scraper
        </h2>
        <br />

        <Switch>
          <Match when={query.isLoading}>
            <p class="text-white">Loading...</p>
          </Match>
          <Match when={query.isError}>
            <p class="text-white">Error: {query.error?.message}</p>
          </Match>
          <Match when={query.isSuccess}>
            <button
              class="hc-btn hc-btn-primary button"
              onClick={() => {
                const url = query.data?.url;
                if (url) window.location.href = url;
              }}
            >
              Authenticate with Hack Club Auth
            </button>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export default Login;
