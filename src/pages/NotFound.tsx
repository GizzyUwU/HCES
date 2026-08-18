import { useNavigate } from "@solidjs/router";
import "@/styles/login.css";

function NotFound() {
  const nav = useNavigate();
  return (
    <div class="bg-dark">
      <div class="h-screen flex flex-col justify-center items-center">
        <h1 class="hc-text-heading text-5 text-white">HCES</h1>
        <h2 class="hc-text-heading text-2 text-secondary-dark">
          Hack Club Event Scraper
        </h2>
        <br />
        <button
          class="hc-btn hc-btn-primary button"
          onClick={() => {
            nav("/dashboard");
          }}
        >
          This page doesn't exist! Go back to dashboard?
        </button>
      </div>
    </div>
  );
}

export default NotFound
