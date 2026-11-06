import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, AlertCircle, CheckCircle2, ChevronRight, 
  Stethoscope, User, Search, RefreshCw, X, Shield, 
  FileText, Check, ArrowRight, Info, Sparkles
} from 'lucide-react';
import UploadBox from '../components/UploadBox';
import ResultCard from '../components/ResultCard';
import { useAuth } from '../services/AuthContext';
import { api, getDoctorDashboard, getErrorMessage, predictImage, getModelStatus } from '../services/api';
import { showErrorAlert } from '../utils/alert';
import FieldFormatHint from '../components/FieldFormatHint';

const Predict = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientData, setPatientData] = useState(null);
  const [fetchingPatient, setFetchingPatient] = useState(false);
  const [todayPatients, setTodayPatients] = useState([]);
  const [showTodayDropdown, setShowTodayDropdown] = useState(false);
  const [modelInfo, setModelInfo] = useState({ connected: true, checking: true, error: null, modelName: 'DenseNet-121' });

  // Check diagnostic AI model connection status
  useEffect(() => {
    let isMounted = true;
    const checkModel = async () => {
      try {
        const data = await getModelStatus();
        if (isMounted) {
          setModelInfo({
            connected: Boolean(data?.connected),
            checking: false,
            error: data?.error || null,
            modelName: data?.model_name || 'DenseNet-121'
          });
        }
      } catch (err) {
        if (isMounted) {
          setModelInfo({
            connected: false,
            checking: false,
            error: 'Backend model service unavailable',
            modelName: 'DenseNet-121'
          });
        }
      }
    };
    checkModel();
    return () => { isMounted = false; };
  }, []);

  // Fetch doctor dashboard on mount to load today's queue
  useEffect(() => {
    const fetchTodayPatients = async () => {
      if (user?.role !== 'doctor') return;
      try {
        const response = await getDoctorDashboard();
        const patients = response.data?.patients || [];
        
        // Exact local date string YYYY-MM-DD
        const todayDateString = (() => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })();
        
        const filtered = patients.filter(p => {
          if (!p.created_at) return false;
          const rawDateStr = p.created_at.split('T')[0];
          if (rawDateStr === todayDateString) return true;
          
          const dateStr = p.created_at.includes('Z') ? p.created_at : `${p.created_at}Z`;
          const pDate = new Date(dateStr);
          const year = pDate.getFullYear();
          const month = String(pDate.getMonth() + 1).padStart(2, '0');
          const day = String(pDate.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}` === todayDateString;
        });
        
        setTodayPatients(filtered);
      } catch (err) {
        console.error("Failed to load today's patients in Predict:", err);
      }
    };
    fetchTodayPatients();
  }, [user]);

  // Live Patient Search
  const verifyPatient = async (val) => {
    const identifier = val.trim();
    setPatientId(identifier);
    if (identifier.length >= 5) {
      setFetchingPatient(true);
      try {
        const response = await api.get('/doctor/search-patient', {
          params: { identifier }
        });
        if (response.data.exists) {
          setPatientData(response.data.patient);
        } else {
          setPatientData(null);
        }
      } catch (err) {
        setPatientData(null);
      } finally {
        setFetchingPatient(false);
      }
    } else {
      setPatientData(null);
    }
  };

  // Check for pre-filled patient data from navigation state
  useEffect(() => {
    if (location.state?.patient) {
      const p = location.state.patient;
      const identifier = p.cnic || p.phone;
      setPatientId(identifier);
      verifyPatient(identifier);
    }
  }, [location.state]);

  const handleUpload = (selectedFile) => {
    setFile(selectedFile);
    setResult(null);
    setError('');
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  const loadSampleXray = async (sampleType) => {
    setError('');
    setResult(null);
    try {
      const filename = sampleType === 'Normal' ? 'sample_normal.png' : sampleType === 'TB' ? 'sample_tb.png' : 'sample_pneumonia.png';
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) {
        throw new Error("Sample file not found");
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], `${sampleType.toLowerCase()}_sample_cxr.png`, { type: 'image/png' });
      setFile(sampleFile);
    } catch (err) {
      console.error("Could not load demo sample X-ray:", err);
      setError("Failed to load sample image. Please upload a file manually.");
    }
  };

  const selectPatientFromQueue = (p) => {
    const identifier = p.cnic || p.phone;
    setPatientId(identifier);
    setPatientData(p);
    setShowTodayDropdown(false);
  };

  const clearSelectedPatient = () => {
    setPatientId('');
    setPatientData(null);
  };

  const runAnalysis = async () => {
    if (!file) return;
    if (!modelInfo.connected) {
      setError('Cannot run analysis: Diagnostic AI model is not connected. Random predictions are restricted and cannot be performed.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await predictImage(file, patientId);
      setResult(response);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 503) {
        setError('Diagnostic AI model is offline or not connected. Random predictions are restricted and disabled.');
        setModelInfo(prev => ({ ...prev, connected: false }));
      } else {
        setError(getErrorMessage(err, 'Analysis failed. Please ensure the image is a clear, valid chest radiograph.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 print:max-w-none print:p-0 print:m-0">
      
      {/* ─────────────────────────────────────────────────────────────
          Page Header
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 sm:mb-6 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1.5">
            <Activity size={14} />
            <span>Clinical Radiography CAD Screening</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Chest Radiograph Screening
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
            Differential diagnostic analysis for Pulmonary Tuberculosis, Pneumonia, and Normal findings.
          </p>
        </div>

        {/* Clinical Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {modelInfo.checking ? (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-500 flex items-center gap-1.5 shadow-xs">
              <span className="size-1.5 rounded-full bg-slate-400 animate-pulse" />
              Checking Model
            </span>
          ) : modelInfo.connected ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Model Connected ({modelInfo.modelName})
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 shadow-xs">
              <span className="size-2 rounded-full bg-rose-500" />
              Model Disconnected (Offline)
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            PA / AP View Supported
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            Tuberculosis &amp; Pneumonia
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            EHR Linked
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Main Two-Column Workspace
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:w-full">
        
        {/* ── Left Column: Diagnostic Setup & Patient Assignment ── */}
        <div className="lg:col-span-5 space-y-3.5 print:hidden">
          
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-3.5">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Activity size={15} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Diagnostic Setup</h3>
                  <p className="text-[10px] text-slate-400">Configure patient link &amp; radiograph</p>
                </div>
              </div>

              {patientData && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Verified
                </span>
              )}
            </div>

            {/* Model Offline Restriction Alert */}
            {!modelInfo.checking && !modelInfo.connected && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Model Connection Required</p>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                    The backend diagnostic model is currently disconnected or offline. Radiograph screening is locked to prevent random or inaccurate mock predictions. Automated screening will unlock when the model is connected.
                  </p>
                </div>
              </div>
            )}

            {/* Doctor-only: Patient Identification Box */}
            {user?.role === 'doctor' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Assign to Patient EHR</span>
                  {patientData && (
                    <button
                      type="button"
                      onClick={clearSelectedPatient}
                      className="text-[10px] text-rose-500 hover:underline font-semibold cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </label>

                {patientData ? (
                  /* Verified Patient Card */
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {patientData.name?.[0] || 'P'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {patientData.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {patientData.age ? `${patientData.age} Yrs` : ''} 
                          {patientData.gender ? ` • ${patientData.gender}` : ''}
                          {patientData.cnic ? ` • ID: ${patientData.cnic}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearSelectedPatient}
                      className="size-6 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950 flex items-center justify-center transition-colors cursor-pointer"
                      title="Change patient"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  /* Patient Search Input */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text"
                        placeholder="Search by CNIC or Phone (e.g. 03XXXXXXXXX)..."
                        value={patientId}
                        onChange={(e) => verifyPatient(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-mono"
                      />
                      {fetchingPatient && (
                        <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                      )}
                      {patientId && !fetchingPatient && (
                        <button
                          type="button"
                          onClick={() => { setPatientId(''); setPatientData(null); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <FieldFormatHint type="identifier" value={patientId} />

                    {/* Quick Queue Chips */}
                    {todayPatients.length > 0 && (
                      <div className="pt-0.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Today's Patients ({todayPatients.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                          {todayPatients.slice(0, 6).map((tp) => (
                            <button
                              key={tp.id}
                              type="button"
                              onClick={() => selectPatientFromQueue(tp)}
                              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[10px] font-semibold transition-all border border-slate-200/60 dark:border-slate-700/60 cursor-pointer truncate max-w-[140px]"
                            >
                              {tp.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Upload Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Chest Radiograph (CXR)
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Standard Thoracic Radiograph</span>
              </div>

              {/* One-Click Verified Demo Samples */}
              <div className="mb-2.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500" />
                    <span>Quick Test Samples (Instant Demo)</span>
                  </span>
                  <span className="text-[9px] text-slate-400">1-Click Load</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadSampleXray('Normal')}
                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs hover:scale-[1.02]"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Normal CXR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleXray('TB')}
                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/70 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs hover:scale-[1.02]"
                  >
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    <span>TB Positive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleXray('Pneumonia')}
                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/70 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs hover:scale-[1.02]"
                  >
                    <span className="size-1.5 rounded-full bg-purple-500" />
                    <span>Pneumonia</span>
                  </button>
                </div>
              </div>

              <UploadBox onUpload={handleUpload} file={file} result={result} />
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="flex items-start gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-medium leading-relaxed">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Run Analysis Button */}
            <button
              type="button"
              onClick={runAnalysis}
              disabled={!file || loading || (!modelInfo.checking && !modelInfo.connected)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !file || loading || (!modelInfo.checking && !modelInfo.connected)
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-98'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing Diagnostic Analysis...</span>
                </>
              ) : !modelInfo.checking && !modelInfo.connected ? (
                <>
                  <AlertCircle size={14} className="text-rose-500" />
                  <span>Model Disconnected (Predictions Blocked)</span>
                </>
              ) : (
                <>
                  <Activity size={14} />
                  <span>Run Radiograph Analysis</span>
                </>
              )}
            </button>

          </div>

          {/* Quick Guidance Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
              <Info size={13} className="text-blue-500" />
              <span>Input Quality Guidelines</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-relaxed">
              <li>Upload standardized posteroanterior (PA) or anteroposterior (AP) chest X-rays.</li>
              <li>Avoid colored photos, rotated angles, or severe motion artifacts.</li>
              <li>Files are automatically processed at $224 \times 224$ normalized tensor resolution.</li>
            </ul>
          </div>

        </div>

        {/* ── Right Column: Diagnostic Results or Waiting Guidance ── */}
        <div className="lg:col-span-7 print:col-span-12 print:w-full">
          <AnimatePresence mode="wait">
            {result ? (
              <ResultCard result={result} onReset={handleReset} />
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xs text-center flex flex-col items-center justify-center min-h-[380px]"
              >
                <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3.5 border border-blue-200/60 dark:border-blue-900/60 shadow-xs">
                  <Activity size={24} />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Awaiting Radiograph Scan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
                  Select a patient record and upload a chest radiograph to generate clinical classification scores.
                </p>

                {/* 3 Step Workflow */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-md text-left">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="size-5 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center mb-1.5">1</span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Assign Patient</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Link to registered patient or select from today's list.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="size-5 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center mb-1.5">2</span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Upload CXR</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Choose chest radiograph in PNG, JPG, JPEG, or DICOM (.dcm).</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="size-5 rounded bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center mb-1.5">3</span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Review Report</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Instant multiclass classification and clinical summary.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
};

export default Predict;
