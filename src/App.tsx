import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { auth, googleProvider, db } from "./firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut 
} from "firebase/auth";
import { 
  getDoc, getDocs, setDoc, doc, serverTimestamp, collection, onSnapshot, query, where, updateDoc, increment, addDoc, deleteDoc, orderBy 
} from "firebase/firestore";
import { 
  Globe, Database, Layout, Github, Linkedin, Twitter, Facebook,
  Menu, X, ExternalLink, Mail, Send, ChevronRight,
  Code, Server, Smartphone, PenTool, BarChart, Image as ImageIcon,
  Mic, Volume2, User, LogIn, ShoppingCart, MessageCircle, Upload,
  Plus, Filter, DollarSign, CheckCircle, ArrowRight, Play, ShoppingBag,
  Clock, Check, AlertCircle, Download, CreditCard, ArrowUpRight, Quote, Sparkles, Layers,
  Activity, Terminal, Zap, Target, Heart, Eye, Share2, Search, Calendar, BookOpen, Trash, Award
} from "lucide-react";
import { portfolioData } from "./data";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AIChat } from "./components/AIChat";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from "react-router-dom";
import Admin from "./Admin";
import { ClientPortal } from "./components/ClientPortal";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";

export const mapProfileData = (data: any) => {
  if (!data) return null;
  const role = data.hero?.role || data.role || "";
  const roles = data.hero?.role ? [data.hero.role] : (data.roles || [role]);
  return {
    ...data,
    name: data.hero?.name || data.name || "",
    role: role,
    roles: roles,
    bio: data.hero?.bio || data.bio || "",
    profilePic: data.hero?.image || data.profilePic || "",
    aboutTitle: data.about?.aboutTitle || data.aboutTitle || "",
    aboutDescription: data.about?.aboutDescription || data.aboutDescription || "",
    aboutImage: data.about?.aboutImage || data.aboutImage || "",
    aboutImageSmall: data.about?.aboutImageSmall || data.aboutImageSmall || "",
    email: data.socials?.email || data.email || "",
    phone: data.contact?.phone || data.phone || "",
    location: data.contact?.address || data.location || "",
    stat1Value: data.about?.stat1Value || data.stat1Value || "",
    stat1Label: data.about?.stat1Label || data.stat1Label || "",
    stat2Value: data.about?.stat2Value || data.stat2Value || "",
    stat2Label: data.about?.stat2Label || data.stat2Label || "",
    resumeUrl: data.resumeUrl || data.hero?.resumeUrl || "",
    brandName: data.brandName || "",
    logoType: data.logoType || "icon",
    logoIcon: data.logoIcon || "Activity",
    logoImage: data.logoImage || "",
  };
};

// Logic was moved to App component

const RedirectToHome = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate("/"); }, [navigate]);
  return null;
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const newUser = {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName || "Client",
            role: currentUser.email === 'jsaha3741@gmail.com' ? "admin" : "client",
            createdAt: serverTimestamp()
          };
          await setDoc(userDocRef, newUser);
          setUser({ ...currentUser, ...newUser });
        } else {
          const data = userDoc.data();
          // Force admin role if email matches, even if DB says otherwise (bootstrap fix)
          if (currentUser.email === 'jsaha3741@gmail.com' && data.role !== 'admin') {
            data.role = 'admin';
            await setDoc(userDocRef, { ...data }, { merge: true });
          }
          setUser({ ...currentUser, ...data });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex bg-background items-center justify-center min-h-screen">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="bg-mesh-light dark:bg-mesh-dark transition-colors duration-500 min-h-screen">
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PortfolioPage user={user} />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/portal" element={<ClientPortal />} />
            <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <RedirectToHome />} />
          </Routes>
          <AIChat user={user} />
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}
import ReactMarkdown from "react-markdown";
import { GoogleGenAI, Modality } from "@google/genai";

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateTTS = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const arrayBuffer = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

