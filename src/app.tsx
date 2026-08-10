import { Route, Router } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createContext, ErrorBoundary, useContext, type ParentComponent } from "solid-js";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import "@/styles/index.css";
import toast, { Toaster } from "solid-toast";
import type { JSX } from "solid-js";
import { Link, MetaProvider } from "@solidjs/meta";
import logo from "@/public/favicon.webp";
type ShowToast = (children: JSX.Element) => void;
const ToastContext = createContext<ShowToast>();

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within RootLayout");
  return ctx;
}

const showToast: ShowToast = (children) => {
  toast.custom(
    (t) => (
      <div
        class={`${t.visible ? "animate-enter" : "animate-leave"} button bg-orange text-background w-fit! whitespace-nowrap`}
        onClick={() => toast.dismiss(t.id)}
      >
        {children}
      </div>
    ),
    { duration: 5000 },
  );
};

const RootLayout: ParentComponent = (props) => (
  <ToastContext.Provider value={showToast}>
    {props.children}
  </ToastContext.Provider>
);


export const App = () => {
  const client = new QueryClient();
  return (
    <ErrorBoundary fallback={<div>Something went wrong!</div>}>
      <MetaProvider>
      <QueryClientProvider client={client}>
        <Link rel="icon" href={logo} />
        <Toaster position="top-center" />
        <Router root={RootLayout}>
          <Route path="/" component={Login} />
          <Route path="/dashboard" component={Dashboard} />
        </Router>
        </QueryClientProvider>
      </MetaProvider>
    </ErrorBoundary>
  );
};
