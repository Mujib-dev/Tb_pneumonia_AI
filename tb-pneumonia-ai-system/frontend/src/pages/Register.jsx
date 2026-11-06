import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { showErrorAlert, clinicalSwal } from '../utils/alert';
import { 
  Camera, 
  Eye, 
  EyeOff, 
  User, 
  Phone, 
  Shield, 
  Lock, 
  Key, 
  Stethoscope, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Activity, 
  UserPlus, 
  Info,
  Sparkles,
  Check
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator';
import FieldFormatHint from '../components/FieldFormatHint';
import {
  LIMITS,
  PROFILE_PIC_MIME_TYPES,
  collectErrors,
  digitsOnly,
  formatCnic,
  hasErrors,
  matchErrorField,
  validateAccessCode,
  validateCnic,
  validateImageFile,
  validateName,
  validatePassword,
  validatePhone,
  withoutField
} from '../utils/validation';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cnic: '',
    password: '',
    access_code: ''
  });
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const cnicInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const accessCodeInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const termsInputRef = useRef(null);
  const navigate = useNavigate();

  const focusAndScrollTo = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        if (typeof ref.current?.focus === 'function') {
          ref.current.focus();
        }
      }, 150);
    }
  };

  const clearFieldError = (fieldName) => {
    setFieldErrors(prev => withoutField(prev, fieldName));
  };

  // Dynamic CNIC Formatter
  const handleCnicChange = (val) => {
    clearFieldError('cnic');
    setFormData({ ...formData, cnic: digitsOnly(val, LIMITS.CNIC_DIGITS) });
  };

  const formatCnicDisplay = formatCnic;

  const handlePhoneChange = (val) => {
    clearFieldError('phone');
    setFormData({ ...formData, phone: digitsOnly(val, LIMITS.PHONE_DIGITS) });
  };

  const handleFileChange = (e) => {
    clearFieldError('profile_pic');
    const file = e.target.files[0];
    if (file) {
      const fileError = validateImageFile(file, { label: 'Profile picture', mimeTypes: ['image/jpeg', 'image/png', 'image/jpg'] });
      if (fileError) {
        showErrorAlert("Invalid Image", fileError);
        return;
      }
      setProfilePic(file);
      setPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemovePhoto = () => {
    setProfilePic(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const cleanName = (formData.name || '').trim();
    const cleanPhone = digitsOnly(formData.phone);
    const cleanCnic = digitsOnly(formData.cnic);
    const cleanAccessCode = (formData.access_code || '').trim();

    const newErrors = collectErrors({
      name: () => validateName(cleanName, { label: 'Full Legal Name' }),
      phone: () => validatePhone(cleanPhone),
      cnic: () => validateCnic(cleanCnic, { label: 'National CNIC' }),
      password: () => validatePassword(formData.password, { label: 'Account Password' }),
      access_code: () => validateAccessCode(cleanAccessCode),
      profile_pic: () => validateImageFile(profilePic, { label: 'Profile picture', allowEmpty: false, mimeTypes: ['image/jpeg', 'image/png', 'image/jpg'] }),
      terms: () => (termsAccepted ? '' : 'Please acknowledge and accept the Terms of Use and Privacy Safeguards.')
    });

    if (hasErrors(newErrors)) {
      setFieldErrors(newErrors);
      setError('Please review and resolve the highlighted errors below.');
      if (newErrors.profile_pic) focusAndScrollTo(photoInputRef);
      else if (newErrors.name) focusAndScrollTo(nameInputRef);
      else if (newErrors.phone) focusAndScrollTo(phoneInputRef);
      else if (newErrors.cnic) focusAndScrollTo(cnicInputRef);
      else if (newErrors.password) focusAndScrollTo(passwordInputRef);
      else if (newErrors.access_code) focusAndScrollTo(accessCodeInputRef);
      else if (newErrors.terms) focusAndScrollTo(termsInputRef);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const fd = new FormData();
      fd.append('name', cleanName);
      fd.append('phone', cleanPhone);
      fd.append('cnic', cleanCnic);
      fd.append('password', formData.password);
      fd.append('role', 'doctor');
      if (cleanAccessCode) {
        fd.append('access_code', cleanAccessCode);
      }
      if (profilePic) {
        fd.append('profile_pic', profilePic);
      }

      // Content-Type is intentionally left to axios: setting it by hand drops the
      // multipart boundary and the API replies 400 "Missing boundary in multipart".
      await api.post('/auth/register', fd);
      
      await clinicalSwal.fire({
        title: 'Physician Account Verified',
        text: 'Your medical credentials have been registered successfully. You may now log in to access diagnostic screening tools.',
        icon: 'success',
        confirmButtonText: 'Proceed to Sign In'
      });
      
      navigate('/login');
    } catch (err) {
      const message = getErrorMessage(err, 'Registration failed. Please check your credentials.');
      showErrorAlert("Registration Failed", message);
      setError(message);

      const field = matchErrorField(message, {
        phone: ['phone'],
        cnic: ['cnic'],
        access_code: ['code', 'authorization', 'license'],
        password: ['password'],
        name: ['name'],
        profile_pic: ['photo', 'picture', 'image']
      });

      if (field) {
        setFieldErrors({ [field]: message });
        focusAndScrollTo({
          phone: phoneInputRef,
          cnic: cnicInputRef,
          access_code: accessCodeInputRef,
          password: passwordInputRef,
          name: nameInputRef,
          profile_pic: photoInputRef
        }[field]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-6 px-3.5 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-200/50 dark:shadow-none text-left relative overflow-hidden"
      >
        {/* Brand & Clinician Onboarding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-3 shadow-xs bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
            <Stethoscope size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>Authorized Medical Specialist Onboarding</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Clinician Account Registration
          </h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
            Create an accredited physician profile to evaluate chest radiographs and oversee live OPD patient queues.
          </p>
          <p className="mt-1 text-slate-400 dark:text-slate-500 text-[11px] max-w-md mx-auto">
            Patient accounts are created by the attending doctor during consultation.
          </p>
        </div>

        {/* Error Alert Message */}
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          
          {/* Profile Photo Uploader */}
          <div ref={photoInputRef} className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border transition-all text-center ${
            fieldErrors.profile_pic ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20' : 'border-slate-200/80 dark:border-slate-800'
          }`}>
            <div className="relative inline-block mb-2">
              <div className="size-20 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 shadow-sm">
                {preview ? (
                  <img 
                    src={preview} 
                    alt="Portrait Preview" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User size={32} className="text-slate-300 dark:text-slate-600" />
                )}
              </div>

              <label 
                htmlFor="register-photo-upload"
                className="absolute bottom-0 right-0 size-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-pointer shadow-md transition-transform hover:scale-105"
                title="Upload portrait photo"
              >
                <Camera size={13} />
                <input 
                  id="register-photo-upload"
                  ref={fileInputRef}
                  type="file" 
                  accept="image/jpeg,image/png,image/jpg" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Official Clinical Portrait <span className="text-rose-500">*</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Visible to patients on token passes (JPG or PNG, max 5MB).
              </p>
            </div>

            {preview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-[11px] font-bold text-rose-500 hover:underline mt-2 cursor-pointer"
              >
                Remove Picture
              </button>
            )}

            {fieldErrors.profile_pic && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.profile_pic}</span>
              </motion.p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Full Name &amp; Title</span>
              <span className="text-rose-500">*</span>
            </label>
            <input 
              ref={nameInputRef}
              type="text" 
              required
              placeholder="e.g. Dr. Mujib Ur Rahman"
              maxLength={LIMITS.NAME_MAX}
              className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                fieldErrors.name 
                  ? 'border-rose-500 bg-rose-50/25 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                  : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
              }`}
              value={formData.name}
              onChange={(e) => {
                clearFieldError('name');
                setFormData({ ...formData, name: e.target.value.slice(0, LIMITS.NAME_MAX) });
              }}
            />
            {fieldErrors.name && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.name}</span>
              </motion.p>
            )}
            <FieldFormatHint type="name" value={formData.name} />
          </div>

          {/* Phone & CNIC (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Mobile Phone</span>
                  <span className="text-rose-500">*</span>
                </span>
                {formData.phone.length === LIMITS.PHONE_DIGITS && !fieldErrors.phone && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <Check size={10} /> Valid
                  </span>
                )}
              </label>
              <input 
                ref={phoneInputRef}
                type="tel" 
                required
                placeholder="03001234567"
                maxLength={LIMITS.PHONE_DIGITS}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.phone 
                    ? 'border-rose-500 bg-rose-50/25 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              {fieldErrors.phone && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
                >
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{fieldErrors.phone}</span>
                </motion.p>
              )}
              <FieldFormatHint type="phone" value={formData.phone} />
            </div>

            {/* CNIC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield size={13} className="text-indigo-600 dark:text-indigo-400" />
                  <span>National CNIC</span>
                  <span className="text-rose-500">*</span>
                </span>
                {formData.cnic.length === 13 && !fieldErrors.cnic && (
                  <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                    <Check size={10} /> 13 Digits
                  </span>
                )}
              </label>
              <input 
                ref={cnicInputRef}
                type="text" 
                required
                placeholder="12345-1234567-1"
                maxLength={15}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.cnic 
                    ? 'border-rose-500 bg-rose-50/25 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={formatCnicDisplay(formData.cnic)}
                onChange={(e) => handleCnicChange(e.target.value)}
              />
              {fieldErrors.cnic && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
                >
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{fieldErrors.cnic}</span>
                </motion.p>
              )}
              <FieldFormatHint type="cnic" value={formData.cnic} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Account Password</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input 
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"} 
                required
                placeholder="At least 8 characters (mixed case, numbers & symbols)"
                minLength={8}
                maxLength={64}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl pl-4 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 shadow-xs ${
                  fieldErrors.password 
                    ? 'border-rose-500 bg-rose-50/25 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
                value={formData.password}
                onChange={(e) => {
                  clearFieldError('password');
                  setFormData({ ...formData, password: e.target.value });
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
            <FieldFormatHint type="password" value={formData.password} />
            <PasswordStrengthIndicator password={formData.password} minLength={8} maxLength={64} />
          </div>

          {/* Medical Access Authorization Code */}
          <div className={`border rounded-2xl p-4 space-y-2 transition-all ${
            fieldErrors.access_code 
              ? 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-400 dark:border-rose-900' 
              : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/70'
          }`}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Doctor Registration Code</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                Admin Only
              </span>
            </div>

            <input 
              ref={accessCodeInputRef}
              type="text" 
              required
              placeholder="e.g. DOC-7860"
              className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal shadow-xs uppercase tracking-wider ${
                fieldErrors.access_code 
                  ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/25 focus:border-rose-500' 
                  : 'border-indigo-200 dark:border-indigo-700 focus:ring-indigo-500/25 focus:border-indigo-500'
              }`}
              value={formData.access_code}
              onChange={(e) => {
                clearFieldError('access_code');
                setFormData({ ...formData, access_code: e.target.value });
              }}
            />

            {fieldErrors.access_code && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.access_code}</span>
              </motion.p>
            )}

            <FieldFormatHint type="accessCode" value={formData.access_code} />

            <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
              This is the <span className="font-extrabold">doctor registration code</span> issued by your hospital or system administrator. Enter it exactly as given (for example <span className="font-bold">DOC-7860</span>). Each code works only once, so ask your administrator for a new one if it has already been used.
            </p>
          </div>

          {/* Terms & Conditions Checkbox */}
          <div ref={termsInputRef} className="pt-1 px-1">
            <div className="flex items-start gap-2.5">
              <input 
                type="checkbox" 
                id="register-terms"
                checked={termsAccepted}
                onChange={(e) => {
                  clearFieldError('terms');
                  setTermsAccepted(e.target.checked);
                }}
                className={`mt-0.5 size-4 rounded cursor-pointer text-blue-600 focus:ring-blue-500/20 ${
                  fieldErrors.terms ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-300 dark:border-slate-700'
                }`}
              />
              <label htmlFor="register-terms" className="text-xs text-slate-600 dark:text-slate-400 leading-snug cursor-pointer select-none">
                I certify that I am a licensed healthcare professional and agree to uphold patient confidentiality under the{' '}
                <Link to="/terms" target="_blank" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Clinical Data Privacy Policy
                </Link>.
              </label>
            </div>
            {fieldErrors.terms && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>{fieldErrors.terms}</span>
              </motion.p>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-3.5 px-4 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {isSubmitting ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Validating Clinical License...</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Complete Physician Registration</span>
              </>
            )}
          </button>

        </form>

        {/* Alternate Quick Links */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Already possess an authorized account?{' '}
            <Link to="/login" className="font-extrabold text-blue-600 dark:text-blue-400 hover:underline">
              Sign In to Medical Portal
            </Link>
          </p>

          <p className="text-[11px] text-slate-400">
            Patients seeking chest X-ray screening or doctor appointments do not require doctor registration.{' '}
            <Link to="/guest-book" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Book a Patient Token Here
            </Link>
          </p>
        </div>

        {/* Security Compliance Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Encrypted Diagnostic Portal • ISO 27001 / HIPAA Standard</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
