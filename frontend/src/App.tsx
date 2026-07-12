import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleRoute } from '@/routes/RoleRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductionPage } from '@/pages/production/ProductionPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { HRPage } from '@/pages/hr/HRPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="production"
            element={
              <RoleRoute module="production">
                <ProductionPage />
              </RoleRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <RoleRoute module="inventory">
                <InventoryPage />
              </RoleRoute>
            }
          />
          <Route
            path="sales"
            element={
              <RoleRoute module="sales">
                <SalesPage />
              </RoleRoute>
            }
          />
          <Route
            path="hr"
            element={
              <RoleRoute module="hr">
                <HRPage />
              </RoleRoute>
            }
          />
          <Route
            path="settings"
            element={
              <RoleRoute module="settings">
                <SettingsPage />
              </RoleRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
