import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ReportsPage } from './pages/ReportsPage'
import { ClientPage } from './pages/ClientPage'
import { ClientsPage } from './pages/ClientsPage'
import { InvoiceEditPage } from './pages/InvoiceEditPage'
import { InvoicePrintPage } from './pages/InvoicePrintPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { LoginPage } from './pages/LoginPage'
import { PriceListPrintPage } from './pages/PriceListPrintPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="splash">Жүктелуде…</div>

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/new" element={<InvoiceEditPage />} />
        <Route path="/invoices/:id" element={<InvoiceEditPage />} />
        <Route path="/invoices/:id/print" element={<InvoicePrintPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/print" element={<PriceListPrintPage />} />
        {/* Categories are managed on the price list page now */}
        <Route path="/categories" element={<Navigate to="/products?categories=1" replace />} />
        <Route path="/users" element={user?.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={user?.role === 'ADMIN' ? <SettingsPage /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
