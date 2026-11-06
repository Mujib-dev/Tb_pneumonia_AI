import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, RefreshCw, ArrowLeft, Inbox, Stethoscope, CheckCircle2,
  Pencil, Trash2, Send, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getPatientInquiries, updatePatientInquiry, deletePatientInquiry } from '../services/api';
import { clinicalSwal } from '../utils/alert';
import { useAuth } from '../services/AuthContext';

const EDIT_WINDOW_MS = 60 * 1000;

const formatReceivedAt = (value) => {
  if (!value) return '';
  const iso = String(value).includes('Z') ? value : `${value}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const msUntil = (value) => {
  if (!value) return 0;
  const iso = String(value).includes('Z') ? value : `${value}Z`;
  const sent = new Date(iso).getTime();
  if (Number.isNaN(sent)) return 0;
  return EDIT_WINDOW_MS - (Date.now() - sent);
};

// Editable only while the 1 minute window is open and the doctor hasn't replied.
const canEdit = (msg) => msUntil(msg.created_at) > 0 && (msg.replies || []).length === 0;

const MyInquiries = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saving, setSaving] = useState(false);
  // Reply ids already announced. Null until the first load lands.
  const seenReplyIdsRef = useRef(null);

  const fetchInquiries = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getPatientInquiries();
      const incoming = res.data || [];
      const allReplies = incoming.flatMap(m => m.replies || []);

      if (silent && seenReplyIdsRef.current) {
        const fresh = allReplies.filter(r => !seenReplyIdsRef.current.has(r.id));
        if (fresh.length === 1) {
          toast.info(`New reply from Dr. ${fresh[0].sender_name || 'your doctor'}`, { autoClose: 3000 });
        } else if (fresh.length > 1) {
          toast.info(`${fresh.length} new replies received`, { autoClose: 3000 });
        }
      }
      seenReplyIdsRef.current = new Set(allReplies.map(r => r.id));

      setMessages(incoming);
    } catch (err) {
      console.error('Failed to load your inquiries:', err);
      toast.error('Failed to load your inquiries: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
    const poll = setInterval(() => fetchInquiries({ silent: true }), 15000);
    return () => clearInterval(poll);
  }, []);

  const toggleThread = (msgId) => {
    setExpanded(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setDraftSubject(msg.subject || '');
    setDraftBody(msg.message || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftSubject('');
    setDraftBody('');
  };

  const saveEdit = async (msg) => {
    if (!draftBody.trim()) {
      toast.warn('Your message cannot be empty.', { autoClose: 4000 });
      return;
    }
    setSaving(true);
    try {
      await updatePatientInquiry(msg.id, { subject: draftSubject, message: draftBody });
      toast.success('Inquiry updated.', { autoClose: 4000 });
      cancelEdit();
      fetchInquiries({ silent: true });
    } catch (err) {
      toast.error('Could not update: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (msg) => {
    const replyCount = (msg.replies || []).length;
    const result = await clinicalSwal.fire({
      title: 'Delete Inquiry?',
      text: replyCount > 0
        ? `This will also remove ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'} from your doctor. This cannot be undone.`
        : 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    try {
      await deletePatientInquiry(msg.id);
      toast.success('Inquiry deleted.', { autoClose: 4000 });
      if (editingId === msg.id) cancelEdit();
      fetchInquiries({ silent: true });
    } catch (err) {
      toast.error('Could not delete: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    }
  };

  const answeredCount = useMemo(
    () => messages.filter(m => (m.replies || []).length > 0).length,
    [messages]
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="glass p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <MessageSquare size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                My Inquiries
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {messages.length} Sent • {answeredCount} Answered
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchInquiries({ silent: true })}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-500" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass p-10 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={20} className="animate-spin text-blue-500" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Loading your inquiries…</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="glass p-10 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
            <Inbox size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Inquiries Sent Yet</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mt-0.5">
            When you contact a doctor from their profile, your question and their reply will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => {
            const replies = msg.replies || [];
            const isOpen = expanded[msg.id];
            return (
              <div
                key={msg.id}
                className="glass rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleThread(msg.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                        {msg.subject || 'No subject'}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Sent {formatReceivedAt(msg.created_at)}
                      </p>
                      {msg.doctor_name ? (
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                          <Stethoscope size={10} className="shrink-0" />
                          <span className="truncate">
                            To: Dr. {msg.doctor_name}
                            {msg.doctor_specialization ? ` • ${msg.doctor_specialization}` : ''}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-1">
                          To: General Enquiry
                        </p>
                      )}
                    </div>
                    {replies.length > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 size={11} />
                        {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        Awaiting Reply
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-2 line-clamp-2">
                    {msg.message}
                  </p>
                </button>

                {/* Edit / Delete — edit only inside the 1 minute window */}
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                  {canEdit(msg) ? (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Editable for {Math.ceil(msUntil(msg.created_at) / 1000)}s
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {replies.length > 0 ? 'Locked — doctor has replied' : 'Editing closed'}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => (editingId === msg.id ? cancelEdit() : startEdit(msg))}
                      disabled={!canEdit(msg) && editingId !== msg.id}
                      title={canEdit(msg) ? 'Edit inquiry' : 'Editing is only available for 1 minute after sending'}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800"
                    >
                      {editingId === msg.id ? <X size={14} /> : <Pencil size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(msg)}
                      title="Delete inquiry"
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingId === msg.id && (
                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={e => setDraftSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-2.5 outline-none transition-all"
                    />
                    <textarea
                      value={draftBody}
                      onChange={e => setDraftBody(e.target.value)}
                      rows={4}
                      placeholder="Your message"
                      className="w-full text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-2.5 resize-y outline-none transition-all"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(msg)}
                        disabled={saving || !draftBody.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send size={12} />
                        <span>{saving ? 'Saving…' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Your Message{msg.doctor_name ? ` to Dr. ${msg.doctor_name}` : ''}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                      {msg.message}
                    </p>

                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 pt-1.5">
                      Doctor's Replies
                    </div>
                    {replies.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        No reply yet. Your doctor will answer here or contact you on WhatsApp.
                      </p>
                    ) : (
                      replies.map(reply => (
                        <div key={reply.id} className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              <Stethoscope size={10} />
                              Dr. {reply.sender_name || 'PulmoAI Doctor'}
                            </span>
                            <span className="text-[9px] text-slate-400">{formatReceivedAt(reply.created_at)}</span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {reply.body}
                          </p>
                        </div>
                      ))
                    )}

                    {msg.whatsapp && (
                      <p className="text-[10px] text-slate-500 pt-1 font-mono">
                        📱 Your WhatsApp: <span className="font-bold text-slate-700 dark:text-slate-300">{msg.whatsapp}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400">
        Signed in as {user?.name} • replies appear here within a few seconds
      </p>
    </div>
  );
};

export default MyInquiries;
