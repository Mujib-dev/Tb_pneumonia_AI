import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../services/AuthContext';
import { Users, CheckCircle, Clock, Activity, Coins, Calendar, ArrowRight, Trash2, Printer, X } from 'lucide-react';
import { clinicalSwal, showErrorAlert, showSuccessAlert } from '../utils/alert';

// ──────────────────────────────────────────────────
// Fee Modal — shown when doctor marks a patient done
// ──────────────────────────────────────────────────
const FeeModal = ({ isOpen, onClose, onConfirm, defaultFee }) => {
  const [customFee, setCustomFee] = useState(defaultFee || 0);

  // Reset whenever modal opens
  useEffect(() => {
    if (isOpen) setCustomFee(defaultFee || 0);
  }, [isOpen, defaultFee]);

  if (!isOpen) return null;

  const half = Math.floor((defaultFee || 0) / 2);

  const presets = [
    { label: 'Full Fee', value: defaultFee || 0, color: 'bg-blue-500 text-white border-blue-500' },
    { label: 'Half Fee', value: half,              color: 'bg-amber-500 text-white border-amber-500' },
    { label: 'Free',     value: 0,                 color: 'bg-emerald-500 text-white border-emerald-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Coins className="text-emerald-500" size={18} />
            <span className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Collect Fee</span>
          </div>
          <button onClick={onClose} className="size-7 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preset buttons */}
          <div className="grid grid-cols-3 gap-2">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => setCustomFee(p.value)}
                className={`py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                  customFee === p.value
                    ? p.color + ' shadow-md scale-105'
                    : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <div>{p.label}</div>
                <div className="text-[9px] opacity-75 mt-0.5 font-bold">Rs. {p.value}</div>
              </button>
            ))}
          </div>

          {/* Custom fee input */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 block">
              Or enter custom amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">Rs.</span>
              <input
                type="number"
                min="0"
                value={customFee}
                onChange={e => setCustomFee(Number(e.target.value))}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white font-black text-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
          </div>

          {/* Confirm */}
          <button
            onClick={() => onConfirm(customFee)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            Complete &amp; Collect Rs. {customFee}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────
const TodayTokens = () => {
  const { user, logout } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [queueWindow, setQueueWindow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  // Fee modal state
  const [feeModal, setFeeModal] = useState({ open: false, appId: null });

  const fetchTodayTokens = useCallback(async () => {
    try {
      const [queueRes, windowRes] = await Promise.all([
        api.get('/appointments/doctor-today', {
          params: { date: selectedDate }
        }),
        api.get('/appointments/queue-window', {
          params: { doctor_id: user?.id, date: selectedDate }
        })
      ]);
      setTokens(queueRes.data);
      setQueueWindow(windowRes.data || null);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      } else {
        showErrorAlert('Error', 'Failed to fetch tokens.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user?.id]);

  useEffect(() => {
    fetchTodayTokens();
    const interval = setInterval(fetchTodayTokens, 15000);
    return () => clearInterval(interval);
  }, [fetchTodayTokens]);

  // Opens the fee modal for any completion action
  const requestComplete = (appId) => {
    setFeeModal({ open: true, appId });
  };

  const handleFeeConfirmed = async (fee) => {
    setFeeModal({ open: false, appId: null });
    try {
      await api.post('/appointments/update-status', {
        appointment_id: feeModal.appId,
        status: 'completed',
        custom_fee: fee
      });
      showSuccessAlert('Done!', fee > 0 ? `Consultation completed. Rs. ${fee} collected.` : 'Consultation completed. Fee waived.');
      fetchTodayTokens();
    } catch (err) {
      showErrorAlert('Failed', err.response?.data?.detail || 'Could not update status.');
    }
  };

  const handleUpdateAppointmentStatus = async (appId, newStatus) => {
    if (newStatus === 'completed') {
      requestComplete(appId);
      return;
    }
    try {
      await api.post('/appointments/update-status', {
        appointment_id: appId,
        status: newStatus,
      });
      fetchTodayTokens();
    } catch (err) {
      showErrorAlert('Update Failed', err.response?.data?.detail || err.message);
    }
  };

  const handleMoveToTomorrow = async (appId) => {
    try {
      const res = await api.post('/appointments/move-to-tomorrow', {
        appointment_id: appId
      });
      showSuccessAlert('Moved', `Patient moved to tomorrow (Token #${res.data.new_token})`);
      fetchTodayTokens();
    } catch (err) {
      showErrorAlert('Move Failed', err.response?.data?.detail || 'Failed to move patient to tomorrow.');
    }
  };

  const handleMoveAllToTomorrow = async () => {
    const result = await clinicalSwal.fire({
      title: 'End Shift?',
      text: `Move all ${incomplete.length} pending patients to tomorrow?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, move all',
      confirmButtonColor: '#4f46e5'
    });
    if (result.isConfirmed) {
      setLoading(true);
      try {
        await Promise.all(incomplete.map(t => 
          api.post('/appointments/move-to-tomorrow', {
            appointment_id: t.id
          })
        ));
        showSuccessAlert('Shift Ended', 'All pending patients moved to tomorrow.');
        fetchTodayTokens();
      } catch (err) {
        showErrorAlert('Error', 'Failed to move some patients.');
        fetchTodayTokens();
      }
    }
  };

  const handleDeleteAppointment = async (appId) => {
    const result = await clinicalSwal.fire({
      title: 'Delete Appointment?',
      text: 'Are you sure you want to completely remove this appointment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });
    if (result.isConfirmed) {
      try {
        await api.delete(`/appointments/cancel/${appId}`);
        showSuccessAlert('Deleted', 'Appointment deleted successfully');
        fetchTodayTokens();
      } catch (err) {
        showErrorAlert('Delete Failed', err.response?.data?.detail || err.message);
      }
    }
  };

  const handlePrintToken = (token) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Clinic Token - #${token.token_number}</title>
          <style>
            @page { margin: 0; }
            html, body { width:100%; height:100%; margin:0; padding:0; display:flex; justify-content:center; align-items:center; }
            body { font-family:'Inter',sans-serif; text-align:center; color:#000; }
            .ticket { border:2px dashed #000; padding:15px; border-radius:12px; width:95mm; height:138mm; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; }
            h1 { margin:5px 0; font-size:48px; letter-spacing:-2px; }
            h2 { margin:5px 0; font-size:20px; }
            p { margin:3px 0; font-size:12px; color:#333; }
            .brand { font-weight:900; letter-spacing:1px; color:#000; font-size:14px; margin-bottom:5px; }
            .date { font-weight:bold; margin-top:10px; font-size:14px; }
            .status { margin-top:10px; padding:6px 12px; border-radius:6px; border:2px solid #000; font-weight:bold; display:inline-block; text-transform:uppercase; font-size:12px; }
            .patient-box { text-align:left; background:#f8f8f8; padding:10px; border-radius:8px; margin:10px 0; border:1px solid #ddd; }
            .patient-box p { font-size:11px; margin:2px 0; }
            .patient-box strong { color:#000; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <p class="brand">PULMO AI - CLINIC TOKEN</p>
            <h2>Dr. ${user?.name}</h2>
            <p>${user?.specialization || 'Specialist'} | ${user?.clinic_name || 'Clinic'}</p>
            <hr style="margin:10px 0;border:none;border-top:2px dashed #000;width:100%;"/>
            <div class="patient-box">
              <p><strong>Patient:</strong> ${token.patient_name || 'Unknown'}</p>
              <p><strong>Phone:</strong> ${token.patient_phone || 'N/A'}</p>
              <p><strong>Gender/Age:</strong> ${token.patient_gender || 'N/A'} / ${token.patient_age ? token.patient_age + ' Yrs' : 'N/A'}</p>
            </div>
            <p style="font-weight:900;letter-spacing:1px;font-size:12px;margin-top:10px;">YOUR TOKEN NUMBER</p>
            <h1>#${token.token_number}</h1>
            <p class="date">Date: ${new Date(selectedDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} &nbsp;|&nbsp; Time: ${token.created_at ? new Date(token.created_at.endsWith('Z') || token.created_at.includes('+') ? token.created_at : token.created_at + 'Z').toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: true}) : new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: true})}</p>
            <div><div class="status">${token.status === 'completed' ? 'Checked Up' : token.status === 'serving' ? 'Now Serving' : token.status === 'absent' ? 'Absent / Delayed' : token.status === 'arrived' ? 'Arrived' : 'Pending in Queue'}</div></div>
          </div>
          <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},500);}</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const completed  = tokens.filter(t => t.status === 'completed');
  const serving    = tokens.filter(t => t.status === 'serving');
  const incomplete = tokens.filter(t => ['pending', 'absent', 'arrived'].includes(t.status));
  const totalEarnings = completed.reduce((sum, t) => sum + (t.fee_charged || 0), 0);

  if (loading) {
    return <div className="py-20 text-center"><div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  }

  return (
    <>
      {/* Fee Modal */}
      <FeeModal
        isOpen={feeModal.open}
        onClose={() => setFeeModal({ open: false, appId: null })}
        onConfirm={handleFeeConfirmed}
        defaultFee={user?.consultation_fee || 0}
      />

      <div className="max-w-6xl mx-auto pb-10">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="text-blue-500" /> Token Master List
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="text-gray-400" size={14} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white dark:bg-[#1e293b] border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
              {queueWindow && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-2 py-1 rounded-lg">
                  Batch {queueWindow.active_batch} • T-{queueWindow.window_start}–T-{queueWindow.window_end}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-end gap-2">
              <Coins className="text-emerald-500" size={18}/> Rs. {totalEarnings}
            </div>
            <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mt-1">{completed.length} Completed • {incomplete.length} Remaining</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* ── Completed ── */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col">
            <h2 className="text-sm font-black uppercase text-green-500 tracking-wider mb-4 border-b border-green-500/20 pb-2 flex items-center gap-2">
              <CheckCircle size={16} /> Completed ({completed.length})
            </h2>
            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
              {completed.length === 0 && <div className="text-xs text-gray-400 italic">No tokens completed yet.</div>}
              {completed.map(t => (
                <div key={t.id} className="bg-green-500/10 border border-green-500/20 rounded-xl py-2 px-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[150px]">{t.patient_name}</div>
                    <div className="text-[9px] font-bold text-green-600 dark:text-green-400 mt-0.5"><Coins size={8} className="inline mr-1"/>{t.fee_charged ? `Rs. ${t.fee_charged}` : 'Free'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePrintToken(t)} className="size-8 bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer" title="Print Token">
                      <Printer size={14} />
                    </button>
                    <div className="size-8 bg-green-500 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-sm">
                      {t.token_number}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Now Serving ── */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col">
            <h2 className="text-sm font-black uppercase text-yellow-500 tracking-wider mb-4 border-b border-yellow-500/20 pb-2 flex items-center gap-2">
              <Activity size={16} /> Now Serving
            </h2>
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              {serving.length > 0 ? (
                <div className="text-center w-full relative">
                  <div className="size-32 bg-yellow-500 mx-auto rounded-full flex items-center justify-center text-white font-black text-6xl shadow-[0_0_40px_rgba(234,179,8,0.4)] animate-pulse mb-4 border-4 border-white dark:border-[#0f172a]">
                    {serving[0].token_number}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white truncate px-4">{serving[0].patient_name}</h3>
                  <p className="text-xs text-yellow-500 font-bold uppercase mt-1 tracking-widest">In Consultation</p>
                  <div className="flex gap-2 w-full mt-6">
                    <button
                      onClick={() => handlePrintToken(serving[0])}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer size={14} /> Print
                    </button>
                    <button
                      onClick={() => requestComplete(serving[0].id)}
                      className="flex-[2] bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={14} /> Complete &amp; Take Fee
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <Activity size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold uppercase tracking-wider">No patient currently serving</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Waiting List ── */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-blue-500/20 pb-2">
              <h2 className="text-sm font-black uppercase text-blue-500 tracking-wider flex items-center gap-2">
                <Clock size={16} /> Waiting List ({incomplete.length})
              </h2>
              {incomplete.length > 0 && (
                <button 
                  onClick={handleMoveAllToTomorrow}
                  className="text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors uppercase tracking-widest flex items-center gap-1"
                >
                  <ArrowRight size={10} /> End Shift: Move All
                </button>
              )}
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
              {incomplete.length === 0 && <div className="text-xs text-gray-400 italic">No pending tokens.</div>}
              {incomplete.map(t => (
                <div key={t.id} className="bg-blue-500/5 border border-blue-500/10 rounded-xl py-2 px-3 flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[150px]">{t.patient_name}</div>
                    <div className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-wider">{t.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePrintToken(t)} className="size-8 bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer" title="Print Token">
                      <Printer size={14} />
                    </button>
                    <button onClick={() => handleMoveToTomorrow(t.id)} className="size-8 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer" title="Move to Tomorrow">
                      <ArrowRight size={14} />
                    </button>
                    <button onClick={() => handleDeleteAppointment(t.id)} className="size-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer" title="Delete Token">
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => requestComplete(t.id)} className="size-8 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer" title="Mark Completed">
                      <CheckCircle size={14} />
                    </button>
                    <div className="size-8 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-center font-black text-sm">
                      {t.token_number}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TodayTokens;
