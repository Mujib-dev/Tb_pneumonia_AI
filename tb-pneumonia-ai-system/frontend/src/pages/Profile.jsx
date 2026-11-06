import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../services/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  Camera, 
  Save, 
  Phone, 
  Mail, 
  Shield, 
  ShieldCheck, 
  CheckCircle2, 
  Briefcase, 
  MessageSquare, 
  ArrowLeft, 
  Info, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Coins, 
  Stethoscope, 
  HeartPulse, 
  Key, 
  Lock, 
  LogOut, 
  Sparkles, 
  Check, 
  Copy, 
  FileText, 
  AlertCircle, 
  Activity, 
  CheckCircle,
  HelpCircle,
  Hash,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { clinicalSwal, showSuccessAlert, showErrorAlert } from '../utils/alert';
import PasswordStrengthIndicator, { getPasswordCriteria } from '../components/PasswordStrengthIndicator';
import FieldFormatHint from '../components/FieldFormatHint';

const Profile = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const defaultSchedule = [
    { day: 'Monday', active: true, start: '09:00', end: '17:00' },
    { day: 'Tuesday', active: true, start: '09:00', end: '17:00' },
    { day: 'Wednesday', active: true, start: '09:00', end: '17:00' },
    { day: 'Thursday', active: true, start: '09:00', end: '17:00' },
    { day: 'Friday', active: true, start: '09:00', end: '17:00' },
    { day: 'Saturday', active: false, start: '10:00', end: '14:00' },
    { day: 'Sunday', active: false, start: '10:00', end: '14:00' }
  ];

  const parseTimetable = (tt) => {
    if (!tt) return defaultSchedule;
    try {
      const parsed = JSON.parse(tt);
      if (Array.isArray(parsed)) return parsed;
      return defaultSchedule;
    } catch {
      return defaultSchedule;
    }
  };

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone ? user.phone.split(', ') : [''],
    whatsapp: user?.whatsapp || '',
    cnic: user?.cnic || '',
    gender: user?.gender || '',
    age: user?.age ? String(user.age) : '',
    specialization: user?.specialization ? user.specialization.split(', ') : [''],
    clinic_name: user?.clinic_name ? user.clinic_name.split(', ') : [''],
    address: user?.address ? user.address.split(', ') : [''],
    token_mode: user?.token_mode || 'fixed',
    max_tokens: user?.max_tokens || 20,
    about: user?.about || '',
    timetable: user?.timetable || '',
    consultation_fee: user?.consultation_fee !== undefined && user?.consultation_fee !== null ? String(user.consultation_fee) : '',
    profile_pic: null
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        phone: user.phone ? user.phone.split(', ') : [''],
        whatsapp: user.whatsapp || '',
        cnic: user.cnic || '',
        gender: user.gender || '',
        age: user.age ? String(user.age) : '',
        specialization: user.specialization ? user.specialization.split(', ') : [''],
        clinic_name: user.clinic_name ? user.clinic_name.split(', ') : [''],
        address: user.address ? user.address.split(', ') : [''],
        token_mode: user.token_mode || 'fixed',
        max_tokens: user.max_tokens || 20,
        about: user.about || '',
        timetable: user.timetable || '',
        consultation_fee: user.consultation_fee !== undefined && user.consultation_fee !== null ? String(user.consultation_fee) : ''
      }));
      if (user.timetable) {
        setSchedule(parseTimetable(user.timetable));
      }
    }
  }, [user]);

  const [schedule, setSchedule] = useState(parseTimetable(user?.timetable));
  const [preview, setPreview] = useState(
    user?.profile_pic 
      ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${user.profile_pic.replace(/\\/g, '/')}` 
      : null
  );
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [copiedPhone, setCopiedPhone] = useState(false);

  // In-app Password Change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdFieldErrors, setPwdFieldErrors] = useState({});
  const pwdCurrentRef = useRef(null);
  const pwdNewRef = useRef(null);
  const pwdConfirmRef = useRef(null);

  const clearPwdFieldError = (field) => {
    if (pwdFieldErrors[field]) {
      setPwdFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdFieldErrors({});

    const newErrors = {};
    if (!pwdCurrent) {
      newErrors.pwdCurrent = 'Please enter your current password.';
    }
    const pwdCriteria = getPasswordCriteria(pwdNew, 8, 64);
    if (!pwdNew || pwdNew.length < 8) {
      newErrors.pwdNew = 'New password must be at least 8 characters long.';
    } else if (pwdNew.length > 64) {
      newErrors.pwdNew = 'New password cannot exceed 64 characters.';
    } else if (!pwdCriteria.isValid) {
      newErrors.pwdNew = 'Password does not meet security criteria. Combine upper/lower case, numbers, or symbols.';
    }
    if (!pwdConfirm) {
      newErrors.pwdConfirm = 'Please confirm your new password.';
    } else if (pwdNew !== pwdConfirm) {
      newErrors.pwdConfirm = 'Password confirmation does not match new password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setPwdFieldErrors(newErrors);
      setPwdError('Please correct the highlighted errors below.');
      if (newErrors.pwdCurrent) {
        pwdCurrentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => pwdCurrentRef.current?.focus(), 100);
      } else if (newErrors.pwdNew) {
        pwdNewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => pwdNewRef.current?.focus(), 100);
      } else if (newErrors.pwdConfirm) {
        pwdConfirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => pwdConfirmRef.current?.focus(), 100);
      }
      return;
    }

    setPwdSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        identifier: user?.phone || user?.cnic,
        current_password: pwdCurrent,
        new_password: pwdNew
      });
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      setShowPasswordChange(false);
      await clinicalSwal.fire({
        icon: 'success',
        title: 'Password Updated',
        text: 'Your account credentials have been securely updated.'
      });
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to update password. Check your current password.');
      setPwdError(msg);
      setPwdFieldErrors({ pwdCurrent: msg });
      pwdCurrentRef.current?.focus();
      showErrorAlert('Password Update Failed', msg);
    } finally {
      setPwdSubmitting(false);
    }
  };

  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const isPatient = user?.role === 'patient';

  const handleScheduleChange = (index, field, value) => {
    const updatedSchedule = [...schedule];
    updatedSchedule[index][field] = value;
    setSchedule(updatedSchedule);
  };

  const applySchedulePreset = (preset) => {
    let newSchedule = [...schedule];
    if (preset === 'weekdays') {
      newSchedule = newSchedule.map(s => ({
        ...s,
        active: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(s.day),
        start: '09:00',
        end: '17:00'
      }));
    } else if (preset === 'sixdays') {
      newSchedule = newSchedule.map(s => ({
        ...s,
        active: s.day !== 'Sunday',
        start: s.day === 'Saturday' ? '10:00' : '09:00',
        end: s.day === 'Saturday' ? '14:00' : '17:00'
      }));
    } else if (preset === 'all') {
      newSchedule = newSchedule.map(s => ({
        ...s,
        active: true,
        start: '09:00',
        end: '17:00'
      }));
    }
    setSchedule(newSchedule);
  };

  const handleArrayChange = (field, index, value) => {
    const updatedArray = [...formData[field]];
    updatedArray[index] = value;
    setFormData({ ...formData, [field]: updatedArray });
  };

  const addField = (field) => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeField = (field, index) => {
    const updatedArray = formData[field].filter((_, i) => i !== index);
    setFormData({ 
      ...formData, 
      [field]: updatedArray.length > 0 ? updatedArray : [''] 
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        showErrorAlert("Invalid Image", "Please select a valid image file (JPG, PNG, or WebP).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showErrorAlert("File Too Large", "Profile picture must be under 5MB.");
        return;
      }
      setFormData({ ...formData, profile_pic: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, profile_pic: null });
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyPhoneNumber = () => {
    const phone = formData.phone[0] || user?.phone || '';
    if (phone) {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleSignOut = async () => {
    const result = await clinicalSwal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to end your active session?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Sign Out',
      confirmButtonColor: '#ef4444'
    });
    if (result.isConfirmed) {
      const isPatientUser = user?.role === 'patient';
      logout(isPatientUser ? '/' : '/login');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const cleanName = (formData.name || '').trim();
    if (!cleanName || cleanName.length < 3) {
      showErrorAlert("Validation Error", "Full Name must be at least 3 characters long.");
      return;
    }
    
    const validPhones = formData.phone.filter(p => p.trim() !== '');
    if (validPhones.length === 0) {
      showErrorAlert("Validation Error", "Please provide a valid primary contact phone number.");
      return;
    }
    const primaryPhone = validPhones[0].trim().replace(/\D/g, '');
    if (!/^03\d{9}$/.test(primaryPhone)) {
      showErrorAlert("Validation Error", "Phone number must be an 11-digit mobile number starting with '03' (e.g. 03XXXXXXXXX).");
      return;
    }

    if (formData.consultation_fee !== '') {
      const feeNum = Number(formData.consultation_fee);
      if (isNaN(feeNum) || feeNum < 0) {
        showErrorAlert("Validation Error", "Please enter a valid non-negative consultation fee.");
        return;
      }
    }

    if (formData.max_tokens !== '') {
      const maxT = parseInt(formData.max_tokens, 10);
      if (isNaN(maxT) || maxT < 1) {
        showErrorAlert("Validation Error", "Daily token capacity must be at least 1.");
        return;
      }
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('name', cleanName);
      data.append('phone', primaryPhone);
      data.append('whatsapp', formData.whatsapp || '');
      
      if (formData.gender) data.append('gender', formData.gender);
      if (formData.age) data.append('age', formData.age);
      
      const joinedSpecialization = formData.specialization.filter(s => s.trim() !== '').join(', ');
      const joinedClinicName = formData.clinic_name.filter(c => c.trim() !== '').join(', ');
      const joinedAddress = formData.address.filter(a => a.trim() !== '').join(', ');

      data.append('specialization', joinedSpecialization);
      data.append('clinic_name', joinedClinicName);
      data.append('address', joinedAddress);
      data.append('token_mode', formData.token_mode);
      if (formData.max_tokens !== '') {
        data.append('max_tokens', parseInt(formData.max_tokens, 10));
      }
      data.append('about', formData.about);
      data.append('timetable', JSON.stringify(schedule));
      if (formData.consultation_fee !== '') {
        data.append('consultation_fee', formData.consultation_fee);
      }
      if (formData.profile_pic) {
        data.append('profile_pic', formData.profile_pic);
      }

      const response = await api.post('/auth/update-profile', data);

      if (response.data && response.data.user) {
        updateUser(response.data.user);
      }
      
      setSavedSuccess(true);
      showSuccessAlert("Account Updated", "Your profile credentials and settings have been saved successfully.");
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      showErrorAlert("Update Failed", getErrorMessage(err, "Failed to update profile settings. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const getDashboardPath = () => {
    if (user?.role === 'doctor') return '/doctor';
    if (user?.role === 'admin') return '/admin';
    return '/';
  };

  const getRoleBadge = () => {
    if (isDoctor) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
          <Stethoscope size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span>Licensed Physician</span>
        </span>
      );
    }
    if (isAdmin) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
          <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400" />
          <span>System Administrator</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
        <User size={13} className="text-blue-600 dark:text-blue-400" />
        <span>Registered Patient</span>
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-16 px-3.5 sm:px-6 text-left">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={() => navigate(getDashboardPath())}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Account Settings
            </h1>
            {getRoleBadge()}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal identity credentials, practice parameters, and clinical security.
          </p>
        </div>

        {/* Quick Save Header Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 ${
              savedSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
            }`}
          >
            {loading ? (
              <>
                <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <CheckCircle2 size={15} />
                <span>Saved Successfully</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 2-Column Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Profile Card & Vertical Tab Navigation (Sticky on desktop) */}
        <div className="w-full lg:col-span-4 space-y-4 lg:sticky lg:top-20 lg:self-start">
          
          {/* Identity Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-center relative overflow-hidden">
            {/* Avatar Frame with Upload Action */}
            <div className="relative inline-block mx-auto mt-2 mb-3">
              <div className="size-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-md">
                {preview ? (
                  <img 
                    src={preview} 
                    alt={formData.name || 'User Avatar'} 
                    className="w-full h-full object-cover" 
                    onError={() => setPreview(null)}
                  />
                ) : (
                  <span>{(formData.name || user?.name || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              
              <label 
                htmlFor="profile-photo-input"
                className="absolute bottom-0 right-0 size-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 cursor-pointer shadow-md transition-transform hover:scale-105"
                title="Upload new profile picture"
              >
                <Camera size={14} />
                <input 
                  id="profile-photo-input"
                  ref={fileInputRef}
                  type="file" 
                  accept="image/jpeg,image/png,image/jpg,image/webp" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
            </div>

            <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
              {formData.name || 'Your Full Name'}
            </h2>
            
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <Phone size={12} className="text-blue-500" />
              <span>{formData.phone[0] || user?.phone || 'No phone set'}</span>
              <button 
                type="button" 
                onClick={copyPhoneNumber} 
                className="p-1 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                title="Copy phone"
              >
                {copiedPhone ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>
            </div>

            {preview && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                >
                  Remove Photo
                </button>
              </div>
            )}

            {/* Account Status Indicators */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 text-left">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Active
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 text-left">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Security</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={12} />
                  TLS 1.3 / AES
                </span>
              </div>
            </div>
          </div>

          {/* Settings Navigation Menu (Grid 2 on small screens, vertical on desktop) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2 shadow-xs grid grid-cols-2 lg:flex lg:flex-col gap-2 lg:gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`w-full text-left px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                activeTab === 'personal'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 lg:border-transparent lg:bg-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <User size={15} className="shrink-0" />
                <span className="truncate">Personal Identity</span>
              </div>
              <ChevronRight size={13} className={`hidden lg:block ml-2 shrink-0 ${activeTab === 'personal' ? 'opacity-100' : 'opacity-40'}`} />
            </button>

            {isDoctor && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('clinical')}
                  className={`w-full text-left px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    activeTab === 'clinical'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 lg:border-transparent lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Stethoscope size={15} className="shrink-0" />
                    <span className="truncate">Practice &amp; Tokens</span>
                  </div>
                  <ChevronRight size={13} className={`hidden lg:block ml-2 shrink-0 ${activeTab === 'clinical' ? 'opacity-100' : 'opacity-40'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('timetable')}
                  className={`w-full text-left px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    activeTab === 'timetable'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 lg:border-transparent lg:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar size={15} className="shrink-0" />
                    <span className="truncate">Weekly Timetable</span>
                  </div>
                  <ChevronRight size={13} className={`hidden lg:block ml-2 shrink-0 ${activeTab === 'timetable' ? 'opacity-100' : 'opacity-40'}`} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('bio')}
              className={`w-full text-left px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                activeTab === 'bio'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 lg:border-transparent lg:bg-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} className="shrink-0" />
                <span className="truncate">{isDoctor ? 'Professional Bio' : 'Medical Notes & Bio'}</span>
              </div>
              <ChevronRight size={13} className={`hidden lg:block ml-2 shrink-0 ${activeTab === 'bio' ? 'opacity-100' : 'opacity-40'}`} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full text-left px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer col-span-2 lg:col-span-1 ${
                activeTab === 'security'
                  ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 lg:border-transparent lg:bg-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck size={15} className="shrink-0" />
                <span className="truncate">Security &amp; Sessions</span>
              </div>
              <ChevronRight size={13} className={`hidden lg:block ml-2 shrink-0 ${activeTab === 'security' ? 'opacity-100' : 'opacity-40'}`} />
            </button>
          </div>

          {/* Quick Access Portal Shortcuts (Desktop only) */}
          <div className="hidden lg:block bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Platform Quick Links
            </span>
            {isDoctor ? (
              <div className="space-y-1.5">
                <Link to="/doctor" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Queue Management</span>
                  <ChevronRight size={12} />
                </Link>
                <Link to="/history" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Patient Medical Records</span>
                  <ChevronRight size={12} />
                </Link>
                <Link to="/predict" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>AI CAD Radiograph Analysis</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            ) : isPatient ? (
              <div className="space-y-1.5">
                <Link to="/" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Patient Portal Home</span>
                  <ChevronRight size={12} />
                </Link>
                <Link to="/book" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Book Clinic Token</span>
                  <ChevronRight size={12} />
                </Link>
                <Link to="/about" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Medical Specialists Directory</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Link to="/admin" className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors">
                  <span>Admin Command Console</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings Panels */}
        <div className="w-full lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: PERSONAL IDENTITY */}
              {activeTab === 'personal' && (
                <motion.div
                  key="personal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <User className="text-blue-600 dark:text-blue-400" size={18} />
                        Personal Identity &amp; Contact Information
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Update your registered name, primary mobile number, gender, and demographic data.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <User size={13} className="text-blue-600" /> Full Legal Name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-xs" 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Ahmad Khan"
                      />
                      <FieldFormatHint type="name" value={formData.name} />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Phone size={13} className="text-emerald-600" /> Primary Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="tel" 
                        required
                        placeholder="03XXXXXXXXX"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-xs" 
                        value={formData.phone[0] || ''}
                        onChange={(e) => handleArrayChange('phone', 0, e.target.value)}
                      />
                      <FieldFormatHint type="phone" value={formData.phone[0] || ''} />
                      <span className="text-[10px] text-slate-400 mt-1 block">Used for authentication and SMS token alerts.</span>
                    </div>

                    {/* WhatsApp Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-emerald-500" /> WhatsApp Number
                        <span className="text-[10px] text-slate-400 font-normal ml-auto">(Optional)</span>
                      </label>
                      <input 
                        type="tel" 
                        placeholder="03XXXXXXXXX"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-xs" 
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      />
                      <FieldFormatHint type="phone" value={formData.whatsapp} />
                      <span className="text-[10px] text-slate-400 mt-1 block">For instant WhatsApp updates, token alerts &amp; inquiries.</span>
                    </div>

                    {/* National ID / CNIC */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Shield size={13} className="text-indigo-600" /> National ID / CNIC
                      </label>
                      <input 
                        type="text" 
                        readOnly
                        value={formData.cnic || 'Not Assigned / Verified'}
                        className="w-full bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-xs" 
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Locked for audit integrity. Contact administration to modify.</span>
                    </div>

                    {/* Gender Selection */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Male', 'Female', 'Other'].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender: g })}
                            className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              formData.gender?.toLowerCase() === g.toLowerCase()
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Age */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Age (Years)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="125"
                        placeholder="e.g. 34"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-xs" 
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      />
                      <FieldFormatHint 
                        custom={{
                          label: 'Age',
                          hint: 'Valid integer between 1 and 120',
                          example: '35',
                          patternStr: '^[1-9][0-9]?$|^1[0-1][0-9]$|^120$'
                        }}
                        value={formData.age}
                      />
                    </div>
                  </div>

                  {/* Informational Callout */}
                  <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-xl p-3.5 flex items-start gap-3">
                    <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                      Your registered mobile number acts as your unique identity token within the clinical CAD system. Ensure you retain access to this phone number to receive critical diagnostic follow-ups and token alerts.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: CLINICAL PRACTICE & TOKENS (DOCTORS ONLY) */}
              {activeTab === 'clinical' && isDoctor && (
                <motion.div
                  key="clinical"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <Stethoscope className="text-indigo-600 dark:text-indigo-400" size={18} />
                      Clinical Practice &amp; Token Dispatch Parameters
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure your medical specializations, hospital facilities, consultation tariffs, and live token generation logic.
                    </p>
                  </div>

                  {/* Specializations Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Briefcase size={13} className="text-indigo-600" /> Medical Specializations
                      </label>
                      <button
                        type="button"
                        onClick={() => addField('specialization')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Specialization
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.specialization.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder={idx === 0 ? "e.g. Consultant Pulmonologist" : "Secondary specialty"}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-xs" 
                            value={item}
                            onChange={(e) => handleArrayChange('specialization', idx, e.target.value)}
                          />
                          {formData.specialization.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeField('specialization', idx)}
                              className="size-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clinic / Hospital Affiliations */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Shield size={13} className="text-indigo-600" /> Hospital / Clinic Affiliations
                      </label>
                      <button
                        type="button"
                        onClick={() => addField('clinic_name')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Hospital / Clinic
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.clinic_name.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder={idx === 0 ? "e.g. City Chest & Pulmonary Center" : "Additional clinic"}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-xs" 
                            value={item}
                            onChange={(e) => handleArrayChange('clinic_name', idx, e.target.value)}
                          />
                          {formData.clinic_name.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeField('clinic_name', idx)}
                              className="size-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Practice Addresses */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Mail size={13} className="text-indigo-600" /> Physical Practice Addresses
                      </label>
                      <button
                        type="button"
                        onClick={() => addField('address')}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Address
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.address.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder={idx === 0 ? "Primary OPD Address (e.g. OPD Wing 2, Swat Hospital)" : "Secondary clinic address"}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-xs" 
                            value={item}
                            onChange={(e) => handleArrayChange('address', idx, e.target.value)}
                          />
                          {formData.address.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeField('address', idx)}
                              className="size-9 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consultation Fee & Token Configuration */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Coins size={14} className="text-amber-500" />
                      Consultation Tariff &amp; Token Logic
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Consultation Fee */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Standard Consultation Fee (PKR)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                          <input 
                            type="number" 
                            min="0"
                            placeholder="e.g. 1500"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" 
                            value={formData.consultation_fee}
                            onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">Default fee recorded when completing patient check-ups.</span>
                      </div>

                      {/* Daily Token Capacity */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Daily Token Capacity (Max Slots)
                        </label>
                        <input 
                          type="number" 
                          min="1" 
                          max="200"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" 
                          value={formData.max_tokens}
                          onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value })}
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Maximum patients accommodated per clinic day.</span>
                      </div>
                    </div>

                    {/* Token Mode Selection */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Queue Dispatch Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div 
                          onClick={() => setFormData({ ...formData, token_mode: 'fixed' })}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            formData.token_mode === 'fixed'
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">Fixed Mode</span>
                            <span className={`size-3.5 rounded-full border flex items-center justify-center ${formData.token_mode === 'fixed' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                              {formData.token_mode === 'fixed' && <Check size={8} />}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Strictly caps bookings at your defined daily maximum. Further appointments are blocked once quota is reached.
                          </p>
                        </div>

                        <div 
                          onClick={() => setFormData({ ...formData, token_mode: 'dynamic' })}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            formData.token_mode === 'dynamic'
                              ? 'bg-purple-50/80 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">Dynamic Mode</span>
                            <span className={`size-3.5 rounded-full border flex items-center justify-center ${formData.token_mode === 'dynamic' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>
                              {formData.token_mode === 'dynamic' && <Check size={8} />}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Automatically adds overflow slots when appointment demand exceeds baseline daily capacity.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: TIMETABLE & AVAILABILITY (DOCTORS ONLY) */}
              {activeTab === 'timetable' && isDoctor && (
                <motion.div
                  key="timetable"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Calendar className="text-emerald-600 dark:text-emerald-400" size={18} />
                        Weekly OPD Schedule &amp; Timings
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Define which days your OPD is open and specify patient consultation hours.
                      </p>
                    </div>

                    {/* Schedule Quick Presets */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('weekdays')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Mon - Fri
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('sixdays')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Mon - Sat
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset('all')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        All 7 Days
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {schedule.map((dayObj, index) => (
                      <div 
                        key={dayObj.day} 
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          dayObj.active 
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/60' 
                            : 'bg-slate-50/70 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={dayObj.active}
                              onChange={(e) => handleScheduleChange(index, 'active', e.target.checked)}
                            />
                            <div className="w-10 h-5.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:size-4.5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                          <span className={`text-xs font-bold ${dayObj.active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                            {dayObj.day}
                          </span>
                        </div>

                        {dayObj.active ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xs">
                              <Clock size={12} className="text-slate-400" />
                              <input 
                                type="time" 
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white outline-none"
                                value={dayObj.start}
                                onChange={(e) => handleScheduleChange(index, 'start', e.target.value)}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase">to</span>
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xs">
                              <Clock size={12} className="text-slate-400" />
                              <input 
                                type="time" 
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white outline-none"
                                value={dayObj.end}
                                onChange={(e) => handleScheduleChange(index, 'end', e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 italic">Clinic Closed / Off-Duty</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: BIOGRAPHY & MEDICAL BACKGROUND */}
              {activeTab === 'bio' && (
                <motion.div
                  key="bio"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <FileText className="text-purple-600 dark:text-purple-400" size={18} />
                      {isDoctor ? 'Professional Medical Bio & Accreditations' : 'Medical Notes & Personal Health Context'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isDoctor 
                        ? 'Introduce your clinical expertise, years of experience, and clinical focus areas for prospective patients.' 
                        : 'Record past respiratory issues, drug allergies, or clinical context you wish to share with reviewing physicians.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isDoctor ? 'About Doctor / Professional Profile' : 'Patient Health Profile & Notes'}
                    </label>
                    <textarea 
                      rows="6"
                      value={formData.about}
                      onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                      placeholder={
                        isDoctor 
                          ? "Dr. Sarah Jenkins is an experienced Pulmonologist specializing in tuberculosis screening, interstitial lung disease, and modern AI-assisted diagnostic evaluation..." 
                          : "Brief medical notes (e.g. History of chronic cough, penicillin sensitivity, non-smoker)..."
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none placeholder:text-slate-400 shadow-xs" 
                    ></textarea>
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>Displayed on clinic profiles and consultation summaries.</span>
                      <span>{formData.about?.length || 0} characters</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 5: SECURITY & SESSIONS */}
              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <ShieldCheck className="text-blue-600 dark:text-blue-400" size={18} />
                      Security, Authentication &amp; Active Session
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Review your login credential parameters, clinical encryption protocols, and session controls.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3.5">
                      <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Key size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Primary Authentication Identifier
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Your account identifier is registered to <strong className="text-slate-800 dark:text-white font-bold">{formData.phone[0] || user?.phone}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                      <div className="flex items-start justify-between gap-3.5">
                        <div className="flex items-start gap-3.5">
                          <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Lock size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                              Account Security &amp; Password
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Enforce clinical password complexity (8–64 characters) to safeguard patient healthcare data.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordChange(!showPasswordChange);
                            setPwdError('');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          {showPasswordChange ? 'Cancel' : 'Change Password'}
                        </button>
                      </div>

                      {showPasswordChange && (
                        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3.5">
                          {pwdError && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
                              <AlertCircle size={14} className="shrink-0" />
                              <span>{pwdError}</span>
                            </div>
                          )}

                          {/* Current Password */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Current Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                ref={pwdCurrentRef}
                                type={showPwdCurrent ? "text" : "password"}
                                required
                                value={pwdCurrent}
                                onChange={(e) => {
                                  clearPwdFieldError('pwdCurrent');
                                  setPwdCurrent(e.target.value);
                                }}
                                placeholder="Enter your current password"
                                className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
                                  pwdFieldErrors.pwdCurrent
                                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
                                    : 'border-slate-200 dark:border-slate-700 focus:ring-purple-500/20 focus:border-purple-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                              >
                                {showPwdCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            {pwdFieldErrors.pwdCurrent && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
                              >
                                <AlertCircle size={13} className="shrink-0" />
                                <span>{pwdFieldErrors.pwdCurrent}</span>
                              </motion.p>
                            )}
                            <FieldFormatHint type="password" value={pwdCurrent} />
                          </div>

                          {/* New Password */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              New Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                ref={pwdNewRef}
                                type={showPwdNew ? "text" : "password"}
                                required
                                minLength={8}
                                maxLength={64}
                                value={pwdNew}
                                onChange={(e) => {
                                  clearPwdFieldError('pwdNew');
                                  setPwdNew(e.target.value);
                                }}
                                placeholder="At least 8 characters (mixed case & numbers)"
                                className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
                                  pwdFieldErrors.pwdNew
                                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
                                    : 'border-slate-200 dark:border-slate-700 focus:ring-purple-500/20 focus:border-purple-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPwdNew(!showPwdNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                              >
                                {showPwdNew ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            {pwdFieldErrors.pwdNew && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
                              >
                                <AlertCircle size={13} className="shrink-0" />
                                <span>{pwdFieldErrors.pwdNew}</span>
                              </motion.p>
                            )}
                            <FieldFormatHint type="password" value={pwdNew} />
                            <PasswordStrengthIndicator password={pwdNew} minLength={8} maxLength={64} />
                          </div>

                          {/* Confirm New Password */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                              <span>Confirm New Password <span className="text-rose-500">*</span></span>
                              {pwdConfirm && (
                                <span className={`text-[10px] font-bold ${pwdNew === pwdConfirm ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                  {pwdNew === pwdConfirm ? '✓ Passwords match' : '✗ Do not match'}
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <input
                                ref={pwdConfirmRef}
                                type={showPwdConfirm ? "text" : "password"}
                                required
                                minLength={8}
                                maxLength={64}
                                value={pwdConfirm}
                                onChange={(e) => {
                                  clearPwdFieldError('pwdConfirm');
                                  setPwdConfirm(e.target.value);
                                }}
                                placeholder="Re-enter new password"
                                className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
                                  pwdFieldErrors.pwdConfirm
                                    ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 focus:ring-rose-500/20 focus:border-rose-500'
                                    : pwdConfirm && pwdNew !== pwdConfirm
                                    ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                                    : pwdConfirm && pwdNew === pwdConfirm
                                    ? 'border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500'
                                    : 'border-slate-200 dark:border-slate-700 focus:ring-purple-500/20 focus:border-purple-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                              >
                                {showPwdConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            {pwdFieldErrors.pwdConfirm && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-rose-500 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 mt-1.5"
                              >
                                <AlertCircle size={13} className="shrink-0" />
                                <span>{pwdFieldErrors.pwdConfirm}</span>
                              </motion.p>
                            )}
                          </div>

                          <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowPasswordChange(false);
                                setPwdCurrent('');
                                setPwdNew('');
                                setPwdConfirm('');
                              }}
                              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handlePasswordUpdate}
                              disabled={pwdSubmitting}
                              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                              {pwdSubmitting ? 'Updating...' : 'Update Password'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3.5">
                      <div className="size-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Clinical Data Compliance &amp; Encryption
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          All diagnostic scans, Grad-CAM heatmaps, and doctor-patient consultations are encrypted at rest with AES-256 and protected under HIPAA-grade health data security standards.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sign Out Action */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Active Session</h4>
                      <p className="text-[11px] text-slate-400">Sign out of this browser session safely.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Bottom Form Action Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500" />
                <span>Modifications apply immediately to your active clinic profile.</span>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => navigate(getDashboardPath())}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-50 ${
                    savedSuccess 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Profile Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save All Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
