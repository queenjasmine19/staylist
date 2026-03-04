import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Map from "@/pages/Map";
import Wishlist from "@/pages/Wishlist";
import Itinerary from "@/pages/Itinerary";
import Profile from "@/pages/Profile";
import UserCollection from "@/pages/UserCollection";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/app" component={Home} />
      <Route path="/map" component={Map} />
      <Route path="/wishlist" component={Wishlist} />
      <Route path="/itinerary" component={Itinerary} />
      <Route path="/profile" component={Profile} />
      <Route path="/user/:id" component={UserCollection} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
