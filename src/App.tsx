import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes";
import GlobalPodcastPlayer from "@/components/feature/GlobalPodcastPlayer";
import EditModeToggle from "@/components/feature/EditModeToggle";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <GlobalPodcastPlayer />
      <EditModeToggle />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
