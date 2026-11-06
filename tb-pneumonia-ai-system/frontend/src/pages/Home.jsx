import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Zap, Search, ArrowRight, Play } from 'lucide-react'
import { useAuth } from '../services/AuthContext'
import { useState, useEffect } from 'react'
import { api } from '../services/api'

const Home = () => {
  const { user } = useAuth();
  const [content, setContent] = useState({
    title: 'PulmoAI',
    subtitle: 'Fast, accurate, and reliable screening for Tuberculosis and Pneumonia using advanced Deep Learning architectures.'
  });

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await api.get('/admin/settings/contact');
        if (response.data) {
          setContent({
            title: response.data.home_hero_title || 'PulmoAI',
            subtitle: response.data.home_hero_subtitle || 'Fast, accurate, and reliable screening for Tuberculosis and Pneumonia using advanced Deep Learning architectures.'
          });
        }
      } catch {
        return;
      }
    };
    fetchContent();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-0 sm:min-h-[60vh] px-3.5 sm:px-4 pt-2 sm:pt-8 pb-1 sm:pb-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold mb-4 shadow-2xs">
          <img src="/logo-mark-128.png" alt="PulmoAI" className="size-4 object-contain" />
          <span>AI-Powered Pulmonary Diagnostic CAD</span>
        </div>
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-3 sm:mb-6 tracking-tighter leading-tight sm:leading-none">
          <span className="gradient-text">{content.title}</span>
        </h1>
        <p className="text-sm sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
          {content.subtitle}
        </p>
        
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 sm:gap-4 justify-center mb-4 sm:mb-8 w-full max-w-xl mx-auto sm:max-w-none">
          {user ? (
            <>
              <Link to="/predict" className="px-4 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-full font-bold text-xs sm:text-sm text-white transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                <Play size={16}/> Start Analysis
              </Link>
              <Link to="/history" className="px-4 sm:px-6 py-2.5 glass hover:bg-black/10 dark:bg-white/10 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2">
                View History
              </Link>
              <Link to="/about" className="col-span-2 sm:col-span-1 px-4 sm:px-6 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 text-blue-500 dark:text-blue-400 hover:text-blue-600">
                About Doctors
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="px-4 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xs sm:text-sm transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                Get Started <ArrowRight size={16}/>
              </Link>
              <Link to="/register" className="px-4 sm:px-6 py-2.5 glass hover:bg-black/10 dark:bg-white/10 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center justify-center">
                Doctor Registration
              </Link>
              <Link to="/guest-book" className="px-4 sm:px-6 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 text-blue-500 dark:text-blue-400 hover:text-blue-600">
                Book Guest Token
              </Link>
              <Link to="/about" className="px-4 sm:px-6 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 text-purple-500 dark:text-purple-400 hover:text-purple-600">
                About Doctors
              </Link>
            </>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 w-full max-w-5xl mx-auto mt-2 sm:mt-6">
        <FeatureCard 
          icon={<Shield className="text-blue-500 size-4 sm:size-6" />}
          title="Diagnostic Accuracy"
          description="Standardized deep learning architecture trained for clinical thoracic radiography."
        />
        <FeatureCard 
          icon={<Zap className="text-indigo-500 size-4 sm:size-6" />}
          title="Rapid Evaluation"
          description="Immediate differential scoring across Tuberculosis, Pneumonia, and Normal findings."
        />
        <FeatureCard 
          icon={<Search className="text-purple-500 size-4 sm:size-6" />}
          title="Comprehensive Screening"
          description="Integrated patient EHR linkage, instant queue passes, and printable reports."
        />
      </div>
    </div>
  )
}

const FeatureCard = ({ icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="glass p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-black/10 dark:border-white/10 text-left"
  >
    <div className="mb-1 sm:mb-3">{icon}</div>
    <h3 className="text-xs sm:text-lg md:text-xl font-bold mb-0.5 sm:mb-1.5 text-slate-900 dark:text-white">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 text-[11px] sm:text-xs md:text-sm leading-snug sm:leading-relaxed">{description}</p>
  </motion.div>
);

export default Home;
