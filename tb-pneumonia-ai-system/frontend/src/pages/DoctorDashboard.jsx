import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, Activity, TrendingUp, AlertCircle, 
  CheckCircle, FileText, Plus, 
  Download, Printer, X, UserPlus, Calendar,
  ChevronRight, Link as LinkIcon, PieChart as PieChartIcon, Clock, Info, Coins, ArrowRight,
  MessageSquare, Trash2, CheckCircle2, RefreshCw, Mail, Stethoscope, Sparkles, Volume2
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useAuth } from '../services/AuthContext'
import { clinicalSwal } from '../utils/alert'
import api, { getDoctorMessages, getAssetUrl, getStoredToken } from '../services/api'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import FieldFormatHint from '../components/FieldFormatHint'

// ──────────────────────────────────────────────────
// Fee Modal — shown when doctor marks a patient done
// ──────────────────────────────────────────────────
const FeeModal = ({ isOpen, onClose, onConfirm, defaultFee }) => {
  const [customFee, setCustomFee] = useState(defaultFee || 0);
  useEffect(() => { if (isOpen) setCustomFee(defaultFee || 0); }, [isOpen, defaultFee]);
  if (!isOpen) return null;
  const half = Math.floor((defaultFee || 0) / 2);
  const presets = [
    { label: 'Full Fee', value: defaultFee || 0, color: 'bg-blue-600 text-white border-blue-600' },
    { label: 'Half Fee', value: half,             color: 'bg-amber-500 text-white border-amber-500' },
    { label: 'Free',     value: 0,                color: 'bg-emerald-600 text-white border-emerald-600' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              💰
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Consultation Fee</h3>
              <p className="text-[10px] text-slate-400">Record final patient payment</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
            <X size={15} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {presets.map(p => (
              <button 
                key={p.label} 
                onClick={() => setCustomFee(p.value)}
                className={`py-3 rounded-2xl font-bold text-xs uppercase tracking-wider border-2 transition-all cursor-pointer ${
                  customFee === p.value 
                    ? p.color + ' shadow-md scale-102 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>{p.label}</div>
                <div className="text-[10px] opacity-80 mt-0.5 font-bold">Rs. {p.value}</div>
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Or enter custom amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rs.</span>
              <input 
                type="number" 
                min="0" 
                value={customFee} 
                onChange={e => setCustomFee(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3 text-slate-900 dark:text-white font-extrabold text-lg outline-none focus:ring-2 focus:ring-blue-500 text-right" 
              />
            </div>
          </div>
          <button 
            onClick={() => onConfirm(customFee)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <CheckCircle2 size={16} />
            Complete Consultation & Collect Rs. {customFee}
          </button>
        </div>
      </div>
    </div>
  );
};

const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const [filter, setFilter] = useState('All')
  const [newPatient, setNewPatient] = useState({
    name: '', cnic: '', phone: '', password: '', address: '', gender: '', age: '', profile_pic: null
  })
  const [formErrors, setFormErrors] = useState({})
  const [formTouched, setFormTouched] = useState({})
  // Fee modal state
  const [feeModal, setFeeModal] = useState({ open: false, appId: null })

  // Doctor Direct Messages States
  const [doctorMessages, setDoctorMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Ids already announced, so a poll can spot an arrival. Null until the first
  // load lands, which keeps the initial batch from toasting on page open.
  const seenMsgIdsRef = useRef(null);

  const fetchDoctorMessages = async ({ silent = false } = {}) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await getDoctorMessages();
      const incoming = res.data || [];

      if (silent && seenMsgIdsRef.current) {
        const fresh = incoming.filter(m => !seenMsgIdsRef.current.has(m.id));
        if (fresh.length === 1) {
          toast.info(`New inquiry from ${fresh[0].name}`, { autoClose: 3000 });
        } else if (fresh.length > 1) {
          toast.info(`${fresh.length} new inquiries received`, { autoClose: 3000 });
        }
      }
      seenMsgIdsRef.current = new Set(incoming.map(m => m.id));

      setDoctorMessages(incoming);
    } catch (err) {
      console.error("Failed to load doctor messages:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Mark-read, delete and WhatsApp reply now live on /inquiries, which owns the
  // full list. The dashboard only needs the fetched messages for the unread count.

  // Live Token Queue States
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [queueWindow, setQueueWindow] = useState(null);
  const [queueFilterDate, setQueueFilterDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  const fetchTodayQueue = async (dateOverride) => {
    try {
      const token = getStoredToken();
      if (!token) return;
      const dateToFetch = dateOverride !== undefined ? dateOverride : queueFilterDate;
      const [queueResponse, windowResponse] = await Promise.all([
        api.get('/appointments/doctor-today', {
          params: { date: dateToFetch, active_only: true }
        }),
        api.get('/appointments/queue-window', {
          params: { doctor_id: user?.id, date: dateToFetch }
        })
      ]);
      setTodayAppointments(Array.isArray(queueResponse.data) ? queueResponse.data : []);
      setQueueWindow(windowResponse.data || null);
    } catch (err) {
      console.error("Failed to load today's appointments queue:", err);
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  const [pendingRequests, setPendingRequests] = useState([]);
  
  const fetchPendingRequests = async (dateOverride) => {
    try {
      const token = getStoredToken();
      if (!token) return;
      const dateToFetch = dateOverride !== undefined ? dateOverride : queueFilterDate;
      const response = await api.get('/registration/requests', {
        params: { date: dateToFetch, active_only: true }
      });
      setPendingRequests(response.data || []);
    } catch (err) {
      console.error("Failed to load pending requests:", err);
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const response = await api.post(`/registration/${requestId}/approve`, {});
      
      clinicalSwal.fire({
        title: 'Request Approved!',
        text: `Patient account created and assigned Token #${response.data.assigned_token}`,
        icon: 'success'
      });
      fetchPendingRequests();
      fetchTodayQueue();
      fetchData();
    } catch (err) {
      clinicalSwal.fire({
        title: 'Approval Failed',
        text: err.response?.data?.detail || "Failed to approve request",
        icon: 'error'
      });
    }
  };

  const handleRejectRequest = async (requestId) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason === null) return;
    
    try {
      await api.post(`/registration/${requestId}/reject`, { reason });
      
      clinicalSwal.fire({
        title: 'Request Rejected',
        text: "The registration request has been rejected.",
        icon: 'info'
      });
      fetchPendingRequests();
      fetchTodayQueue();
    } catch (err) {
      clinicalSwal.fire({
        title: 'Rejection Failed',
        text: err.response?.data?.detail || "Failed to reject request",
        icon: 'error'
      });
    }
  };

  const handleMoveAllToTomorrow = async () => {
    const incomplete = todayAppointments.filter(t => t.status !== 'completed' && t.status !== 'absent');
    if (incomplete.length === 0) return;

    const result = await clinicalSwal.fire({
      title: 'End Shift?',
      text: `Move all ${incomplete.length} pending patients to tomorrow?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, move all',
      confirmButtonColor: '#4f46e5'
    });
    if (result.isConfirmed) {
      try {
        await Promise.all(incomplete.map(t => 
          api.post('/appointments/move-to-tomorrow', {
            appointment_id: t.id
          })
        ));
        clinicalSwal.fire({
          title: 'Shift Ended',
          text: 'All pending patients moved to tomorrow.',
          icon: 'success'
        });
        fetchTodayQueue();
        fetchData();
      } catch (err) {
        clinicalSwal.fire({
          title: 'Error',
          text: 'Failed to move some patients.',
          icon: 'error'
        });
        fetchTodayQueue();
      }
    }
  };

  const announceToken = (tokenNum, patientName) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
        const text = patientName 
          ? `Token number ${tokenNum}, ${patientName}, please proceed to the doctor.`
          : `Token number ${tokenNum}, please proceed to the doctor.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (audioErr) {
      console.warn("Speech synthesis error:", audioErr);
    }
  };

  const handleUpdateAppointmentStatus = async (appId, newStatus) => {
    // For completions, show fee modal first
    if (newStatus === 'completed') {
      setFeeModal({ open: true, appId });
      return;
    }

    if (newStatus === 'serving') {
      const targetApp = todayAppointments.find(a => a.id === appId);
      if (targetApp) {
        announceToken(targetApp.token_number, targetApp.patient_name_override || targetApp.patient?.name);
      }
    }

    try {
      await api.post('/appointments/update-status', {
        appointment_id: appId,
        status: newStatus
      });
      fetchTodayQueue();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleFeeConfirmed = async (fee) => {
    const { appId } = feeModal;
    setFeeModal({ open: false, appId: null });
    try {
      await api.post('/appointments/update-status', {
        appointment_id: appId,
        status: 'completed',
        custom_fee: fee
      });
      fetchTodayQueue();
      fetchData();
    } catch (err) {
      console.error('Failed to complete with fee:', err);
    }
  };

  useEffect(() => {
    fetchTodayQueue();
    fetchPendingRequests();
    fetchDoctorMessages();
    const interval = setInterval(() => {
      fetchTodayQueue();
      fetchPendingRequests();
      fetchDoctorMessages({ silent: true });
    }, 10000); // Poll every 10 seconds for ultra-responsive live dashboard
    
    // Setup WebSocket for new requests
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const authToken = localStorage.getItem('token') || '';
    const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/api/ws/queue?token=${encodeURIComponent(authToken)}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_REGISTRATION_REQUEST') {
        fetchPendingRequests();
      }
    };
    
    return () => {
      clearInterval(interval);
      if (ws.readyState === 1) {
        ws.close();
      } else if (ws.readyState === 0) {
        ws.onopen = () => ws.close();
      }
    };
  }, [user]);

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getStoredToken();
      if (!token) {
        setError("No authentication token found. Please log in again.");
        return;
      }
      const response = await api.get('/doctor/dashboard');
      setData(response.data);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      if (err.response?.status === 401) {
        logout();
        setError("Your clinical session has expired. Please log out and log in again.");
      } else {
        setError(err.response?.data?.detail || "Could not connect to the clinical database.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (patientId) => {
    try {
      await api.post('/doctor/link-patient', { patient_id: patientId });
      clinicalSwal.fire({
        title: 'Patient Linked!',
        text: "Patient linked successfully to your registry!",
        icon: 'success'
      });
      setSearchResult(null);
      fetchData();
    } catch (err) {
      clinicalSwal.fire({
        title: 'Link Failed',
        text: err.response?.data?.detail || "Failed to link patient.",
        icon: 'error'
      });
    }
  };

  // Field-level Validation Helpers for Registration
  const validatePatientField = (fieldName, value, currentValues = newPatient) => {
    switch (fieldName) {
      case 'name': {
        const val = (value || '').trim();
        if (!val) return 'Patient full name is required.';
        if (val.length < 3) return 'Full name must be at least 3 characters.';
        if (!/^[a-zA-Z\s.'-]+$/.test(val)) return "Name can only contain letters, spaces, and punctuation (. - ').";
        return '';
      }
      case 'cnic': {
        const clean = (value || '').replace(/\D/g, '');
        if (!clean) return 'CNIC / National ID is required.';
        if (clean.length !== 13) return `CNIC must be exactly 13 digits (${clean.length}/13 entered).`;
        return '';
      }
      case 'phone': {
        const clean = (value || '').replace(/\D/g, '');
        if (!clean) return 'Phone number is required.';
        if (!clean.startsWith('03')) return "Phone number must start with '03' (e.g. 03XXXXXXXXX).";
        if (clean.length !== 11) return `Phone number must be exactly 11 digits (${clean.length}/11 entered).`;
        return '';
      }
      case 'gender': {
        if (!value) return 'Please select patient gender.';
        return '';
      }
      case 'age': {
        if (value === '' || value === null || value === undefined) return 'Patient age is required.';
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 120) return 'Age must be between 1 and 120 years.';
        return '';
      }
      case 'password': {
        if (value && value.length < 6) return 'Password must be at least 6 characters long.';
        return '';
      }
      default:
        return '';
    }
  };

  const validateAllPatientFields = (values = newPatient) => {
    const errors = {};
    const fieldsToValidate = ['name', 'cnic', 'phone', 'gender', 'age', 'password'];
    fieldsToValidate.forEach(field => {
      const err = validatePatientField(field, values[field], values);
      if (err) errors[field] = err;
    });
    return errors;
  };

  const resetRegisterModal = () => {
    setNewPatient({
      name: '', cnic: '', phone: '', password: '', address: '', gender: '', age: '', profile_pic: null
    });
    setFormErrors({});
    setFormTouched({});
    setShowRegisterForm(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const errors = validateAllPatientFields(newPatient);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormTouched({
        name: true,
        cnic: true,
        phone: true,
        gender: true,
        age: true,
        password: true
      });
      clinicalSwal.fire({
        icon: 'warning',
        title: 'Validation Errors',
        text: 'Please review and fix the highlighted fields in the form before saving.',
        confirmButtonText: 'Review Form'
      });
      return;
    }

    const cleanName = (newPatient.name || '').trim();
    const cleanCnic = (newPatient.cnic || '').replace(/\D/g, '').trim();
    const cleanPhone = (newPatient.phone || '').replace(/\D/g, '').trim();

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('cnic', cleanCnic);
      formData.append('phone', cleanPhone);
      formData.append('address', newPatient.address || '');
      if (newPatient.gender) formData.append('gender', newPatient.gender);
      if (newPatient.age) formData.append('age', newPatient.age);
      if (newPatient.password) formData.append('password', newPatient.password);
      if (newPatient.profile_pic) formData.append('profile_pic', newPatient.profile_pic);

      await api.post('/doctor/register-patient', formData);
      
      clinicalSwal.fire({
        title: 'Registered & Linked!',
        text: "Patient registered and linked successfully!",
        icon: 'success'
      });
      resetRegisterModal();
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "";
      if (msg.includes("already exists") || msg.includes("already registered")) {
        resetRegisterModal();
        api.get(`/doctor/search-patient?identifier=${newPatient.cnic}`).then(res => {
          setSearchResult(res.data);
        }).catch(console.error);
      } else {
        clinicalSwal.fire({
          title: 'Registration Failed',
          text: msg || "Registration failed.",
          icon: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data?.records) return;
    const headers = ["Patient Name", "Result", "Confidence", "Date"];
    const rows = data.records.map(r => [
      `"${r.patient_name || 'Guest/Self'}"`, 
      r.result, 
      (r.confidence * 100).toFixed(1) + "%", 
      new Date(r.created_at).toLocaleDateString()
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clinical_records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    toast.success("Clinical records exported to CSV.", { autoClose: 5000 });
  };

  const filteredRecords = data?.records?.filter(r => {
    const matchesFilter = filter === 'All' || r.result === filter;
    if (!showTodayOnly) return matchesFilter;
    
    const today = new Date().toLocaleDateString();
    const recordDate = new Date(r.created_at).toLocaleDateString();
    return matchesFilter && today === recordDate;
  }) || [];
  
  // Recent Diagnostic Activity - Limited to Top 10 Records
  const recentRecords = filteredRecords?.slice(0, 10);

  // Clean greeting name (removes any duplicate Dr prefix)
  const rawName = user?.name || data?.doctor_name || 'Specialist';
  const cleanDoctorName = rawName.replace(/^Dr\.?\s*/i, '');

  if (loading && !data) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
      <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="font-bold text-base text-slate-600 dark:text-slate-300">Synchronizing Clinical Hub...</p>
    </div>
  );

  const statsData = data?.stats || { total: 0, normal: 0, tb: 0, pneumonia: 0, patient_count: 0 };
  const fallbackLength = user?.max_tokens ? Number(user.max_tokens) : 20;
  const activeQueueTokens = queueWindow?.tokens?.length
    ? queueWindow.tokens
    : Array.from({ length: fallbackLength }, (_, index) => index + 1);
  const activeWindowStart = queueWindow?.window_start ?? activeQueueTokens[0] ?? 1;
  const activeWindowEnd = queueWindow?.window_end ?? activeQueueTokens[activeQueueTokens.length - 1] ?? fallbackLength;
  const activeWindowSize = activeWindowEnd - activeWindowStart + 1;
  const activeAppointmentsByToken = new Map(
    todayAppointments.map((appointment) => [appointment.token_number, appointment])
  );
  const activePendingTokens = new Set(
    pendingRequests.map((request) => request.token_number)
  );

  const activeInQueueAppointments = todayAppointments.filter(
    (app) => app.status !== 'completed' && app.status !== 'absent' && app.status !== 'arrived'
  );

  const completedAppointments = todayAppointments.filter(app => app.status === 'completed');
  const incompleteAppointments = todayAppointments.filter(t => t.status !== 'completed' && t.status !== 'absent');
  const servingAppointment = todayAppointments.find(a => a.status === 'serving');
  const unreadMessagesCount = doctorMessages.filter(m => !m.is_read).length;

  return (
    <>
      {/* Fee Modal */}
      <FeeModal
        isOpen={feeModal.open}
        onClose={() => setFeeModal({ open: false, appId: null })}
        onConfirm={handleFeeConfirmed}
        defaultFee={user?.consultation_fee || data?.stats?.consultation_fee || 0}
      />

      <div className="max-w-6xl mx-auto pt-2 pb-12 px-4 space-y-5 sm:space-y-6">
        <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
        
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 rounded-2xl flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle size={20} />
              <p className="text-sm font-semibold">{error}</p>
            </div>
            {error.includes("expired") ? (
              <button onClick={logout} className="text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer">
                Log Out & Re-authenticate
              </button>
            ) : (
              <button onClick={fetchData} className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl cursor-pointer">
                Retry Sync
              </button>
            )}
          </div>
        )}

        {/* ── Modern Clinical Header ── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-2">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <Stethoscope size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  Clinical Hub
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Welcome back, <span className="font-bold text-slate-800 dark:text-slate-200">Dr. {cleanDoctorName}</span> • <span className="text-blue-600 dark:text-blue-400 font-semibold">{user?.specialization || 'Clinical Specialist'}</span> {user?.clinic_name ? `• ${user.clinic_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Action Buttons Row on Mobile */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
              {/* Register Patient Button */}
              <button
                type="button"
                onClick={() => setShowRegisterForm(true)}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>New Patient</span>
              </button>

              {/* Patient Inquiries Button */}
              <button
                type="button"
                onClick={() => navigate('/inquiries')}
                className="relative flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <MessageSquare size={15} className="text-emerald-500" />
                <span>Inquiries</span>
                {unreadMessagesCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ── 1. Modern KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard 
            icon={<Users size={18} />} 
            title="Patients" 
            value={statsData.patient_count} 
            color="blue" 
            badge="Registry" 
            subtitle="Active directory"
          />
          <StatCard 
            icon={<Activity size={18} />} 
            title="Total Screenings" 
            value={statsData.total} 
            color="slate" 
            badge="Analyzed" 
            subtitle="Scans processed"
          />
          <StatCard 
            icon={<AlertCircle size={18} />} 
            title="Tuberculosis" 
            value={statsData.tb} 
            color="red" 
            badge="Attention" 
            subtitle={statsData.total > 0 ? `${Math.round((statsData.tb / statsData.total) * 100)}% of total` : '0%'}
          />
          <StatCard 
            icon={<TrendingUp size={18} />} 
            title="Pneumonia" 
            value={statsData.pneumonia} 
            color="purple" 
            badge="Priority" 
            subtitle={statsData.total > 0 ? `${Math.round((statsData.pneumonia / statsData.total) * 100)}% of total` : '0%'}
          />
          <StatCard 
            icon={<CheckCircle size={18} />} 
            title="Normal Findings" 
            value={statsData.normal} 
            color="green" 
            badge="Healthy" 
            subtitle={statsData.total > 0 ? `${Math.round((statsData.normal / statsData.total) * 100)}% of total` : '0%'}
          />
        </div>

        {/* ── Pending Patient Requests (Waiting Approval) ── */}
        {pendingRequests.length > 0 && (
          <div className="glass p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-left relative overflow-hidden shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <UserPlus size={20} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Pending Patient Approvals</h3>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  {pendingRequests.length} Unregistered patients waiting for token approval
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800/90 border border-amber-200 dark:border-amber-800/60 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="mb-2 sm:mb-3">
                    <div className="flex justify-between items-start gap-1 mb-1">
                      <h4 className="font-bold text-[11px] sm:text-xs text-slate-900 dark:text-white truncate">{req.name}</h4>
                      <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8.5px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-black shrink-0">
                        T-{req.token_number}
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono truncate">{req.phone}</p>
                    <p className="text-[8.5px] sm:text-[10px] text-slate-500 font-mono truncate">{req.cnic}</p>
                    <p className="text-[8px] sm:text-[10px] text-slate-400 mt-1 truncate">
                      {req.gender} • {req.age}Y • {req.booking_date}
                    </p>
                  </div>
                  
                  <div className="flex gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <button 
                      onClick={() => handleApproveRequest(req.id)}
                      className="flex-1 py-1.5 px-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer truncate"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleRejectRequest(req.id)}
                      className="flex-1 py-1.5 px-1 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer truncate"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. Today's Live Appointment Queue (Redesigned) ── */}
        <div className="glass p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left relative overflow-hidden transition-all shadow-xs space-y-3.5">
          {/* Header row */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Clock size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Today's Live Appointment Queue
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Batch {queueWindow?.active_batch || 1} • Slots {activeWindowStart}–{activeWindowEnd}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Live patient tracking & consultation serving workflow
                </p>
              </div>
            </div>

            {/* Right: Now Serving Badge & End Shift Action */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {incompleteAppointments.length > 0 && (
                <button 
                  onClick={handleMoveAllToTomorrow}
                  className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <ArrowRight size={12} /> Move {incompleteAppointments.length} to Tomorrow
                </button>
              )}

              {/* Now Serving Live Card */}
              <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border ${
                servingAppointment 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                <span className={`size-2 rounded-full ${servingAppointment ? 'bg-blue-500 animate-ping' : 'bg-slate-400'}`} />
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Now Serving</p>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate max-w-[160px]">
                    {servingAppointment ? `T-${servingAppointment.token_number} (${servingAppointment.patient_name})` : 'Queue Idle'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Slots</p>
              <p className="text-base font-black text-slate-900 dark:text-white leading-tight">{activeWindowSize}</p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Booked Today</p>
              <p className="text-base font-black text-blue-700 dark:text-blue-300 leading-tight">{todayAppointments.length}</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</p>
              <p className="text-base font-black text-emerald-700 dark:text-emerald-300 leading-tight">{completedAppointments.length}</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Slots</p>
              <p className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {queueWindow ? queueWindow.available_count : Math.max(0, activeWindowSize - todayAppointments.length)}
              </p>
            </div>
          </div>

          {/* Visual Token Strip */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Slot Status Strip (T-{activeWindowStart} to T-{activeWindowEnd})
              </span>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> Serving</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Waiting</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Done</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" /> Open</span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 max-h-[168px] overflow-y-auto custom-scrollbar pr-0.5">
              {activeQueueTokens.map((tokenNum) => {
                const appointment = activeAppointmentsByToken.get(tokenNum);
                const isPending = !appointment && activePendingTokens.has(tokenNum);
                const isServing = appointment?.status === 'serving';
                const isCompleted = appointment?.status === 'completed';
                const isAbsent = appointment?.status === 'absent';
                const isWaiting = appointment && !isServing && !isCompleted && !isAbsent;

                let style = "bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 text-slate-400";
                let statusLabel = "Open";

                if (isServing) {
                  style = "bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-500/30 scale-105 font-bold z-10";
                  statusLabel = "Serving";
                } else if (isCompleted) {
                  style = "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold";
                  statusLabel = "Done";
                } else if (isWaiting) {
                  style = "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold";
                  statusLabel = "Waiting";
                } else if (isAbsent) {
                  style = "bg-slate-200/50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-400 line-through";
                  statusLabel = "Absent";
                }

                return (
                  <div
                    key={tokenNum}
                    title={appointment ? `${appointment.patient_name} - ${statusLabel}` : `Token ${tokenNum} Open`}
                    className={`w-full px-1 py-1.5 rounded-lg border text-center transition-all ${style}`}
                  >
                    <p className="text-[10px] sm:text-[11px] font-black leading-none">T-{tokenNum}</p>
                    <p className="text-[7px] sm:text-[8px] uppercase mt-0.5 tracking-tight truncate leading-none">
                      {statusLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Patients In Queue Consultation Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Active Patients Awaiting Consultation ({activeInQueueAppointments.length})
            </h3>

            {activeInQueueAppointments.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {activeInQueueAppointments.map((app) => {
                  const isServing = app.status === 'serving';

                  return (
                    <div 
                      key={app.id} 
                      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all relative flex flex-col justify-between ${
                        isServing 
                          ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 shadow-md ring-1 ring-blue-500/20' 
                          : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                          <div className="size-8 sm:size-10 rounded-lg sm:rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
                            {app.patient_profile_pic ? (
                              <img 
                                src={getAssetUrl(app.patient_profile_pic)} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(app.patient_name)}&background=2563eb&color=fff`;
                                }}
                              />
                            ) : (
                              <span className="font-extrabold text-xs sm:text-sm text-blue-600 dark:text-blue-400">{app.patient_name?.[0] || 'P'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs truncate">{app.patient_name}</h4>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{app.patient_phone}</p>
                            <p className="text-[8.5px] sm:text-[9px] text-slate-400 truncate">
                              {app.patient_gender} • {app.patient_age}Y
                            </p>
                          </div>
                        </div>
                        
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider shrink-0 ${
                          isServing 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                        }`}>
                          T-{app.token_number}
                        </span>
                      </div>

                      {/* Quick Consultation Controls */}
                      <div className="pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-700/60 flex gap-1 sm:gap-2">
                        {isServing ? (
                          <>
                            <button
                              onClick={() => announceToken(app.token_number, app.patient_name_override || app.patient?.name)}
                              className="py-1.5 sm:py-2 px-2 sm:px-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl border border-blue-200 dark:border-blue-800 transition-all cursor-pointer flex items-center justify-center"
                              title="Voice Announce Token to Waiting Hall"
                            >
                              <Volume2 size={12} />
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'completed')}
                              className="flex-1 py-1.5 sm:py-2 px-1 sm:px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer truncate"
                            >
                              <CheckCircle2 size={11} className="shrink-0" />
                              <span className="truncate">Done</span>
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'absent')}
                              className="py-1.5 sm:py-2 px-2 sm:px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-400 rounded-lg sm:rounded-xl border border-amber-300 dark:border-amber-800 text-[9px] sm:text-[10px] font-black uppercase transition-all cursor-pointer"
                              title="Mark Patient Absent"
                            >
                              Absent
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'serving')}
                              className="flex-1 py-1.5 sm:py-2 px-1 sm:px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm shadow-blue-500/20 transition-all cursor-pointer truncate"
                            >
                              <Stethoscope size={11} className="shrink-0" />
                              <span className="truncate">Serve</span>
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(app.id, 'completed')}
                              className="py-1.5 sm:py-2 px-2 sm:px-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-600 text-[9px] sm:text-[10px] font-black uppercase transition-all cursor-pointer"
                              title="Directly Complete Consultation"
                            >
                              ✓
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 px-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <div className="size-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center mx-auto mb-2.5 text-blue-600 dark:text-blue-400">
                  <Calendar size={22} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {todayAppointments.length > 0 && todayAppointments.every(a => a.status === 'completed')
                    ? 'All Active Consultations Completed for Today!'
                    : 'No Active Patients in Queue for Today'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Scheduled patients and reception check-ins will display here in real-time.
                </p>
              </div>
            )}
          </div>

          {/* Absent / Waiting Room Accordion */}
          {todayAppointments.filter((app) => app.status === 'absent' || app.status === 'arrived').length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 mb-2">
                <Clock size={14} /> Absent / Delayed Patients (Waiting Room)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {todayAppointments
                  .filter((app) => app.status === 'absent' || app.status === 'arrived')
                  .map((app) => {
                    const isArrived = app.status === 'arrived';
                    return (
                      <div 
                        key={app.id} 
                        className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border flex flex-col justify-between ${
                          isArrived
                            ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-amber-300 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1 mb-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs truncate">{app.patient_name}</h4>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">{isArrived ? 'Arrived (Waiting)' : 'Absent'}</p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                            T-{app.token_number}
                          </span>
                        </div>

                        <button
                          onClick={() => handleUpdateAppointmentStatus(app.id, 'pending')}
                          className="w-full py-1.5 rounded-lg sm:rounded-xl text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer truncate"
                        >
                          {isArrived ? 'Approve & Re-queue' : 'Re-queue'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Recent Diagnostic Activity (Modern EHR Table) ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Recent Diagnostic Activity</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Deep learning X-ray screenings and clinical validations</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Filters */}
              <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 gap-1 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                <button 
                  onClick={() => setShowTodayOnly(!showTodayOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    showTodayOnly 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Clock size={12}/> Today
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 my-auto mx-0.5" />
                {['All', 'Normal', 'TB', 'Pneumonia'].map(opt => (
                  <button 
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filter === opt 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* CSV Export Button */}
              {data?.records?.length > 0 && (
                <button
                  onClick={exportCSV}
                  title="Export records to CSV"
                  className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block glass overflow-hidden border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Patient</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Diagnostic Result</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">AI Confidence</th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-right">Screening Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentRecords?.map((record) => {
                  const isNormal = record.result === 'Normal';
                  const isTB = record.result === 'TB';
                  return (
                    <tr key={record.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                            {(record.patient_name || 'G')[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {record.patient_name || 'Guest / Walk-in Patient'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">#REF-{record.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                          isNormal 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                            : isTB 
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                              : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                        }`}>
                          {isNormal && <CheckCircle2 size={12} />}
                          {isTB && <AlertCircle size={12} />}
                          {!isNormal && !isTB && <Activity size={12} />}
                          {record.result}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[120px] border border-slate-200/50 dark:border-slate-700/50">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isNormal ? 'bg-emerald-500' : isTB ? 'bg-rose-500' : 'bg-violet-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, record.confidence * 100))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                            {(record.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {new Date(record.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
                {recentRecords?.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center text-slate-400 italic">
                      No matching diagnostic records found for selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View - Grid 2 on Small Screen */}
          <div className="md:hidden grid grid-cols-2 gap-2.5">
            {recentRecords?.map((record) => {
              const isNormal = record.result === 'Normal';
              const isTB = record.result === 'TB';
              return (
                <div key={record.id} className="glass p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between shadow-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{record.patient_name || 'Walk-in'}</p>
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border shrink-0 ${
                        isNormal ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                        isTB ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                      }`}>
                        {record.result}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono">#REF-{record.id}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[9px] text-slate-500 mt-2">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {(record.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="truncate">
                      {new Date(record.created_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View Full History Link */}
          {filteredRecords?.length > 10 && (
            <div className="flex justify-center pt-2">
              <Link 
                to="/history"
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-2 group shadow-xs cursor-pointer"
              >
                <span>View All {filteredRecords.length} Clinical Records</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Bottom Section: Diagnostics Distribution & AI Insights ── */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Diagnostics Distribution */}
          <div className="lg:col-span-2 glass p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Diagnostics Distribution
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Prevalence across all {statsData.total} screened patients
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Global Analytics
              </span>
            </div>
            
            <div className="space-y-6">
              {/* Normal */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Normal Findings
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">
                    {statsData.normal} cases ({statsData.total > 0 ? Math.round((statsData.normal / statsData.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${statsData.total > 0 ? (statsData.normal / statsData.total) * 100 : 0}%` }} 
                    className="h-full bg-emerald-500 rounded-full" 
                  />
                </div>
              </div>
              
              {/* TB */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Tuberculosis Detected
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">
                    {statsData.tb} cases ({statsData.total > 0 ? Math.round((statsData.tb / statsData.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${statsData.total > 0 ? (statsData.tb / statsData.total) * 100 : 0}%` }} 
                    className="h-full bg-rose-500 rounded-full" 
                  />
                </div>
              </div>

              {/* Pneumonia */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                    <TrendingUp size={14} /> Pneumonia Detected
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">
                    {statsData.pneumonia} cases ({statsData.total > 0 ? Math.round((statsData.pneumonia / statsData.total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${statsData.total > 0 ? (statsData.pneumonia / statsData.total) * 100 : 0}%` }} 
                    className="h-full bg-violet-500 rounded-full" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Note & AI Insight */}
          <div className="glass p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="text-blue-500" size={18} />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Clinical Note</h3>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Clinical Diagnostic Summary
              </p>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider mb-1.5">
                  <Info size={15} /> Regional Alert
                </div>
                <p className="text-xs leading-relaxed">
                  {statsData.total > 0 ? (
                    <>
                      Diagnostic patterns indicate that <span className="font-extrabold text-slate-900 dark:text-white">{Math.round((statsData.tb / statsData.total) * 100)}%</span> of total processed cases are testing positive for Tuberculosis. Please prioritize high-confidence cases for secondary clinical validation.
                    </>
                  ) : (
                    <>
                      No clinical records processed yet. Diagnostic insights and regional alerts will update automatically as screenings are performed.
                    </>
                  )}
                </p>
              </div>
            </div>

            <Link 
              to="/history"
              className="mt-6 w-full py-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Access Complete Archives</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Search Patient Result Modal ── */}
      <AnimatePresence>
        {searchResult && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative"
            >
              <button 
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" 
                onClick={() => setSearchResult(null)}
              >
                <X size={18}/>
              </button>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Patient Found</h3>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Full Name</p>
                  <p className="font-bold text-slate-900 dark:text-white text-base">{searchResult.patient.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Identity CNIC</p>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">{searchResult.patient.cnic}</p>
                </div>
                
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  {searchResult.is_linked ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle size={15}/> Linked to Your Practice
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleLink(searchResult.patient.id)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold uppercase text-xs tracking-wider text-white transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                    >
                      Link to My Practice
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Register Patient Modal ── */}
        {showRegisterForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 p-5 sm:p-7 w-full max-w-lg rounded-2xl relative border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => resetRegisterModal()} 
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2.5">
                <UserPlus className="text-blue-500" size={22}/> Register New Patient
              </h2>
              <p className="text-[11px] text-slate-400 mb-6 border-b border-slate-100 dark:border-slate-800 pb-3">
                Establish clinical record and patient login credentials
              </p>
              
              <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Full Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    {formTouched.name && !formErrors.name && newPatient.name.trim() && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Valid
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Patient Name" 
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs text-slate-900 dark:text-white transition-all ${
                      formTouched.name && formErrors.name
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.name && !formErrors.name && newPatient.name.trim()
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.name} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPatient({ ...newPatient, name: val });
                      if (formTouched.name) {
                        setFormErrors(prev => ({ ...prev, name: validatePatientField('name', val) }));
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, name: true }));
                      setFormErrors(prev => ({ ...prev, name: validatePatientField('name', newPatient.name) }));
                    }}
                  />
                  {formTouched.name && formErrors.name && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.name}</span>
                    </p>
                  )}
                  <FieldFormatHint type="name" value={newPatient.name} />
                </div>

                {/* CNIC */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      CNIC <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${
                      newPatient.cnic.length === 13 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>
                      {newPatient.cnic.length}/13 digits
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="13 digits (no dashes)" 
                    maxLength={13}
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs font-mono text-slate-900 dark:text-white transition-all ${
                      formTouched.cnic && formErrors.cnic
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.cnic && !formErrors.cnic && newPatient.cnic.length === 13
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.cnic} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 13);
                      setNewPatient({ ...newPatient, cnic: val });
                      if (formTouched.cnic) {
                        setFormErrors(prev => ({ ...prev, cnic: validatePatientField('cnic', val) }));
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, cnic: true }));
                      setFormErrors(prev => ({ ...prev, cnic: validatePatientField('cnic', newPatient.cnic) }));
                    }}
                  />
                  {formTouched.cnic && formErrors.cnic && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.cnic}</span>
                    </p>
                  )}
                  <FieldFormatHint type="cnic" value={newPatient.cnic} />
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${
                      newPatient.phone.length === 11 && newPatient.phone.startsWith('03') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>
                      {newPatient.phone.length}/11 digits
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="03XXXXXXXXX" 
                    maxLength={11}
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs font-mono text-slate-900 dark:text-white transition-all ${
                      formTouched.phone && formErrors.phone
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.phone && !formErrors.phone && newPatient.phone.length === 11
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.phone} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setNewPatient({ ...newPatient, phone: val });
                      if (formTouched.phone) {
                        setFormErrors(prev => ({ ...prev, phone: validatePatientField('phone', val) }));
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, phone: true }));
                      setFormErrors(prev => ({ ...prev, phone: validatePatientField('phone', newPatient.phone) }));
                    }}
                  />
                  {formTouched.phone && formErrors.phone && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.phone}</span>
                    </p>
                  )}
                  <FieldFormatHint type="phone" value={newPatient.phone} />
                </div>

                {/* Portal Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Portal Password <span className="text-slate-400 font-normal">(Min 6 chars)</span>
                    </label>
                    {newPatient.password && !formErrors.password && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Valid
                      </span>
                    )}
                  </div>
                  <input 
                    type="password" 
                    placeholder="Min 6 characters" 
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs text-slate-900 dark:text-white transition-all ${
                      formTouched.password && formErrors.password
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.password && !formErrors.password && newPatient.password
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.password} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPatient({ ...newPatient, password: val });
                      if (formTouched.password) {
                        setFormErrors(prev => ({ ...prev, password: validatePatientField('password', val) }));
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, password: true }));
                      setFormErrors(prev => ({ ...prev, password: validatePatientField('password', newPatient.password) }));
                    }}
                  />
                  {formTouched.password && formErrors.password && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.password}</span>
                    </p>
                  )}
                  <FieldFormatHint type="patientPassword" value={newPatient.password} />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    {formTouched.gender && !formErrors.gender && newPatient.gender && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Selected
                      </span>
                    )}
                  </div>
                  <select 
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs text-slate-900 dark:text-white transition-all ${
                      formTouched.gender && formErrors.gender
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.gender && !formErrors.gender && newPatient.gender
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.gender} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPatient({ ...newPatient, gender: val });
                      setFormTouched(prev => ({ ...prev, gender: true }));
                      setFormErrors(prev => ({ ...prev, gender: validatePatientField('gender', val) }));
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, gender: true }));
                      setFormErrors(prev => ({ ...prev, gender: validatePatientField('gender', newPatient.gender) }));
                    }}
                  >
                    <option value="" disabled>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {formTouched.gender && formErrors.gender && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.gender}</span>
                    </p>
                  )}
                </div>

                {/* Age */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Age (Years) <span className="text-rose-500">*</span>
                    </label>
                    {formTouched.age && !formErrors.age && newPatient.age && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Valid
                      </span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    min="1" 
                    max="120" 
                    placeholder="Years (1-120)" 
                    required 
                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 outline-none text-xs text-slate-900 dark:text-white transition-all ${
                      formTouched.age && formErrors.age
                        ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20'
                        : formTouched.age && !formErrors.age && newPatient.age
                          ? 'border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }`} 
                    value={newPatient.age} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPatient({ ...newPatient, age: val });
                      if (formTouched.age) {
                        setFormErrors(prev => ({ ...prev, age: validatePatientField('age', val) }));
                      }
                    }}
                    onBlur={() => {
                      setFormTouched(prev => ({ ...prev, age: true }));
                      setFormErrors(prev => ({ ...prev, age: validatePatientField('age', newPatient.age) }));
                    }}
                  />
                  {formTouched.age && formErrors.age && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5 ml-1">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{formErrors.age}</span>
                    </p>
                  )}
                  <FieldFormatHint 
                    custom={{
                      label: 'Age',
                      hint: 'Valid integer between 1 and 120',
                      example: '32',
                      patternStr: '^[1-9][0-9]?$|^1[0-1][0-9]$|^120$'
                    }}
                    value={newPatient.age}
                  />
                </div>

                {/* Residential Address */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Residential Address</label>
                  <input 
                    type="text" 
                    placeholder="Street, City, Province" 
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 dark:text-white" 
                    value={newPatient.address} 
                    onChange={(e) => setNewPatient({...newPatient, address: e.target.value})} 
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => resetRegisterModal()} 
                    className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-98"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Create Patient Record</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

// ── Redesigned Modern StatCard Component ──
const StatCard = ({ icon, title, value, color, badge, subtitle }) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      glow: 'hover:border-blue-500/40 hover:shadow-blue-500/10',
    },
    slate: {
      bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      glow: 'hover:border-indigo-500/40 hover:shadow-indigo-500/10',
    },
    red: {
      bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      glow: 'hover:border-rose-500/40 hover:shadow-rose-500/10',
    },
    purple: {
      bg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      glow: 'hover:border-violet-500/40 hover:shadow-violet-500/10',
    },
    green: {
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      glow: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`glass p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 ${scheme.glow} hover:shadow-md transition-all text-left flex flex-col justify-between group relative overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl border ${scheme.bg} flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${scheme.badge}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {value ?? 0}
          </h3>
          {subtitle && (
            <span className="text-[10px] text-slate-400 font-medium">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DoctorDashboard;
