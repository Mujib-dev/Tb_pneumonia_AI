import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { clinicalSwal } from '../utils/alert';
import { 
  Eye, 
  EyeOff, 
  Phone, 
  Lock, 
  LogIn, 
  ShieldCheck, 
  Activity, 
  UserCheck, 
  Stethoscope, 
  Shield, 
  ArrowRight, 
  AlertCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  BookmarkCheck
} from 'lucide-react';
import FieldFormatHint from '../components/FieldFormatHint';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [rememberMe, setRememberMe] = useState(true);
  const idInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const alertTimerRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const ALERT_AUTO_DISMISS_MS = 3000;

  const dismissAlert = () => {
    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = null;
    }
    setAlert(null);
  };

  // Auto-dismiss the banner and the matching field hints together, so no orphaned
  // red field states are left behind once the message collapses.
  useEffect(() => {
    if (!alert) return undefined;
    alertTimerRef.current = setTimeout(() => {
      alertTimerRef.current = null;
      setAlert(null);
      setFieldErrors({});
    }, ALERT_AUTO_DISMISS_MS);
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, [alert]);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const focusAndScrollTo = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        if (typeof ref.current?.focus === 'function') {
          ref.current.focus();
        }
      }, 100);
    }
  };

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('login_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch {
      setHistory([]);
    }
  }, []);

  // Format detection
  const getIdentifierType = () => {
    const clean = identifier.trim();
    if (!clean) return null;
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 0) {
      return { type: 'invalid', label: 'Numbers only', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800' };
    }
    if (digits.startsWith('03') && digits.length === 11) {
      return { type: 'phone', label: 'Mobile Number Valid', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' };
    }
    if (digits.length === 13) {
      return { type: 'cnic', label: 'National CNIC Valid', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' };
    }
    if (digits.length > 0 && digits.length < 11) {
      return { type: 'typing', label: 'Enter 11 digits (03...)', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
    }
    return null;
  };

  const idType = getIdentifierType();

  const handleSubmit = async (e) => {
    e.preventDefault();
    dismissAlert();
    setFieldErrors({});

    const newErrors = {};
    const cleanId = identifier.trim();
    const digitsOnly = cleanId.replace(/\D/g, '');
    if (!cleanId) {
      newErrors.identifier = 'Please enter your registered Phone Number or CNIC.';
    } else if (digitsOnly.length !== 11 && digitsOnly.length !== 13) {
      newErrors.identifier = 'Please enter a valid 11-digit Phone (03XXXXXXXXX) or 13-digit CNIC.';
    } else if (digitsOnly.length === 11 && !digitsOnly.startsWith('03')) {
      newErrors.identifier = "Phone number must be 11 digits starting with '03' (e.g. 03XXXXXXXXX).";
    }

    if (!password) {
      newErrors.password = 'Password is required to authenticate.';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters long.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setAlert({
        title: 'Check your details',
        message: 'Please resolve the highlighted fields before signing in.',
        showReset: false
      });
      if (newErrors.identifier) focusAndScrollTo(idInputRef);
      else if (newErrors.password) focusAndScrollTo(passwordInputRef);
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login(identifier, password);
      
      // Save identifier to history
      if (rememberMe) {
        const newHistory = [identifier, ...history.filter(h => h !== identifier)].slice(0, 5);
        localStorage.setItem('login_history', JSON.stringify(newHistory));
      }
      
      await clinicalSwal.fire({
        title: 'Authentication Verified',
        text: `Welcome back, ${user.name || 'User'}. Logged in as ${user.role}.`,
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
      
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'doctor') navigate('/doctor');
      else navigate('/history');
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      let nextAlert;

      if (!err.response) {
        nextAlert = {
          title: 'Server Unreachable',
          message: 'Could not reach the medical portal server. Make sure the backend is running, then try again.',
          showReset: false
        };
      } else if (status === 400) {
        nextAlert = {
          title: 'Details Not Valid',
          message: detail || 'Please check the sign-in details you entered.',
          showReset: false
        };
      } else if (status === 401) {
        nextAlert = {
          title: 'Sign-In Failed',
          message: detail || 'We could not sign you in. Check your phone number/CNIC and password, then try again.',
          showReset: true
        };
      } else if (status === 429) {
        nextAlert = {
          title: 'Too Many Attempts',
          message: 'Too many sign-in attempts in a short time. Please wait a moment before trying again.',
          showReset: false
        };
      } else {
        nextAlert = {
          title: 'Unexpected Error',
          message: detail || 'Sign-in failed for an unexpected reason. Please try again.',
          showReset: false
        };
      }

      setAlert(nextAlert);
      clinicalSwal.fire({
        icon: 'error',
        title: nextAlert.title,
        text: nextAlert.message,
        timer: ALERT_AUTO_DISMISS_MS,
        showConfirmButton: true
      });
      setFieldErrors(
        status === 400
          ? { identifier: nextAlert.message }
          : status === 401
            ? {
                identifier: 'Check this phone number or CNIC.',
                password: 'This password did not match our records.'
              }
            : status === 429
              ? { password: 'Please wait before trying again.' }
              : {}
      );
      focusAndScrollTo(passwordInputRef);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-6 px-3.5 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none text-left relative overflow-hidden"
      >
        {/* Brand & Portal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3 shadow-xs">
            <img src="/logo-mark-128.png" alt="PulmoAI" className="size-4 object-contain" />
            <span>PulmoAI Clinical CAD Portal</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sign In to Account
          </h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Access diagnostic screenings, appointments, and medical records.
          </p>
        </div>

        {/* Error Alert Box */}
        <AnimatePresence initial={false}>
          {alert && (
            <motion.div
              key="login-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mb-5 overflow-hidden rounded-2xl border border-rose-200/90 dark:border-rose-900/60 bg-gradient-to-b from-rose-50/80 to-white dark:from-rose-950/40 dark:to-slate-900"
            >
              <div className="flex items-start gap-3 p-3.5 sm:p-4">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50 ring-4 ring-rose-50 dark:ring-rose-950/50">
                  <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-rose-800/90 dark:text-rose-200/80">
                    {alert.message}
                  </p>

                  {alert.showReset && (
                    <Link
                      to="/forgot-password"
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 hover:underline"
                    >
                      <span>Reset your password</span>
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          
          {/* Identifier Input (Phone or CNIC) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Phone size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Phone Number or CNIC</span>
                <span className="text-rose-500">*</span>
              </label>

              {idType && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${idType.color}`}>
                  {idType.label}
                </span>
              )}
            </div>

            <div className="relative">
              <input 
                ref={idInputRef}
                type="text" 
                list="identifier-history"
                required
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.identifier 
                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                placeholder="e.g. 03001234567 or 1234512345671"
                value={identifier}
                onChange={(e) => {
                  dismissAlert();
                  clearFieldError('identifier');
                  setIdentifier(e.target.value);
                }}
              />

              <datalist id="identifier-history">
                {history.map((item, index) => (
                  <option key={index} value={item} />
                ))}
              </datalist>
            </div>

            {fieldErrors.identifier && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.identifier}</span>
              </motion.p>
            )}

            <FieldFormatHint type="identifier" value={identifier} />

            {/* Quick history pill suggestions */}
            {history.length > 0 && !identifier && (
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[10px] font-bold text-slate-400 shrink-0">Recent:</span>
                {history.slice(0, 3).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      clearFieldError('identifier');
                      setIdentifier(item);
                    }}
                    className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Account Password</span>
                <span className="text-rose-500">*</span>
              </label>

              <Link 
                to="/forgot-password" 
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>

            <div className="relative">
              <input 
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"} 
                required
                placeholder="••••••••"
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.password 
                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={password}
                onChange={(e) => {
                  dismissAlert();
                  clearFieldError('password');
                  setPassword(e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {fieldErrors.password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.password}</span>
              </motion.p>
            )}

            <FieldFormatHint 
              patternStr="^.{4,64}$" 
              format="Min 4 characters (e.g. ••••••••)" 
              example="4+ chars" 
              description="Clinical or patient login password" 
              value={password} 
            />
          </div>

          {/* Remember Workstation Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/20"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Remember login on this device
              </span>
            </label>
          </div>

          {/* Submit Sign In Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-3 px-4 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                <span>Sign In to Medical Portal</span>
              </>
            )}
          </button>
        </form>

        {/* Alternate Quick Access Options */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
          
          {/* Guest Booking Callout */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <BookmarkCheck size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">New Patient?</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Book an OPD token instantly without logging in.</p>
              </div>
            </div>
            <Link 
              to="/guest-book"
              className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Book Slot</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Doctor Register Link */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            <span>Are you a registered clinician? </span>
            <Link to="/register" className="font-extrabold text-blue-600 dark:text-blue-400 hover:underline">
              Medical Specialist Registration
            </Link>
          </div>
        </div>

        {/* Security Compliance Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>TLS 1.3 Encrypted • HIPAA-Compliant Architecture</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
