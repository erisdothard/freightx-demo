import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { ErrorBoundary } from '@/shared/components/error-boundary';

// Auto-retry lazy imports once on chunk-load failure (stale deploy cache)
function lazyRetry(fn: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    fn().catch(() => {
      window.location.reload();
      return new Promise<{ default: ComponentType }>(() => {});
    }),
  );
}

// Public pages — small, load eagerly
import SplashPage from '@/pages/splash';
import LoginPage from '@/pages/login';
import ForgotPasswordPage from '@/pages/forgot-password';
import ResetPasswordPage from '@/pages/reset-password';
import OnboardingPage from '@/pages/onboarding';
import ClaimAccountPage from '@/pages/claim-account';
import AuthCallbackPage from '@/pages/auth-callback';

// Lazy-loaded — only downloaded when the user navigates to that role
const CarrierDashboard = lazyRetry(() => import('@/pages/carrier/dashboard'));
const CarrierLoadsPage = lazyRetry(() => import('@/pages/carrier/loads'));
const CarrierFleetPage = lazyRetry(() => import('@/pages/carrier/fleet'));
const CarrierFleetMapPage = lazyRetry(() => import('@/pages/carrier/fleet-map'));
const CarrierTeamPage = lazyRetry(() => import('@/pages/carrier/team'));
const CarrierTeamSettingsPage = lazyRetry(() => import('@/pages/carrier/team-settings'));

const BrokerDashboard = lazyRetry(() => import('@/pages/broker/dashboard'));
const BrokerLoadsPage = lazyRetry(() => import('@/pages/broker/loads'));

const ShipperDashboard = lazyRetry(() => import('@/pages/shipper/dashboard'));
const ShipperLoadsPage = lazyRetry(() => import('@/pages/shipper/loads'));

const DriverDashboard = lazyRetry(() => import('@/pages/driver/dashboard'));
const DriverLoadsPage = lazyRetry(() => import('@/pages/driver/loads'));
const DriverDocumentsPage = lazyRetry(() => import('@/pages/driver/documents'));
const DriverTireLogPage = lazyRetry(() => import('@/pages/driver/tire-log'));
const DriverReceiptsPage = lazyRetry(() => import('@/pages/driver/receipts'));
const DriverExpensesPage = lazyRetry(() => import('@/pages/driver/expenses'));

