import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanLine, RefreshCw, Trash2, UserCheck, Server, Inbox,
  AlertTriangle, CheckCircle2, Link2, Search, X, Clock,
  ImageOff, ShieldAlert, Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  getDicomGatewayStatus,
  getDicomPendingStudies,
  attachDicomStudy,
  discardDicomStudy,
  getProtectedImageUrl,
  getErrorMessage
} from '../services/api';
import { clinicalSwal } from '../utils/alert';
import FieldFormatHint from '../components/FieldFormatHint';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting Analysis' },
  { key: 'analysed', label: 'Analysed' },
  { key: 'rejected', label: 'Rejected' }
];

const formatReceivedAt = (value) => {
  if (!value) return '';
  const iso = String(value).includes('Z') ? value : `${value}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const shortUid = (uid) => {
  if (!uid) return '—';
  const tail = String(uid).split('.').pop();
  return tail.length > 12 ? `…${tail.slice(-12)}` : tail;
};

const statusTheme = (status) => {
  if (status === 'analysed') {
    return {
      chip: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      label: 'Analysed'
    };
  }
  if (status === 'rejected') {
    return {
      chip: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      label: 'Rejected'
    };
  }
  return {
    chip: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    label: 'Queued'
  };
};

const resultTheme = (result) => {
  if (result === 'TB') return 'text-rose-500';
  if (result === 'Pneumonia') return 'text-purple-500';
  return 'text-emerald-500';
};

// ──────────────────────────────────────────────────
// Attach Study Modal — link a received study to a patient
// ──────────────────────────────────────────────────
const AttachModal = ({ study, onClose, onAttached }) => {
  const [identifier, setIdentifier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!identifier.trim()) {
      setError('Enter the patient phone number or CNIC.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await attachDicomStudy(study.id, identifier.trim());
      toast.success(res.data.message || 'Study attached.');
      onAttached();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not attach this study.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <UserCheck className="text-blue-500" size={18} />
            <span className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">
              Attach to Patient
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0">DICOM Patient</span>
              <span className="font-bold text-slate-900 dark:text-white text-right truncate">
                {study.dicom_patient_name || 'Not set'}{study.dicom_patient_id ? ` (${study.dicom_patient_id})` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0">SOP Instance</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-right truncate">{shortUid(study.sop_instance_uid)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0">Received</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 text-right">{formatReceivedAt(study.created_at)}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            The DICOM Patient ID is assigned by the X-ray machine and does not match this
            system's phone/CNIC records, so the match is confirmed by you.
          </p>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block">
              Patient phone number or CNIC
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                placeholder="e.g. 03001234567"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-9 pr-4 py-3 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <FieldFormatHint cnic="42201" phone="0300" />
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <Link2 size={15} />
            {saving ? 'Attaching…' : 'Attach Study'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────
// Study Card
// ──────────────────────────────────────────────────
const StudyCard = ({ study, onAttach, onDiscard }) => {
  const [viewMode, setViewMode] = useState('heatmap');
  const theme = statusTheme(study.status);
  const hasImage = Boolean(study.image_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="p-3.5 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${theme.chip}`}>
              {theme.label}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {study.modality || 'DICOM'}
            </span>
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1.5 truncate">
            {study.dicom_patient_name || 'Unlabelled Study'}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {study.dicom_patient_id ? `ID ${study.dicom_patient_id} • ` : ''}
            SOP {shortUid(study.sop_instance_uid)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <Clock size={9} /> Received
          </span>
          <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">
            {formatReceivedAt(study.created_at)}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {hasImage ? (
          <div>
            <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-square max-h-64 mx-auto flex items-center justify-center">
              <img
                src={getProtectedImageUrl(
                  viewMode === 'heatmap' && study.heatmap_url ? study.heatmap_url : study.image_url
                )}
                alt="Radiograph received from the X-ray machine"
                className="max-h-full max-w-full object-contain"
              />
              {viewMode === 'heatmap' && study.heatmap_url && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[9px] font-bold text-slate-300">
                  Grad-CAM Saliency
                </div>
              )}
            </div>
            {study.heatmap_url && (
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold mt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('original')}
                  className={`flex-1 px-2 py-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === 'original' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Original CXR
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('heatmap')}
                  className={`flex-1 px-2 py-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === 'heatmap' ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  AI Heatmap
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center text-center">
            <ImageOff size={22} className="text-slate-300 dark:text-slate-600 mb-1.5" />
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">No viewable image</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">
              {study.rejection_label || 'This study was not analysed.'}
            </p>
          </div>
        )}

        {study.status === 'analysed' && (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`size-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center ${resultTheme(study.result)} shrink-0`}>
                {study.result === 'Normal' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              </span>
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">CAD Result</span>
                <span className={`block text-sm font-black truncate ${resultTheme(study.result)}`}>
                  {study.result === 'TB' ? 'Tuberculosis' : study.result}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Confidence</span>
              <span className={`block text-lg font-black ${resultTheme(study.result)}`}>
                {study.confidence != null ? `${(study.confidence * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
        )}

        {study.status === 'pending' && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <Clock size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              The study was received but is not analysed yet. It will be classified once the
              service is available.
            </p>
          </div>
        )}

        {study.status === 'rejected' && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
            <ShieldAlert size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="block text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">
                {study.rejection_label || 'Not analysed'}
              </span>
              <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed mt-0.5">
                The original study is retained for audit and cannot be attached to a patient.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          {study.status === 'analysed' ? (
            <button
              type="button"
              onClick={() => onAttach(study)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck size={12} /> Attach to Patient
            </button>
          ) : (
            <div className="flex-1 text-center py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-not-allowed">
              Not attachable
            </div>
          )}
          <button
            type="button"
            onClick={() => onDiscard(study)}
            title="Discard study"
            className="size-10 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ──────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────
const DicomInbox = () => {
  const [studies, setStudies] = useState([]);
  const [gateway, setGateway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachTarget, setAttachTarget] = useState(null);
  const seenIdsRef = useRef(null);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [statusRes, studiesRes] = await Promise.all([
        getDicomGatewayStatus(),
        getDicomPendingStudies({ limit: 100 })
      ]);
      const incoming = studiesRes.data || [];

      if (silent && seenIdsRef.current) {
        const fresh = incoming.filter((s) => !seenIdsRef.current.has(s.id));
        if (fresh.length === 1) {
          toast.info(`New study received from ${fresh[0].source_ae_title || 'the X-ray machine'}`, { autoClose: 4000 });
        } else if (fresh.length > 1) {
          toast.info(`${fresh.length} new studies received`, { autoClose: 4000 });
        }
      }
      seenIdsRef.current = new Set(incoming.map((s) => s.id));

      setGateway(statusRes.data);
      setStudies(incoming);
    } catch (err) {
      console.error('Failed to load DICOM inbox:', err);
      if (err.response?.status === 401) {
        toast.error('Your session expired. Please sign in again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // The machine pushes asynchronously, so poll like the inquiries inbox does.
    const poll = setInterval(() => fetchData({ silent: true }), 15000);
    return () => clearInterval(poll);
  }, [fetchData]);

  const visibleStudies = studies.filter((study) => {
    if (filter !== 'all' && study.status !== filter) return false;
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.trim().toLowerCase();
    return [study.dicom_patient_name, study.dicom_patient_id, study.sop_instance_uid, study.source_ae_title]
      .some((value) => String(value || '').toLowerCase().includes(needle));
  });

  const handleDiscard = async (study) => {
    const result = await clinicalSwal.fire({
      title: 'Discard Study?',
      text: 'The rendered image and the retained original DICOM study will be deleted. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, discard',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });
    if (!result.isConfirmed) return;
    try {
      await discardDicomStudy(study.id);
      toast.success('DICOM study discarded.');
      fetchData({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not discard this study.'));
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Gateway status header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <ScanLine className="text-blue-500" /> DICOM Inbox
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Chest radiographs pushed by the hospital X-ray machine over DICOM C-STORE. Each
          study arrives unattributed and is matched to a patient by you.
        </p>

        {gateway && (
          <div className="mt-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${gateway.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="text-slate-500 dark:text-slate-400">Listener</span>
                <span className={gateway.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                  {gateway.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Server size={11} className="text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">AE</span>
                <span className="text-slate-900 dark:text-white font-mono">{gateway.local_ae_title}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400">Port</span>
                <span className="text-slate-900 dark:text-white font-mono">{gateway.port}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Inbox size={11} className="text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Unattributed</span>
                <span className="text-blue-600 dark:text-blue-400">{gateway.counts?.unattributed ?? 0}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400">CAD</span>
                <span className={gateway.model_connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                  {gateway.model_connected ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>

            {!gateway.machine_integration_verified && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex items-start gap-2">
                <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  The gateway has been verified against a DICOM simulator only. It has not yet been
                  connected to a physical X-ray machine, so site-level compatibility is unconfirmed.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                filter === item.key
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient, SOP UID or AE title…"
            className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={() => fetchData()}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Grid */}
      {visibleStudies.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <Inbox size={30} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No studies to review</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {studies.length === 0
              ? 'Studies sent by the X-ray machine appear here automatically within a few seconds of arrival.'
              : 'No study matches the current filter or search.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleStudies.map((study) => (
            <StudyCard
              key={study.id}
              study={study}
              onAttach={setAttachTarget}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
        <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Attach only after confirming the radiograph matches the patient. This computer-aided
          detection is decision support; final diagnosis remains the responsibility of the
          treating physician.
        </p>
      </div>

      {attachTarget && (
        <AttachModal
          study={attachTarget}
          onClose={() => setAttachTarget(null)}
          onAttached={() => { setAttachTarget(null); fetchData({ silent: true }); }}
        />
      )}
    </div>
  );
};

export default DicomInbox;
