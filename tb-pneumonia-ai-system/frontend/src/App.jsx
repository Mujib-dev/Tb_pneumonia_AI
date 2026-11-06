import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import { AuthProvider, useAuth } from './services/AuthContext'

// Lazy loaded pages to optimize bundle splitting and decrease initial payload
const Predict = lazy(() => import('./pages/Predict'))
const History = lazy(() => import('./pages/History'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const DicomInbox = lazy(() => import('./pages/DicomInbox'))
const Profile = lazy(() => import('./pages/Profile'))
const BookAppointment = lazy(() => import('./pages/BookAppointment'))
const GuestBooking = lazy(() => import('./pages/GuestBooking'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const TodayTokens = lazy(() => import('./pages/TodayTokens'))
const Inquiries = lazy(() => import('./pages/Inquiries'))
const MyInquiries = lazy(() => import('./pages/MyInquiries'))
const Payments = lazy(() => import('./pages/Payments'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))

const PageLoading = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="size-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading Medical Portal...</span>
  </div>
)

const getRoleHome = (role) => {
  if (role === 'doctor') return '/doctor'
  if (role === 'admin') return '/admin'
  if (role === 'patient') return '/history'
  return '/login'
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={getRoleHome(user.role)} replace />;
  return children;
};

// Redirect logged-in users away from the landing page to their dashboard
const SmartHome = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (user) return <Navigate to={getRoleHome(user.role)} replace />;
  return <Home />;
};


function App() {
  const location = useLocation();
  const publicRoutes = ['/', '/about', '/contact', '/login', '/register', '/forgot-password', '/guest-book', '/terms', '/privacy'];
  const showFooter = publicRoutes.includes(location.pathname);
  const hideFooterOnMobile = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white transition-colors duration-300">
        <Navbar />
        <main className={isAdminRoute ? "max-w-6xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 pt-1 pb-10 flex flex-col" : "container mx-auto px-2 sm:px-4 md:px-6 pt-0 pb-1 sm:pb-4"}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<SmartHome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/guest-book" element={<GuestBooking />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              
              {/* Analysis & History - Accessible by Doctors, Patients, and Admin */}
              <Route path="/predict" element={
                <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
                  <Predict />
                </ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
                  <History />
                </ProtectedRoute>
              } />

              <Route path="/today-tokens" element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <TodayTokens />
                </ProtectedRoute>
              } />

              {/* DICOM studies pushed by the hospital X-ray machine */}
              <Route path="/dicom-inbox" element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                  <DicomInbox />
                </ProtectedRoute>
              } />

              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              {/* Doctor Routes */}
              <Route path="/doctor" element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/payments" element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <Payments />
                </ProtectedRoute>
              } />
              <Route path="/inquiries" element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <Inquiries />
                </ProtectedRoute>
              } />
              <Route path="/my-inquiries" element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <MyInquiries />
                </ProtectedRoute>
              } />
              {/* Doctor & Patient Management */}
              <Route path="/patients" element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <Patients />
                </ProtectedRoute>
              } />
              <Route path="/book" element={
                <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
                  <BookAppointment />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </main>

        {showFooter && (
          <div className={hideFooterOnMobile ? "hidden md:block" : ""}>
            <Footer />
          </div>
        )}
      </div>
    </AuthProvider>
  )
}

export default App
