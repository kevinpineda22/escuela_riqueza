import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes";
import GlobalPodcastPlayer from "@/components/feature/GlobalPodcastPlayer";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <GlobalPodcastPlayer />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
