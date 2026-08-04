import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import server from "../backend";
import { useQueryClient } from "@tanstack/solid-query";

function Dashboard() {
  const queryClient = useQueryClient();
  const nav = useNavigate();

  onMount(async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ["sessionCheck"],
      queryFn: async () => {
        const result = await server.api.v1.web.login.sessionCheck.get();
        if (!result.data) throw new Error("Failed to fetch data");
        return result.data;
      },
    });
    if (!data.ok) return nav("/");
  })

  return (
    <div>
      Goog... Successfully authed!
    </div>
  );
}

export default Dashboard;