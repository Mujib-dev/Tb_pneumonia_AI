import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  MapPin, 
  MessageCircle, 
  Send, 
  CheckCircle2, 
  Clock, 
  Headphones, 
  Building, 
  User, 
  HelpCircle, 
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { showErrorAlert, showSuccessAlert } from '../utils/alert';
import FieldFormatHint from '../components/FieldFormatHint';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    subject: '',
    message: ''
  });
  const [settings, setSettings] = useState({
    contact_email: '["support@tbpneumonia-ai.com"]',
    contact_phone: '["+92 300 000 0000"]',
    contact_whatsapp: '["+92 300 000 0000"]',
    contact_address: "123 Healthcare Avenue\nMedical City, PK 12345",
    contact_desc: "Have a clinical inquiry, technical question, or partnership request? Our support team and medical officers are ready to assist you."
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [copiedItem, setCopiedItem] = useState(null);

  // Inline Validation & Auto-Redirect States
  const [fieldErrors, setFieldErrors] = useState({});
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const whatsappRef = useRef(null);
  const subjectRef = useRef(null);
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
  };

  const parseArray = (str) => {
    try {
      const arr = JSON.parse(str);
      return Array.isArray(arr) ? arr : [str];
    } catch {
      return [str || ''];
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/admin/settings/contact');
        if (response.data) {
          setSettings(response.data);
        }
      } catch {
        return;
      }
    };
    fetchSettings();
  }, []);

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedItem(key);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = (formData.get('name') || '').trim();
    const email = (formData.get('email') || '').trim();
    const whatsapp = (formData.get('whatsapp') || '').trim();
    const subject = (formData.get('subject') || '').trim();
    const message = (formData.get('message') || '').trim();

    const newErrors = {};

    if (!name || name.length < 2) {
      newErrors.name = "Please enter your full name (minimum 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      newErrors.email = "Please provide a valid email address (e.g. name@domain.com).";
    }

    const cleanWhatsappDigits = whatsapp.replace(/\D/g, '');
    if (!whatsapp || cleanWhatsappDigits.length < 10 || cleanWhatsappDigits.length > 15) {
      newErrors.whatsapp = "Please enter a valid WhatsApp contact number (10 to 15 digits).";
    }

    if (!subject || subject.length < 3) {
      newErrors.subject = "Subject must be at least 3 characters long.";
    }

    if (!message || message.length < 10) {
      newErrors.message = "Message must be at least 10 characters long.";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      if (newErrors.name) focusAndScrollTo(nameRef);
      else if (newErrors.email) focusAndScrollTo(emailRef);
      else if (newErrors.whatsapp) focusAndScrollTo(whatsappRef);
      else if (newErrors.subject) focusAndScrollTo(subjectRef);
      else if (newErrors.message) focusAndScrollTo(messageRef);
      return;
    }

    setSubmitting(true);
    const data = { name, email, whatsapp, subject, message };

    try {
      await api.post('/contact/submit', data);
      setSubmitted(true);
      setFieldErrors({});
      setFormData({ name: '', email: '', whatsapp: '', subject: '', message: '' });
      showSuccessAlert("Message Dispatched!", "Thank you for reaching out. A medical officer or technical representative will reply shortly.");
      e.target.reset();
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      showErrorAlert("Transmission Failed", getErrorMessage(error, "Could not dispatch message. Please check connection."));
    } finally {
      setSubmitting(false);
    }
  };

  const emailList = parseArray(settings.contact_email);
  const phoneList = parseArray(settings.contact_phone);
  const waList = parseArray(settings.contact_whatsapp);

  const faqs = [
    {
      q: "How quickly will a clinical or technical officer reply?",
      a: "Messages sent through this portal are dispatched directly to the on-duty support desk. We typically review and respond within 2 to 4 hours during active clinic hours."
    },
    {
      q: "Can I cancel or reschedule an appointment token here?",
      a: "Yes, you may inquire here, but you can also manage tokens directly from your Patient or Guest dashboard. Please note that completed consultations or past-date tokens are permanently locked."
    },
    {
      q: "Are my chest X-ray uploads and personal health records secure?",
      a: "Yes. All diagnostic radiograph scans, diagnostic heatmaps, and medical records are transmitted via encrypted TLS 1.3 channels and stored under strict clinical confidentiality safeguards."
    },
    {
      q: "What if I or a patient requires emergency medical attention?",
      a: "This contact form is designed for non-emergency inquiries. If you or someone under your care is experiencing severe shortness of breath, acute chest pain, or hemoptysis, please visit the nearest hospital emergency room immediately or call 1122."
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-16 px-3.5 sm:px-6 text-left">
      {/* Sleek, Compact Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-2 shadow-xs">
          <Headphones size={14} className="text-blue-600 dark:text-blue-400" />
          <span>24/7 Clinical &amp; Technical Support</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Get in Touch with Our Team
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl">
          {settings.contact_desc}
        </p>
      </div>

      {/* Main Grid: Left Scrollable Content & Right Fixed Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left Side: Scrollable (Message Form + Clinical Advisory + FAQ) */}
        <div className="w-full lg:col-span-7 space-y-6">
          {/* Form Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5"
          >
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Send Us a Direct Message
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fill out the inquiry form below and our medical officers will follow up via email and WhatsApp.
              </p>
            </div>

            <form noValidate className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-blue-600" /> Your Full Name <span className="text-red-500">*</span>
                </label>
                <input 
                  ref={nameRef}
                  type="text" 
                  name="name" 
                  value={formData.name}
                  onChange={(e) => {
                    clearFieldError('name');
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                  }}
                  className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 shadow-xs ${
                    fieldErrors.name 
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder="e.g. Dr. Sarah Jenkins" 
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{fieldErrors.name}</span>
                  </p>
                )}
                <FieldFormatHint type="name" value={formData.name} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-blue-600" /> Email Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    ref={emailRef}
                    type="email" 
                    name="email" 
                    value={formData.email}
                    onChange={(e) => {
                      clearFieldError('email');
                      setFormData(prev => ({ ...prev, email: e.target.value }));
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 shadow-xs ${
                      fieldErrors.email 
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                        : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                    placeholder="name@hospital.org" 
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                  <FieldFormatHint type="email" value={formData.email} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MessageCircle size={13} className="text-emerald-500" /> WhatsApp Number <span className="text-red-500">*</span>
                  </label>
                  <input 
                    ref={whatsappRef}
                    type="tel" 
                    name="whatsapp" 
                    value={formData.whatsapp}
                    onChange={(e) => {
                      clearFieldError('whatsapp');
                      setFormData(prev => ({ ...prev, whatsapp: e.target.value }));
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 shadow-xs ${
                      fieldErrors.whatsapp 
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                        : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                    placeholder="e.g. +92 300 1234567" 
                  />
                  {fieldErrors.whatsapp && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fieldErrors.whatsapp}</span>
                    </p>
                  )}
                  <FieldFormatHint type="phoneLoose" value={formData.whatsapp} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <HelpCircle size={13} className="text-blue-600" /> Subject / Inquiry Type <span className="text-red-500">*</span>
                </label>
                <input 
                  ref={subjectRef}
                  type="text" 
                  name="subject" 
                  value={formData.subject}
                  onChange={(e) => {
                    clearFieldError('subject');
                    setFormData(prev => ({ ...prev, subject: e.target.value }));
                  }}
                  className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 shadow-xs ${
                    fieldErrors.subject 
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder="e.g. Clinical trial collaboration, diagnostic inquiry, or technical bug" 
                />
                {fieldErrors.subject && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{fieldErrors.subject}</span>
                  </p>
                )}
                <FieldFormatHint 
                  patternStr="^.{3,120}$" 
                  format="Min 3 characters" 
                  example="Diagnostic consultation" 
                  value={formData.subject} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-blue-600" /> Detailed Message <span className="text-red-500">*</span>
                </label>
                <textarea 
                  ref={messageRef}
                  name="message" 
                  rows="4" 
                  value={formData.message}
                  onChange={(e) => {
                    clearFieldError('message');
                    setFormData(prev => ({ ...prev, message: e.target.value }));
                  }}
                  className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all resize-none placeholder:text-slate-400 shadow-xs ${
                    fieldErrors.message 
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/10' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                  placeholder="Please describe how we can assist you with your clinical or technical inquiry..."
                ></textarea>
                {fieldErrors.message && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{fieldErrors.message}</span>
                  </p>
                )}
                <FieldFormatHint 
                  patternStr="^.{10,2000}$" 
                  format="Min 10 characters" 
                  example="Detailed inquiry description..." 
                  value={formData.message} 
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className={`w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.99] ${
                  submitted 
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Dispatching Message...</span>
                  </>
                ) : submitted ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Message Sent Successfully!</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send Clinical Message</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Clinical Emergency Advisory Banner */}
          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="size-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700/80 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Emergency Medical Notice
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-1 leading-relaxed">
                This communication channel is strictly for outpatient inquiries and administrative support. If a patient is experiencing acute respiratory distress, severe cyanosis, or chest pain, please report to the nearest hospital casualty ward or call emergency services (1122) immediately.
              </p>
            </div>
          </div>

          {/* Frequently Asked Questions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <HelpCircle size={15} className="text-blue-600 dark:text-blue-400" />
                Frequently Asked Clinical Questions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Common inquiries regarding platform response time, tokens, and imaging confidentiality.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div 
                    key={index} 
                    className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full text-left p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown 
                        size={14} 
                        className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} 
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-3.5 pb-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-2.5"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: FIXED / STICKY on Desktop, completely hidden on small screens */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:block w-full lg:col-span-5 space-y-3.5 lg:sticky lg:top-20 lg:self-start"
        >
          {/* Top Status Header */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Building size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Direct Contact Channels
                </h3>
                <p className="text-[11px] text-slate-400">Immediate access for patients &amp; staff</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Desk Live</span>
            </div>
          </div>

          {/* Email Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-blue-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/70 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Email Inquiries
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-2">Platform questions, diagnosis queries &amp; bug reports.</p>
              <div className="space-y-1.5">
                {emailList.map((em, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <a 
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(em)}&su=${encodeURIComponent('PulmoAI Enquiry')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Compose in Gmail"
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {em}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(em, `email-${idx}`)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Copy email address"
                    >
                      {copiedItem === `email-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Phone Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
              <Phone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Phone Support
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-2">Available Mon - Sat from 9:00 AM to 6:00 PM (PKT).</p>
              <div className="space-y-1.5">
                {phoneList.map((ph, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <a 
                      href={`tel:${ph}`} 
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {ph}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(ph, `phone-${idx}`)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Copy phone number"
                    >
                      {copiedItem === `phone-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* WhatsApp Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-green-300 dark:hover:border-slate-700 transition-all flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-green-50 dark:bg-green-950/60 border border-green-200/70 dark:border-green-800/70 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 shadow-xs">
              <MessageCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  WhatsApp Live Chat
                </h3>
                <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                  Instant
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-2">Direct messaging channel for swift appointment help.</p>
              <div className="space-y-1">
                {waList.map((wa, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <a 
                      href={`https://wa.me/${wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello PulmoAI support, I would like to enquire about TB / Pneumonia screening.')}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400 hover:underline"
                    >
                      <span>Connect on WhatsApp</span>
                      <ArrowRight size={12} />
                    </a>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{wa}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Address Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/70 dark:border-purple-800/70 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-xs">
              <MapPin size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Clinical Facility
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed whitespace-pre-line">
                {settings.contact_address || '123 Healthcare Avenue, Swat, KP, Pakistan'}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <Clock size={12} />
                <span>Walk-in OPD: 8:00 AM - 4:00 PM</span>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Contact;
