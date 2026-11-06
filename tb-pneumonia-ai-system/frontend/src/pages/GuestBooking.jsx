import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { 
  Calendar, 
  Clock, 
  User, 
  Stethoscope, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  Phone, 
  Building,
  BookmarkCheck,
  X,
  Search,
  UserPlus
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import FieldFormatHint from '../components/FieldFormatHint';

const clinicalSwal = Swal.mixin({
  background: '#0f172a',
  color: '#ffffff',
  confirmButtonColor: '#2563eb',
  cancelButtonColor: '#1e293b',
  customClass: {
    popup:'border border-black/10 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-[#0f172a]',
    title: 'text-slate-900 dark:text-white font-black tracking-tight text-lg sm:text-xl',
    htmlContainer: 'text-gray-600 dark:text-gray-400 text-xs leading-relaxed',
    confirmButton: 'px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-slate-900 dark:text-white bg-blue-600 hover:bg-blue-700 transition-colors mx-1 cursor-pointer',
    cancelButton: 'px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 transition-colors mx-1 cursor-pointer',
    input: 'bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-full mb-2',
    actions: 'mt-4'
  },
  buttonsStyling: false
});

const GuestBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectedDoctorId = location.state?.selectedDoctorId;
  
  // Data states
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  
  // Selection states
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const todayDateString = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const [bookingDate, setBookingDate] = useState(todayDateString);
  const [bookedTokens, setBookedTokens] = useState([]);
  const [queueWindow, setQueueWindow] = useState(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  
  // Registration Form States
  const [showRegForm, setShowRegForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cnic: '',
    gender: 'Male',
    age: ''
  });
  
  // Approval States
  const [registrationStatus, setRegistrationStatus] = useState('idle'); // idle, submitting, waiting, approved, rejected
  const [requestId, setRequestId] = useState(null);
  const [approvedToken, setApprovedToken] = useState(null);
  const wsRef = useRef(null);

  // Inline Validation & Auto-Redirect States
  const [fieldErrors, setFieldErrors] = useState({});
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const cnicInputRef = useRef(null);
  const ageInputRef = useRef(null);

  const focusAndScrollTo = (ref) => {
    if (!ref || !ref.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      ref.current?.focus();
    }, 120);
  };

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await axios.get((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/doctors/list');
        const docs = response.data || [];
        setDoctors(docs);
        if (preSelectedDoctorId) {
          const matchedDoc = docs.find(d => d.id === preSelectedDoctorId);
          if (matchedDoc) {
            setSelectedDoctor(matchedDoc);
          }
        }
      } catch (err) {
        console.error("Failed to load doctor directory:", err);
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, [preSelectedDoctorId]);

  // Fetch booked tokens when selected doctor or booking date changes
  useEffect(() => {
    const fetchQueueWindow = async () => {
      if (!selectedDoctor) {
        setBookedTokens([]);
        setQueueWindow(null);
        return;
      }
      setLoadingTokens(true);
      setSelectedToken(null);
      try {
        const response = await axios.get((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/appointments/queue-window', {
          params: { doctor_id: selectedDoctor.id, date: bookingDate }
        });
        const data = response.data || {};
        setQueueWindow(data);
        setBookedTokens(Array.isArray(data.booked_tokens) ? data.booked_tokens : []);
      } catch (err) {
        console.error("Failed to load queue window:", err);
        setQueueWindow(null);
        setBookedTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };
    fetchQueueWindow();
  }, [selectedDoctor, bookingDate]);

  // WebSocket connection for real-time approval updates
  useEffect(() => {
    if (registrationStatus === 'waiting' && requestId) {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/api/ws/queue?request_id=${encodeURIComponent(requestId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => console.log("WebSocket connected for guest approval");
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'REGISTRATION_APPROVED' && data.request_id === requestId) {
          setRegistrationStatus('approved');
          setApprovedToken(data.token_number);
          clinicalSwal.fire({
            icon: 'success',
            title: 'Request Approved!',
            text: `Your account has been created and you are assigned Token #${data.token_number}. Please login with your Phone/CNIC to view your dashboard.`,
            confirmButtonText: 'Go to Login'
          }).then(() => {
            navigate('/login');
          });
        } else if (data.type === 'REGISTRATION_REJECTED' && data.request_id === requestId) {
          setRegistrationStatus('rejected');
          clinicalSwal.fire({
            icon: 'error',
            title: 'Request Rejected',
            text: `Reason: ${data.reason}`,
            confirmButtonText: 'Try Again'
          }).then(() => {
            setRegistrationStatus('idle');
            setShowRegForm(false);
          });
        }
      };

      ws.onerror = (err) => console.error("WebSocket error:", err);
      
      return () => {
        if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === 0)) {
          wsRef.current.close();
        }
      };
    }
  }, [registrationStatus, requestId, navigate]);

  const handleOpenForm = () => {
    if (!selectedDoctor || !bookingDate || !selectedToken) return;
    setFieldErrors({});
    setShowRegForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const cleanName = (formData.name || '').trim();
    if (!cleanName || cleanName.length < 3) {
      newErrors.name = 'Full Name must be at least 3 characters long.';
    }

    const cleanPhone = (formData.phone || '').trim();
    if (!/^03\d{9}$/.test(cleanPhone)) {
      newErrors.phone = "Phone number must be an 11-digit number starting with '03' (e.g., 03001234567).";
    }

    const cleanCnic = (formData.cnic || '').replace(/-/g, '').trim();
    if (!/^\d{13}$/.test(cleanCnic)) {
      newErrors.cnic = 'CNIC must be exactly 13 digits (e.g., 1234567890123).';
    }

    const ageNum = parseInt(formData.age, 10);
    if (!formData.age || isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      newErrors.age = 'Please enter a valid age between 1 and 120 years.';
    }

    if (!formData.gender) {
      newErrors.gender = 'Please select a gender option.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      if (newErrors.name) focusAndScrollTo(nameInputRef);
      else if (newErrors.phone) focusAndScrollTo(phoneInputRef);
      else if (newErrors.cnic) focusAndScrollTo(cnicInputRef);
      else if (newErrors.age) focusAndScrollTo(ageInputRef);
      return;
    }

    if (!selectedDoctor || !selectedToken) {
      clinicalSwal.fire({
        icon: 'error',
        title: 'Incomplete Selection',
        text: 'Please select an available doctor and queue token slot.'
      });
      return;
    }

    setRegistrationStatus('submitting');
    
    try {
      const response = await axios.post((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/registration/request', {
        ...formData,
        cnic: cleanCnic,
        phone: cleanPhone,
        doctor_id: selectedDoctor.id,
        booking_date: bookingDate,
        token_number: selectedToken
      });
      
       setRequestId(response.data.request_id);
       if (response.data.queue_window) {
         setQueueWindow(response.data.queue_window);
         setBookedTokens(response.data.queue_window.booked_tokens || []);
       }
       setRegistrationStatus('waiting');
    } catch (err) {
      setRegistrationStatus('idle');
      const errDetail = err.response?.data?.detail || 'An error occurred. Please try again.';
      const lower = typeof errDetail === 'string' ? errDetail.toLowerCase() : '';

      if (lower.includes('phone')) {
        setFieldErrors(prev => ({ ...prev, phone: errDetail }));
        focusAndScrollTo(phoneInputRef);
      } else if (lower.includes('cnic')) {
        setFieldErrors(prev => ({ ...prev, cnic: errDetail }));
        focusAndScrollTo(cnicInputRef);
      } else if (lower.includes('age')) {
        setFieldErrors(prev => ({ ...prev, age: errDetail }));
        focusAndScrollTo(ageInputRef);
      } else {
        clinicalSwal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: errDetail
        });
      }
    }
  };

  const formatDoctorName = (name) => {
    if (!name) return 'Doctor';
    const trimmed = name.trim();
    return trimmed.toLowerCase().startsWith('dr') ? trimmed : `Dr. ${trimmed}`;
  };

  const specializations = ['All', ...new Set(doctors.map(d => d.specialization).filter(Boolean))];

  const filteredDoctors = doctors.filter(doc => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      doc.name.toLowerCase().includes(q) || 
      (doc.specialization && doc.specialization.toLowerCase().includes(q)) ||
      (doc.clinic_name && doc.clinic_name.toLowerCase().includes(q));
      
    const matchesSpecialty = selectedSpecialty === 'All' || doc.specialization === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  const setQuickDate = (daysFromToday) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setBookingDate(`${year}-${month}-${day}`);
  };

  const isTodaySelected = bookingDate === todayDateString;
  const tomorrowDateString = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const isTomorrowSelected = bookingDate === tomorrowDateString;

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-12 px-3 sm:px-6">
      {/* Hero Header */}
      <div className="text-left mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-2 shadow-xs">
          <BookmarkCheck size={14} className="text-blue-600 dark:text-blue-400" />
          <span>Fast-Track Clinic Queue</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Guest Token Registration
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
          Book an instant consultation slot as a new patient without prior registration. Pick your doctor, choose a date, and reserve your live queue token.
        </p>
      </div>

      {registrationStatus === 'waiting' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 text-center shadow-lg max-w-xl mx-auto my-8">
          <div className="relative size-20 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-blue-600/20 animate-ping" />
            <div className="size-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin flex items-center justify-center" />
            <Clock className="absolute text-blue-600 dark:text-blue-400" size={24} />
          </div>

          <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-3">
            Pending Doctor Review
          </span>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Request Sent for Approval
          </h2>

          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
            Your request for <strong className="text-slate-900 dark:text-white font-bold">Token #{selectedToken}</strong> with{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{formatDoctorName(selectedDoctor?.name)}</strong> on{' '}
            <strong className="text-slate-900 dark:text-white font-bold">{bookingDate}</strong> has been transmitted to the clinic.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span className="font-medium">Patient Name:</span>
              <span className="font-bold text-slate-900 dark:text-white">{formData.name}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span className="font-medium">Contact Phone:</span>
              <span className="font-bold text-slate-900 dark:text-white">{formData.phone}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span className="font-medium">Clinic:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedDoctor?.clinic_name || 'PulmoAI Clinic'}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 animate-pulse">
            ⚡ Please keep this tab open. Your confirmation will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Doctor Selection */}
          <div className="lg:col-span-7 space-y-4">
            {/* Modern Search & Specialist Filter Suite */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/70 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                    <Stethoscope size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white leading-tight">
                      Find Medical Specialist
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {filteredDoctors.length} {filteredDoctors.length === 1 ? 'specialist' : 'specialists'} available today
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {(searchQuery || selectedSpecialty !== 'All') && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setSelectedSpecialty('All'); }}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X size={11} /> Reset Filter
                    </button>
                  )}
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                    Live Directory
                  </span>
                </div>
              </div>

              {/* Elevated Search Bar Input */}
              <div className="relative group">
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 transition-all duration-200 group-focus-within:border-blue-500 group-focus-within:bg-white dark:group-focus-within:bg-slate-900 group-focus-within:ring-4 group-focus-within:ring-blue-500/15 shadow-inner">
                  <Search className="text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors shrink-0 mr-2.5" size={17} />
                  <input 
                    type="text"
                    placeholder="Search by doctor name, clinic name, or specialty..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="size-5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shrink-0 ml-1.5"
                      title="Clear search query"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Specialty Filter Pills */}
              {specializations.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                    Specialty:
                  </span>
                  {specializations.map((spec) => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSelectedSpecialty(spec)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer ${
                        selectedSpecialty === spec
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingDoctors ? (
              <div className="text-center py-24 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="size-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-xs font-semibold">Loading available medical specialists...</p>
              </div>
            ) : filteredDoctors.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                {filteredDoctors.map((doc) => {
                  const isSelected = selectedDoctor?.id === doc.id;
                  const docDisplayName = formatDoctorName(doc.name);

                  return (
                    <motion.div
                      key={doc.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDoctor(doc)}
                      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all duration-200 text-left flex flex-col justify-between relative group shadow-xs ${
                        isSelected 
                          ? 'bg-gradient-to-br from-blue-50/90 to-indigo-50/60 dark:from-blue-950/50 dark:to-indigo-950/40 border-2 border-blue-600 dark:border-blue-500 shadow-md ring-2 sm:ring-4 ring-blue-500/15' 
                          : 'bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {/* Top Checkmark Badge */}
                      {isSelected ? (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-blue-600 text-white rounded-full p-1 shadow-xs">
                          <CheckCircle size={12} className="sm:size-[14px]" />
                        </div>
                      ) : (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 text-[9px] sm:text-[10px] font-bold">
                          Select
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="relative size-10 sm:size-12 rounded-lg sm:rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600 shrink-0 shadow-xs">
                            {doc.profile_pic ? (
                              <img 
                                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${doc.profile_pic.replace(/\\/g, '/')}`} 
                                alt={docDisplayName} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <User className="text-slate-400 dark:text-slate-300" size={18} />
                            )}
                            <span className="absolute bottom-0.5 right-0.5 size-2 sm:size-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Active" />
                          </div>

                          <div className="min-w-0 pr-4 sm:pr-6">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                              {docDisplayName}
                            </h4>
                            <span className="inline-block mt-0.5 px-1.5 sm:px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 rounded-md text-[9px] sm:text-[10px] font-bold tracking-tight truncate max-w-full">
                              {doc.specialization || 'Medical Specialist'}
                            </span>
                          </div>
                        </div>

                        {doc.about && (
                          <p className="mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                            {doc.about}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 sm:mt-3.5 pt-2 sm:pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs gap-1.5">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-slate-600 dark:text-slate-300 font-medium truncate min-w-0">
                          <Building className="text-slate-400 shrink-0" size={12} />
                          <span className="truncate text-[10px] sm:text-[11px]">{doc.clinic_name || 'PulmoAI Clinic'}</span>
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
                <AlertCircle className="size-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No doctors match your search</h4>
                <p className="text-xs text-slate-500 mt-1">Try searching by a different name or specialization</p>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Booking Details */}
          <div className="lg:col-span-5 space-y-4 sticky top-24">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden text-left">
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Booking Details
                  </h3>
                </div>
                {selectedDoctor && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                    Live Queue
                  </span>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {selectedDoctor ? (
                  <>
                    {/* Active Doctor Snapshot */}
                    <div className="flex items-center gap-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 p-3 rounded-xl">
                      <div className="size-10 rounded-lg overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0 shadow-xs">
                        {selectedDoctor.profile_pic ? (
                          <img 
                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${selectedDoctor.profile_pic.replace(/\\/g, '/')}`} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User className="text-blue-500" size={18} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider block leading-tight">
                          Consulting With
                        </span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                          {formatDoctorName(selectedDoctor.name)}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {selectedDoctor.specialization} • {selectedDoctor.clinic_name}
                        </p>
                      </div>
                    </div>

                    {/* Step 1: Date Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                          <Calendar size={13} className="text-blue-600" /> Consult Date
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setQuickDate(0)}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${
                              isTodaySelected 
                                ? 'bg-blue-600 text-white shadow-xs' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickDate(1)}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${
                              isTomorrowSelected 
                                ? 'bg-blue-600 text-white shadow-xs' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            Tomorrow
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <input 
                          type="date" 
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all shadow-xs"
                          value={bookingDate}
                          min={todayDateString}
                          onChange={(e) => setBookingDate(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Step 2: Token Slot Grid */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        <span>Select Token Slot</span>
                        <div className="flex items-center gap-2">
                          {queueWindow && (
                            <span className="text-[9px] font-bold normal-case tracking-normal text-blue-600 dark:text-blue-400">
                              Batch {queueWindow.active_batch} • T-{queueWindow.window_start}–T-{queueWindow.window_end}
                            </span>
                          )}
                          {selectedToken && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-blue-600 dark:text-blue-400 font-extrabold text-[10px]">
                                Token #{selectedToken}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedToken(null)}
                                className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                                title="Deselect token"
                              >
                                <X size={10} /> Clear
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[9px] text-slate-500 dark:text-slate-400 pt-0.5 pb-1">
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-full bg-slate-200 dark:bg-slate-600 border border-slate-300" /> Available
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-full bg-blue-600" /> Selected
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700 line-through" /> Booked
                        </span>
                      </div>

                      {loadingTokens ? (
                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-slate-500 text-xs">Checking slot availability...</p>
                        </div>
                      ) : (() => {
                        const fallbackLength = selectedDoctor?.max_tokens ? Number(selectedDoctor.max_tokens) : 20;
                        const visibleTokens = queueWindow?.tokens?.length
                          ? queueWindow.tokens
                          : Array.from({ length: fallbackLength }, (_, index) => index + 1);
                        const pendingTokens = queueWindow?.pending_tokens || [];

                        return (
                          <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {visibleTokens.map((tokenNumber) => {
                              const isBooked = bookedTokens.includes(tokenNumber);
                              const isPending = pendingTokens.includes(tokenNumber);
                              const isUnavailable = isBooked || isPending;
                              const isSelected = selectedToken === tokenNumber;

                              return (
                                <button
                                  key={tokenNumber}
                                  type="button"
                                  disabled={isUnavailable}
                                  onClick={() => setSelectedToken(isSelected ? null : tokenNumber)}
                                  className={`h-8 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center justify-center border shadow-xs ${
                                    isUnavailable
                                      ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 line-through cursor-not-allowed'
                                      : isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400 scale-105 z-10'
                                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 cursor-pointer active:scale-95'
                                  }`}
                                >
                                  T-{tokenNumber}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Step 3: Registration Trigger */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={!selectedToken}
                        onClick={handleOpenForm}
                        className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md ${
                          selectedToken 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer active:scale-[0.99] shadow-blue-500/25' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <UserPlus size={15} /> 
                        <span>Proceed to Registration</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                    <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                      <Stethoscope size={24} />
                    </div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      No Doctor Selected
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                      Choose a doctor from the directory on the left to see consult dates and available tokens.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Form Modal */}
      <AnimatePresence>
        {showRegForm && registrationStatus === 'idle' && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 w-full max-w-lg relative my-auto shadow-2xl text-left"
            >
              <button 
                onClick={() => setShowRegForm(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Guest Patient Details
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Booking <strong className="text-blue-600 dark:text-blue-400 font-bold">Token #{selectedToken}</strong> for {bookingDate}
                  </p>
                </div>
              </div>
              
              <form noValidate onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    ref={nameInputRef}
                    name="name" 
                    value={formData.name} 
                    onChange={handleFormChange} 
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none transition-all shadow-xs ${
                      fieldErrors.name 
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                        : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`} 
                    placeholder="e.g. John Doe" 
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                  <FieldFormatHint type="name" value={formData.name} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input 
                      ref={phoneInputRef}
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleFormChange} 
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none transition-all shadow-xs ${
                        fieldErrors.phone 
                          ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      }`} 
                      placeholder="03001234567" 
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{fieldErrors.phone}</span>
                      </p>
                    )}
                    <FieldFormatHint type="phone" value={formData.phone} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      CNIC / B-Form <span className="text-red-500">*</span>
                    </label>
                    <input 
                      ref={cnicInputRef}
                      name="cnic" 
                      value={formData.cnic} 
                      onChange={handleFormChange} 
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none transition-all shadow-xs ${
                        fieldErrors.cnic 
                          ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      }`} 
                      placeholder="12345-1234567-1" 
                    />
                    {fieldErrors.cnic && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{fieldErrors.cnic}</span>
                      </p>
                    )}
                    <FieldFormatHint type="cnic" value={formData.cnic} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gender
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Male', 'Female'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, gender: g });
                            clearFieldError('gender');
                          }}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            formData.gender === g
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.gender && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{fieldErrors.gender}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input 
                      ref={ageInputRef}
                      name="age" 
                      type="number" 
                      min="1" 
                      max="120" 
                      value={formData.age} 
                      onChange={handleFormChange} 
                      className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all shadow-xs ${
                        fieldErrors.age 
                          ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      }`} 
                      placeholder="e.g. 35" 
                    />
                    {fieldErrors.age && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{fieldErrors.age}</span>
                      </p>
                    )}
                    <FieldFormatHint patternStr="^(?:[1-9]|[1-9][0-9]|1[01][0-9]|120)$" format="1 to 120 whole years" example="35" value={formData.age} />
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold uppercase tracking-wider text-xs py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    Confirm & Send Token Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GuestBooking;
