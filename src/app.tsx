import { Route, Router } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary, type ParentComponent } from "solid-js";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import "@/styles/index.css";

const RootLayout: ParentComponent = (props) => (
  <>
    {props.children}
  </>
);

export const App = () => {
  const client = new QueryClient();
  return (
    <ErrorBoundary fallback={<div>Something went wrong!</div>}>
      <QueryClientProvider client={client}>
        <Router root={RootLayout}>
          <Route path="/" component={Login} />
          <Route path="/dashboard" component={Dashboard} />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