// --- Components ---

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-surface/80 backdrop-blur-md border-b border-border">
          <h2 className="text-xl font-bold text-primary">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-primary/5 hover:bg-primary/10 text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Background = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse-glow" />
    <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-secondary/20 blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
    <div className="absolute top-[40%] right-[10%] w-[25%] h-[25%] rounded-full bg-premium/20 blur-[80px] animate-pulse-glow" style={{ animationDelay: '4s' }} />
    <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-accent/20 blur-[110px] animate-pulse-glow" style={{ animationDelay: '6s' }} />
    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.1] dark:opacity-[0.05]" />
  </div>
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        setProfile(mapProfileData(doc.data()));
      }
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
    });

    const loginTimeout = setTimeout(() => {
      if (!auth.currentUser) {
        setIsAuthModalOpen(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
      unsubProfile();
      clearTimeout(loginTimeout);
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navLinks = [
    { name: "About", href: "/#about" },
    { name: "Portfolio", href: "/#portfolio" },
    { name: "Services", href: "/#services" },
    { name: "Contact", href: "/#contact" },
  ];

  const portalLink = user ? { name: "Client Portal", href: "/portal" } : null;
  const adminLink = user?.email === 'jsaha3741@gmail.com' ? { name: "Admin", href: "/admin" } : null;

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6",
        isScrolled ? "py-3.5" : "py-5"
      )}>
        <div className={cn(
          "max-w-7xl mx-auto px-6 py-3 flex items-center justify-between transition-all duration-500 rounded-3xl",
          isScrolled ? "glass shadow-2xl relative translate-y-0" : "bg-transparent"
        )}>
          <Link to="/" className="text-2xl font-black tracking-tighter group flex items-center gap-2">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-12 h-12 rounded-2xl bg-premium-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20 overflow-hidden"
            >
              {profile?.logoType === "image" && profile?.logoImage ? (
                <img 
                  src={profile.logoImage} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (() => {
                const iconMap: Record<string, any> = {
                  Activity, Terminal, Zap, Target, Heart, Eye, Share2, Sparkles, Layers, Code, Database, Globe
                };
                const LogoIcon = iconMap[profile?.logoIcon || "Activity"] || Activity;
                return <LogoIcon size={28} className="drop-shadow-lg" />;
              })()}
            </motion.div>
            <span className="text-ink">
              {(() => {
                const brandText = profile?.brandName || profile?.name || "JOY SAHA";
                const brandFirst = brandText.split(' ')[0]?.toUpperCase() || "";
                const brandRest = brandText.split(' ').slice(1).join(' ')?.toUpperCase() || "";
                return (
                  <>
                    {brandFirst}
                    <span className="text-primary"> {brandRest}</span>
                  </>
                );
              })()}
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-sm font-bold text-ink/60 hover:text-primary transition-all relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </a>
            ))}
            {user && (
              <Link 
                to="/portal" 
                className="text-sm font-bold text-primary hover:text-secondary transition-all flex items-center gap-2"
              >
                <Layout size={16} /> Portal
              </Link>
            )}
            {user?.email === 'jsaha3741@gmail.com' && (
              <Link 
                to="/admin" 
                className="text-sm font-bold text-secondary hover:text-primary transition-all flex items-center gap-2"
              >
                <Database size={16} /> Admin
              </Link>
            )}
            <div className="flex items-center gap-4 pl-6 border-l border-border">
              <ThemeToggle />
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => user ? handleLogout() : setIsAuthModalOpen(true)}
                className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-ink transition-colors relative"
              >
                <User size={20} />
                {user && <span className="absolute top-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-background" />}
              </motion.button>
              <a href="#contact" className="btn-primary py-2.5 px-6 text-sm">
                Engage <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* Mobile Toggle */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <button 
              className="text-ink p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-24 left-6 right-6 glass p-8 md:hidden flex flex-col gap-6"
            >
              {navLinks.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href} 
                  className="text-2xl font-black text-ink-muted hover:text-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              {user && (
                <Link 
                  to="/portal" 
                  className="text-2xl font-black text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Client Portal
                </Link>
              )}
              {user?.email === 'jsaha3741@gmail.com' && (
                <Link 
                  to="/admin" 
                  className="text-2xl font-black text-secondary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Admin Center
                </Link>
              )}
              <div className="pt-6 border-t border-border flex flex-col gap-4">
                <a 
                  href="#contact" 
                  className="btn-primary justify-center text-lg py-4"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Engage Now
                </a>
                <button 
                  onClick={() => {
                    user ? handleLogout() : setIsAuthModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 py-4 border border-border rounded-xl font-bold hover:bg-primary/5 transition-colors"
                >
                  <User size={20} />
                  {user ? "Sign Out" : "Sign In / Join"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};

const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isLogin ? "Welcome Back" : "Create Account"}>
      <div className="space-y-6">
        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-border rounded-xl hover:bg-primary/5 transition-colors font-medium"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-ink-muted">Or continue with email</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-bold mb-2">Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-primary/5 border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-primary outline-none" 
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold mb-2">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-primary/5 border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-primary outline-none" 
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-primary/5 border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-primary outline-none" 
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full py-4 justify-center disabled:opacity-50"
          >
            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
          <p className="text-center text-sm text-ink-muted">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-bold hover:underline"
            >
              {isLogin ? "Create one" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </Modal>
  );
};

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user's projects from backend
        try {
          const res = await fetch(`/api/user-projects?userId=${firebaseUser.uid}`);
          const data = await res.json();
          setProjects(data);
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    <h2 className="text-2xl font-bold">Please log in to view your dashboard</h2>
    <Link to="/" className="btn-primary">Go Home</Link>
  </div>;

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Welcome back, {user.displayName || user.email?.split('@')[0]}!</h1>
          <p className="text-ink-muted">Track your active projects and manage payments.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-ink-muted uppercase tracking-widest">Active Projects</div>
              <div className="text-xl font-bold">{projects.filter(p => p.status !== 'completed').length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Live Project Tracking
          </h2>
          
          {projects.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border-2 border-dashed border-border">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mx-auto mb-4">
                <Plus size={32} />
              </div>
              <h3 className="font-bold mb-2">No active projects</h3>
              <p className="text-ink-muted mb-6">Start a new project with Joy to see it here.</p>
              <a href="/#services" className="btn-primary inline-flex">Explore Services</a>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold">{project.title}</h3>
                      <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">{project.category}</p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      project.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                      project.status === 'in-progress' ? "bg-blue-500/10 text-blue-500" :
                      "bg-amber-500/10 text-amber-500"
                    )}>
                      {project.status}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-ink-muted">Progress</span>
                      <span className="text-primary">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-primary/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-primary/5 border border-border">
                      <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">Next Milestone</div>
                      <div className="text-sm font-bold">{project.nextMilestone || 'N/A'}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/5 border border-border">
                      <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">Estimated Delivery</div>
                      <div className="text-sm font-bold">{project.eta || 'TBD'}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/5 border border-border flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">Project Files</div>
                        <div className="text-sm font-bold">{project.files?.length || 0} Files</div>
                      </div>
                      {project.files?.length > 0 && (
                        <button className="p-2 rounded-lg bg-primary text-white hover:scale-105 transition-transform">
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CreditCard size={20} className="text-primary" />
            Secure Payments
          </h2>
          
          <div className="card space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-500/80 leading-relaxed">
                Please ensure you use the correct payment IDs provided below. Contact Joy if you have any questions.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-primary/5 border border-border group hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold">Payoneer</div>
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <img src="https://www.payoneer.com/wp-content/uploads/2021/06/Payoneer_Logo_2021.svg" className="w-6" alt="Payoneer" />
                  </div>
                </div>
                <div className="text-xs text-ink-muted mb-2">Payoneer Email</div>
                <div className="p-3 rounded-xl bg-background border border-border font-mono text-sm flex items-center justify-between">
                  <span>jsaha3741@gmail.com</span>
                  <button className="text-primary hover:underline font-bold">Copy</button>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-primary/5 border border-border group hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold">UddoktaPay</div>
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <img src="https://uddoktapay.com/assets/images/logo.png" className="w-5" alt="UddoktaPay" />
                  </div>
                </div>
                <div className="text-xs text-ink-muted mb-2">Merchant Panel</div>
                <div className="p-3 rounded-xl bg-background border border-border font-mono text-sm flex items-center justify-between">
                  <span>Checkout System V2</span>
                  <a href="/portal" className="text-primary hover:underline font-bold">Portal</a>
                </div>
              </div>
            </div>

            <button className="btn-primary w-full py-4 justify-center">
              Submit Payment Proof
            </button>
          </div>

          <div className="card bg-primary text-white">
            <h3 className="font-bold mb-2">Need Help?</h3>
            <p className="text-sm opacity-80 mb-6">Joy is available for support 24/7 for active clients.</p>
            <button className="w-full py-3 rounded-xl bg-white text-primary font-bold hover:bg-opacity-90 transition-all">
              Chat with Joy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Hero = () => {
  const [socials, setSocials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [roleIndex, setRoleIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const typingSpeed = isDeleting ? 30 : 60;

  // Mouse variables for 3D tilt effect on profile card
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  // Smooth out the movement using spring physics
  const springX = useSpring(rotateX, { stiffness: 100, damping: 15 });
  const springY = useSpring(rotateY, { stiffness: 100, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate rotation angles based on cursor offset from center
    const x = e.clientX - rect.left - width / 2;
    const y = e.clientY - rect.top - height / 2;
    
    // Max rotation +/- 12 degrees
    const rX = -(y / (height / 2)) * 12;
    const rY = (x / (width / 2)) * 12;
    
    rotateX.set(rX);
    rotateY.set(rY);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        setProfile(mapProfileData(doc.data()));
      }
    });
    
    // In a real app we might store socials in the same settings doc or a collection
    // Let's check the settings doc for socials first, fallback to a collection
    const unsubSocials = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (Array.isArray(data.socials)) {
          setSocials(data.socials);
        } else if (data.socials && typeof data.socials === 'object') {
          const list = [];
          if (data.socials.github) list.push({ id: "github", icon: "Github", url: data.socials.github });
          if (data.socials.linkedin) list.push({ id: "linkedin", icon: "Linkedin", url: data.socials.linkedin });
          if (data.socials.twitter) list.push({ id: "twitter", icon: "Twitter", url: data.socials.twitter });
          if (data.socials.email) list.push({ id: "email", icon: "Mail", url: `mailto:${data.socials.email}` });
          setSocials(list);
        } else {
          const list = [];
          if (data.github) list.push({ id: "github", icon: "Github", url: data.github });
          if (data.linkedin) list.push({ id: "linkedin", icon: "Linkedin", url: data.linkedin });
          if (data.twitter) list.push({ id: "twitter", icon: "Twitter", url: data.twitter });
          if (data.email) list.push({ id: "email", icon: "Mail", url: `mailto:${data.email}` });
          setSocials(list);
        }
      }
    });

    return () => {
      unsubProfile();
      unsubSocials();
    };
  }, []);

  useEffect(() => {
    const roles = profile?.roles || [profile?.role || portfolioData.role];
    const currentRole = roles[roleIndex];
    if (!currentRole) return;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentRole.substring(0, displayText.length + 1));
        if (displayText.length === currentRole.length) {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        setDisplayText(currentRole.substring(0, displayText.length - 1));
        if (displayText.length === 0) {
          setIsDeleting(false);
          setRoleIndex((prev) => (prev + 1) % roles.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, roleIndex]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <section className="relative flex items-center pt-24 pb-4 md:pt-28 md:pb-8 overflow-hidden">
      <Background />
      
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 items-center relative z-10 w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="col-span-12 md:col-span-7 xl:col-span-8 space-y-8"
        >
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.25em]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              {profile?.aboutTitle || "Premium Digital Solutions"}
            </div>
            
            <h1 className="text-5xl md:text-7xl xl:text-8xl font-black leading-[0.95] tracking-tight flex flex-col group">
              <span className="text-gradient-vibrant drop-shadow-xl select-none leading-none pb-2">
                {profile?.name || "Joy Saha"}
              </span>
            </h1>
          </motion.div>

          <motion.div variants={itemVariants} className="text-xl md:text-4xl font-extrabold tracking-tight">
            <span className="text-ink/60">I transform ideas into </span>
            <span className="text-primary italic relative inline-block">
              {displayText}
              <motion.span 
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-1.5 h-8 md:h-12 bg-primary ml-1.5 align-middle"
              />
            </span>
          </motion.div>

          {profile?.bio && (
            <motion.p variants={itemVariants} className="text-ink/60 text-base md:text-lg font-medium max-w-xl leading-relaxed">
              {profile.bio}
            </motion.p>
          )}

          <motion.div variants={itemVariants} className="relative pt-24 sm:pt-0 w-full">
            {/* Compact Profile Image for Mobile: Hidden on desktop (md), but shown to the top-right of the download button on mobile */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="block md:hidden absolute -top-24 right-0 w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl z-20"
            >
              <img 
                src={profile?.profilePic || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop"} 
                alt={profile?.name || "Joy Saha"} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://picsum.photos/seed/joy/1000/1000";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </motion.div>

            <div className="flex flex-wrap gap-6 items-center">
              {profile?.resumeUrl ? (
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="Resume.pdf"
                  className="btn-primary px-8 py-4.5 text-base relative group flex items-center gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/35 transition-all cursor-pointer rounded-xl font-bold"
                >
                  <Download size={18} className="animate-bounce" />
                  <span>Download Resume</span>
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                </motion.a>
              ) : (
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  href="#contact"
                  className="btn-primary px-8 py-4.5 text-base relative group flex items-center gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/35 transition-all cursor-pointer rounded-xl font-bold"
                >
                  <Download size={18} />
                  <span>Download Resume</span>
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                </motion.a>
              )}
              
              <div className="flex items-center gap-5">
                {Array.isArray(socials) && socials.map((social, idx) => {
                  const icons: Record<string, any> = {
                    Github: Github,
                    Linkedin: Linkedin,
                    Facebook: Facebook,
                    Twitter: Twitter,
                    Mail: Mail
                  };
                  const Icon = icons[social.icon] || Twitter;
                  return (
                    <motion.a 
                      key={social.id} 
                      whileHover={{ scale: 1.25, rotate: (idx % 2 === 0 ? 8 : -8) }}
                      href={social.url} 
                      className="text-ink/40 hover:text-primary transition-all p-2.5 rounded-xl bg-surface/50 border border-transparent hover:border-primary/20 hover:shadow-md"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon size={22} />
                    </motion.a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.0, type: "spring", bounce: 0.2 }}
          className="hidden md:block col-span-12 md:col-span-5 xl:col-span-4 relative mt-12 md:mt-0 w-full max-w-md md:max-w-none mx-auto"
        >
          <div 
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative group perspective-1000 cursor-grab active:cursor-grabbing"
          >
            {/* Soft backdrop glow to make it look incredibly premium */}
            <div className="absolute -inset-4 rounded-[4rem] bg-gradient-to-tr from-primary/30 to-secondary/30 opacity-40 blur-2xl group-hover:opacity-65 transition-all duration-700 pointer-events-none" />

            <motion.div 
              style={{ 
                rotateX: springX, 
                rotateY: springY, 
                transformStyle: "preserve-3d" 
              }}
              className="aspect-[4/5] rounded-[3.5rem] overflow-hidden border-2 border-white/10 shadow-[0_35px_70px_-15px_rgba(0,0,0,0.6)] relative bg-surface transition-shadow duration-300 group-hover:shadow-[0_45px_90px_-10px_rgba(0,0,0,0.7)]"
            >
              <img 
                src={profile?.profilePic || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop"} 
                alt={profile?.name || "Joy Saha"} 
                className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                style={{ transform: "translateZ(30px)" }} // Pop the image forward in 3D space
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://picsum.photos/seed/joy/1000/1000";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              
              <div 
                className="absolute bottom-8 left-8 right-8"
                style={{ transform: "translateZ(50px)" }} // Pop text even further forward in 3D
              >
                <div className="text-white text-2xl font-black mb-1.5 tracking-tight flex items-center gap-2">
                  <Sparkles size={20} className="text-primary animate-pulse" />
                  {profile?.role || "Digital Visionary"}
                </div>
                <div className="text-white/60 text-xs font-bold uppercase tracking-widest">
                  {profile?.location || "Based in Excellence"}
                </div>
              </div>
            </motion.div>

            {/* Floating Achievement Cards with dynamic data fallback */}
            <motion.div 
              animate={{ 
                y: [0, -10, 0],
                x: [0, 4, 0]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              style={{ transform: "translateZ(60px)" }}
              onClick={() => setSelectedStat("experience")}
              className="absolute -top-6 -right-6 glass p-5 rounded-2.5xl shadow-2xl border-white/20 bg-accent/15 backdrop-blur-3xl hidden lg:block cursor-pointer hover:bg-accent/25 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/35">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <div className="text-xl font-black text-ink">
                    {profile?.stat1Value || "50+"}
                  </div>
                  <div className="text-[9px] text-ink/40 font-black uppercase tracking-widest">
                    {profile?.stat1Label || "Global Projects"}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ 
                y: [0, 10, 0],
                x: [0, -4, 0]
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              style={{ transform: "translateZ(60px)" }}
              onClick={() => setSelectedStat("stats")}
              className="absolute -bottom-6 -left-6 glass p-5 rounded-2.5xl shadow-2xl border-white/20 bg-premium/15 backdrop-blur-3xl hidden lg:block cursor-pointer hover:bg-premium/25 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-premium flex items-center justify-center text-white shadow-lg shadow-premium/35">
                  <BarChart size={24} />
                </div>
                <div>
                  <div className="text-xl font-black text-ink">
                    {profile?.stat2Value || "99%"}
                  </div>
                  <div className="text-[9px] text-ink/40 font-black uppercase tracking-widest">
                    {profile?.stat2Label || "Success Rate"}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedStat && (
          <Modal 
            isOpen={!!selectedStat} 
            onClose={() => setSelectedStat(null)} 
            title={selectedStat === "experience" ? "Experience Overview" : "Project Statistics"}
          >
            {selectedStat === "experience" ? (
              <div className="space-y-4">
                <p className="text-lg text-ink-muted leading-relaxed">
                  Over the past 5 years, I have worked with diverse clients ranging from startups to established enterprises. My journey has been defined by continuous learning and a commitment to delivering high-quality code.
                </p>
                <ul className="space-y-2 text-ink">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> 3+ Years in Full Stack Development</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> 2+ Years in AI Integration</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> 10+ Successful Enterprise Solutions</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg text-ink-muted leading-relaxed">
                  I have successfully delivered over 50 projects across various industries. My portfolio includes e-commerce platforms, AI-driven applications, and complex management systems.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="text-2xl font-bold text-primary">20+</div>
                    <div className="text-xs text-ink-muted uppercase">Web Apps</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                    <div className="text-2xl font-bold text-secondary">15+</div>
                    <div className="text-xs text-ink-muted uppercase">Mobile Apps</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10">
                    <div className="text-2xl font-bold text-accent">10+</div>
                    <div className="text-xs text-ink-muted uppercase">AI Solutions</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                    <div className="text-2xl font-bold text-blue-400">5+</div>
                    <div className="text-xs text-ink-muted uppercase">Open Source</div>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
};

const Skills = () => {
  const [skills, setSkills] = useState<any[]>([]);
  const iconMap: Record<string, any> = {
    Globe,
    Database,
    Zap,
    Layout,
    Code,
    Smartphone,
    Server,
    ImageIcon,
    PenTool
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "skills"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data && data.length > 0) {
        setSkills(data);
      } else {
        setSkills(portfolioData.skills);
      }
    });
    return () => unsub();
  }, []);

  return (
    <section id="skills" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Capabilities & Mastery
          </motion.div>
          <h2 className="section-title">Technical <span className="text-gradient-vibrant">Mastery</span></h2>
          <p className="text-ink-muted max-w-2xl mx-auto text-lg">
            Engineering digital experiences with a deep understanding of core technologies and emerging trends.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {skills.map((skill: any, idx) => {
            const Icon = iconMap[skill.icon] || Code;
            return (
              <motion.div 
                key={skill.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -10 }}
                className="premium-card group"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-5">
                    <motion.div 
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.8 }}
                      className={cn(
                        "w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl transition-all",
                        idx % 3 === 0 ? "bg-primary" : idx % 3 === 1 ? "bg-secondary" : "bg-accent"
                      )}
                    >
                      <Icon size={32} />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-black mb-1 tracking-tight">{skill.name}</h3>
                      <span className="text-[10px] text-ink/40 font-black uppercase tracking-widest">{skill.category}</span>
                    </div>
                  </div>
                  <div className="text-4xl font-black opacity-10 group-hover:opacity-100 transition-opacity text-primary">{skill.level}%</div>
                </div>
                
                <div className="space-y-4">
                  <div className="h-3 w-full bg-surface rounded-full overflow-hidden relative border border-border">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${skill.level}%` }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 40, damping: 12, delay: 0.3 }}
                      className={cn(
                        "h-full relative rounded-full",
                        idx % 3 === 0 ? "bg-primary" : idx % 3 === 1 ? "bg-secondary" : "bg-accent"
                      )}
                    >
                      <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-white/30 skew-x-12 w-1/3 blur-sm"
                      />
                    </motion.div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-ink/40">
                    <span>Foundational</span>
                    <span className="text-primary italic">Expert Level</span>
                  </div>
                </div>

                {/* Decorative SVG pattern */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <Icon size={200} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const Services = () => {
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        setProfile(mapProfileData(doc.data()));
      }
    });

    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data && data.length > 0) {
        setServices(data);
      } else {
        setServices(portfolioData.services);
      }
    });

    return () => {
      unsubProfile();
      unsubServices();
    };
  }, []);

  const icons: Record<string, any> = {
    Globe: Globe,
    Database: Database,
    Zap: Zap,
    Layout: Layout,
    Code: Code,
    Smartphone: Smartphone,
    Server: Server,
    BarChart: BarChart,
    Image: ImageIcon,
    PenTool: PenTool,
    Layers: Layers,
    Sparkles: Sparkles
  };

  return (
    <section id="services" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row items-end justify-between mb-24 gap-8">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="text-secondary text-[10px] font-black uppercase tracking-[0.3em] mb-6 block"
            >
              Elite Offerings
            </motion.div>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black leading-[1.0] tracking-tight mb-3">
              Premium <span className="text-gradient-vibrant">Services</span>
            </h2>
          </div>
          <p className="text-ink-muted text-lg max-w-sm border-l-2 border-primary/20 pl-6 leading-relaxed">
            Delivering high-end digital solutions balanced between aesthetic brilliance and technical precision.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service: any, idx: number) => {
            const serviceData = typeof service === 'string' ? { title: service, description: "Professional service tailored to your needs.", icon: "Globe" } : service;
            const Icon = icons[serviceData.icon] || Globe;
            const colors = [ "from-orange-500 to-orange-600", "from-blue-500 to-blue-600", "from-emerald-500 to-emerald-600", "from-purple-500 to-purple-600" ];
            const colorClass = colors[idx % colors.length];

            return (
              <motion.div 
                key={serviceData.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, type: "spring", bounce: 0.4 }}
                whileHover={{ y: -15 }}
                className="premium-card group cursor-pointer h-full flex flex-col"
                onClick={() => setSelectedService(serviceData)}
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={cn(
                    "w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl transition-all bg-gradient-to-br",
                    colorClass
                  )}
                >
                  <Icon size={40} />
                </motion.div>
                <h3 className="text-2xl font-black mb-6 tracking-tight group-hover:text-primary transition-colors">{serviceData.title}</h3>
                <p className="text-ink-muted text-sm leading-relaxed mb-10 flex-grow">
                  {serviceData.description}
                </p>
                
                <div className="flex items-center justify-between pt-6 border-t border-border group-hover:border-primary/20 transition-all">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">Request Project</span>
                  <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight size={20} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedService && (
          <Modal 
            isOpen={!!selectedService} 
            onClose={() => setSelectedService(null)} 
            title={`Elite Order: ${selectedService.title}`}
          >
            <div className="space-y-6">
              <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                  <Terminal size={120} />
                </div>
                <h4 className="text-2xl font-black mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
                    <Terminal size={24} />
                  </div>
                  System Analysis
                </h4>
                <p className="text-lg text-ink-muted leading-relaxed">
                  I've analyzed your interest in <span className="text-primary font-black">{selectedService.title}</span>. This service represents our highest tier of performance and design. 
                </p>
                <div className="mt-6 flex items-center gap-3 p-3 rounded-2xl bg-white/50 border border-white/20">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-ink">Priority Consultant Available</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedService(null);
                    const chatBtn = document.querySelector('button[class*="fixed bottom-8"]') as HTMLButtonElement;
                    chatBtn?.click();
                  }}
                  className="btn-secondary justify-center py-5 text-lg"
                >
                  Negotiate Direct
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary justify-center py-5 text-lg shadow-xl shadow-primary/20"
                  onClick={() => alert("Elite Order system activated. Primary consultant Joy Saha will reach out within 2 hours.")}
                >
                  Seal Agreement
                </motion.button>
              </div>
              
              <p className="text-[10px] text-center text-ink/30 uppercase tracking-[0.4em] font-black">
                End-to-End Encryption Enabled
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
};

const ExperienceSection = () => {
  const [experience, setExperience] = useState<any[]>([]);
  const [selectedExp, setSelectedExp] = useState<any | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "experience"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data && data.length > 0) {
        setExperience(data);
      } else {
        setExperience([]);
      }
    });
    return () => unsub();
  }, []);

  if (experience.length === 0) return null;

  return (
    <section id="experience" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Professional Legacy
          </motion.div>
          <h2 className="section-title">Milestones & <span className="text-gradient-vibrant">Growth</span></h2>
          <p className="text-ink-muted max-w-2xl mx-auto text-lg leading-relaxed">
            A selective history of my professional evolution and the impact I've created across various industries.
          </p>
        </div>

        <div className="relative">
          {/* Main Timeline Line */}
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-secondary to-accent opacity-20 transform md:-translate-x-1/2" />

          <div className="space-y-24">
            {experience.map((exp, idx) => (
              <motion.div 
                key={exp.id || exp.company}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                  "relative flex flex-col md:flex-row items-center gap-12",
                  idx % 2 === 0 ? "md:flex-row-reverse text-left md:text-right" : "text-left"
                )}
              >
                {/* Timeline Dot */}
                <div className="absolute left-[-5px] md:left-1/2 top-0 md:top-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_rgba(249,115,22,0.5)] transform md:-translate-x-1/2 md:-translate-y-1/2 z-20 border-2 border-background" />

                <div className="w-full md:w-1/2 flex flex-col gap-6">
                  <div className={cn(
                    "flex items-center gap-4 text-primary font-black text-2xl tracking-tighter italic",
                    idx % 2 === 0 ? "md:justify-start" : "md:justify-end md:order-2"
                  )}>
                    <div className="px-6 py-2 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-xl">
                      {exp.year}
                    </div>
                  </div>
                  <div className={cn(
                    "flex flex-col gap-2",
                    idx % 2 === 0 ? "md:items-start" : "md:items-end"
                  )}>
                    <h3 className="text-3xl font-black tracking-tight flex items-center gap-3">
                      {idx % 2 !== 0 && <Sparkles className="text-secondary opacity-30" size={24} />}
                      {exp.role}
                      {idx % 2 === 0 && <Sparkles className="text-primary opacity-30" size={24} />}
                    </h3>
                    <div className="text-xl font-bold text-ink/60 uppercase tracking-[0.2em]">{exp.company}</div>
                  </div>
                </div>

                <div className="w-full md:w-1/2">
                  <motion.div 
                    whileHover={{ scale: 1.02, x: idx % 2 === 0 ? -10 : 10 }}
                    className="premium-card group cursor-pointer"
                    onClick={() => setSelectedExp(exp)}
                  >
                    <p className="text-ink-muted text-lg leading-relaxed mb-8">
                      {exp.description}
                    </p>
                    <div className={cn(
                      "flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest italic group-hover:gap-4 transition-all",
                      idx % 2 === 0 ? "justify-end" : "justify-start"
                    )}>
                      Deep Dive <ArrowRight size={16} />
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedExp && (
          <Modal 
            isOpen={!!selectedExp} 
            onClose={() => setSelectedExp(null)} 
            title={`${selectedExp.role} @ ${selectedExp.company}`}
          >
            <div className="space-y-10">
              <div className="flex items-center justify-between p-6 rounded-3xl bg-surface border border-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">Duration</span>
                  <span className="text-2xl font-black text-primary">{selectedExp.year}</span>
                </div>
                <div className="h-10 w-px bg-border mx-8" />
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-1">Engagement</span>
                  <span className="text-2xl font-black text-secondary">Elite Consultant</span>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="text-primary font-black uppercase tracking-[0.3em] text-[10px] flex items-center gap-3">
                  <div className="h-px bg-primary/20 flex-grow" />
                  Impact & Narrative
                </div>
                <p className="text-2xl font-medium text-ink leading-relaxed italic">
                  "{selectedExp.description}"
                </p>
              </div>

              <div className="space-y-6">
                <div className="text-secondary font-black uppercase tracking-[0.3em] text-[10px] flex items-center gap-3">
                  <div className="h-px bg-secondary/20 flex-grow" />
                  Strategic Domains
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Technical Strategy", icon: Target, color: "text-primary bg-primary/10" },
                    { label: "Product Vision", icon: Layout, color: "text-secondary bg-secondary/10" },
                    { label: "System Design", icon: Server, color: "text-accent bg-accent/10" },
                    { label: "Agile Leadership", icon: Globe, color: "text-premium bg-premium/10" }
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-2xl bg-surface border border-border flex items-center gap-4 group hover:border-primary/20 transition-all">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", item.color)}>
                        <item.icon size={24} />
                      </div>
                      <span className="text-sm font-black text-ink uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
};

const EducationSection = () => {
  const [education, setEducation] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedEdu, setSelectedEdu] = useState<any | null>(null);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  useEffect(() => {
    const unsubEdu = onSnapshot(collection(db, "education"), (snap) => {
      setEducation(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "education");
    });

    const unsubCert = onSnapshot(collection(db, "certificates"), (snap) => {
      setCertificates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "certificates");
    });

    return () => {
      unsubEdu();
      unsubCert();
    };
  }, []);

  if (education.length === 0 && certificates.length === 0) return null;

  return (
    <section id="education" className="py-32 bg-surface/5 backdrop-blur-xl relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-accent text-[10px] font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Academic Foundation
          </motion.div>
          <h2 className="section-title">Knowledge & <span className="text-gradient-vibrant">Craft</span></h2>
          <p className="text-ink-muted max-w-2xl mx-auto text-lg leading-relaxed">
            The intellectual architecture that supports my engineering and creative capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {education.map((edu, idx) => (
            <motion.div 
              key={edu.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, type: "spring", bounce: 0.3 }}
              className="premium-card group cursor-pointer"
              onClick={() => setSelectedEdu(edu)}
            >
              <div className="flex flex-col sm:flex-row gap-10">
                {edu.image && (
                  <div className="w-full sm:w-48 h-48 shrink-0 rounded-[2.5rem] overflow-hidden border border-border bg-background relative p-4">
                    <img 
                      src={edu.image} 
                      alt={edu.title} 
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-background/5 group-hover:bg-transparent transition-colors" />
                  </div>
                )}
                <div className="flex-1 flex flex-col pt-4">
                  <div className="flex items-center gap-3 mb-6">
                    <span className={`text-[10px] px-4 py-1.5 rounded-full uppercase font-black tracking-widest border ${edu.type === 'Education' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                      {edu.type}
                    </span>
                    <span className="text-xs text-ink/40 font-black italic">{edu.year}</span>
                  </div>
                  <h3 className="text-3xl font-black mb-3 tracking-tight group-hover:text-primary transition-colors leading-tight">{edu.title}</h3>
                  <div className="text-primary font-bold text-lg mb-6 italic">{edu.institution}</div>
                  
                  <div className="mt-auto flex items-center justify-between pt-6 border-t border-border group-hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Credential Verification</span>
                    <ArrowRight className="text-primary group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Certificates Grid */}
        {certificates.length > 0 && (
          <div className="mt-32">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-accent text-[10px] font-black uppercase tracking-[0.3em] mb-4 block"
              >
                Verified Qualifications
              </motion.div>
              <h3 className="text-4xl font-black tracking-tight text-ink">Professional <span className="text-gradient-vibrant">Certifications</span></h3>
              <p className="text-ink-muted max-w-2xl mx-auto text-sm mt-3 leading-relaxed">
                Industry recognized specialized credentials demonstrating deep technical mastery.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {certificates.map((cert, idx) => (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.6 }}
                  className="premium-card group cursor-pointer flex flex-col justify-between"
                  onClick={() => setSelectedCert(cert)}
                >
                  <div>
                    {cert.image && (
                      <div className="w-full h-48 rounded-2xl overflow-hidden border border-border bg-background relative mb-6 p-4 flex items-center justify-center">
                        <img
                          src={cert.image}
                          alt={cert.title}
                          className="max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-background/5 group-hover:bg-transparent transition-colors" />
                      </div>
                    )}
                    <h4 className="text-xl font-black tracking-tight text-ink group-hover:text-primary transition-colors line-clamp-2 leading-snug">{cert.title}</h4>
                    <p className="text-xs text-ink-muted leading-relaxed italic line-clamp-3 mt-3">"{cert.description}"</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-border group-hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <Award size={12} /> View Certificate
                    </span>
                    <ArrowRight size={14} className="text-primary group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedEdu && (
          <Modal 
            isOpen={!!selectedEdu} 
            onClose={() => setSelectedEdu(null)} 
            title={selectedEdu.title}
          >
            <div className="space-y-10">
              {selectedEdu.image && (
                <div className="relative rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl aspect-video bg-white p-12">
                  <img 
                    src={selectedEdu.image} 
                    alt={selectedEdu.title} 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
                  <div>
                    <div className="text-primary font-black text-3xl mb-1 tracking-tight">{selectedEdu.institution}</div>
                    <div className="text-ink-muted text-lg font-bold italic">{selectedEdu.year}</div>
                  </div>
                  <div className={`px-8 py-3 rounded-2xl uppercase font-black tracking-[0.25em] text-sm shadow-xl ${selectedEdu.type === 'Education' ? 'bg-blue-500 text-white shadow-blue-500/30' : 'bg-orange-500 text-white shadow-orange-500/30'}`}>
                    {selectedEdu.type}
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  <p className="text-2xl font-medium text-ink leading-relaxed font-serif italic">
                    "{selectedEdu.description}"
                  </p>
                </div>
                
                <div className="p-8 rounded-[2rem] bg-surface border border-border grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">Core Competencies</h4>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3 text-sm font-bold text-ink"><div className="w-2 h-2 rounded-full bg-primary" /> Advanced Data Structures</li>
                      <li className="flex items-center gap-3 text-sm font-bold text-ink"><div className="w-2 h-2 rounded-full bg-primary" /> Algorithmic Efficiency</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-4">Mastery Outcome</h4>
                    <p className="text-xs text-ink/60 font-medium leading-relaxed">
                      Graduated with highest honors, specializing in scalable architectural designs and human-centric UI/UX paradigms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {selectedCert && (
          <Modal 
            isOpen={!!selectedCert} 
            onClose={() => setSelectedCert(null)} 
            title={selectedCert.title}
          >
            <div className="space-y-10">
              {selectedCert.image && (
                <div className="relative rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-white p-12 max-h-[70vh] flex items-center justify-center">
                  <img 
                    src={selectedCert.image} 
                    alt={selectedCert.title} 
                    className="max-h-[50vh] object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
                  <div>
                    <div className="text-primary font-black text-3xl mb-1 tracking-tight">Verified Credential</div>
                    <div className="text-ink-muted text-sm font-bold tracking-widest uppercase italic flex items-center gap-2">
                      <Award size={16} className="text-primary" /> Professional Certification
                    </div>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  <p className="text-2xl font-medium text-ink leading-relaxed font-serif italic">
                    "{selectedCert.description}"
                  </p>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
};

const Portfolio = () => {
  const [filter, setFilter] = useState("All");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  
  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const id = url.includes("v=") ? url.split("v=")[1].split("&")[0] : url.split("/").pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("vimeo.com")) {
      const id = url.split("/").pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "portfolio_projects"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data && data.length > 0) {
        setProjects(data);
      } else {
        setProjects(portfolioData.projects);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let timer: any;
    const projectGallery = selectedProject?.gallery || selectedProject?.images;
    if (selectedProject && projectGallery && projectGallery.length > 1 && !isPlayingVideo) {
      timer = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % projectGallery.length);
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [selectedProject, isPlayingVideo]);

  const categories = ["All", ...new Set(projects.map(p => p.category))];
  
  const filteredProjects = filter === "All" 
    ? projects 
    : projects.filter(p => p.category === filter);

  return (
    <section id="portfolio" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-24 gap-12">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="text-primary text-[9px] font-black uppercase tracking-[0.3em] mb-4 block"
            >
              Curated Masterpieces
            </motion.div>
            <h2 className="text-2xl md:text-5xl font-black leading-[0.9] tracking-tight mb-4 italic">
              Digital <span className="text-gradient-vibrant">Artifacts</span>
            </h2>
            <p className="text-ink-muted text-sm leading-relaxed">
              Constructing functional art through clean code and breakthrough design patterns.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            {categories.map(cat => (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl",
                  filter === cat 
                    ? "bg-primary text-white shadow-primary/20" 
                    : "bg-surface text-ink/40 hover:bg-surface-accent border border-border"
                )}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, idx) => (
              <motion.div
                layout
                key={project.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="group relative rounded-[3rem] overflow-hidden aspect-[16/10] cursor-pointer shadow-[0_40px_100px_-30px_rgba(0,0,0,0.4)] border border-white/10"
                onClick={() => {
                  setSelectedProject(project);
                  setCurrentImageIndex(0);
                  setIsPlayingVideo(false);
                }}
              >
                <img 
                  src={project.image} 
                  alt={project.title} 
                  className="w-full h-full object-cover transition-transform duration-2000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-90 transition-all duration-700" />
                
                <div className="absolute inset-0 p-12 flex flex-col justify-end">
                  <div className="transform translate-y-8 group-hover:translate-y-0 transition-all duration-700 ease-out">
                    <motion.div 
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-6"
                    >
                      {project.category}
                    </motion.div>
                    <h3 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter leading-none group-hover:text-primary transition-colors">{project.title}</h3>
                    
                    <div className="flex flex-wrap gap-3 mb-8 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      {project.tech.map(t => (
                        <span key={t} className="text-[10px] px-4 py-1.5 rounded-xl bg-white/10 text-white font-black uppercase tracking-widest border border-white/10 backdrop-blur-md italic">{t}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="absolute top-12 right-12 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-700 flex flex-col gap-4">
                    <div className="w-16 h-16 rounded-[2rem] bg-primary flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform rotate-12 group-hover:rotate-0">
                      <ArrowUpRight size={32} />
                    </div>
                    {project.videoUrl && (
                      <div className="w-16 h-16 rounded-[2rem] bg-secondary flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform -rotate-12 group-hover:rotate-0">
                        <Play size={28} fill="currentColor" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selectedProject && (
          <Modal 
            isOpen={!!selectedProject} 
            onClose={() => setSelectedProject(null)} 
            title={selectedProject.title}
          >
            <div className="space-y-8 overflow-hidden">
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-white/10 aspect-video group bg-black/40">
                {isPlayingVideo && selectedProject.videoUrl ? (
                  <iframe 
                    src={getEmbedUrl(selectedProject.videoUrl)} 
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="relative w-full h-full">
                    <AnimatePresence mode="wait">
                      <motion.img 
                        key={currentImageIndex}
                        initial={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                        src={(selectedProject.gallery || selectedProject.images) ? (selectedProject.gallery || selectedProject.images)[currentImageIndex] : selectedProject.image} 
                        alt={selectedProject.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                    
                    {(selectedProject.gallery || selectedProject.images) && (selectedProject.gallery || selectedProject.images).length > 1 && (
                      <div className="absolute inset-x-0 bottom-10 flex justify-center gap-4 z-20">
                        {(selectedProject.gallery || selectedProject.images).map((_: any, idx: number) => (
                          <motion.button 
                            key={idx}
                            whileHover={{ scale: 1.2 }}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={cn(
                              "w-3 h-3 rounded-full transition-all border-2 border-white/50",
                              currentImageIndex === idx ? "bg-primary border-primary w-12" : "bg-white/20"
                            )}
                          />
                        ))}
                      </div>
                    )}
                    
                    {selectedProject.videoUrl && (
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-primary/90 text-white flex items-center justify-center backdrop-blur-md shadow-2xl z-30"
                        onClick={() => setIsPlayingVideo(true)}
                      >
                        <Play size={40} fill="currentColor" />
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid lg:grid-cols-3 gap-12 p-4">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px]">Project Narrative</span>
                    <div className="h-px bg-primary/20 flex-grow" />
                  </div>
                  <p className="text-2xl font-medium text-ink leading-relaxed">
                    {selectedProject.description}
                  </p>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-ink/40 mb-4 italic">Core Stack</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.tech.map((t: string) => (
                        <div key={t} className="px-4 py-2 rounded-xl bg-surface border border-border text-sm font-black text-ink">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <a 
                      href={selectedProject.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-primary w-full justify-center py-5 text-lg group italic"
                    >
                      Launch Experience
                      <ArrowUpRight className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
};

const Gallery = () => {
  const [images, setImages] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gallery"), (snap) => {
      setImages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="text-premium text-[10px] font-black uppercase tracking-[0.4em] mb-6 block"
          >
            Visual Fragments
          </motion.div>
          <h2 className="section-title">Aesthetic <span className="text-gradient-vibrant">Journal</span></h2>
          <p className="text-ink-muted max-w-2xl mx-auto text-lg">
            A curated stream of moments, textures, and digital explorations.
          </p>
        </div>

        <div className="columns-2 md:columns-4 gap-8 space-y-8">
          {images.map((img, idx) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="relative rounded-[2rem] overflow-hidden border border-border group cursor-zoom-in"
            >
              <img 
                src={img.url} 
                alt={img.caption || "Gallery Image"} 
                className="w-full h-auto object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center p-6 text-center">
                 <p className="text-white text-xs font-black uppercase tracking-widest leading-relaxed">
                  {img.caption || "Abstract Study"}
                 </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "testimonials"), (snap) => {
      setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <section id="testimonials" className="py-32 relative overflow-hidden bg-primary/5">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-secondary text-[10px] font-black uppercase tracking-[0.4em] mb-6 block"
          >
            Voice of the Elite
          </motion.div>
          <h2 className="section-title">Kind <span className="text-gradient-vibrant">Words</span></h2>
          <p className="text-ink-muted max-w-2xl mx-auto text-lg leading-relaxed">
            Collaborative success stories from partners who demand nothing but excellence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {testimonials.map((item, idx) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="premium-card relative group flex flex-col"
            >
              <Quote className="absolute top-8 right-8 text-primary opacity-20 group-hover:opacity-40 transition-opacity" size={40} />
              <div className="flex-1">
                <p className="text-xl font-medium text-ink leading-relaxed italic mb-10">
                  "{item.text}"
                </p>
              </div>
              <div className="flex items-center gap-6 pt-8 border-t border-border">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-black text-xl text-white shadow-lg">
                  {item.name[0]}
                </div>
                <div>
                  <div className="font-black text-lg text-ink tracking-tight uppercase leading-none mb-1">{item.name}</div>
                  <div className="text-[10px] font-black text-primary uppercase tracking-widest italic">{item.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Blog = () => {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "blog"), (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <section id="blog" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex items-end justify-between mb-24">
          <div className="max-w-xl">
             <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="text-accent text-[10px] font-black uppercase tracking-[0.4em] mb-6 block"
            >
              Coded Narratives
            </motion.div>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black leading-[1.0] tracking-tight mb-4 italic">
              Digital <span className="text-gradient-vibrant">Dialogues</span>
            </h2>
          </div>
          <motion.div
            whileHover={{ x: 10 }}
            className="hidden md:block"
          >
            <Link to="/blog" className="flex items-center gap-4 text-primary font-black uppercase tracking-widest text-[10px] group transition-all">
              Explore All Thoughts <div className="w-12 h-12 rounded-full border border-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"><ChevronRight size={24} /></div>
            </Link>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {posts.map((post, idx) => (
            <Link 
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group"
            >
              <motion.article 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="premium-card p-0 overflow-hidden flex flex-col sm:flex-row gap-0 h-full"
              >
                <div className="w-full sm:w-64 h-64 sm:h-full relative overflow-hidden bg-surface">
                  <img 
                    src={post.image} 
                    alt={post.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                </div>
                <div className="flex-1 p-10 flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest border-b-2 border-primary/20 pb-1 italic">{post.category}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-[10px] font-black text-ink/30 uppercase tracking-widest">{new Date(post.published_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-3xl font-black mb-4 group-hover:text-primary transition-colors leading-tight tracking-tight">{post.title}</h3>
                  <p className="text-ink-muted text-sm line-clamp-3 mb-8 leading-relaxed italic">
                    {post.excerpt}
                  </p>
                  <div className="mt-auto flex items-center gap-3 text-primary font-black text-[10px] uppercase tracking-widest group-hover:gap-5 transition-all">
                    Initiate Read <ArrowRight size={16} />
                  </div>
                </div>
              </motion.article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const BlogListPage = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // New Post Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Technology");
  const [newExcerpt, setNewExcerpt] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const categories = ["All", "Technology", "Design", "Productivity", "Business", "Development"];

  const unsplashPresets = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200",
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1200",
    "https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1200",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200"
  ];

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    const path = "blog";
    const unsub = onSnapshot(collection(db, path), (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => {
      unsubscribeAuth();
      unsub();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToast(msg);
  };

  const seedDatabase = async () => {
    const samplePosts = [
      {
        title: "The Future of Web Development: AI Agents and Autonomous Code",
        slug: "future-of-web-development-ai-agents",
        excerpt: "Exploring how LLMs and agentic workflows are reshaping the modern developer experience, from IDE integrations to autonomous deployment.",
        content: `# The Future of Web Development: AI Agents and Autonomous Code

The web development landscape is undergoing a tectonic shift. For decades, our tooling has evolved from simple text editors to integrated development environments (IDEs) and compiler-assisted frameworks. Today, we are stepping into a new era: **Autonomous Code Engines** and **Agentic Software Development**.

## The Rise of Agentic Workflows

An agentic workflow is one where an AI model isn't just a static autocomplete companion, but an active, loop-driven participant. It follows a loop of reasoning:

1. **Plan**: Formulate steps to achieve a user's instruction.
2. **Execute**: Create files, call tools, and run commands.
3. **Verify**: Review output, run tests, and check linters.
4. **Refine**: Fix errors recursively until the goal is fully accomplished.

> "The true craft of software engineering is no longer about writing lines of syntax; it is about articulating design boundaries, verifying constraints, and choreographing smart agents."

## What This Means for Developers

Rather than being replaced, developers are evolving into **Software Architects and Choreographers**. Your role is to:

- Define the **system requirements** and exact parameters of the application.
- Ensure rigorous **security rules** and attribute-based access controls.
- Oversee the **visual Polish** and micro-interactions that make an experience delightful.

---

### Key Takeaway

The future belongs to those who learn to build *with* agents. We are no longer limited by the speed of our typing, but by the clarity of our imagination.
`,
        category: "Technology",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop",
        published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        date: new Date(Date.now() - 86400000 * 2).toLocaleDateString(),
        likes: 42,
        views: 184,
        authorName: "Joy Saha",
        authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
        authorId: "joy_saha_admin"
      },
      {
        title: "Designing for the Spatial Web: A Premium UX/UI Manifesto",
        slug: "designing-for-the-spatial-web",
        excerpt: "An in-depth look into the principles of mixed-reality design, interactive glassmorphic canvases, depth cue hierarchy, and tactile interfaces.",
        content: `# Designing for the Spatial Web: A Premium UX/UI Manifesto

With the advent of high-fidelity spatial computation, we must rethink the standard flat interfaces that have dominated the last two decades. The canvas is no longer bounded by bezel frames; it is merged with our physical environment.

## 1. Dimensional Depth and Shadowing

On a flat display, shadows are used for subtle contrast. In spatial environments, **shadows are crucial spatial cues** that indicate physical height and coordinate positions relative to real surfaces.

### Real Depth Rules:
- **Relative Distance**: Canvases further away should have wider, softer shadows.
- **Dynamic Occlusion**: Moving layers should cast real-time responsive shadows onto standard elements below them.

## 2. Interactive Glassmorphism

Instead of solid dark or white blocks, interfaces should use high-index **backdrop blurs** (glassmorphism). This allows ambient light from the user's physical environment to color the UI naturally, creating a native, harmonious feel.

\`\`\`css
/* Pure spatial glassmorphism */
.spatial-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px border rgba(255, 255, 255, 0.1);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
}
\`\`\`

## 3. Micro-Interaction Feedback

Because spatial web interfaces lack traditional tactile keys, **hover state feedback must be exaggerated**. 

- Buttons should gently scale up (+5%) and glow when looked at or hovered.
- Use sound-effects or haptics if accessories support them.

---

*Authored with passion by Joy Saha, Lead UX/UI Engineer.*
`,
        category: "Design",
        image: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1200&auto=format&fit=crop",
        published_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        date: new Date(Date.now() - 86400000 * 5).toLocaleDateString(),
        likes: 31,
        views: 112,
        authorName: "Joy Saha",
        authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
        authorId: "joy_saha_admin"
      },
      {
        title: "Mastering Focus: Deep Work Systems for High-Impact Engineers",
        slug: "mastering-focus-deep-work-systems",
        excerpt: "How to engineer a bulletproof flow state amidst constant notifications, Slack pings, and the chaotic nature of multi-context environments.",
        content: `# Mastering Focus: Deep Work Systems for High-Impact Engineers

Modern developers do not suffer from a lack of coding hours; they suffer from a lack of **undisturbed, contiguous focus cycles**. A single notification can instantly evict complex abstract system diagrams from your working memory, costing up to 23 minutes to fully recover.

Here is how you can build a bulletproof shield for your attention:

## The Focus Stack Architecture

To enter high-output flow states regularly, you must divide your day into specific zones:

### A. The "Mute Zone" (First 3 Hours)
Begin your workday by closing Slack, email, and Discord completely. During this time, your sole output should be structural:
- Code generation
- Schema architecture
- Writing clean tests

### B. The "Collaboration Zone" (Midday)
Open your communication channels. Dedicate this block entirely to code reviews, coordination meetings, and assisting teammates.

### C. The "Polishing Zone" (Late Afternoon)
Review the work completed. Run linters, verify layout responsiveness, optimize SQL query execution plans, and write clean summaries of what was achieved.

---

> "He who can focus on a single complex mathematical or architectural problem for four hours without interruption will always outperform those who spend twelve hours context-switching."

Implementing this stack is not an optimization; it is a fundamental career accelerator.
`,
        category: "Productivity",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop",
        published_at: new Date(Date.now() - 86400000 * 8).toISOString(),
        date: new Date(Date.now() - 86400000 * 8).toLocaleDateString(),
        likes: 56,
        views: 245,
        authorName: "Joy Saha",
        authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
        authorId: "joy_saha_admin"
      }
    ];

    setLoading(true);
    for (const post of samplePosts) {
      try {
        await addDoc(collection(db, "blog"), post);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "blog");
      }
    }
    triggerToast("Sample articles seeded successfully into Firestore!");
  };

  const handleSubscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    try {
      await addDoc(collection(db, "subscribers"), {
        email: newsletterEmail.trim(),
        createdAt: new Date().toISOString()
      });
      setNewsletterSubscribed(true);
      setNewsletterEmail("");
      triggerToast("Thank you! You have subscribed to our newsletter.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "subscribers");
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newExcerpt.trim() || !newContent.trim()) {
      triggerToast("Please fill in all required fields.");
      return;
    }

    if (!user) {
      triggerToast("Please sign in to publish articles.");
      return;
    }

    const generatedSlug = newTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const coverPhoto = newImage || unsplashPresets[0];

    const postPayload = {
      title: newTitle.trim(),
      slug: generatedSlug,
      excerpt: newExcerpt.trim(),
      content: newContent.trim(),
      category: newCategory,
      image: coverPhoto,
      published_at: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      likes: 0,
      views: 0,
      authorName: user.displayName || "Anonymous Creator",
      authorImage: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
      authorId: user.uid
    };

    try {
      await addDoc(collection(db, "blog"), postPayload);
      setShowCreateModal(false);
      // Reset form
      setNewTitle("");
      setNewExcerpt("");
      setNewContent("");
      setNewImage("");
      triggerToast("Article successfully published to live database!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "blog");
    }
  };

  const handleDeletePost = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
      await deleteDoc(doc(db, "blog", id));
      triggerToast("Article successfully deleted from Firestore!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blog/${id}`);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch = 
      post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.category?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort posts: latest first
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    return new Date(b.published_at || b.date).getTime() - new Date(a.published_at || a.date).getTime();
  });

  const featuredPost = sortedPosts[0];
  const gridPosts = sortedPosts.slice(1);

  return (
    <div className="min-h-screen bg-mesh-light dark:bg-mesh-dark transition-colors duration-500 text-ink">
      <Navbar />
      
      <main className="pt-28 pb-16 px-6 max-w-7xl mx-auto">
        
        {/* Header Hero Section */}
        <div className="relative py-12 md:py-16 flex flex-col md:flex-row md:items-end justify-between border-b border-border mb-12">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-3 block"
            >
              The Modern Narrative
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight mb-4 italic"
            >
              Coded <span className="text-gradient-vibrant">Insights</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-ink-muted text-lg max-w-xl leading-relaxed font-sans"
            >
              Documenting systems design, visual ergonomics, and next-gen AI engineering protocols.
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-6 md:mt-0 flex gap-4 flex-wrap"
          >
            {user ? (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary py-3 px-6 flex items-center gap-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
              >
                <Plus size={16} /> Write Article
              </button>
            ) : (
              <div className="text-xs text-ink-muted bg-surface/30 backdrop-blur border border-border p-4 rounded-xl flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Sign in to write articles and leave comments.
              </div>
            )}
            
            {posts.length === 0 && !loading && (
              <button
                onClick={seedDatabase}
                className="btn-secondary py-3 px-6 text-sm font-bold rounded-xl flex items-center gap-2 border border-dashed border-primary/40"
              >
                <Sparkles size={16} className="text-primary" /> Seed Live Database
              </button>
            )}
          </motion.div>
        </div>

        {/* Search and Category Filters */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center mb-12">
          {/* Horizontal Category Slider */}
          <div className="flex gap-2 overflow-x-auto pb-2 w-full lg:w-auto scrollbar-none no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-300 whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105"
                    : "bg-surface/30 border-border/80 text-ink-muted hover:text-ink hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-96">
            <input
              type="text"
              placeholder="Search journals or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface/30 hover:bg-surface/40 focus:bg-surface/60 border border-border focus:border-primary rounded-full py-3.5 pl-12 pr-6 outline-none transition-all text-sm font-medium tracking-tight"
            />
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-primary transition-colors text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
            />
            <span className="text-xs text-ink-muted font-bold tracking-widest uppercase animate-pulse">Accessing Firestore...</span>
          </div>
        ) : sortedPosts.length === 0 ? (
          /* Empty State */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-dashed border-border/60 bg-surface/10 rounded-[2rem] p-16 text-center max-w-2xl mx-auto my-12"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
              <BookOpen size={28} />
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">No journals found</h3>
            <p className="text-ink-muted mb-8 text-sm max-w-md mx-auto leading-relaxed">
              We couldn't find any articles matching "{searchQuery}" under {selectedCategory} category. Try refining your filters or create a new post!
            </p>
            <div className="flex gap-4 justify-center">
              {user ? (
                <button onClick={() => setShowCreateModal(true)} className="btn-primary rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider">
                  Create First Post
                </button>
              ) : (
                <div className="text-xs font-bold text-primary">Sign in to publish the first article!</div>
              )}
              <button onClick={seedDatabase} className="btn-secondary rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider border border-border">
                Seed Database
              </button>
            </div>
          </motion.div>
        ) : (
          /* Featured Spot + Grid */
          <div className="space-y-16">
            
            {/* Spotlight Banner (First article in search/filter results) */}
            {featuredPost && selectedCategory === "All" && !searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="premium-card p-0 rounded-[2.5rem] overflow-hidden grid lg:grid-cols-12 gap-0 border border-border/80 group shadow-2xl relative"
              >
                {/* Image Section */}
                <div className="lg:col-span-7 h-72 sm:h-96 lg:h-[480px] relative overflow-hidden bg-surface">
                  <img
                    src={featuredPost.image}
                    alt={featuredPost.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.03]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <span className="absolute top-6 left-6 px-4 py-1.5 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl">
                    Spotlight
                  </span>
                </div>

                {/* Info details */}
                <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-xs font-black uppercase tracking-widest text-primary border-b border-primary/20 pb-0.5">{featuredPost.category}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-border" />
                      <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">{featuredPost.date}</span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4 group-hover:text-primary transition-colors italic">
                      {featuredPost.title}
                    </h2>
                    
                    <p className="text-ink-muted font-sans text-sm sm:text-base leading-relaxed line-clamp-4 mb-8">
                      {featuredPost.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-6">
                    <div className="flex items-center gap-3">
                      <img 
                        src={featuredPost.authorImage || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100"} 
                        alt={featuredPost.authorName} 
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                      <div>
                        <div className="text-xs font-black tracking-tight">{featuredPost.authorName}</div>
                        <div className="text-[10px] text-ink-muted uppercase font-bold">Author</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-ink-muted font-bold font-mono">
                      <span className="flex items-center gap-1.5"><Heart size={14} className="text-red-500 fill-red-500" /> {featuredPost.likes || 0}</span>
                      <span className="flex items-center gap-1.5"><Eye size={14} /> {featuredPost.views || 0}</span>
                    </div>
                  </div>

                  {/* Absolute Click Layer */}
                  <Link to={`/blog/${featuredPost.slug}`} className="absolute inset-0 z-10" />
                </div>
              </motion.div>
            )}

            {/* Grid Layout */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
              {(selectedCategory !== "All" || searchQuery ? sortedPosts : gridPosts).map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group premium-card p-0 rounded-[2rem] overflow-hidden flex flex-col h-full border border-border/80 hover:border-primary/20 transition-all duration-300 hover:shadow-2xl relative"
                >
                  <Link to={`/blog/${post.slug}`} className="absolute inset-0 z-10" />
                  
                  {/* Card Cover Photo */}
                  <div className="aspect-[16/10] overflow-hidden bg-surface relative">
                    <img 
                      src={post.image} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                    
                    {/* Delete Icon if Owner/Admin */}
                    {(user?.uid === post.authorId || user?.email === 'jsaha3741@gmail.com') && (
                      <button
                        onClick={(e) => handleDeletePost(post.id, e)}
                        className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-red-500/95 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                        title="Delete Article"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-8 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/25 pb-0.5">{post.category}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">{post.date}</span>
                      </div>

                      <h3 className="text-xl font-bold leading-snug mb-3 group-hover:text-primary transition-colors tracking-tight text-ink/90">
                        {post.title}
                      </h3>

                      <p className="text-ink-muted font-sans text-xs sm:text-sm leading-relaxed line-clamp-3 mb-6">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-5">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={post.authorImage || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100"} 
                          alt={post.authorName} 
                          className="w-8 h-8 rounded-full object-cover border border-border"
                        />
                        <span className="text-xs font-bold text-ink/80">{post.authorName}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-ink-muted">
                        <span className="flex items-center gap-1"><Heart size={12} className="text-red-500 fill-red-500" /> {post.likes || 0}</span>
                        <span className="flex items-center gap-1"><Eye size={12} /> {post.views || 0}</span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

          </div>
        )}

        {/* Newsletter Subscription Area */}
        <section className="mt-24 bg-surface/5 backdrop-blur-md border border-border/80 rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/5 blur-[120px]" />
          
          <div className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Mail size={22} />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black italic tracking-tight mb-4 text-ink leading-none">
              The <span className="text-gradient-vibrant">Weekly Digest</span>
            </h2>
            <p className="text-ink-muted text-sm leading-relaxed max-w-md mb-8">
              Join our engineering and layout mailing list. Get premium tutorials, case-studies, and tech resources directly in your mailbox.
            </p>

            {newsletterSubscribed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-primary/10 border border-primary/20 text-primary px-8 py-4 rounded-2xl font-bold text-sm tracking-wide"
              >
                ✓ Subscription Active! Welcome to the loop.
              </motion.div>
            ) : (
              <form onSubmit={handleSubscribeNewsletter} className="w-full flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  placeholder="Enter your personal email address..."
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 bg-surface/40 focus:bg-surface/60 border border-border focus:border-primary outline-none px-6 py-4 rounded-xl text-sm font-medium transition-colors"
                />
                <button
                  type="submit"
                  className="btn-primary py-4 px-8 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/25"
                >
                  Join List
                </button>
              </form>
            )}
          </div>
        </section>

      </main>

      <Footer />

      {/* Write Article slide-over drawer modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop Blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Sheet Container */}
            <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-screen max-w-2xl bg-mesh-light dark:bg-mesh-dark border-l border-border shadow-2xl overflow-y-auto"
              >
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-20">
                    <div>
                      <h2 className="text-2xl font-black italic tracking-tight">Create Blog Post</h2>
                      <p className="text-xs text-ink-muted">Write and publish directly to live Firestore</p>
                    </div>
                    <button 
                      onClick={() => setShowCreateModal(false)}
                      className="p-2 hover:bg-surface/20 rounded-full text-ink-muted hover:text-ink transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Form Form Content */}
                  <form onSubmit={handleCreatePost} className="p-8 flex-1 space-y-6">
                    
                    {/* Mode Toggle */}
                    <div className="flex gap-2 p-1 bg-surface/30 border border-border rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setIsPreviewMode(false)}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${!isPreviewMode ? 'bg-primary text-white' : 'text-ink-muted'}`}
                      >
                        Editor Mode
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsPreviewMode(true)}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${isPreviewMode ? 'bg-primary text-white' : 'text-ink-muted'}`}
                      >
                        Live Preview
                      </button>
                    </div>

                    {!isPreviewMode ? (
                      <div className="space-y-6">
                        {/* Title */}
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Article Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g., Understanding System Design Tokens"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full bg-surface/20 focus:bg-surface/30 border border-border focus:border-primary px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                          />
                          <div className="mt-1.5 text-[10px] text-ink-muted font-mono uppercase tracking-wider">
                            URL slug: /{newTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")}
                          </div>
                        </div>

                        {/* Category and preset picker */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Category</label>
                            <select
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              className="w-full bg-surface/20 border border-border focus:border-primary px-4 py-3.5 rounded-xl text-sm font-medium outline-none"
                            >
                              {categories.filter(c => c !== "All").map(c => (
                                <option key={c} value={c} className="bg-background text-ink">{c}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Author Persona</label>
                            <div className="px-4 py-3 rounded-xl bg-surface/10 border border-border/50 text-xs font-bold flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {user?.displayName || "Joy Saha"}
                            </div>
                          </div>
                        </div>

                        {/* Custom Image URL or Preset */}
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Cover Image Option</label>
                          <input
                            type="url"
                            placeholder="Paste custom Unsplash image link or click a preset below..."
                            value={newImage}
                            onChange={(e) => setNewImage(e.target.value)}
                            className="w-full bg-surface/20 focus:bg-surface/30 border border-border focus:border-primary px-4 py-3 rounded-xl text-sm font-medium transition-colors mb-3"
                          />
                          
                          {/* Presets Grid */}
                          <div className="grid grid-cols-4 gap-3">
                            {unsplashPresets.map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setNewImage(preset)}
                                className={`aspect-video rounded-lg overflow-hidden border-2 transition-transform hover:scale-105 relative ${newImage === preset ? 'border-primary' : 'border-transparent'}`}
                              >
                                <img src={preset} alt="preset" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/10 hover:bg-transparent" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Excerpt */}
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Brief Summary Excerpt *</label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Provide a high-impact, brief teaser description for your article card..."
                            value={newExcerpt}
                            onChange={(e) => setNewExcerpt(e.target.value)}
                            className="w-full bg-surface/20 focus:bg-surface/30 border border-border focus:border-primary p-4 rounded-xl text-sm font-medium transition-colors resize-none"
                          />
                        </div>

                        {/* Rich Markdown Content */}
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-ink-muted mb-2">Markdown Content *</label>
                          <textarea
                            required
                            rows={12}
                            placeholder="# Write your rich text in Markdown!&#10;&#10;Use headings, blockquotes, lists, and code blocks seamlessly."
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            className="w-full bg-surface/20 focus:bg-surface/30 border border-border focus:border-primary p-4 rounded-xl font-mono text-xs leading-normal transition-colors"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Live Preview Container */
                      <div className="space-y-6 pb-12">
                        <div className="aspect-video rounded-2xl overflow-hidden bg-surface border border-border">
                          <img src={newImage || unsplashPresets[0]} alt="preview" className="w-full h-full object-cover" />
                        </div>
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                          {newCategory}
                        </span>
                        <h1 className="text-3xl font-black italic tracking-tight">{newTitle || "Untitled Draft"}</h1>
                        <p className="text-ink-muted text-sm italic font-sans">{newExcerpt || "Excerpt content preview goes here..."}</p>
                        <div className="border-t border-border pt-6 mt-6">
                          <div className="prose prose-invert max-w-none">
                            <ReactMarkdown>{newContent || "*No markdown content drafted yet.*"}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer Submit */}
                    <div className="sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t border-border mt-10 flex gap-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="flex-1 btn-secondary py-3.5 px-6 rounded-xl font-bold uppercase tracking-widest text-xs border border-border"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPreviewMode}
                        className="flex-1 btn-primary py-3.5 px-6 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/25 disabled:opacity-50"
                      >
                        Publish Live
                      </button>
                    </div>

                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Interactive Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-surface/90 backdrop-blur-md border border-primary/20 text-ink px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span className="text-xs font-bold tracking-tight text-ink/90">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BlogDetailPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "blog"), where("slug", "==", slug));
    
    const unsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const postDoc = snap.docs[0];
        const postData = { id: postDoc.id, ...postDoc.data() } as any;
        setPost(postData);
        setLikesCount(postData.likes || 0);

        // Check if user already liked this post in localStorage
        const likedBlogs = JSON.parse(localStorage.getItem("liked_blog_posts") || "[]");
        setIsLiked(likedBlogs.includes(postData.id));

        // Increment Views on initial load (session gated via localStorage to avoid double counts)
        const viewKey = `viewed_${postData.id}`;
        if (!localStorage.getItem(viewKey)) {
          try {
            await updateDoc(doc(db, "blog", postData.id), { views: increment(1) });
            localStorage.setItem(viewKey, "true");
          } catch (err) {
            console.error("Error updating views: ", err);
          }
        }

        // Fetch Comments Subcollection
        const commentsPath = `blog/${postData.id}/comments`;
        const commentsRef = collection(db, "blog", postData.id, "comments");
        const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubComments = onSnapshot(commentsQuery, (commentsSnap) => {
          setComments(commentsSnap.docs.map(cd => ({ id: cd.id, ...cd.data() })));
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, commentsPath);
        });

        // Fetch Related Posts
        const blogPath = "blog";
        const relatedRef = collection(db, blogPath);
        const unsubRelated = onSnapshot(relatedRef, (relatedSnap) => {
          const allPosts = relatedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
          const filtered = allPosts
            .filter((p: any) => p.id !== postData.id && p.category === postData.category)
            .slice(0, 2);
          setRelatedPosts(filtered);
        });

        setLoading(false);

        return () => {
          unsubComments();
          unsubRelated();
        };
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `blog/slug/${slug}`);
    });

    return () => unsub();
  }, [slug]);

  const toggleLike = async () => {
    if (!post) return;
    const likedBlogs = JSON.parse(localStorage.getItem("liked_blog_posts") || "[]");
    const docRef = doc(db, "blog", post.id);

    try {
      if (isLiked) {
        // Decrement like
        await updateDoc(docRef, { likes: increment(-1) });
        const updated = likedBlogs.filter((id: string) => id !== post.id);
        localStorage.setItem("liked_blog_posts", JSON.stringify(updated));
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        setToast("Liked removed.");
      } else {
        // Increment like
        await updateDoc(docRef, { likes: increment(1) });
        likedBlogs.push(post.id);
        localStorage.setItem("liked_blog_posts", JSON.stringify(likedBlogs));
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        setToast("Article liked! Thank you for the support.");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `blog/${post.id}`);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    if (!user && !guestName.trim()) {
      setToast("Please enter a guest name or sign in to comment.");
      return;
    }

    const commentsPath = `blog/${post.id}/comments`;
    const commentPayload = {
      authorName: user ? (user.displayName || user.email?.split('@')[0]) : guestName.trim(),
      authorImage: user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${guestName || 'anon'}`,
      content: commentText.trim(),
      createdAt: new Date().toISOString(),
      userId: user?.uid || "guest"
    };

    try {
      await addDoc(collection(db, "blog", post.id, "comments"), commentPayload);
      setCommentText("");
      setGuestName("");
      setToast("Comment posted successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, commentsPath);
    }
  };

  const handleShare = (platform: 'link' | 'twitter' | 'linkedin') => {
    const articleUrl = window.location.href;
    const shareTitle = encodeURIComponent(`Check out this article by Joy Saha: ${post?.title}`);

    if (platform === 'link') {
      navigator.clipboard.writeText(articleUrl);
      setToast("Link copied to clipboard!");
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(articleUrl)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`, '_blank');
    }
    setShareOpen(false);
  };

  const renderCustomMarkdown = (content: string) => {
    return (
      <div className="space-y-6 text-ink-muted leading-relaxed text-base sm:text-lg font-sans">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-3xl md:text-5xl font-extrabold text-ink mt-12 mb-6 tracking-tight leading-tight italic">{children}</h1>,
            h2: ({ children }) => <h2 className="text-2xl md:text-3xl font-bold text-ink mt-10 mb-5 tracking-tight leading-tight">{children}</h2>,
            h3: ({ children }) => <h3 className="text-xl md:text-2xl font-bold text-ink mt-8 mb-4 tracking-tight">{children}</h3>,
            p: ({ children }) => <p className="mb-6 leading-relaxed text-ink/80 dark:text-ink-muted/90">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-6 mb-6 space-y-2.5 text-ink/85 dark:text-ink-muted/90">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 mb-6 space-y-2.5 text-ink/85 dark:text-ink-muted/90">{children}</ol>,
            li: ({ children }) => <li className="pl-1.5">{children}</li>,
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline ? (
                <pre className="p-5 bg-surface/40 rounded-2xl border border-border overflow-x-auto my-8 font-mono text-xs md:text-sm text-primary leading-normal shadow-inner">
                  <code {...props}>{children}</code>
                </pre>
              ) : (
                <code className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md font-mono text-sm" {...props}>
                  {children}
                </code>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary pl-6 py-3 my-8 italic text-ink/75 dark:text-ink-muted bg-primary/5 rounded-r-2xl pr-4">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold inline-flex items-center gap-1 transition-colors">
                {children}
              </a>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-mesh-light dark:bg-mesh-dark transition-colors duration-500 gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      <span className="text-xs text-ink-muted font-bold tracking-widest uppercase animate-pulse">Retrieving article details...</span>
    </div>
  );

  if (!post) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-mesh-light dark:bg-mesh-dark transition-colors duration-500 gap-6 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
        <AlertCircle size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-black mb-2">Article Not Found</h2>
        <p className="text-ink-muted text-sm max-w-sm">The article you are searching for might have been moved or deleted from Firestore.</p>
      </div>
      <Link to="/blog" className="btn-primary px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider">
        Back to Insights
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-mesh-light dark:bg-mesh-dark transition-colors duration-500 text-ink">
      <Navbar />
      
      <main className="pt-28 pb-24">
        
        {/* Header Breadcrumb & Metas */}
        <div className="max-w-4xl mx-auto px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 text-ink-muted hover:text-primary transition-colors mb-8 font-bold text-xs uppercase tracking-widest group">
            <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={14} /> Back to Journals
          </Link>

          <div className="mb-10">
            <div className="flex items-center gap-4 mb-5">
              <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/20">
                {post.category}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-border" />
              <span className="text-ink-muted text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> {post.date}
              </span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-ink/95 mb-6">
              {post.title}
            </h1>
          </div>
        </div>

        {/* Wide Featured Cover Image */}
        <div className="max-w-6xl mx-auto px-6 mb-12">
          <div className="aspect-[21/9] sm:aspect-[16/7] rounded-[2.5rem] overflow-hidden border border-border shadow-2xl bg-surface relative">
            <img 
              src={post.image} 
              alt={post.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </div>

        {/* Grid: Main Body + Sidebar Interactions */}
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Main Body */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Markdown rendering */}
            <article className="pb-12 border-b border-border/60">
              {renderCustomMarkdown(post.content)}
            </article>

            {/* Live Comment Thread and Box */}
            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <MessageCircle size={22} className="text-primary" />
                <h3 className="text-xl font-bold tracking-tight text-ink">
                  Discussion Thread <span className="text-sm font-mono text-ink-muted ml-1.5">({comments.length})</span>
                </h3>
              </div>

              {/* Comments list */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-border/50 bg-surface/5">
                    <p className="text-ink-muted text-xs font-semibold tracking-wider uppercase mb-1">Be the first to share a thought</p>
                    <p className="text-ink-muted/70 text-xs">Write your perspective below to engage with the article.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div 
                      key={comment.id}
                      className="p-5 rounded-2xl bg-surface/15 border border-border/50 flex gap-4 transition-all duration-300 hover:border-primary/10"
                    >
                      <img 
                        src={comment.authorImage || `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.authorName}`} 
                        alt={comment.authorName} 
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-xs font-black tracking-tight">{comment.authorName}</span>
                          <span className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="text-ink/80 text-sm leading-relaxed whitespace-pre-line font-sans">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handlePostComment} className="space-y-4 p-6 bg-surface/5 border border-border/80 rounded-2xl">
                <h4 className="text-xs font-black uppercase tracking-widest text-ink/90">Add your perspective</h4>
                
                {/* Guest name block if not logged in */}
                {!user && (
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Your name for display..."
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-surface/30 focus:bg-surface/50 border border-border focus:border-primary outline-none px-4 py-3 rounded-xl text-xs font-bold transition-all"
                    />
                    <div className="mt-1 text-[9px] text-ink-muted font-mono uppercase">Commenting as guest</div>
                  </div>
                )}

                <textarea
                  required
                  rows={4}
                  placeholder={user ? "Write a respectful response..." : "Sign in or fill name above to write comment..."}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-surface/30 focus:bg-surface/50 border border-border focus:border-primary outline-none p-4 rounded-xl text-sm font-medium transition-all resize-none"
                />

                <div className="flex justify-between items-center">
                  {user ? (
                    <div className="flex items-center gap-2 text-[10px] text-ink-muted font-bold">
                      <img src={user.photoURL || ""} alt={user.displayName} className="w-5 h-5 rounded-full object-cover border border-border" />
                      Logged in as {user.displayName || user.email?.split('@')[0]}
                    </div>
                  ) : (
                    <span className="text-[10px] text-ink-muted font-bold uppercase">Guest comment mode</span>
                  )}
                  <button
                    type="submit"
                    className="btn-primary py-2.5 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px]"
                  >
                    Submit Thought
                  </button>
                </div>
              </form>

            </section>

          </div>

          {/* Interactive Sidebar details */}
          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-28 h-fit">
            
            {/* Author details */}
            <div className="premium-card p-6 border border-border rounded-3xl space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">About The Author</h3>
              <div className="flex items-center gap-4">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop" 
                  alt="Joy Saha" 
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-bold text-lg text-ink">Joy Saha</h4>
                  <p className="text-xs text-ink-muted uppercase tracking-wider font-bold">Full-Stack Engineer</p>
                </div>
              </div>
              <p className="text-ink-muted text-xs leading-relaxed font-sans">
                Bengal-based software designer structuring hyper-polished modular systems, database security schemas, and robust interactive canvases.
              </p>
              
              <div className="flex gap-4 border-t border-border pt-4">
                <a href="#contact" className="btn-primary flex-1 py-3 text-center rounded-xl text-xs font-bold uppercase tracking-widest leading-none">
                  Hire Me
                </a>
              </div>
            </div>

            {/* Sidebar Toolbar Interactions */}
            <div className="premium-card p-6 border border-border rounded-3xl space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Engage & Share</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Like Button */}
                <button
                  onClick={toggleLike}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all duration-300 font-bold ${
                    isLiked
                      ? "bg-red-500/10 border-red-500/30 text-red-500 shadow-sm"
                      : "bg-surface/20 border-border hover:border-red-500/30 hover:text-red-500 text-ink-muted"
                  }`}
                >
                  <Heart size={16} className={isLiked ? "fill-red-500" : ""} />
                  <span className="text-xs font-bold">{likesCount} Likes</span>
                </button>

                {/* Live views display */}
                <div className="py-3 px-4 rounded-xl bg-surface/10 border border-border flex items-center justify-center gap-2 text-ink-muted text-xs font-bold">
                  <Eye size={16} />
                  <span>{post.views || 0} Views</span>
                </div>
              </div>

              {/* Social sharing links */}
              <div className="border-t border-border pt-4 space-y-3 relative">
                <div className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Distribute Knowledge</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleShare('twitter')}
                    className="flex-1 py-2 bg-surface/20 hover:bg-surface/30 border border-border rounded-lg text-xs font-bold transition-all hover:text-primary flex items-center justify-center gap-1.5"
                  >
                    Twitter
                  </button>
                  <button 
                    onClick={() => handleShare('linkedin')}
                    className="flex-1 py-2 bg-surface/20 hover:bg-surface/30 border border-border rounded-lg text-xs font-bold transition-all hover:text-primary flex items-center justify-center gap-1.5"
                  >
                    LinkedIn
                  </button>
                  <button 
                    onClick={() => handleShare('link')}
                    className="flex-1 py-2 bg-surface/20 hover:bg-surface/30 border border-border rounded-lg text-xs font-bold transition-all hover:text-primary flex items-center justify-center gap-1.5"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* Related/Recommend Posts */}
            {relatedPosts.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary">Related Journals</h4>
                <div className="space-y-4">
                  {relatedPosts.map((related) => (
                    <Link 
                      key={related.id} 
                      to={`/blog/${related.slug}`}
                      className="block p-4 bg-surface/15 hover:bg-surface/25 border border-border hover:border-primary/20 rounded-2xl transition-all duration-300 group"
                    >
                      <div className="flex gap-3 items-center">
                        <img src={related.image} alt={related.title} className="w-14 h-14 rounded-xl object-cover border border-border" />
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary">{related.category}</span>
                          <h5 className="text-xs font-bold group-hover:text-primary transition-colors line-clamp-2 leading-snug tracking-tight text-ink/90 mt-1">
                            {related.title}
                          </h5>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      <Footer />

      {/* Shared Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-surface/90 backdrop-blur-md border border-primary/20 text-ink px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span className="text-xs font-bold tracking-tight text-ink/90">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Contact = () => {
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        setProfile(mapProfileData(doc.data()));
      }
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-24">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="text-primary text-[9px] font-black uppercase tracking-[0.3em] mb-6 block"
            >
              Bridge the Gap
            </motion.div>
            <h2 className="text-2xl md:text-5xl font-black mb-4 leading-[0.9] tracking-tight italic">Let's Build <span className="text-gradient-vibrant">Legendary</span></h2>
            <p className="text-ink-muted text-sm leading-relaxed mb-10 italic font-medium">
              Architecting the future requires the right collaborative synergy. Initiate a direct channel below.
            </p>

             <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-ink/40 italic">Digital Inquiry</div>
                <div className="bg-surface p-4 rounded-2xl border border-border flex flex-col gap-2 group hover:border-primary transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="text-primary" size={14} />
                    <span className="text-xs font-black text-ink">{profile?.email || "hello@joysaha.dev"}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-ink/40 italic">Global Access</div>
                <div className="bg-surface p-4 rounded-2xl border border-border flex flex-col gap-2 group hover:border-secondary transition-all shadow-sm">
                  <div className="flex items-center gap-3">
                    <Smartphone className="text-secondary" size={14} />
                    <span className="text-xs font-black text-ink">{profile?.phone || "01863054816"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-ink/40 italic">Operational Base</div>
                <div className="text-xs font-bold bg-surface px-4 py-3 rounded-2xl border border-border flex items-center gap-3 group hover:border-accent transition-all shadow-sm">
                  <Globe className="text-accent" size={14} />
                  <span>{profile?.location || "Global Distribution"}</span>
                </div>
              </div>

              {(profile?.github || profile?.socials?.github || profile?.linkedin || profile?.socials?.linkedin || profile?.twitter || profile?.socials?.twitter) && (
                <div className="space-y-2 sm:col-span-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-ink/40 italic">Social Connections</div>
                  <div className="flex flex-wrap gap-3">
                    {(profile?.github || profile?.socials?.github) && (
                      <a 
                        href={profile.github || profile.socials?.github} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface/80 rounded-xl border border-border transition-colors text-xs font-bold"
                      >
                        <Github size={14} className="text-primary" />
                        <span>GitHub</span>
                      </a>
                    )}
                    {(profile?.linkedin || profile?.socials?.linkedin) && (
                      <a 
                        href={profile.linkedin || profile.socials?.linkedin} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface/80 rounded-xl border border-border transition-colors text-xs font-bold"
                      >
                        <Linkedin size={14} className="text-primary" />
                        <span>LinkedIn</span>
                      </a>
                    )}
                    {(profile?.twitter || profile?.socials?.twitter) && (
                      <a 
                        href={profile.twitter || profile.socials?.twitter} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface/80 rounded-xl border border-border transition-colors text-xs font-bold"
                      >
                        <Twitter size={14} className="text-primary" />
                        <span>Twitter</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="premium-card !p-12"
          >
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-ink/30 italic">Identified As</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-background border-2 border-border rounded-3xl px-8 py-5 focus:outline-none focus:border-primary transition-all font-black text-lg placeholder:text-ink/20"
                    placeholder="Full Name"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-ink/30 italic">Return Channel</label>
                  <input 
                    required
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-background border-2 border-border rounded-3xl px-8 py-5 focus:outline-none focus:border-secondary transition-all font-black text-lg placeholder:text-ink/20"
                    placeholder="Email Address"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/30 italic">Objective</label>
                <input 
                  type="text" 
                  value={formData.subject}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  className="w-full bg-background border-2 border-border rounded-3xl px-8 py-5 focus:outline-none focus:border-accent transition-all font-black text-lg placeholder:text-ink/20"
                  placeholder="Subject"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-ink/30 italic">Narrative</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  className="w-full bg-background border-2 border-border rounded-[2rem] px-8 py-6 focus:outline-none focus:border-premium transition-all resize-none font-black text-lg placeholder:text-ink/20 leading-relaxed"
                  placeholder="Message..."
                />
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={status === "loading"}
                type="submit" 
                className="btn-primary w-full justify-center py-6 text-xl italic shadow-2xl shadow-primary/20"
              >
                {status === "loading" ? "Processing..." : status === "success" ? "Transmission Received!" : "Engage Joy Saha"}
                <Send size={24} className={cn("transition-transform", status === "success" && "translate-x-40 opacity-0")} />
              </motion.button>
              {status === "error" && <p className="text-red-500 font-black text-center text-xs uppercase tracking-widest">Critical Error Occurred. Reset Attempt Recommended.</p>}
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  const [socials, setSocials] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProfile(mapProfileData(data));
        if (Array.isArray(data.socials)) {
          setSocials(data.socials);
        } else if (data.socials && typeof data.socials === 'object') {
          const list = [];
          if (data.socials.github) list.push({ id: "github", icon: "Github", url: data.socials.github });
          if (data.socials.linkedin) list.push({ id: "linkedin", icon: "Linkedin", url: data.socials.linkedin });
          if (data.socials.twitter) list.push({ id: "twitter", icon: "Twitter", url: data.socials.twitter });
          if (data.socials.email) list.push({ id: "email", icon: "Mail", url: `mailto:${data.socials.email}` });
          setSocials(list);
        } else {
          const list = [];
          if (data.github) list.push({ id: "github", icon: "Github", url: data.github });
          if (data.linkedin) list.push({ id: "linkedin", icon: "Linkedin", url: data.linkedin });
          if (data.twitter) list.push({ id: "twitter", icon: "Twitter", url: data.twitter });
          if (data.email) list.push({ id: "email", icon: "Mail", url: `mailto:${data.email}` });
          setSocials(list);
        }
      }
    });
    return () => unsub();
  }, []);

  return (
    <footer className="py-20 relative overflow-hidden bg-surface border-t border-border">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-4 gap-16 mb-20">
          <div className="md:col-span-2">
            <div className="text-3xl font-black tracking-tighter text-primary mb-6 flex items-center gap-2 italic">
              {(() => {
                const brandText = profile?.brandName || profile?.name || "JOY SAHA";
                const brandFirst = brandText.split(' ')[0]?.toUpperCase() || "";
                const brandRest = brandText.split(' ').slice(1).join(' ')?.toUpperCase() || "";
                return (
                  <>
                    {brandFirst}<span className="text-ink">{brandRest}</span>
                  </>
                );
              })()}
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            </div>
            <p className="text-ink-muted text-lg max-w-md italic leading-relaxed">
              Engineering the next generation of digital experiences through technical mastery and obsessive design details.
            </p>
          </div>
          
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-ink/30 mb-8 italic">Explorations</h4>
            <ul className="space-y-4">
              {["Portfolio", "Skills", "Services", "Blog"].map(item => (
                <li key={item}>
                  <a href={`#${item.toLowerCase()}`} className="text-sm font-black text-ink uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2 group">
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-ink/30 mb-8 italic">Connect</h4>
            <div className="flex flex-wrap gap-4">
              {Array.isArray(socials) && socials.map((social) => {
                const icons: Record<string, any> = {
                  Github: Github,
                  Linkedin: Linkedin,
                  Facebook: Facebook,
                  Twitter: Twitter,
                  Mail: Mail
                };
                const Icon = icons[social.icon] || Twitter;
                return (
                  <motion.a 
                    key={social.id} 
                    href={social.url} 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center text-ink-muted hover:text-primary hover:border-primary transition-all shadow-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.name}
                  >
                    <Icon size={20} />
                  </motion.a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-10 border-t border-border flex flex-col md:flex-row items-center justify-between gap-8">
          <p className="text-[10px] font-black text-ink/30 uppercase tracking-[0.4em]">
            © {new Date().getFullYear()} Elite Engineering Initiative // Joy Saha
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-[10px] font-black text-ink/30 uppercase tracking-[0.4em] hover:text-primary transition-colors">Privacy Protocol</a>
            <a href="#" className="text-[10px] font-black text-ink/30 uppercase tracking-[0.4em] hover:text-primary transition-colors">Digital Ethics</a>
          </div>
        </div>
      </div>
      
      {/* Footer Decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-px bg-gradient-to-l from-primary/20 to-transparent" />
      <div className="absolute top-0 right-0 h-1/2 w-px bg-gradient-to-b from-primary/20 to-transparent" />
    </footer>
  );
};

const StoreSection = ({ products, user }: { products: any[], user: any }) => {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState("");

  const categories = ["All", ...new Set(products.map(p => p.category || "Other").filter(Boolean))];

  const filteredProducts = activeCategory === "All" 
    ? products 
    : products.filter(p => (p.category || "Other") === activeCategory);

  const calculateDiscountedPrice = (price: number) => {
    if (!appliedCoupon) return price;
    if (appliedCoupon.discountType === 'percentage') {
      return price - (price * (appliedCoupon.discountValue / 100));
    }
    return Math.max(0, price - appliedCoupon.discountValue);
  };

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponCode) return;
    
    try {
      const q = query(collection(db, "coupons"), where("code", "==", couponCode.toUpperCase()), where("isActive", "==", true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError("Invalid or inactive coupon code.");
        setAppliedCoupon(null);
        return;
      }

      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() as any };
      
      // Check expiry
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError("This coupon has expired.");
        setAppliedCoupon(null);
        return;
      }

      // Check usage limit
      if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
        setCouponError("This coupon has reached its usage limit.");
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(coupon);
      setCouponError("");
    } catch (err) {
      console.error(err);
      setCouponError("Error validating coupon.");
    }
  };

  const handlePurchase = async (product: any) => {
    if (!user) {
      alert("Please login to proceed with purchase.");
      return;
    }
    
    try {
      const finalPrice = calculateDiscountedPrice(product.price);
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalPrice,
          productId: product.id,
          userId: user.uid,
          productTitle: product.title,
          couponId: appliedCoupon?.id || null
        })
      });
      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      console.error(err);
      alert("Payment gateway error.");
    }
  };

  return (
    <section id="store" className="py-12 md:py-16 relative overflow-hidden bg-surface/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 md:mb-16 gap-12">
           <div className="max-w-2xl">
             <motion.div
               initial={{ opacity: 0, scale: 0.8 }}
               whileInView={{ opacity: 1, scale: 1 }}
               className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mb-6 block"
             >
               Digital Marketplace
             </motion.div>
             <h2 className="text-2xl md:text-4xl lg:text-5xl font-black leading-[1.0] tracking-tight mb-4">
               Premium <span className="text-gradient-vibrant">Source Code</span>
             </h2>
             <p className="text-ink-muted text-xl leading-relaxed">
               Acquire field-tested, production-ready website source code to accelerate your development workflow.
             </p>

             <div className="flex flex-wrap gap-3 mt-10">
               {categories.map(cat => (
                 <button
                   key={cat as string}
                   onClick={() => setActiveCategory(cat as string)}
                   className={cn(
                     "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                     activeCategory === cat 
                       ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                       : "bg-surface-accent text-ink/60 hover:bg-primary/10 hover:text-primary"
                   )}
                 >
                   {cat as string}
                 </button>
               ))}
             </div>
           </div>
           <div>
              <div className="flex items-center gap-4 p-4 rounded-3xl bg-primary/5 border border-primary/10">
                 <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                    <Zap size={24} />
                 </div>
                 <div>
                    <div className="text-lg font-bold">Instant Delivery</div>
                    <div className="text-xs opacity-50 uppercase tracking-widest font-black">Post-Payment Unlock</div>
                 </div>
              </div>
           </div>
        </div>

        {products.length === 0 ? (
           <div className="p-20 text-center rounded-[3rem] border-2 border-dashed border-border group hover:border-primary transition-all">
              <ShoppingBag size={80} className="mx-auto mb-6 text-ink/20 group-hover:text-primary transition-colors" />
              <h3 className="text-2xl font-black mb-2 opacity-40 italic">Inventory Loading or Empty</h3>
              <p className="text-ink-muted">Joy is currently preparing elite source code packages for deployment.</p>
           </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredProducts.map((p, idx) => (
               <motion.div 
                 key={p.id}
                 initial={{ opacity: 0, y: 30 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.1 }}
                 className="premium-card group p-0 overflow-hidden flex flex-col h-full"
               >
                  <div className="relative aspect-[16/10] overflow-hidden">
                     <img src={p.preview_image || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800"} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={p.title} />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                     <div className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-primary text-white font-black shadow-xl">
                        ${p.price}
                     </div>
                     <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-surface/80 backdrop-blur-md text-ink text-[10px] font-black uppercase tracking-widest border border-white/20">
                        {p.category || "General"}
                     </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                     <h3 className="text-2xl font-black mb-4 tracking-tight group-hover:text-primary transition-colors">{p.title}</h3>
                     <p className="text-ink-muted text-sm leading-relaxed mb-8 line-clamp-3">
                        {p.description || "A professional-grade source code package designed for high performance and scalability."}
                     </p>
                     
                     <div className="mt-auto space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <a 
                             href={p.live_demo_url} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-border text-xs font-bold hover:bg-surface-accent transition-all"
                           >
                              <ExternalLink size={14} /> Live Demo
                           </a>
                           <button 
                             onClick={() => setSelectedProduct(p)}
                             className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary hover:text-white transition-all"
                           >
                              Details
                           </button>
                        </div>
                        <button 
                          onClick={() => handlePurchase(p)}
                          className="w-full btn-primary py-4 justify-center gap-2 text-lg shadow-xl shadow-primary/20"
                        >
                           <ShoppingCart size={20} /> Buy Source Code
                        </button>
                     </div>
                  </div>
               </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
         {selectedProduct && (
            <Modal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} title={selectedProduct.title}>
               <div className="space-y-8">
                  <img src={selectedProduct.preview_image} className="w-full rounded-2xl aspect-video object-cover shadow-2xl" alt="" />
                  <div className="prose dark:prose-invert max-w-none">
                     <p className="text-lg leading-relaxed text-ink-muted">
                        {selectedProduct.description}
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Base Price</span>
                        <span className={cn("text-3xl font-black transition-all", appliedCoupon ? "text-ink/30 line-through text-xl" : "text-primary")}>${selectedProduct.price}</span>
                     </div>
                     {appliedCoupon && (
                        <div className="flex flex-col text-right">
                           <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Discounted Price</span>
                           <span className="text-3xl font-black text-primary">${calculateDiscountedPrice(selectedProduct.price)}</span>
                        </div>
                     )}
                     {!appliedCoupon && (
                        <div className="flex flex-col text-right">
                           <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Delivery</span>
                           <span className="text-3xl font-black text-secondary">Instant</span>
                        </div>
                     )}
                  </div>

                  {/* Coupon Section */}
                  <div className="p-4 rounded-2xl bg-surface-accent border border-border space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Have a coupon code?</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="SAVE10"
                         value={couponCode}
                         onChange={e => setCouponCode(e.target.value.toUpperCase())}
                         className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm font-bold uppercase"
                       />
                       <button 
                         onClick={handleApplyCoupon}
                         className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform"
                       >
                         Apply
                       </button>
                    </div>
                    {appliedCoupon && (
                      <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                        <CheckCircle size={12} /> Coupon "{appliedCoupon.code}" applied successfully!
                      </p>
                    )}
                    {couponError && (
                      <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                        <AlertCircle size={12} /> {couponError}
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={() => { handlePurchase(selectedProduct); setSelectedProduct(null); }}
                    className="w-full btn-primary py-5 justify-center text-xl"
                  >
                     <ShoppingCart size={24} /> {appliedCoupon ? "Confirm & Pay Discounted" : "Confirm & Pay with UddoktaPay"}
                  </button>
               </div>
            </Modal>
         )}
      </AnimatePresence>
    </section>
  );
};

// --- Main App ---

const PortfolioPage = ({ user }: { user: any }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubProfile = onSnapshot(doc(db, "settings", "portfolio"), (doc) => {
      if (doc.exists()) {
        setProfile(mapProfileData(doc.data()));
      }
    });
    return () => {
      unsubProducts();
      unsubProfile();
    };
  }, []);

  const isVisible = (key: string) => {
    return profile?.sectionVisibility?.[key] !== false;
  };

  return (
    <div className="bg-mesh-light dark:bg-mesh-dark transition-colors duration-500">
      <Navbar />
      <main>
        <Hero />
        {isVisible("contact") && (
          <section id="about" className="py-12 md:py-16">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="aspect-square rounded-3xl overflow-hidden border border-border">
                    <img 
                      src={profile?.aboutImage || "https://picsum.photos/seed/workspace/800/800"} 
                      alt="Workspace" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-3xl overflow-hidden border-8 border-background hidden md:block">
                    <img 
                      src={profile?.aboutImageSmall || "https://picsum.photos/seed/code/400/400"} 
                      alt="Code" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </motion.div>
                
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-8">{profile?.aboutTitle || "Passionate about building impactful digital experiences."}</h2>
                  <p className="text-ink-muted text-lg mb-8 leading-relaxed">
                    {profile?.aboutDescription || portfolioData.about}
                  </p>
                  <div className="grid grid-cols-2 gap-8 mb-12">
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{profile?.stat1Value || "99%"}</div>
                      <div className="text-sm text-ink-muted uppercase font-bold tracking-widest">{profile?.stat1Label || "Client Satisfaction"}</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-secondary mb-1">{profile?.stat2Value || "24/7"}</div>
                      <div className="text-sm text-ink-muted uppercase font-bold tracking-widest">{profile?.stat2Label || "Technical Support"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        {isVisible("store") && <StoreSection products={products} user={user} />}
        {isVisible("skills") && <Skills />}
        {isVisible("experience") && <ExperienceSection />}
        {isVisible("education") && <EducationSection />}
        <section id="process" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="section-title">My Work Process</h2>
              <p className="text-ink-muted max-w-2xl mx-auto">
                A systematic approach to delivering high-quality digital solutions.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: "01", title: "Discovery", desc: "Understanding your vision, goals, and project requirements." },
                { step: "02", title: "Planning", desc: "Architecting the solution and defining the technical roadmap." },
                { step: "03", title: "Development", desc: "Building the product with clean code and modern standards." },
                { step: "04", title: "Deployment", desc: "Rigorous testing and launching your product to the world." },
              ].map((item, idx) => (
                <div key={item.step} className="relative">
                  <div className="text-6xl font-bold text-primary/5 absolute -top-8 -left-4 select-none">{item.step}</div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                    <p className="text-ink-muted text-sm leading-relaxed">{item.desc}</p>
                  </div>
                  {idx < 3 && <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-primary/10" />}
                </div>
              ))}
            </div>
          </div>
        </section>
        {isVisible("services") && <Services />}
        {isVisible("portfolio") && <Portfolio />}
        {isVisible("gallery") && <Gallery />}
        {isVisible("testimonials") && <Testimonials />}
        {isVisible("blog") && <Blog />}
        {isVisible("contact") && <Contact />}
      </main>
      <Footer />
    </div>
  );
};

