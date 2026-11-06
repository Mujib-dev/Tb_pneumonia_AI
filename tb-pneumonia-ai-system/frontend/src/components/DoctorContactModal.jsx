import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, User, Phone, Mail, FileText, CheckCircle2, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { submitContactMessage } from '../services/api';
import { toast } from 'react-toastify';
import FieldFormatHint from './FieldFormatHint';

const DoctorContactModal = ({ doctor, isOpen, onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'Consultation Inquiry',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const messageRef = useRef(null);

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
    if (generalError) setGeneralError('');
  };

  // Pre-fill user details if logged in
  useEffect(() => {
    if (isOpen) {
      setFieldErrors({});
      setGeneralError('');
      setFormData({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        subject: 'Consultation Inquiry',
        message: ''
      });
    }
  }, [isOpen, user]);

  if (!isOpen || !doctor) return null;

  const cleanDocName = (doctor.name || '').replace(/^Dr\.?\s*/i, '');

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Please enter your full name (minimum 2 characters).';
    }
    const cleanPhone = formData.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      newErrors.phone = 'Please enter a valid contact/WhatsApp phone number (minimum 10 digits).';
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = 'Please write your message or question (minimum 10 characters).';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      if (newErrors.name) focusAndScrollTo(nameRef);
      else if (newErrors.phone) focusAndScrollTo(phoneRef);
      else if (newErrors.message) focusAndScrollTo(messageRef);
      return false;
    }

    setFieldErrors({});
    setGeneralError('');
    return true;
  };

  // Helper to clean phone for WhatsApp international format
  const getWhatsAppTarget = (rawPhone) => {
    let digits = (rawPhone || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
      digits = '92' + digits.substring(1);
    }
    return digits;
  };

  const handleWhatsAppSend = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const targetNumber = getWhatsAppTarget(doctor.phone);
    if (!targetNumber) {
      setGeneralError('The selected doctor does not have a valid WhatsApp contact number on file.');
      return;
    }

    const formattedMessage = 
`*Inquiry for Dr. ${doctor.name}*
*From:* ${formData.name.trim()}
*Contact Phone:* ${formData.phone.trim()}
*Subject:* ${formData.subject.trim()}

*Message:*
${formData.message.trim()}`;

    const waUrl = `https://wa.me/${targetNumber}?text=${encodeURIComponent(formattedMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Opening WhatsApp chat with Dr. ${doctor.name}...`, { autoClose: 5000 });
    onClose();
  };

  const handleDashboardSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await submitContactMessage({
        name: formData.name.trim(),
        email: formData.email.trim() || 'patient@pulmoai.clinic',
        whatsapp: formData.phone.trim(),
        subject: formData.subject.trim() || `Inquiry for Dr. ${doctor.name}`,
        message: formData.message.trim(),
        doctor_id: doctor.id
      });

      toast.success(`Your message has been submitted directly to Dr. ${doctor.name}'s clinical dashboard!`, { autoClose: 5000 });
      onClose();
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || 'Failed to submit inquiry to doctor.';
      setGeneralError(errDetail);
      toast.error(errDetail, { autoClose: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >

          {/* Header (Always Visible at Top) */}
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="size-11 sm:size-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
                {doctor.profile_pic ? (
                  <img 
                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${doctor.profile_pic.replace(/\\/g, '/')}`} 
                    alt={doctor.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { 
                      e.target.onerror = null; 
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=random`; 
                    }} 
                  />
                ) : (
                  <span className="font-black text-blue-500 text-lg">{doctor.name[0]}</span>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Contact Specialist</p>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Dr. {cleanDocName}
                </h2>
                <p className="text-[11px] text-gray-500 truncate max-w-[220px]">
                  {doctor.specialization || 'Clinical Specialist'} • {doctor.clinic_name || 'PulmoAI'}
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form (Flex container with scrollable content & fixed footer buttons) */}
          <form noValidate onSubmit={handleDashboardSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
            {/* Scrollable Input Body */}
            <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto flex-1">
              {generalError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      ref={nameRef}
                      type="text"
                      placeholder="e.g. Muhammad Ali"
                      value={formData.name}
                      onChange={(e) => {
                        clearFieldError('name');
                        setFormData({ ...formData, name: e.target.value });
                      }}
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border text-slate-900 dark:text-white outline-none transition-all ${
                        fieldErrors.name 
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                          : 'border-black/10 dark:border-white/10 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                  <FieldFormatHint type="name" value={formData.name} compact />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                    Your Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      ref={phoneRef}
                      type="tel"
                      placeholder="e.g. 03001234567"
                      value={formData.phone}
                      onChange={(e) => {
                        clearFieldError('phone');
                        setFormData({ ...formData, phone: e.target.value });
                      }}
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border text-slate-900 dark:text-white outline-none transition-all ${
                        fieldErrors.phone 
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                          : 'border-black/10 dark:border-white/10 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldErrors.phone}</span>
                    </p>
                  )}
                  <FieldFormatHint type="phoneLoose" value={formData.phone} compact />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Subject / Consultation Reason
                </label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="e.g. Chest X-Ray report discussion"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                  Your Message / Health Question <span className="text-red-500">*</span>
                </label>
                <textarea 
                  ref={messageRef}
                  rows={3}
                  placeholder="Describe your symptoms, report questions, or appointment query in detail..."
                  value={formData.message}
                  onChange={(e) => {
                    clearFieldError('message');
                    setFormData({ ...formData, message: e.target.value });
                  }}
                  className={`w-full p-3 text-xs rounded-xl bg-black/5 dark:bg-white/5 border text-slate-900 dark:text-white outline-none resize-none transition-all ${
                    fieldErrors.message 
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                      : 'border-black/10 dark:border-white/10 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                {fieldErrors.message && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{fieldErrors.message}</span>
                  </p>
                )}
                <FieldFormatHint patternStr="^.{10,1500}$" format="Min 10 characters" example="Detailed message..." value={formData.message} compact />
              </div>

              {/* Doctor Phone Info Banner */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <Phone size={13} /> Doctor's Direct Line:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {doctor.phone || 'Available via Dashboard'}
                </span>
              </div>
            </div>

            {/* Permanent Fixed Action Buttons Footer (Never cut off or hidden) */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="text-sm shrink-0">💬</span>
                <span className="whitespace-nowrap truncate">Message on WhatsApp</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleDashboardSubmit}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all cursor-pointer whitespace-nowrap"
              >
                <Send size={14} className={submitting ? 'animate-spin shrink-0' : 'shrink-0'} />
                <span className="whitespace-nowrap truncate">{submitting ? 'Submitting...' : 'Submit to Doc Dashboard'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DoctorContactModal;
