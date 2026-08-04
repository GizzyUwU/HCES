import { createQuery } from "@tanstack/solid-query";
import { Switch, Match, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useSearchParams } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import server from "../backend";

const errorMessages: Record<string, string> = {
  account_unverified: "Your Hack Club account must be verified before you can sign in.",
};

function Login() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const query = createQuery(() => ({
    queryKey: ["redirectURL"],
    queryFn: async () => {
      const result = await server.api.v1.web.login.getRedirectUrl.get()
      if (!result.data) throw new Error("Failed to fetch data");
      return result.data;
    },
    throwOnError: true,
  }));

  const authError = () => {
    const rawCode = searchParams.error;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    return code ? errorMessages[code] ?? "Sign-in failed. Please try again." : null;
  };

  onMount(async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ["sessionCheck"],
      queryFn: async () => {
        const result = await server.api.v1.web.login.sessionCheck.get();
        if (!result.data) throw new Error("Failed to fetch data");
        return result.data;
      },
    });
    console.log(data)
    if (data.ok) return nav("/dashboard");
  })

  return (
    <div>
      <Show when={authError()}>
        {(message) => <p>{message()}</p>}
      </Show>
      <Switch>
        <Match when={query.isLoading}>
          <p>Loading...</p>
        </Match>
        <Match when={query.isError}>
          <p>Error: {query.error?.message}</p>
        </Match>
        <Match when={query.isSuccess}>
          <a href={query.data?.url ?? ""}>Login via HCA</a>
        </Match>
      </Switch>
    </div>
  );
}

export default Login;