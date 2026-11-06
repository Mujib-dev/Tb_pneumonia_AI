import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Phone, 
  Building, 
  Calendar,
  Search,
  X,
  Stethoscope,
  ArrowRight,
  Info,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { api, getAssetUrl } from '../services/api';
import DoctorContactModal from '../components/DoctorContactModal';

const About = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorDetails, setSelectedDoctorDetails] = useState(null);
  const [contactingDoctor, setContactingDoctor] = useState(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get('/doctors/list');
        setDoctors(response.data || []);
      } catch (err) {
        console.error("Failed to load doctors list:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  // Redirect doctors away from this page
  if (user?.role === 'doctor') {
    return <Navigate to="/doctor" replace />;
  }

  const formatDoctorName = (name) => {
    if (!name) return 'Specialist';
    const trimmed = name.trim();
    return trimmed.toLowerCase().startsWith('dr') ? trimmed : `Dr. ${trimmed}`;
  };

  const canBook = user?.role === 'patient' || user?.role === 'doctor';

  const filteredDoctors = doctors.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (doc.specialization && doc.specialization.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (doc.clinic_name && doc.clinic_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-12 px-4">
      {/* Header section with glow */}
      <div className="text-center relative mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 flex items-center justify-center gap-2.5">
          <Stethoscope className="text-blue-600 dark:text-blue-400" size={28} />
          Our Medical Specialists
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-xs font-semibold uppercase tracking-wider leading-relaxed">
          Clinical leadership and diagnostic pulmonary specialists
        </p>
      </div>

      {/* Search Bar section */}
      <div className="max-w-md mx-auto mb-10 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input 
          type="text"
          aria-label="Search doctors"
          placeholder="Search by name, specialty, or clinic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl pl-11 pr-10 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 transition-all"
        />
        {searchQuery && (
           <button
             type="button"
             aria-label="Clear doctor search"
             onClick={() => setSearchQuery('')}
             className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-24 bg-white/[0.02] rounded-[2.5rem] border border-black/10 dark:border-white/10">
          <div className="size-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-sm font-bold uppercase tracking-wider">Syncing Specialist Directory...</p>
        </div>
      ) : filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
          {filteredDoctors.map((doc) => (
            <motion.div
              key={doc.id}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden group shadow-xs hover:shadow-md transition-all text-center"
            >
              <div className="flex-1 flex flex-col items-center">
                {/* Doctor Avatar */}
                <div className="size-16 sm:size-20 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center p-0.5 sm:p-1 shadow-xs group-hover:scale-105 transition-transform duration-300 shrink-0 mt-1">
                  {doc.profile_pic ? (
                    <img 
                       src={getAssetUrl(doc.profile_pic)} 
                      alt={doc.name} 
                      className="w-full h-full object-cover rounded-xl" 
                    />
                  ) : (
                    <User className="text-blue-500 size-8 sm:size-10" />
                  )}
                </div>

                {/* Doctor Name */}
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-base tracking-tight text-center mt-2.5 sm:mt-3 leading-tight line-clamp-1 sm:group-hover:text-blue-600 sm:dark:group-hover:text-blue-400 transition-colors">
                  {formatDoctorName(doc.name)}
                </h3>

                {/* Specialization Pill Box */}
                <div className="w-full mt-1.5 sm:mt-2 py-1 px-1.5 bg-blue-50/90 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 rounded-lg text-[7.5px] sm:text-[9.5px] font-bold uppercase tracking-wider text-center line-clamp-1">
                  {doc.specialization || 'General Medical Specialist'}
                </div>
              </div>

              {/* Doctor Card Action Buttons - One Button Per Line (No Wrap) */}
              <div className="space-y-1.5 mt-3 sm:mt-4 w-full">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorDetails(doc)}
                  className="w-full py-2 sm:py-2.5 px-2 sm:px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-[9.5px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Info size={14} className="shrink-0 text-slate-600 dark:text-slate-300" />
                  <span className="whitespace-nowrap">View Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setContactingDoctor(doc)}
                  className="w-full py-2 sm:py-2.5 px-2 sm:px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-[9.5px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="whitespace-nowrap">Contact Doctor</span>
                </button>

                {user?.role === 'doctor' && doc.id === user.id ? (
                  <Link
                    to="/profile"
                    className="w-full py-2 sm:py-2.5 px-2 sm:px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9.5px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <User size={13} className="shrink-0" />
                    <span className="whitespace-nowrap">Edit Bio</span>
                    <ArrowRight size={12} className="shrink-0" />
                  </Link>
                ) : canBook ? (
                  <Link
                    to="/book"
                    state={{ selectedDoctorId: doc.id }}
                    className="w-full py-2 sm:py-2.5 px-2 sm:px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9.5px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Calendar size={13} className="shrink-0" />
                    <span className="whitespace-nowrap">Book Appointment</span>
                    <ArrowRight size={12} className="shrink-0" />
                  </Link>
                ) : (
                  <Link
                    to="/guest-book"
                    state={{ selectedDoctorId: doc.id }}
                    className="w-full py-2 sm:py-2.5 px-2 sm:px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9.5px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Calendar size={13} className="shrink-0" />
                    <span className="whitespace-nowrap">Book as Guest</span>
                    <ArrowRight size={12} className="shrink-0" />
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl italic text-gray-500 text-sm">
          No specialists match your search criteria.
        </div>
      )}

      {/* Doctor Details Modal - Expanded Width on Small Screen */}
      <AnimatePresence>
        {selectedDoctorDetails && (() => {
          const cleanDetailDocName = (selectedDoctorDetails.name || '').replace(/^Dr\.?\s*/i, '');
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-1.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedDoctorDetails(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl relative my-auto custom-scrollbar"
              >
                <button
                  type="button"
                  aria-label="Close doctor details"
                  onClick={() => setSelectedDoctorDetails(null)}
                  className="absolute top-2.5 right-2.5 sm:top-5 sm:right-5 p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors z-10 cursor-pointer shadow-xs"
                >
                  <X size={18} className="text-slate-800 dark:text-white" />
                </button>

                <div className="p-3.5 sm:p-6 md:p-8">
                  <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-center md:items-start text-center md:text-left">
                    <div className="size-20 sm:size-28 md:size-36 rounded-2xl overflow-hidden bg-blue-600/10 flex items-center justify-center border border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
                      {selectedDoctorDetails.profile_pic ? (
                        <img 
                          src={getAssetUrl(selectedDoctorDetails.profile_pic)} 
                          alt={selectedDoctorDetails.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <User className="text-blue-400" size={36} />
                      )}
                    </div>
                    <div className="w-full min-w-0">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1 sm:mb-2">
                        Dr. {cleanDetailDocName}
                      </h2>
                      <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md text-[9px] sm:text-xs font-black uppercase tracking-wider inline-block mb-3 sm:mb-4">
                        {selectedDoctorDetails.specialization || 'Clinical Specialist'}
                      </span>
                      
                      <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-4 text-left">
                        {selectedDoctorDetails.clinic_name && (
                          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-bold">
                            <Building className="text-slate-400 shrink-0" size={15} />
                            <span className="truncate">{selectedDoctorDetails.clinic_name}</span>
                          </div>
                        )}
                        {selectedDoctorDetails.address && (
                          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            <MapPin className="text-slate-400 shrink-0 mt-0.5" size={15} />
                            <span className="leading-snug">{selectedDoctorDetails.address}</span>
                          </div>
                        )}
                        {selectedDoctorDetails.phone && (
                          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono">
                            <Phone className="text-slate-400 shrink-0" size={15} />
                            <span>{selectedDoctorDetails.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 sm:mt-6 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider mb-2 text-left">
                      Detailed Biography
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-left">
                      {selectedDoctorDetails.about || "No professional statement or biography has been entered by the doctor yet."}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 sm:mt-6 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-2.5 sm:mb-4 flex items-center gap-2 text-left">
                      <Calendar size={15} /> Timetable / Availability
                    </h3>
                    {(() => {
                      if (!selectedDoctorDetails.timetable) {
                        return <p className="text-slate-500 italic text-xs text-left">No timetable provided.</p>;
                      }
                      try {
                        const schedule = JSON.parse(selectedDoctorDetails.timetable);
                        if (Array.isArray(schedule)) {
                          return (
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 mt-2">
                              {schedule.map(dayObj => (
                                <div 
                                  key={dayObj.day} 
                                  className={`p-1.5 sm:p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 transition-colors ${
                                    dayObj.active 
                                      ? 'bg-emerald-500/10 border-emerald-500/25' 
                                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800 opacity-60'
                                  }`}
                                >
                                  <span className={`text-[10px] sm:text-xs font-bold truncate ${dayObj.active ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                                    {dayObj.day}
                                  </span>
                                  {dayObj.active ? (
                                    <span className="text-[8.5px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                      {dayObj.start} - {dayObj.end}
                                    </span>
                                  ) : (
                                    <span className="text-[8.5px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                                      Off
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return <p className="text-slate-600 dark:text-slate-400 text-xs text-left">{selectedDoctorDetails.timetable}</p>;
                      } catch (e) {
                        return <p className="text-slate-600 dark:text-slate-400 text-xs text-left">{selectedDoctorDetails.timetable}</p>;
                      }
                    })()}
                  </div>

                  <div className="mt-6 pt-2 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => setContactingDoctor(selectedDoctorDetails)}
                      className="flex-1 py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <MessageSquare size={16} />
                      Message Doctor
                    </button>
                    {user?.role === 'doctor' && selectedDoctorDetails.id === user.id ? (
                      <Link
                        to="/profile"
                        className="flex-1 py-3 sm:py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                      >
                        <User size={16} />
                        Edit Bio
                      </Link>
                    ) : canBook ? (
                      <Link
                        to="/book"
                        state={{ selectedDoctorId: selectedDoctorDetails.id }}
                        className="flex-1 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                      >
                        <Calendar size={16} />
                        Book Appointment
                      </Link>
                    ) : (
                      <Link
                        to="/guest-book"
                        state={{ selectedDoctorId: selectedDoctorDetails.id }}
                        className="flex-1 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                      >
                        <Calendar size={16} />
                        Book as Guest
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <DoctorContactModal 
        doctor={contactingDoctor} 
        isOpen={Boolean(contactingDoctor)} 
        onClose={() => setContactingDoctor(null)} 
      />
    </div>
  );
};

export default About;
