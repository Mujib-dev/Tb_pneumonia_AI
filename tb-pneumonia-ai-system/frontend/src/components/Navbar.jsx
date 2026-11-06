import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Activity, LogIn, LayoutDashboard, User, LogOut, 
  ChevronDown, Menu, X, Users as PatientsIcon, FileText, Calendar,
   Info, Sun, Moon, MessageSquare, Home, Coins, Inbox as InboxIcon
   } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../services/AuthContext'
import { useTheme } from '../services/ThemeContext'
import { getAssetUrl } from '../services/api'

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopDropdownRef = useRef(null);
  const mobileDropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';

  // Close menus when clicking outside or navigating
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedDesktop = desktopDropdownRef.current && desktopDropdownRef.current.contains(event.target);
      const clickedMobile = mobileDropdownRef.current && mobileDropdownRef.current.contains(event.target);
      if (!clickedDesktop && !clickedMobile) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      setIsMobileMenuOpen(false);
      setIsDropdownOpen(false);
    };
  }, [location]);

  const handleLogout = () => {
    const isPatientUser = user?.role === 'patient';
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    logout(isPatientUser ? '/' : '/login');
  };

  const logoLink = !user ? "/" : (user.role === 'admin' ? "/admin" : (user.role === 'doctor' ? "/doctor" : "/history"));

  const NavLinks = ({ mobile }) => {
    const handleLinkClick = () => {
      if (mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    const getLinkClass = (path) => {
      const isActive = location.pathname === path;
      return `px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold tracking-normal transition-all flex items-center gap-1.5 cursor-pointer ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/80 dark:border-blue-900/60 shadow-xs'
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
      } ${mobile ? 'w-full py-3 text-xs sm:text-sm border-b border-slate-100 dark:border-slate-800/80 rounded-none px-2.5' : ''}`;
    };

    return (
      <div className={`flex ${mobile ? 'flex-col w-full' : 'items-center'} gap-1 md:gap-1.5 lg:gap-2`}>
        {user ? (
          <>
            <Link 
              to={logoLink} 
              onClick={handleLinkClick}
              className={getLinkClass(logoLink)}
            >
              <LayoutDashboard size={mobile ? 16 : 14}/>
              <span>Dashboard</span>
            </Link>
            
            {user.role === 'doctor' && (
              <Link 
                to="/patients" 
                onClick={handleLinkClick}
                className={getLinkClass("/patients")}
              >
                <PatientsIcon size={mobile ? 16 : 14}/>
                <span>Patients</span>
              </Link>
            )}

            {user.role === 'doctor' && (
              <Link 
                to="/predict" 
                onClick={handleLinkClick}
                className={getLinkClass("/predict")}
              >
                <Activity size={mobile ? 16 : 14}/>
                <span>Analyze</span>
              </Link>
            )}

            {user.role === 'doctor' && (
              <Link 
                to="/dicom-inbox" 
                onClick={handleLinkClick}
                className={getLinkClass("/dicom-inbox")}
              >
                <InboxIcon size={mobile ? 16 : 14}/>
                <span>DICOM Inbox</span>
              </Link>
            )}

            {user.role === 'doctor' && (
              <Link 
                to="/history" 
                onClick={handleLinkClick}
                className={getLinkClass("/history")}
              >
                <FileText size={mobile ? 16 : 14}/>
                <span>Records</span>
              </Link>
            )}

            <Link 
              to="/book" 
              onClick={handleLinkClick}
              className={getLinkClass("/book")}
            >
              <Calendar size={mobile ? 16 : 14}/>
              <span>Book Token</span>
            </Link>

            {user.role !== 'doctor' && (
              <>
                <Link 
                  to="/about" 
                  onClick={handleLinkClick}
                  className={getLinkClass("/about")}
                >
                  <Info size={mobile ? 16 : 14}/>
                  <span>About Doctors</span>
                </Link>
                <Link 
                  to="/contact" 
                  onClick={handleLinkClick}
                  className={getLinkClass("/contact")}
                >
                  <MessageSquare size={mobile ? 16 : 14}/>
                  <span>Contact</span>
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <Link 
              to="/" 
              onClick={handleLinkClick} 
              className={getLinkClass("/")}
            >
              <Home size={mobile ? 16 : 14}/>
              <span>Home</span>
            </Link>
            <Link 
              to="/about" 
              onClick={handleLinkClick} 
              className={getLinkClass("/about")}
            >
              <Info size={mobile ? 16 : 14}/>
              <span>About Doctors</span>
            </Link>
            <Link 
              to="/contact" 
              onClick={handleLinkClick} 
              className={getLinkClass("/contact")}
            >
              <MessageSquare size={mobile ? 16 : 14}/>
              <span>Contact</span>
            </Link>
          </>
        )}
      </div>
    );
  };

  return (
    <nav className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-[60] transition-colors print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex justify-between items-center">
        
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Toggle Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 -ml-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors outline-none cursor-pointer md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          {/* Clean Medical Logo */}
          <Link to={logoLink} className="flex items-center gap-2.5 group shrink-0">
            <img
              src="/logo-mark-128.png"
              alt="PulmoAI"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
            />
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                Pulmo<span className="text-blue-600 dark:text-blue-400">AI</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mt-0.5">
                Clinical CAD
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <div className="hidden md:flex flex-1 justify-center px-4">
          <NavLinks />
        </div>

        {/* Right: Desktop Action Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center cursor-pointer shadow-xs outline-none"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {user ? (
            <div className="relative" ref={desktopDropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-xs focus:outline-none"
                aria-label="User profile menu"
              >
                <div 
                  className="w-8 h-8 min-w-[32px] min-h-[32px] max-w-[32px] max-h-[32px] rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-blue-500/20 dark:ring-blue-400/20 aspect-square"
                  style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                >
                  {user.profile_pic ? (
                    <img 
                      src={getAssetUrl(user.profile_pic)} 
                      alt={user.name || 'User'} 
                      className="w-full h-full max-w-full max-h-full object-cover block"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&bold=true`;
                      }}
                    />
                  ) : (
                    <span>{(user.name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-slate-900 dark:text-white max-w-[110px] truncate">{user.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{user.role}</span>
                </div>
                <ChevronDown size={13} className="text-slate-400" />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-1.5 z-50 overflow-hidden shadow-lg text-left"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">Signed in as</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate capitalize">{user.role}</p>
                    </div>
                    
                    <Link 
                      to="/profile" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User size={14} className="text-blue-500" />
                      <span>Account Settings</span>
                    </Link>

                    {user.role === 'patient' && (
                      <Link 
                        to="/my-inquiries" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare size={14} className="text-blue-500" />
                        <span>My Inquiries</span>
                      </Link>
                    )}

                    {user.role === 'doctor' && (
                      <Link 
                        to="/inquiries" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare size={14} className="text-emerald-500" />
                        <span>Patient Inquiries</span>
                      </Link>
                    )}

                    {user.role === 'doctor' && (
                      <Link 
                        to="/payments" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Coins size={14} className="text-emerald-500" />
                        <span>Payments &amp; Earnings</span>
                      </Link>
                    )}

                    <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : !isHomePage ? (
            <Link 
              to="/login" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <LogIn size={14}/> 
              <span>Login</span>
            </Link>
          ) : null}
        </div>

        {/* Mobile Right Controls */}
        <div className="flex md:hidden items-center gap-2">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 min-w-[36px] min-h-[36px] max-w-[36px] max-h-[36px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Mobile User Profile Photo / Avatar */}
          {user ? (
            <div className="relative shrink-0" ref={mobileDropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] max-w-[36px] max-h-[36px] rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 ring-2 ring-blue-500/25 dark:ring-blue-400/25 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs focus:outline-none cursor-pointer active:scale-95 transition-all aspect-square p-0"
                style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
                aria-label="User profile menu"
                aria-expanded={isDropdownOpen}
              >
                {user.profile_pic ? (
                  <img 
                    src={getAssetUrl(user.profile_pic)} 
                    alt={user.name || 'User'} 
                    className="w-full h-full max-w-full max-h-full object-cover block rounded-full" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { 
                      e.target.onerror = null; 
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&bold=true`; 
                    }} 
                  />
                ) : (
                  <span className="text-xs font-bold leading-none select-none">
                    {(user.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-1.5 z-[70] overflow-hidden shadow-xl text-left"
                  >
                    <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-1 ring-blue-500/20">
                        {user.profile_pic ? (
                          <img 
                            src={getAssetUrl(user.profile_pic)} 
                            alt={user.name || 'User'} 
                            className="w-full h-full object-cover block" 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&bold=true`;
                            }}
                          />
                        ) : (
                          <span>{(user.name || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400">Signed in as</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60 capitalize mt-0.5">
                          {user.role}
                        </span>
                      </div>
                    </div>
                    
                    <Link 
                      to="/profile" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User size={14} className="text-blue-500 shrink-0" />
                      <span>Account Settings</span>
                    </Link>

                    {user.role === 'patient' && (
                      <Link 
                        to="/my-inquiries" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare size={14} className="text-blue-500 shrink-0" />
                        <span>My Inquiries</span>
                      </Link>
                    )}

                    {user.role === 'doctor' && (
                      <Link 
                        to="/inquiries" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare size={14} className="text-emerald-500 shrink-0" />
                        <span>Patient Inquiries</span>
                      </Link>
                    )}

                    {user.role === 'doctor' && (
                      <Link 
                        to="/payments" 
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Coins size={14} className="text-emerald-500 shrink-0" />
                        <span>Payments &amp; Earnings</span>
                      </Link>
                    )}
                    
                    <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left"
                      >
                        <LogOut size={14} className="shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : !isHomePage ? (
            <Link 
              to="/login" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <LogIn size={13}/> 
              <span>Login</span>
            </Link>
          ) : null}
        </div>

      </div>

      {/* Mobile sliding Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[190] md:hidden"
            />

            {/* Left Sliding Drawer Panel */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-[270px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-[200] md:hidden flex flex-col p-4 sm:p-5 overflow-y-auto"
              style={{ height: '100vh' }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-3">
                <Link to={logoLink} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5">
                  <img
                    src="/logo-mark-128.png"
                    alt="PulmoAI"
                    className="w-7 h-7 object-contain shrink-0"
                  />
                  <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    Pulmo<span className="text-blue-600 dark:text-blue-400">AI</span>
                  </span>
                </Link>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Profile Card in Drawer if logged in */}
              {user && (
                <div className="flex items-center gap-2.5 p-2.5 mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 ring-1 ring-blue-500/20 bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {user.profile_pic ? (
                      <img 
                        src={getAssetUrl(user.profile_pic)} 
                        alt={user.name || 'User'} 
                        className="w-full h-full object-cover block"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2563eb&color=fff&bold=true`;
                        }}
                      />
                    ) : (
                      <span>{(user.name || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{user.role} Portal</p>
                  </div>
                </div>
              )}

              {/* Drawer Navigation Links */}
              <div className="flex-1 flex flex-col gap-1">
                <NavLinks mobile />
              </div>

              {/* Drawer Footer */}
              {user && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                  <button 
                    onClick={handleLogout} 
                    className="w-full text-rose-600 font-bold flex items-center justify-center gap-2 py-2 px-3 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  )
}

export default Navbar
