import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import RankingPage from "@/pages/ranking";
import CleanPlatePage from "@/pages/cleanplate";
import AdminCleanplatePage from "@/pages/admin-cleanplate";
import BuddyPage from "@/pages/buddy";
import BuddyMatchPage from "@/pages/buddy-match";
import AdminModerationPage from "@/pages/admin-moderation";
import ClassBattlePage from "@/pages/class-battle";
import StorePage from "@/pages/store";
import AdminStorePage from "@/pages/admin-store";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/ranking" component={RankingPage} />
      <Route path="/cleanplate" component={CleanPlatePage} />
      <Route path="/buddy" component={BuddyPage} />
      <Route path="/buddy/match/:id" component={BuddyMatchPage} />
      <Route path="/admin/cleanplate" component={AdminCleanplatePage} />
      <Route path="/admin/moderation" component={AdminModerationPage} />
      <Route path="/admin/store" component={AdminStorePage} />
      <Route path="/class-battle" component={ClassBattlePage} />
      <Route path="/store" component={StorePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
