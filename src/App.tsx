import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes";
import GlobalPodcastPlayer from "@/components/feature/GlobalPodcastPlayer";
import { Toaster } from "@/components/ui/toaster";
import SessionGuard from "@/components/providers/SessionGuard";

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <GlobalPodcastPlayer />
      <Toaster />
      <SessionGuard />
    </BrowserRouter>
  );
}

export default App;
