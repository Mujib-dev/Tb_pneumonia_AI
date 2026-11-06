import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Mail, RefreshCw, CheckCircle2, Trash2,
  Search, ArrowLeft, Inbox, Send, UserCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getDoctorMessages, markDoctorMessageRead, deleteDoctorMessage, replyToDoctorMessage } from '../services/api';
import { clinicalSwal } from '../utils/alert';
import { useAuth } from '../services/AuthContext';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' }
];

const formatReceivedAt = (value) => {
  if (!value) return '';
  const iso = String(value).includes('Z') ? value : `${value}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Inquiries = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  // Ids already shown, so a poll can tell an arrival from what was on screen.
  // Null until the first load lands, which keeps the initial batch quiet.
  const seenIdsRef = useRef(null);

  const fetchInquiries = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getDoctorMessages();
      const incoming = res.data || [];

      if (silent && seenIdsRef.current) {
        const fresh = incoming.filter(m => !seenIdsRef.current.has(m.id));
        if (fresh.length === 1) {
          toast.info(`New inquiry from ${fresh[0].name}`, { autoClose: 3000 });
        } else if (fresh.length > 1) {
          toast.info(`${fresh.length} new inquiries received`, { autoClose: 3000 });
        }
      }
      seenIdsRef.current = new Set(incoming.map(m => m.id));

      setMessages(incoming);
    } catch (err) {
      console.error('Failed to load doctor inquiries:', err);
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

  const handleMarkRead = async (msgId) => {
    try {
      await markDoctorMessageRead(msgId);
      toast.info('Inquiry marked as read.', { autoClose: 4000 });
      fetchInquiries({ silent: true });
    } catch (err) {
      toast.error('Failed to mark as read: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    }
  };

  const handleDelete = async (msgId) => {
    const result = await clinicalSwal.fire({
      title: 'Delete Inquiry?',
      text: 'Are you sure you want to remove this patient inquiry?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    try {
      await deleteDoctorMessage(msgId);
      toast.success('Inquiry deleted successfully.', { autoClose: 4000 });
      fetchInquiries({ silent: true });
    } catch (err) {
      toast.error('Failed to delete inquiry: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    }
  };

  const handleReplyWhatsApp = (msg) => {
    let cleanPhone = (msg.whatsapp || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.substring(1);
    }
    const replyText = `Hello ${msg.name}, this is Dr. ${user?.name || 'your physician'} from PulmoAI regarding your inquiry: "${msg.subject}".`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(replyText)}`, '_blank', 'noopener,noreferrer');
  };

  const toggleReplyBox = (msg) => {
    if (replyingTo === msg.id) {
      setReplyingTo(null);
      setReplyBody('');
      return;
    }
    setReplyingTo(msg.id);
    setReplyBody('');
  };

  const handleSendReply = async (msg) => {
    const body = replyBody.trim();
    if (!body) {
      toast.warn('Write a reply before sending.', { autoClose: 4000 });
      return;
    }
    setSendingReply(true);
    try {
      await replyToDoctorMessage(msg.id, body);
      toast.success(`Reply sent to ${msg.name}.`, { autoClose: 4000 });
      setReplyingTo(null);
      setReplyBody('');
      fetchInquiries({ silent: true });
    } catch (err) {
      toast.error('Failed to send reply: ' + (err.response?.data?.detail || err.message), { autoClose: 5000 });
    } finally {
      setSendingReply(false);
    }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return messages.filter((msg) => {
      if (filter === 'unread' && msg.is_read) return false;
      if (filter === 'read' && !msg.is_read) return false;
      if (!query) return true;
      return [msg.name, msg.subject, msg.message, msg.email, msg.whatsapp]
        .some(field => String(field || '').toLowerCase().includes(query));
    });
  }, [messages, filter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="glass p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/doctor')}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Patient Direct Inquiries
                </h1>
                {unreadCount > 0 ? (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    {unreadCount} Unread
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    All Handled
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Direct patient inquiries submitted via your specialist profile &bull; {messages.length} Total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inquiries..."
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchInquiries({ silent: true })}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-500' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center p-1 mt-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 w-fit">
          {FILTERS.map(opt => {
            const count = opt.key === 'all'
              ? messages.length
              : opt.key === 'unread'
                ? unreadCount
                : messages.length - unreadCount;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filter === opt.key
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Inquiry List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="size-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">Loading Inquiries...</p>
        </div>
      ) : visibleMessages.length === 0 ? (
        <div className="glass p-10 text-center rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Inbox size={22} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {messages.length === 0 ? 'No Patient Inquiries Yet' : 'No Inquiries Match This View'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            {messages.length === 0
              ? 'Direct questions sent by patients will appear here with one-click WhatsApp response.'
              : 'Try a different filter or clear the search box.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {visibleMessages.map(msg => (
            <div
              key={msg.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                msg.is_read
                  ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-800/95 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20'
              }`}
            >
              <div className="space-y-2 mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{msg.name}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[10px] text-slate-400 font-medium">
                        {formatReceivedAt(msg.created_at)}
                      </p>
                      <span
                        title={msg.is_from_account
                          ? 'Sent from a patient account — can be replied to in-app'
                          : 'Sent by a guest — reachable on WhatsApp only'}
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded border inline-flex items-center gap-1 ${
                          msg.is_from_account
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {msg.is_from_account
                          ? <><UserCheck size={9} /> Account</>
                          : 'Guest'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                    msg.is_read
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}>
                    {msg.is_read ? 'Read' : 'New'}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                  Subject: {msg.subject}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                  {msg.message}
                </p>

                <div className="text-[10px] text-slate-500 space-y-0.5 pt-1">
                  {msg.whatsapp && <p className="font-mono">📱 WhatsApp: <span className="font-bold text-slate-700 dark:text-slate-300">{msg.whatsapp}</span></p>}
                  {msg.email && <p className="truncate">✉️ Email: <span className="font-medium text-slate-700 dark:text-slate-300">{msg.email}</span></p>}
                </div>
              </div>

              {msg.replies?.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {msg.replies.map(reply => (
                    <div key={reply.id} className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Dr. {reply.sender_name || user?.name || 'You'}
                        </span>
                        <span className="text-[9px] text-slate-400">{formatReceivedAt(reply.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {reply.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === msg.id && (
                <div className="mb-3">
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder={`Reply to ${msg.name}… they will see this in their account.`}
                    className="w-full text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/60 border border-blue-500/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-2.5 resize-y outline-none transition-all placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-end gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => { setReplyingTo(null); setReplyBody(''); }}
                      className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendReply(msg)}
                      disabled={sendingReply || !replyBody.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send size={12} />
                      <span>{sendingReply ? 'Sending…' : 'Send Reply'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {msg.is_from_account ? (
                    <button
                      type="button"
                      onClick={() => toggleReplyBox(msg)}
                      className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Send size={11} />
                      <span>Reply</span>
                    </button>
                  ) : null}

                  {msg.whatsapp ? (
                    <button
                      type="button"
                      onClick={() => handleReplyWhatsApp(msg)}
                      title={msg.is_from_account ? 'Also reply over WhatsApp' : 'Reply on WhatsApp'}
                      className={`${msg.is_from_account ? 'flex-1' : 'w-full'} py-1.5 px-2 ${msg.is_from_account ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer`}
                    >
                      <span>💬 WhatsApp</span>
                    </button>
                  ) : !msg.is_from_account ? (
                    <span className="text-[10px] text-slate-400 italic">No WhatsApp number</span>
                  ) : null}
                </div>

                {!msg.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(msg.id)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Mark as Read"
                  >
                    <CheckCircle2 size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(msg.id)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title="Delete Inquiry"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inquiries;