const TrackingPage = lazyRetry(() => import('@/pages/tracking'));
const PublicTrackingPage = lazyRetry(() => import('@/pages/public-tracking'));
const MessagesPage = lazyRetry(() => import('@/pages/messages'));
const ProfilePage = lazyRetry(() => import('@/pages/profile'));
const HelpCenterPage = lazyRetry(() => import('@/pages/profile/help-center'));
const NotificationsPage = lazyRetry(() => import('@/pages/profile/notifications'));
const DocumentsPage = lazyRetry(() => import('@/pages/profile/documents'));
const PrivacyPage = lazyRetry(() => import('@/pages/legal/privacy'));
const TermsPage = lazyRetry(() => import('@/pages/legal/terms'));
const AdminDashboard = lazyRetry(() => import('@/pages/admin/dashboard'));
const AuditLogPage = lazyRetry(() => import('@/pages/admin/audit-log'));
const LaneIntelligencePage = lazyRetry(() => import('@/pages/lane-intelligence'));
const CarrierPaymentsPage = lazyRetry(() => import('@/pages/carrier-payments'));
const NotificationHealthPage = lazyRetry(() => import('@/pages/admin/notification-health'));
const TrustProfilePage = lazyRetry(() => import('@/pages/profile/trust-profile'));
const CarrierInvitationsPage = lazyRetry(() => import('@/pages/carrier/invitations'));
const CarrierAlertsPage = lazyRetry(() => import('@/pages/carrier/alerts'));
const DriverHosPage = lazyRetry(() => import('@/pages/driver/hos'));
const ShipperDockSchedulingPage = lazyRetry(() => import('@/pages/shipper/dock-scheduling'));
const ShipperRfpsPage = lazyRetry(() => import('@/pages/shipper/rfps'));
const CarrierRfpsPage = lazyRetry(() => import('@/pages/carrier/rfps'));
const BrokerApiKeysPage = lazyRetry(() => import('@/pages/broker/api-keys'));
const CarrierFuelCardsPage = lazyRetry(() => import('@/pages/carrier/fuel-cards'));
const AdminFactoringRiskPage = lazyRetry(() => import('@/pages/admin/factoring-risk'));
const CarrierSpotRatesPage = lazyRetry(() => import('@/pages/carrier/spot-rates'));
const NotFound = lazyRetry(() => import('@/pages/not-found'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/invite/:token" element={<OnboardingPage />} />
          <Route path="/claim-account" element={<ClaimAccountPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/t/:token" element={<PublicTrackingPage />} />

          {/* Carrier */}
          <Route
            path="/carrier"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrier/loads"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierLoadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrier/fleet"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierFleetPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrier/map"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierFleetMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrier/team"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrier/team-settings"
            element={
              <ProtectedRoute requiredRole="carrier">
                <CarrierTeamSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Broker */}
          <Route path="/broker/post" element={<Navigate to="/broker/loads" replace />} />
          <Route
            path="/broker"
            element={
              <ProtectedRoute requiredRole="broker">
                <BrokerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broker/loads"
            element={
              <ProtectedRoute requiredRole="broker">
                <BrokerLoadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broker/team"
            element={
              <ProtectedRoute requiredRole={['broker', 'carrier']}>
                <CarrierTeamPage />
              </ProtectedRoute>
            }
          />

          {/* Shipper */}
          <Route
            path="/shipper"
            element={
              <ProtectedRoute requiredRole="shipper">
                <ShipperDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipper/loads"
            element={
              <ProtectedRoute requiredRole="shipper">
                <ShipperLoadsPage />
              </ProtectedRoute>
            }
          />

          {/* Driver */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/loads"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverLoadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/documents"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/tire-log"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverTireLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/receipts"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverReceiptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/expenses"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverExpensesPage />
              </ProtectedRoute>
            }
          />

          {/* Shared */}
          <Route
            path="/track/:loadId?"
            element={
              <ProtectedRoute>
                <TrackingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/help"
            element={
              <ProtectedRoute>
                <HelpCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />

          {/* Lane Intelligence — carrier + broker */}
          <Route
            path="/lane-intelligence"
            element={
              <ProtectedRoute>
                <LaneIntelligencePage />
              </ProtectedRoute>
            }
          />

          {/* Carrier Payments */}
          <Route
            path="/carrier/payments"
            element={
              <ProtectedRoute requiredRole="carrier">
                <CarrierPaymentsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute requiredRole="admin">
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute requiredRole="admin">
                <NotificationHealthPage />
              </ProtectedRoute>
            }
          />

          {/* Trust Profile */}
          <Route
            path="/profile/trust/:companyId?"
            element={
              <ProtectedRoute>
                <TrustProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Carrier: Invitations */}
          <Route
            path="/carrier/invitations"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierInvitationsPage />
              </ProtectedRoute>
            }
          />

          {/* Carrier: Alerts & Lane Suggestions */}
          <Route
            path="/carrier/alerts"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierAlertsPage />
              </ProtectedRoute>
            }
          />

          {/* Carrier: RFPs */}
          <Route
            path="/carrier/rfps"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierRfpsPage />
              </ProtectedRoute>
            }
          />

          {/* Carrier: Fuel Cards */}
          <Route
            path="/carrier/fuel-cards"
            element={
              <ProtectedRoute requiredRole="carrier">
                <CarrierFuelCardsPage />
              </ProtectedRoute>
            }
          />

          {/* Carrier: Spot Rates */}
          <Route
            path="/carrier/spot-rates"
            element={
              <ProtectedRoute requiredRole={['carrier', 'broker']}>
                <CarrierSpotRatesPage />
              </ProtectedRoute>
            }
          />

          {/* Driver: HOS */}
          <Route
            path="/driver/hos"
            element={
              <ProtectedRoute requiredRole="driver">
                <DriverHosPage />
              </ProtectedRoute>
            }
          />

          {/* Broker: API Keys */}
          <Route
            path="/broker/api-keys"
            element={
              <ProtectedRoute requiredRole="broker">
                <BrokerApiKeysPage />
              </ProtectedRoute>
            }
          />

          {/* Shipper: Dock Scheduling */}
          <Route
            path="/shipper/dock-scheduling"
            element={
              <ProtectedRoute requiredRole="shipper">
                <ShipperDockSchedulingPage />
              </ProtectedRoute>
            }
          />

          {/* Shipper: RFPs */}
          <Route
            path="/shipper/rfps"
            element={
              <ProtectedRoute requiredRole="shipper">
                <ShipperRfpsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin: Factoring Risk */}
          <Route
            path="/admin/factoring-risk"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminFactoringRiskPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
