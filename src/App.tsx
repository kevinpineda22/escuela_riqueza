import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@/routes";
import GlobalPodcastPlayer from "@/components/feature/GlobalPodcastPlayer";

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <GlobalPodcastPlayer />
    </BrowserRouter>
  );
}

export default App;
