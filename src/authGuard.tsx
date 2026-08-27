import { createMutation, createQuery } from "@tanstack/solid-query";
import { useToast } from "@/app";
import { A, useNavigate } from "@solidjs/router";
import server, { isApiError, resolveErrorMessage } from "./backend";
import {
  Show,
  createContext,
  useContext,
  createEffect,
  type ParentComponent,
  type Accessor,
} from "solid-js";
import logo from "@/public/orpheus-hces.webp";

type SessionCheckData = Awaited<
  ReturnType<typeof server.api.v1.web.login.sessionCheck.get>
>["data"];
export type SessionCheckSuccess = Extract<SessionCheckData, { ok: true }>;

function isSessionCheckSuccess(data: unknown): data is SessionCheckSuccess {
  if (!data || typeof data !== "object") return false;
  const candidate = data as SessionCheckData;
  return !!candidate && candidate.ok === true && !!candidate.user;
}

type AuthContextValue = {
  ready: Accessor<boolean>;
  user: Accessor<SessionCheckSuccess["user"] | undefined>;
};

const AuthContext = createContext<AuthContextValue>();

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthGuard");
  return ctx;
}

const AuthGuard: ParentComponent = (props) => {
  const toast = useToast();
  const nav = useNavigate();

  const query = createQuery(() => ({
    queryKey: ["sessionCheck"],
    queryFn: async () => {
      const result = await server.api.v1.web.login.sessionCheck.get();
      if (!result.data) {
        if(result.status !== 401) {
          toast("Failed to pass session check due to server error.");
        }
        return { ok: false as const };
      }
      return result.data;
    },
    retry: false,
  }));

  createEffect(() => {
    if (query.isSuccess && !isSessionCheckSuccess(query.data)) {
      nav("/");
    }
  });

  const ready = () => query.isSuccess && isSessionCheckSuccess(query.data);
  const user = () =>
    isSessionCheckSuccess(query.data) ? query.data.user : undefined;

  const logout = createMutation(() => ({
    mutationFn: async () => {
      const result = await server.api.v1.web.login.getOUT.get();
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err) => {
      if (isApiError(err)) {
        toast(resolveErrorMessage(err.err.msg, "Internal server error"));
      } else {
        toast(
          err instanceof Error ? err.message : "Failed to logout of the account",
        );
      }
    },
  }));

  return (
    <AuthContext.Provider value={{ ready, user }}>
      <Show when={ready()}>
        <nav class="bg-dark border-b border-b-darkless min-h-[56px] flex items-center relative ">
          <div class="-ml-px mt-2 absolute">
            <img src={logo} title="HCES" class="text-2 h-5" />
          </div>
          <div class="flex gap-2 ml-[120px]">
            <A href="/stats" class="no-underline text-white hover:text-secondary-dark">
              Statistics
            </A>
            <A href="/" class="no-underline text-white hover:text-secondary-dark">
              Manage
            </A>
            <Show when={user()?.admin}>
              <A href="/admin" class="no-underline text-white hover:text-secondary-dark">
                Admin
              </A>
            </Show>
          </div>
          <button
            class="no-underline text-white hover:text-secondary-dark ml-auto mr-3 cursor-pointer"
            onClick={() => window.location.href = "/api/v1/docs"}
          >
            Docs
          </button>
          <button
            class="no-underline text-white hover:text-secondary-dark mr-3 cursor-pointer"
            onClick={() => window.location.href = "/api/v1/ws/docs"}
          >
            WSDocs
          </button>
          <button
            class="no-underline text-white hover:text-secondary-dark mr-3 cursor-pointer"
            onClick={() => logout.mutate()}
          >
            Logout
          </button>
        </nav>
        {props.children}
      </Show>
    </AuthContext.Provider>
  );
};

export default AuthGuard;