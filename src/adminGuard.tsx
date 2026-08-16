import { useNavigate } from "@solidjs/router";
import { Show, createEffect, type ParentComponent } from "solid-js";
import { useAuth } from "./authGuard";
import { useToast } from "./app";

const AdminGuard: ParentComponent = (props) => {
  const nav = useNavigate();
    const toast = useToast();
  const { user } = useAuth();

  createEffect(() => {
    if (!user()?.admin) {
      toast("You lack the permissions to access this.")
      nav("/dashboard");
    }
  });

  return <Show when={user()?.admin}>{props.children}</Show>;
};

export default AdminGuard;