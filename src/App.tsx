import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ManagersPage from "./pages/ManagersPage";
import UsersPage from "./pages/UsersPage";
import CouponsPage from "./pages/CouponsPage";
import PayoutsPage from "./pages/PayoutsPage";
import SettingsPage from "./pages/SettingsPage";
import InfluencersPage from "./pages/InfluencersPage";
import AdminInfluencersPage from "./pages/AdminInfluencersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import WalletPage from "./pages/WalletPage";
import LedgerPage from "./pages/LedgerPage";
import ProfilePage from "./pages/ProfilePage";
import CreditPackagesPage from "./pages/CreditPackagesPage";
import CreditConfigPage from "./pages/CreditConfigPage";
import PaymentLogsPage from "./pages/PaymentLogsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import MockCheckoutPage from "./pages/MockCheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PricingPage from "./pages/PricingPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MySubscriptionPage from "./pages/MySubscriptionPage";
import SupportFormPage from "./pages/SupportFormPage";
import SupportQueriesPage from "./pages/SupportQueriesPage";
import NewsleadsPage from "./pages/NewsleadsPage";
import ChatbotLeadsPage from "./pages/ChatbotLeadsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/checkout" element={<ProtectedRoute><MockCheckoutPage /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
            <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/managers" element={<ProtectedRoute allowedRoles={['admin']}><ManagersPage /></ProtectedRoute>} />
            <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin-influencers" element={<ProtectedRoute allowedRoles={['admin']}><AdminInfluencersPage /></ProtectedRoute>} />
            <Route path="/dashboard/coupons" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'influencer']}><CouponsPage /></ProtectedRoute>} />
            <Route path="/dashboard/payouts" element={<ProtectedRoute allowedRoles={['admin']}><PayoutsPage /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/dashboard/packages" element={<ProtectedRoute allowedRoles={['admin']}><CreditPackagesPage /></ProtectedRoute>} />
            <Route path="/dashboard/credit-config" element={<ProtectedRoute allowedRoles={['admin']}><CreditConfigPage /></ProtectedRoute>} />
            <Route path="/dashboard/payment-logs" element={<ProtectedRoute allowedRoles={['admin']}><PaymentLogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute allowedRoles={['admin']}><SubscriptionsPage /></ProtectedRoute>} />
            <Route path="/dashboard/influencers" element={<ProtectedRoute allowedRoles={['manager']}><InfluencersPage /></ProtectedRoute>} />
            <Route path="/dashboard/analytics" element={<ProtectedRoute allowedRoles={['manager']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute allowedRoles={['manager', 'influencer']}><WalletPage /></ProtectedRoute>} />
            <Route path="/dashboard/ledger" element={<ProtectedRoute allowedRoles={['influencer']}><LedgerPage /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute allowedRoles={['influencer']}><ProfilePage /></ProtectedRoute>} />
            <Route path="/dashboard/my-subscription" element={<ProtectedRoute><MySubscriptionPage /></ProtectedRoute>} />
            <Route path="/dashboard/support-queries" element={<ProtectedRoute allowedRoles={['admin']}><SupportQueriesPage /></ProtectedRoute>} />
            <Route path="/dashboard/newsleads" element={<ProtectedRoute allowedRoles={['admin']}><NewsleadsPage /></ProtectedRoute>} />
            <Route path="/dashboard/chatbot-leads" element={<ProtectedRoute allowedRoles={['admin']}><ChatbotLeadsPage /></ProtectedRoute>} />
            <Route path="/support" element={<SupportFormPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
