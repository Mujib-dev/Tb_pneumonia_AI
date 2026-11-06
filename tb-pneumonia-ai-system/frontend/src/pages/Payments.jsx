import { useState, useEffect, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Coins, TrendingUp, Calendar, ArrowUpRight, Search, Activity, User, CreditCard } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import { showErrorAlert } from '../utils/alert';

const Payments = () => {
  const [data, setData] = useState({
    total_revenue: 0,
    this_month_revenue: 0,
    today_revenue: 0,
    history: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'));

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await api.get('/doctor/payments');
        setData(res.data);
      } catch (err) {
        showErrorAlert('Error', getErrorMessage(err, 'Failed to fetch payment data.'));
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const filteredHistory = data.history.filter(item => {
    const matchesSearch = item.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || item.date.includes(searchTerm);
    const matchesDate = filterDate ? item.date === filterDate : true;
    return matchesSearch && matchesDate;
  });

  const groupedHistory = filteredHistory.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => new Date(b) - new Date(a));

  const StatCard = ({ icon, title, value, color }) => {
    const colorClasses = {
      emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    };

    return (
      <div className="glass p-4 rounded-xl border border-black/5 dark:border-white/5 flex items-center gap-3 relative overflow-hidden group">
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${colorClasses[color]} transition-transform group-hover:scale-110 duration-500 flex items-center justify-center`}>
          {icon}
        </div>
        <div className="flex flex-col text-left">
          <p className="text-[8.5px] font-black uppercase text-gray-500 tracking-widest mb-0.5">{title}</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none">Rs. {value.toLocaleString()}</h3>
        </div>
        <div className={`absolute -right-4 -bottom-4 opacity-5 ${colorClasses[color].split(' ')[1]}`}>
          {icon}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Activity className="animate-spin text-blue-500" size={40} />
        <p className="font-bold text-xl gradient-text">Loading Financial Records...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-black/10 dark:border-white/10 pb-6 pt-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="text-emerald-500" size={32} /> Payments Dashboard
          </h1>
          <p className="text-gray-500 mt-2 font-bold text-sm">Track your clinic earnings and consultation fees.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Coins size={20} />} 
          title="All-Time Revenue" 
          value={data.total_revenue} 
          color="emerald" 
        />
        <StatCard 
          icon={<Calendar size={20} />} 
          title="This Month" 
          value={data.this_month_revenue} 
          color="blue" 
        />
        <StatCard 
          icon={<TrendingUp size={20} />} 
          title="Today's Earnings" 
          value={data.today_revenue} 
          color="purple" 
        />
      </div>

      {/* Transactions List */}
      <div className="glass rounded-[2rem] border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Transaction History</h2>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">
              Showing {filteredHistory.length} completed payments
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
            {(filterDate !== '' || searchTerm !== '') && (
               <button
                 type="button"
                 onClick={() => { setFilterDate(''); setSearchTerm(''); }}
                className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-500/10 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
            <div className="relative w-full sm:w-auto">
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Search patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
              <tr>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Transaction Date</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Patient Details</th>
                <th className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 text-right">Fee Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {sortedDates.map((date) => (
                <Fragment key={date}>
                  {/* Date Header */}
                  <tr className="bg-black/5 dark:bg-white/5">
                    <td colSpan="3" className="px-4 py-2 text-xs font-black text-slate-900 dark:text-white tracking-wider">
                      📅 {new Date(date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      <span className="ml-2 text-[10px] text-gray-500 font-bold uppercase">
                        (Daily Total: Rs. {groupedHistory[date].reduce((sum, i) => sum + i.fee, 0).toLocaleString()})
                      </span>
                    </td>
                  </tr>
                  
                  {/* Items for this date */}
                  {groupedHistory[date].map((item) => (
                    <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.date}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Completed</p>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                            <User size={12} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{item.patient_name}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.patient_phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className="text-sm font-black text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                            <ArrowUpRight size={12} /> Rs. {item.fee.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
                            Token #{item.token_number}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              
              {sortedDates.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <Coins size={32} className="opacity-20" />
                      <p className="text-sm font-bold">No payment records found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payments;
