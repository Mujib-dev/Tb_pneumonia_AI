import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Mail, 
  Phone, 
  MapPin, 
  MessageCircle, 
  Facebook, 
  Instagram, 
  Linkedin, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  Layers,
  PhoneCall,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

const Footer = () => {
  const [settings, setSettings] = useState({
    contact_email: '["support@tbpneumonia-ai.com"]',
    contact_phone: '["+92 300 000 0000"]',
    contact_whatsapp: '["+92 300 000 0000"]',
    contact_address: "123 Healthcare Avenue\nMedical City, PK 12345",
  });

  // Collapsible accordion state for small screens (platform expanded by default)
  const [openSections, setOpenSections] = useState({
    platform: true,
    solutions: false,
    contact: false,
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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
          setSettings(prev => ({...prev, ...response.data}));
        }
      } catch (err) {
        console.error("Failed to fetch footer settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const email = parseArray(settings.contact_email)[0] || 'support@pulmoai.org';
  const phone = parseArray(settings.contact_phone)[0] || '+92 300 000 0000';
  const whatsapp = parseArray(settings.contact_whatsapp)[0] || '+92 300 000 0000';

  return (
    <footer className="mt-4 sm:mt-10 md:mt-16 border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-10 md:pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-6 lg:gap-10 pb-8 sm:pb-10 border-b border-slate-100 dark:border-slate-800">
          
          {/* Brand & Mission Column */}
          <div className="lg:col-span-4 space-y-4 text-left pb-2 md:pb-0">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <img
                src="/logo-mark-128.png"
                alt="PulmoAI Logo"
                className="size-10 object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Pulmo<span className="text-blue-600 dark:text-blue-400">AI</span>
              </span>
            </Link>

            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Clinical-grade artificial intelligence for automated detection of Tuberculosis, Pneumonia, and normal chest radiographs. Empowering healthcare providers with fast, accurate screening.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <ShieldCheck className="text-emerald-500" size={16} />
              <span>HIPAA Compliant &amp; AI Verified</span>
            </div>
          </div>

          {/* Platform Links (Collapsible on mobile) */}
          <div className="lg:col-span-2 text-left border border-slate-200/70 dark:border-slate-800 md:border-0 md:border-transparent md:dark:border-transparent rounded-2xl md:rounded-none p-3.5 md:p-0 bg-slate-50/50 dark:bg-slate-800/40 md:bg-transparent md:dark:bg-transparent transition-all">
            <button
              type="button"
              onClick={() => toggleSection('platform')}
              className="w-full flex items-center justify-between text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white cursor-pointer md:cursor-default outline-none"
            >
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Platform</span>
              </div>
              <ChevronDown 
                size={18} 
                className={`md:hidden transition-transform duration-200 text-slate-400 ${openSections.platform ? 'rotate-180 text-blue-600' : ''}`}
              />
            </button>
            <ul className={`${openSections.platform ? 'block' : 'hidden'} md:block space-y-2.5 text-sm pt-3 md:pt-3.5 border-t border-slate-200/60 dark:border-slate-700/60 md:border-t-0 mt-2.5 md:mt-0`}>
              <li>
                <Link to="/" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 group">
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all text-blue-500" />
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 group">
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all text-blue-500" />
                  <span>About Specialists</span>
                </Link>
              </li>
              <li>
                <Link to="/guest-book" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 group">
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all text-blue-500" />
                  <span>Guest Token Booking</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 group">
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -ml-3 group-hover:ml-0 transition-all text-blue-500" />
                  <span>Contact Clinic</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Clinical Features (Collapsible on mobile) */}
          <div className="lg:col-span-3 text-left border border-slate-200/70 dark:border-slate-800 md:border-0 md:border-transparent md:dark:border-transparent rounded-2xl md:rounded-none p-3.5 md:p-0 bg-slate-50/50 dark:bg-slate-800/40 md:bg-transparent md:dark:bg-transparent transition-all">
            <button
              type="button"
              onClick={() => toggleSection('solutions')}
              className="w-full flex items-center justify-between text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white cursor-pointer md:cursor-default outline-none"
            >
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Clinical Solutions</span>
              </div>
              <ChevronDown 
                size={18} 
                className={`md:hidden transition-transform duration-200 text-slate-400 ${openSections.solutions ? 'rotate-180 text-blue-600' : ''}`}
              />
            </button>
            <ul className={`${openSections.solutions ? 'block' : 'hidden'} md:block space-y-2.5 text-sm text-slate-500 dark:text-slate-400 pt-3 md:pt-3.5 border-t border-slate-200/60 dark:border-slate-700/60 md:border-t-0 mt-2.5 md:mt-0`}>
              <li className="flex items-center gap-2.5">
                <Activity size={15} className="text-blue-500 shrink-0" />
                <span>Chest Radiograph CAD</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Layers size={15} className="text-indigo-500 shrink-0" />
                <span>Focal Pathology Localization</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock size={15} className="text-purple-500 shrink-0" />
                <span>Real-Time Clinic Queue Sync</span>
              </li>
              <li className="flex items-center gap-2.5">
                <FileText size={15} className="text-emerald-500 shrink-0" />
                <span>Structured EHR Medical Reports</span>
              </li>
            </ul>
          </div>

          {/* Contact Details (Collapsible on mobile) */}
          <div className="lg:col-span-3 text-left border border-slate-200/70 dark:border-slate-800 md:border-0 md:border-transparent md:dark:border-transparent rounded-2xl md:rounded-none p-3.5 md:p-0 bg-slate-50/50 dark:bg-slate-800/40 md:bg-transparent md:dark:bg-transparent transition-all">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full flex items-center justify-between text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white cursor-pointer md:cursor-default outline-none"
            >
              <div className="flex items-center gap-2">
                <PhoneCall size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Emergency &amp; Inquiries</span>
              </div>
              <ChevronDown 
                size={18} 
                className={`md:hidden transition-transform duration-200 text-slate-400 ${openSections.contact ? 'rotate-180 text-blue-600' : ''}`}
              />
            </button>
            <ul className={`${openSections.contact ? 'block' : 'hidden'} md:block space-y-3 text-sm pt-3 md:pt-3.5 border-t border-slate-200/60 dark:border-slate-700/60 md:border-t-0 mt-2.5 md:mt-0`}>
              <li>
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent('PulmoAI Enquiry')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Compose in Gmail"
                  className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 shrink-0 border border-blue-200/60 dark:border-blue-800">
                    <Mail size={15} />
                  </div>
                  <span className="truncate">{email}</span>
                </a>
              </li>
              <li>
                <a 
                  href={`tel:${phone}`} 
                  className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-200/60 dark:border-emerald-800">
                    <Phone size={15} />
                  </div>
                  <span>{phone}</span>
                </a>
              </li>
              <li>
                <a 
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                >
                  <div className="size-8 rounded-lg bg-green-50 dark:bg-green-950/60 flex items-center justify-center text-green-600 shrink-0 border border-green-200/60 dark:border-green-800">
                    <MessageCircle size={15} />
                  </div>
                  <span>WhatsApp Consultation</span>
                </a>
              </li>
              <li className="pt-0.5 flex items-start gap-2.5 text-slate-500 dark:text-slate-400">
                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 dark:border-slate-700 mt-0.5">
                  <MapPin size={15} />
                </div>
                <span className="text-xs leading-relaxed whitespace-pre-line">
                  {settings.contact_address || '123 Healthcare Avenue, Swat, KP, Pakistan'}
                </span>
              </li>
            </ul>
          </div>

        </div>
        
        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
          <p className="font-medium text-xs sm:text-sm">
            {settings.footer_text || `© ${new Date().getFullYear()} PulmoAI Clinical Decision System. All rights reserved.`}
          </p>

          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 text-xs sm:text-sm">
            <Link to="/privacy" className="hover:text-blue-600 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline-block size-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <Link to="/terms" className="hover:text-blue-600 dark:hover:text-white transition-colors">
              Terms &amp; Medical Disclaimer
            </Link>
            <span className="hidden sm:inline-block size-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <Link to="/contact" className="hover:text-blue-600 dark:hover:text-white transition-colors">
              Help Center
            </Link>
          </div>
          
          {/* Social Links */}
          <div className="flex items-center justify-center gap-2">
            {settings.social_facebook && (
              <a 
                href={settings.social_facebook} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all flex items-center justify-center"
                title="Facebook"
              >
                <Facebook size={16} />
              </a>
            )}
            {settings.social_instagram && (
              <a 
                href={settings.social_instagram} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950 transition-all flex items-center justify-center"
                title="Instagram"
              >
                <Instagram size={16} />
              </a>
            )}
            {settings.social_linkedin && (
              <a 
                href={settings.social_linkedin} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all flex items-center justify-center"
                title="LinkedIn"
              >
                <Linkedin size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
