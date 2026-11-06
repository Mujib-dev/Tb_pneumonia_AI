import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Phone, 
  Lock, 
  KeyRound, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Activity,
  Check
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { clinicalSwal, showErrorAlert, showSuccessAlert } from '../utils/alert';
import PasswordStrengthIndicator, { getPasswordCriteria } from '../components/PasswordStrengthIndicator';
import FieldFormatHint from '../components/FieldFormatHint';

const ForgotPassword = () => {
  const [identifier, setIdentifier] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const idRef = useRef(null);
  const currentPwdRef = useRef(null);
  const newPwdRef = useRef(null);
  const confirmPwdRef = useRef(null);
  const navigate = useNavigate();

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

  const handlePhoneOrCnicChange = (val) => {
    clearFieldError('identifier');
    setIdentifier(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setFieldErrors({});

    const newErrors = {};
    const cleanId = identifier.trim();
    if (!cleanId) {
      newErrors.identifier = 'Please enter your Phone number or CNIC.';
    } else {
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length !== 11 && digitsOnly.length !== 13) {
        newErrors.identifier = 'Please enter a valid 11-digit Phone (03XXXXXXXXX) or 13-digit CNIC.';
      } else if (digitsOnly.length === 11 && !digitsOnly.startsWith('03')) {
        newErrors.identifier = "Phone number must start with '03' (e.g. 03XXXXXXXXX).";
      }
    }

    if (!currentPassword) {
      newErrors.current_password = 'Enter your existing account password.';
    }

    const pwdCriteria = getPasswordCriteria(newPassword, 8, 64);
    if (!newPassword || newPassword.length < 8) {
      newErrors.new_password = 'New password must be at least 8 characters long.';
    } else if (newPassword.length > 64) {
      newErrors.new_password = 'New password cannot exceed 64 characters.';
    } else if (!pwdCriteria.isValid) {
      newErrors.new_password = 'New password does not meet security criteria. Combine upper/lower case, numbers, or symbols.';
    }

    if (!confirmPassword) {
      newErrors.confirm_password = 'Confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm_password = 'Password confirmation does not match new password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError('Please resolve the highlighted errors below.');
      if (newErrors.identifier) focusAndScrollTo(idRef);
      else if (newErrors.current_password) focusAndScrollTo(currentPwdRef);
      else if (newErrors.new_password) focusAndScrollTo(newPwdRef);
      else if (newErrors.confirm_password) focusAndScrollTo(confirmPwdRef);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        identifier: cleanId,
        current_password: currentPassword,
        new_password: newPassword
      });

      const successText = response.data?.message || "Password updated successfully.";
      setMessage(successText);
      
      await clinicalSwal.fire({
        title: 'Credentials Updated',
        text: 'Your password has been updated successfully. Redirecting to login...',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false
      });

      navigate('/login');
    } catch (err) {
      const errorMsg = getErrorMessage(err, "Failed to update password. Verify your Phone/CNIC and current password.");
      showErrorAlert("Password Reset Failed", errorMsg);
      setError(errorMsg);
      const lower = errorMsg.toLowerCase();
      if (lower.includes('current password') || lower.includes('identity verification')) {
        setFieldErrors({ current_password: errorMsg });
        focusAndScrollTo(currentPwdRef);
      } else if (lower.includes('phone') || lower.includes('cnic') || lower.includes('user not found')) {
        setFieldErrors({ identifier: errorMsg });
        focusAndScrollTo(idRef);
      } else {
        setFieldErrors({ current_password: errorMsg });
        focusAndScrollTo(currentPwdRef);
      }
    } finally {
      setLoading(false);
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
        {/* Brand & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3 shadow-xs">
            <KeyRound size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Secure Credential Recovery</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Reset Account Password
          </h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Enter your registered Phone Number or CNIC and your current password to set a new one.
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300"
          >
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">
              {error}
            </div>
          </motion.div>
        )}

        {/* Success Alert Box */}
        {message && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">
              {message}
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          
          {/* Phone or CNIC Identifier */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Registered Phone Number or CNIC</span>
              <span className="text-rose-500">*</span>
            </label>
            <input 
              ref={idRef}
              type="text" 
              required
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                fieldErrors.identifier 
                  ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                  : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
              }`}
              placeholder="e.g. 03001234567 or 1234512345671"
              value={identifier}
              onChange={(e) => handlePhoneOrCnicChange(e.target.value)}
            />
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
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Current Password</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input 
                ref={currentPwdRef}
                type={showCurrentPassword ? "text" : "password"} 
                required
                placeholder="Your existing password"
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.current_password 
                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={currentPassword}
                onChange={(e) => {
                  clearFieldError('current_password');
                  setCurrentPassword(e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1"
                title={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.current_password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.current_password}</span>
              </motion.p>
            )}
            <FieldFormatHint patternStr="^.{4,64}$" format="Existing password (min 4 chars)" example="••••••••" value={currentPassword} />
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-blue-600 dark:text-blue-400" />
              <span>New Account Password</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input 
                ref={newPwdRef}
                type={showNewPassword ? "text" : "password"} 
                required
                minLength={8}
                maxLength={64}
                placeholder="At least 8 characters (mixed case & numbers)"
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.new_password 
                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={newPassword}
                onChange={(e) => {
                  clearFieldError('new_password');
                  setNewPassword(e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.new_password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.new_password}</span>
              </motion.p>
            )}
            <FieldFormatHint type="password" value={newPassword} />
            <PasswordStrengthIndicator password={newPassword} minLength={8} maxLength={64} />
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Confirm New Password</span>
                <span className="text-rose-500">*</span>
              </span>
              {confirmPassword && (
                <span className={`text-[10px] font-bold ${
                  newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                }`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Do not match'}
                </span>
              )}
            </label>
            <div className="relative">
              <input 
                ref={confirmPwdRef}
                type={showConfirmPassword ? "text" : "password"} 
                required
                minLength={8}
                maxLength={64}
                placeholder="Re-enter new password"
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.confirm_password
                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
                    : confirmPassword && newPassword !== confirmPassword 
                    ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' 
                    : confirmPassword && newPassword === confirmPassword
                    ? 'border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={confirmPassword}
                onChange={(e) => {
                  clearFieldError('confirm_password');
                  setConfirmPassword(e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.confirm_password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.confirm_password}</span>
              </motion.p>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-3 px-4 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {loading ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Resetting Password...</span>
              </>
            ) : (
              <>
                <KeyRound size={15} />
                <span>Update Account Password</span>
              </>
            )}
          </button>
        </form>

        {/* Navigation Link to Login */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link 
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft size={13} />
            <span>Return to Sign In</span>
          </Link>
        </div>

        {/* Security Compliance Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Encrypted Session • Verified Credential Reset</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
