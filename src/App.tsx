import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2, Building2, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lobby from './pages/Lobby';
import Engine from './pages/Engine';
import PropertyDetail from './pages/PropertyDetail';
import DeployProject from './pages/DeployProject';
import Skyboxes from './pages/Skyboxes';
import SkyboxPreview from './pages/SkyboxPreview';

/* ──────────────────────────────────────────────────
   Cinematic easing shared across auth page
   ────────────────────────────────────────────────── */
const ease = [0.2, 0.8, 0.2, 1] as const;

function AuthPage() {
  const { signIn, signUp } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'buyer' | 'developer'>('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) setAuthError(error.message);
      } else {
        const dbRole = role === 'developer' ? 'admin' : 'client';
        const { error } = await signUp(email, password, fullName, dbRole);
        if (error) setAuthError(error.message);
        else {
          alert('Check your inbox to verify your account, then log in.');
          setIsLogin(true);
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center">

      {/* Cinematic Video Background */}
      <video
        className="absolute inset-0 w-full h-full object-cover scale-105"
        src="https://www.pexels.com/video/8569028/download/"
        autoPlay muted loop playsInline
        poster="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80"
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0B]/90 via-[#0A0A0B]/70 to-[#0A0A0B]/85 z-10" />

      {/* Ambient colour blooms */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[#C6A664]/6 blur-[140px] z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#39FF14]/4 blur-[120px] z-10 pointer-events-none" />

      {/* Brand wordmark — top left */}
      <motion.div
        className="absolute top-10 left-10 z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease }}
      >
        <div className="font-serif-display text-2xl text-[#F5F7FA] tracking-[0.25em]">MYXELLIA</div>
        <div className="text-[10px] tracking-[0.35em] text-[#C6A664] uppercase mt-0.5">3D Real Estate Engine</div>
      </motion.div>

      {/* Floating Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        className="glass-card relative z-20 w-full max-w-[400px] mx-4 p-8"
      >
        {/* Card heading */}
        <div className="mb-7 text-center">
          <h2 className="font-serif-display text-[28px] text-[#F5F7FA] leading-tight mb-1">
            {isLogin ? 'Welcome back.' : 'Join Myxellia.'}
          </h2>
          <p className="text-[11px] tracking-[0.2em] text-[#94A3B8] uppercase">
            {isLogin ? 'Enter your credentials to continue' : 'Create your account below'}
          </p>
        </div>

        {/* Role Toggle — only on Sign Up */}
        <AnimatePresence mode="wait">
          {!isLogin && (
            <motion.div
              key="role-toggle"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease }}
              className="overflow-hidden mb-5"
            >
              <div className="text-[10px] tracking-[0.2em] text-[#94A3B8] uppercase mb-2">I am a</div>
              <div className="grid grid-cols-2 gap-2">
                {(['buyer', 'developer'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-xs tracking-widest uppercase font-medium transition-all duration-200 ${role === r
                      ? 'bg-[#C6A664]/20 border-[#C6A664]/60 text-[#C6A664]'
                      : 'bg-white/4 border-white/10 text-[#94A3B8] hover:border-white/20'
                      }`}
                  >
                    {r === 'buyer' ? <Building2 size={13} /> : <Briefcase size={13} />}
                    {r === 'buyer' ? 'Buyer' : 'Developer'}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease }}
                className="overflow-hidden"
              >
                <div className="relative group">
                  <UserIcon size={14} className="absolute left-4 top-[17px] text-[#94A3B8]/60 group-focus-within:text-[#C6A664] transition-colors" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#C6A664]/50 rounded-lg py-3.5 pl-11 pr-4 text-sm font-light text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none focus:bg-white/8 transition-all duration-200"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative group">
            <Mail size={14} className="absolute left-4 top-[17px] text-[#94A3B8]/60 group-focus-within:text-[#C6A664] transition-colors" />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-[#C6A664]/50 rounded-lg py-3.5 pl-11 pr-4 text-sm font-light text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none focus:bg-white/8 transition-all duration-200"
            />
          </div>

          <div className="relative group">
            <Lock size={14} className="absolute left-4 top-[17px] text-[#94A3B8]/60 group-focus-within:text-[#C6A664] transition-colors" />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-[#C6A664]/50 rounded-lg py-3.5 pl-11 pr-4 text-sm font-light text-[#F5F7FA] placeholder:text-[#94A3B8]/50 focus:outline-none focus:bg-white/8 transition-all duration-200"
            />
          </div>

          <AnimatePresence mode="wait">
            {authError && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-[11px] tracking-wider uppercase pt-1"
              >
                {authError}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative overflow-hidden w-full mt-2 py-4 rounded-lg bg-[#C6A664] text-[#0A0A0B] font-semibold text-xs tracking-[0.18em] uppercase transition-all duration-300 hover:bg-[#D4BA82] disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            {/* Shimmer layer */}
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={14} /> : <UserPlus size={14} />}
                <span>{isLogin ? 'Enter Platform' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        {/* Divider + Toggle */}
        <div className="mt-6 pt-5 border-t border-white/8 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setAuthError(null); }}
            className="text-[#94A3B8] hover:text-[#C6A664] text-[10px] tracking-widest uppercase transition-colors duration-200"
          >
            {isLogin ? 'New to Myxellia? Create Account →' : '← Back to Login'}
          </button>
        </div>
      </motion.div>

      {/* Bottom tagline */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 flex justify-center z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
      >
        <p className="text-[10px] tracking-[0.3em] text-[#94A3B8]/40 uppercase">
          The Future of Real Estate Discovery
        </p>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Root App — Routes
   ────────────────────────────────────────────────── */
export default function App() {
  const { session, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0A0A0B] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="font-serif-display text-xl text-[#F5F7FA] tracking-[0.3em]">MYXELLIA</div>
          <div className="w-48 h-px bg-gradient-to-r from-transparent via-[#C6A664]/60 to-transparent animate-shimmer" />
          <p className="text-[10px] tracking-[0.25em] text-[#94A3B8] uppercase animate-pulse">Initializing Engine...</p>
        </motion.div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/detail/:buildingId" element={<PropertyDetailKeyed />} />
        <Route path="/engine/:buildingId" element={<EngineKeyed />} />
        <Route path="/deploy" element={<DeployProject />} />
        <Route path="/skyboxes" element={<Skyboxes />} />
        <Route path="/skyboxes/preview/:id" element={<SkyboxPreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PropertyDetailKeyed() {
  const location = useLocation();
  return <PropertyDetail key={`${location.pathname}-${location.key}`} />;
}

function EngineKeyed() {
  const location = useLocation();
  return <Engine key={location.pathname} />;
}
