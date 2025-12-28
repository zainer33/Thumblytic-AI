
import React, { useState, useEffect, useRef } from 'react';
import { 
  supabase, 
  syncProfile, 
  saveGeneration, 
  adminFetchAllProfiles, 
  adminFetchAllGenerationsCount, 
  adminUpdateUserPlan,
  adminFetchAllAppeals,
  adminUpdateUserStatus,
  adminUpdateAppealStatus,
  adminResetAllProfilesToFree,
  createAppeal,
  UserProfile, 
  GenerationRecord,
  PlanAppeal
} from './lib/supabase';
import { StylePreset, Emotion, ThumbnailConfig, GenerationState, AISuggestion } from './types';
import { LOADING_MESSAGES } from './constants';
import Button from './components/Button';
import Card from './components/Card';
import Auth from './components/Auth';
import { generateThumbnail, getAiSuggestions, editImage } from './services/geminiService';
import { 
  Download, Image as ImageIcon, Zap, Shield, Sparkles, Wand2, 
  CheckCircle2, AlertTriangle, X, PlusCircle, LogOut, CreditCard, 
  History as HistoryIcon, LayoutDashboard, Crown, Clock, Users, Activity, 
  RefreshCw, Mail, Check, Ban, Star, Copy, Database, Upload, Trash2, Phone, AlertOctagon, Key, ExternalLink
} from 'lucide-react';

// Removed manual 'aistudio' declaration to avoid conflicts with global AIStudio type definition

type Tab = 'dashboard' | 'history' | 'price' | 'admin';

const ADMIN_EMAIL = 'zainichaudhary83@gmail.com';
const JAZZCASH_NUMBER = '03007211813';

const SQL_INIT_SCRIPT = `-- RUN IN SUPABASE SQL EDITOR
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  credits INTEGER DEFAULT 3,
  plan TEXT DEFAULT 'free',
  is_suspended BOOLEAN DEFAULT false,
  last_credit_reset DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  image_url TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  requested_plan TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [appeals, setAppeals] = useState<PlanAppeal[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [totalGens, setTotalGens] = useState(0);
  
  const [appealPlan, setAppealPlan] = useState('pro');
  const [appealMessage, setAppealMessage] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);

  const [config, setConfig] = useState<ThumbnailConfig>({
    topic: 'How I Built a $10k/mo Business with AI',
    style: StylePreset.CINEMATIC,
    emotion: Emotion.AUTHORITY,
    textOnThumbnail: '$10k/MO SECRETS',
    colors: 'Neon blue and metallic silver',
    faceType: 'Yes',
    aspectRatio: '16:9',
    subjectGlow: true
  });

  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [editInstructions, setEditInstructions] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<GenerationState>({
    loading: false,
    error: null,
    imageUrl: null,
    statusMessage: ''
  });

  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      // Check API Key status
      if (typeof (window as any).aistudio !== 'undefined') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey && !process.env.API_KEY) {
          setNeedsKey(true);
        }
      }

      // Check Session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) await loadUserData(session.user);
      else setIsAuthLoading(false);
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) await loadUserData(session.user);
      else {
        setProfile(null);
        setHistory([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (user: any) => {
    try {
      const prof = await syncProfile(user);
      if (prof) setProfile(prof);
      
      const { data: gens } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (gens) setHistory(gens);
      
      if (user.email === ADMIN_EMAIL) {
        loadAdminData();
      }
    } catch (err) {
      console.error("User sync failure:", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loadAdminData = async () => {
    setAdminError(null);
    setIsAdminLoading(true);
    try {
      const users = await adminFetchAllProfiles();
      const allAppeals = await adminFetchAllAppeals();
      const count = await adminFetchAllGenerationsCount();
      setAllUsers(users);
      setAppeals(allAppeals);
      setTotalGens(count);
    } catch (e: any) {
      console.error("Admin data fetch failed", e);
      setAdminError(e.message || "Access Restricted: Potential Database Schema Failure.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleConnectKey = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      await (window as any).aistudio.openSelectKey();
      // Assume success as per race condition notes
      setNeedsKey(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleGenerate = async () => {
    if (!config.topic) return;
    if (profile && profile.plan === 'free' && (profile.credits || 0) <= 0) {
      setActiveTab('price');
      return;
    }

    setState({
      loading: true,
      error: null,
      imageUrl: null,
      statusMessage: LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
    });

    try {
      const url = await generateThumbnail(config);
      const newGen = await saveGeneration(session.user.id, config.topic, url, config);
      
      setState({ loading: false, error: null, imageUrl: url, statusMessage: 'Neural Asset Rendered!' });
      
      if (newGen) {
        setHistory(prev => [newGen, ...prev]);
        const { data: updatedProf } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (updatedProf) setProfile(updatedProf);
      }
    } catch (err: any) {
      setState({ loading: false, error: err.message, imageUrl: null, statusMessage: '' });
    }
  };

  const handleFile = (file: File) => {
    if (sourceImages.length >= 3) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImages(prev => [...prev, e.target?.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        handleFile(file);
      }
    });
  };

  const submitAppeal = async () => {
    if (!appealMessage) return;
    setIsAppealing(true);
    try {
      await createAppeal(session.user.id, session.user.email, appealPlan, appealMessage);
      alert("Upgrade request transmitted. Administration will verify your JazzCash payment and activate the tier.");
      setAppealMessage('');
    } catch (e) {
      alert("Transmission failed. Please retry.");
    } finally {
      setIsAppealing(false);
    }
  };

  const handleUpgradeClick = (plan: string) => {
    setAppealPlan(plan);
    setAppealMessage(`I am requesting an upgrade to the ${plan.toUpperCase()} tier. I have sent the payment via JazzCash. Transaction ID: `);
    const element = document.getElementById('appeal-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleResetAllPlans = async () => {
    const confirmed = window.confirm("NUCLEAR PROTOCOL: This will downgrade ALL users to the FREE tier and reset their credits. This cannot be undone. Proceed?");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      await adminResetAllProfilesToFree();
      alert("All user plans have been revoked. Database reset complete.");
      await loadAdminData();
    } catch (e) {
      alert("Database reset protocol failed.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleSuspension = async (userId: string, currentStatus: boolean) => {
    try {
      await adminUpdateUserStatus(userId, !currentStatus);
      loadAdminData();
    } catch (e) {
      alert("Action Failed");
    }
  };

  const handleAdminApproveAppeal = async (appeal: PlanAppeal) => {
    try {
      await adminUpdateUserPlan(appeal.user_id, appeal.requested_plan as any);
      await adminUpdateAppealStatus(appeal.id, 'approved');
      loadAdminData();
      alert("Appeal Approved & Plan Granted");
    } catch (e) {
      alert("Approval Process Error");
    }
  };

  const handleAdminPlanChange = async (userId: string, plan: 'free' | 'pro' | 'elite') => {
    try {
      await adminUpdateUserPlan(userId, plan);
      loadAdminData();
    } catch (e) {
      alert("Failed to update user plan.");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <Zap className="w-12 h-12 text-indigo-500 animate-pulse fill-current" />
      </div>
    );
  }

  if (needsKey) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full glass p-10 rounded-[48px] border border-indigo-500/20 shadow-2xl animate-in fade-in zoom-in duration-500">
           <div className="w-20 h-20 bg-indigo-500/10 rounded-[32px] flex items-center justify-center border border-indigo-500/30 mx-auto mb-8">
              <Key className="w-10 h-10 text-indigo-400" />
           </div>
           <h1 className="text-3xl font-black text-white tracking-tight mb-4 uppercase">Neural Link Required</h1>
           <p className="text-sm text-gray-400 mb-10 leading-relaxed">
             The Thumblytic engine requires a secure connection to the Gemini AI API to generate high-converting assets.
           </p>
           <div className="space-y-4">
              <Button onClick={handleConnectKey} className="w-full h-16 rounded-3xl text-xs font-black uppercase tracking-widest" leftIcon={<Zap className="w-5 h-5" />}>
                Initialize Secure Connection
              </Button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors mt-4"
              >
                <ExternalLink className="w-3 h-3" /> Billing Protocol Documentation
              </a>
           </div>
        </div>
      </div>
    );
  }

  if (!session) return <Auth />;

  if (profile?.is_suspended) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-6 text-center">
        <Ban className="w-20 h-20 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-black text-white mb-2">ACCESS TERMINATED</h1>
        <p className="text-gray-400 max-w-md">Your neural link has been severed by the administration for protocol violations.</p>
        <Button variant="outline" className="mt-8" onClick={handleLogout}>Log Out</Button>
      </div>
    );
  }

  const isAdmin = session.user.email === ADMIN_EMAIL;

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <Zap className="text-white w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Thumblytic<span className="text-indigo-400">.ai</span></h1>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Neural Design Studio</p>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-8">
          <button onClick={() => setActiveTab('dashboard')} className={`text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'dashboard' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-white'}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button onClick={() => setActiveTab('history')} className={`text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-white'}`}>
            <HistoryIcon className="w-4 h-4" /> History
          </button>
          <button onClick={() => setActiveTab('price')} className={`text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'price' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-white'}`}>
            <CreditCard className="w-4 h-4" /> Price
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'admin' ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-white'}`}>
              <Shield className="w-4 h-4" /> Command
            </button>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 border-r border-white/10">
            <div className="text-right">
              <p className="text-[10px] font-black text-white uppercase tracking-tighter">{profile?.credits ?? 0} Credits</p>
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{profile?.plan ?? 'Initializing...'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 bg-gray-950 custom-scrollbar">
        {activeTab === 'dashboard' ? (
          <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
            <aside className="w-full lg:w-[400px] flex flex-col gap-6">
              <div className="flex p-1.5 bg-gray-900/50 border border-white/10 rounded-3xl">
                <button onClick={() => setStudioMode('create')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-[0.2em] ${studioMode === 'create' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-gray-500 hover:text-gray-300'}`}>
                  Neural Render
                </button>
                <button onClick={() => setStudioMode('edit')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-[0.2em] ${studioMode === 'edit' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-gray-500 hover:text-gray-300'}`}>
                  Morph Assets
                </button>
              </div>

              {studioMode === 'create' ? (
                <Card title="Design Parameters" className="shadow-2xl">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Core Concept</label>
                          <button onClick={async () => {
                             if (!config.topic) return;
                             setIsSuggesting(true);
                             try {
                               const res = await getAiSuggestions(config.topic);
                               setSuggestion(res);
                             } finally {
                               setIsSuggesting(false);
                             }
                          }} className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-2 hover:text-indigo-300 transition-colors">
                            <Wand2 className={`w-3.5 h-3.5 ${isSuggesting ? 'animate-spin' : ''}`} /> CTR Optimize
                          </button>
                       </div>
                       <textarea
                        className="w-full bg-gray-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none h-32 transition-all resize-none shadow-inner"
                        placeholder="Explain your video idea for viral mapping..."
                        value={config.topic}
                        onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                      />
                    </div>

                    {suggestion && (
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-2 mb-3">
                           <Sparkles className="w-4 h-4 text-indigo-400" />
                           <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Growth Recommendation</p>
                        </div>
                        <p className="text-xs text-white font-medium mb-4 italic">"{suggestion.suggestedText}"</p>
                        <button className="w-full h-9 bg-indigo-600 text-white text-[10px] font-black tracking-widest rounded-xl hover:bg-indigo-700 transition-colors" onClick={() => {
                          setConfig({...config, textOnThumbnail: suggestion.suggestedText, style: suggestion.suggestedStyle, emotion: suggestion.suggestedEmotion});
                          setSuggestion(null);
                        }}>Inject Strategy</button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Aesthetic</label>
                        <select className="w-full bg-gray-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500" value={config.style} onChange={(e) => setConfig({ ...config, style: e.target.value as StylePreset })}>
                          {Object.values(StylePreset).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Emotional Hook</label>
                        <select className="w-full bg-gray-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500" value={config.emotion} onChange={(e) => setConfig({ ...config, emotion: e.target.value as Emotion })}>
                          {Object.values(Emotion).map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Overlay Content</label>
                      <input 
                        type="text"
                        className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="MAX 4 WORDS FOR CTR"
                        value={config.textOnThumbnail}
                        onChange={(e) => setConfig({...config, textOnThumbnail: e.target.value})}
                      />
                    </div>

                    <Button onClick={handleGenerate} className="w-full h-16 rounded-[24px] text-xs font-black uppercase tracking-[0.2em]" isLoading={state.loading} disabled={profile?.plan === 'free' && (profile.credits || 0) <= 0} leftIcon={<Sparkles className="w-5 h-5 fill-current" />}>
                      {profile?.plan === 'free' && profile?.credits === 0 ? 'Fuel Depleted (See Pricing)' : 'Render Neural Design'}
                    </Button>
                    
                    {profile?.plan === 'free' && (
                      <div className="flex items-center justify-center gap-3 bg-white/5 p-3 rounded-2xl">
                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{width: `${((profile.credits || 0) / 3) * 100}%`}}></div>
                        </div>
                        <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">
                          {profile.credits || 0}/3 Remaining
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card title="Step 01: Ingestion" description="Provide source materials for transformation." className="shadow-2xl">
                     <div className="space-y-6">
                        <div 
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`
                            relative h-48 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group
                            ${isDragging ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'bg-gray-900/50 border-white/10 hover:border-white/20 hover:bg-gray-900/80'}
                            ${sourceImages.length >= 3 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                          `}
                        >
                           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              files.forEach(handleFile);
                           }} />
                           
                           <div className={`p-4 rounded-2xl bg-white/5 transition-transform group-hover:scale-110 ${isDragging ? 'scale-110 bg-indigo-500/20' : ''}`}>
                              <Upload className={`w-8 h-8 ${isDragging ? 'text-indigo-400' : 'text-gray-500'}`} />
                           </div>
                           <div className="text-center">
                              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDragging ? 'text-indigo-400' : 'text-gray-400'}`}>
                                 {isDragging ? 'Drop into Neural Field' : 'Drag or Click to Upload'}
                              </p>
                              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">
                                 {sourceImages.length}/3 Assets Managed
                              </p>
                           </div>
                        </div>

                        {sourceImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-3">
                             {sourceImages.map((img, i) => (
                               <div key={i} className="aspect-square relative rounded-2xl overflow-hidden border border-white/10 shadow-xl group">
                                  <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setSourceImages(prev => prev.filter((_, idx) => idx !== i));
                                       }}
                                       className="p-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg"
                                     >
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                               </div>
                             ))}
                          </div>
                        )}
                     </div>
                  </Card>

                  <Card title="Step 02: Synthesis Directive" description="Define the transformation protocol." className="shadow-2xl">
                     <div className="space-y-6">
                        <div className="space-y-4">
                           <div className="flex flex-wrap gap-2">
                              {['Swap Face', 'Change Background', 'Add Subject Glow', 'Style Shift'].map(tag => (
                                <button 
                                  key={tag}
                                  onClick={() => setEditInstructions(prev => prev + (prev ? ', ' : '') + tag)}
                                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-gray-400 uppercase tracking-widest hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                                >
                                   + {tag}
                                </button>
                              ))}
                           </div>
                           <div className="relative">
                              <textarea 
                                 className="w-full bg-gray-950 border border-white/10 rounded-2xl p-5 text-xs text-white focus:ring-2 focus:ring-indigo-500/50 outline-none h-32 resize-none shadow-inner" 
                                 placeholder="E.g. Transform background into a futuristic space station, keeping the main subject sharp..." 
                                 value={editInstructions} 
                                 onChange={e => setEditInstructions(e.target.value)} 
                              />
                              <div className="absolute bottom-4 right-4 text-[9px] font-black text-gray-600 uppercase tracking-widest pointer-events-none">
                                 Directive Buffer
                              </div>
                           </div>
                        </div>

                        <Button 
                          className="w-full h-16 rounded-[24px] text-xs font-black uppercase tracking-[0.2em]" 
                          disabled={sourceImages.length === 0 || !editInstructions} 
                          isLoading={state.loading} 
                          onClick={async () => {
                            setState({loading: true, statusMessage: "Synthesizing new reality...", error: null, imageUrl: null});
                            try {
                              const url = await editImage(sourceImages, editInstructions);
                              const newGen = await saveGeneration(session.user.id, "Morph Synthesis", url, {style: 'Neural Morph'});
                              setState({loading: false, imageUrl: url, statusMessage: "Synthesis Complete!", error: null});
                              if (newGen) setHistory(prev => [newGen, ...prev]);
                            } catch(e: any) {
                              setState({loading: false, statusMessage: "", error: e.message, imageUrl: null});
                            }
                          }}
                        >
                          Execute Synthesis
                        </Button>
                     </div>
                  </Card>
                </div>
              )}
            </aside>

            {/* Neural Viewport */}
            <section className="flex-1 flex flex-col gap-6 min-h-[600px]">
              <div className="flex-1 glass rounded-[48px] border border-white/10 relative flex flex-col items-center justify-center overflow-hidden shadow-2xl bg-[#020617]">
                <div className="absolute top-8 right-8 flex gap-3 z-10">
                   <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Neural Engine v3.1</span>
                   </div>
                </div>

                {state.loading ? (
                   <div className="text-center space-y-8 animate-pulse">
                     <div className="relative">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] animate-spin-slow mx-auto flex items-center justify-center border border-indigo-500/30">
                          <Sparkles className="w-12 h-12 text-indigo-500" />
                        </div>
                        <div className="absolute inset-0 w-24 h-24 bg-indigo-500/10 blur-3xl mx-auto"></div>
                     </div>
                     <p className="text-3xl font-black text-white tracking-tighter uppercase">{state.statusMessage}</p>
                   </div>
                ) : state.imageUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-12 group relative animate-in fade-in zoom-in-95 duration-1000">
                    <img src={state.imageUrl} className="max-w-full max-h-[85%] rounded-[40px] shadow-[0_0_120px_rgba(79,70,229,0.2)] border border-white/10 transition-all duration-700 hover:scale-[1.02]" alt="Neural Output" />
                    
                    <div className="mt-10 flex gap-6">
                       <Button size="lg" className="rounded-3xl h-16 px-10 shadow-indigo-600/30" onClick={() => {
                          const a = document.createElement('a'); a.href = state.imageUrl!; a.download = 'thumblytic-render.png'; a.click();
                       }} leftIcon={<Download className="w-5 h-5" />}>Neural Export (4K)</Button>
                       <Button size="lg" variant="secondary" className="rounded-3xl h-16 px-10 border-white/10" onClick={() => {
                          setState({loading: false, error: null, imageUrl: null, statusMessage: ''});
                       }} leftIcon={<RefreshCw className="w-5 h-5" />}>Flush Buffer</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center opacity-40 group hover:opacity-100 transition-all duration-700">
                    <div className="w-36 h-36 border-4 border-dashed border-gray-900 rounded-[56px] flex items-center justify-center mx-auto mb-10 transition-colors group-hover:border-indigo-500/20">
                       <ImageIcon className="w-16 h-16 text-gray-800 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 group-hover:text-white transition-colors uppercase tracking-widest">Viewport Standby</h3>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-2">Initialize design protocol to see output</p>
                  </div>
                )}
                
                {state.error && (
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 px-8 py-4 rounded-3xl flex items-center gap-4 animate-in slide-in-bottom-4 shadow-2xl">
                     <AlertTriangle className="w-6 h-6 text-red-500" />
                     <p className="text-sm font-black text-red-400 uppercase tracking-widest">{state.error}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : activeTab === 'history' ? (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center border-b border-white/5 pb-8">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
                  <HistoryIcon className="w-10 h-10 text-indigo-500" /> Neural Archive
                </h2>
                <p className="text-gray-400 mt-1">Access your generated viral assets from the neural database.</p>
              </div>
              <Button onClick={() => setActiveTab('dashboard')} size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>New Design</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {history.map((item) => (
                <div key={item.id} className="glass rounded-[32px] overflow-hidden group border border-white/5 hover:border-indigo-500/50 transition-all shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-2 duration-500">
                  <div className="aspect-video relative overflow-hidden bg-gray-900">
                    <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={item.topic} />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                       <Button size="sm" className="rounded-2xl" onClick={() => {
                         const a = document.createElement('a'); a.href = item.image_url; a.download = 'thumblytic-viral.png'; a.click();
                       }} leftIcon={<Download className="w-4 h-4" />}>Export Studio Quality</Button>
                    </div>
                  </div>
                  <div className="p-6 bg-white/[0.02]">
                    <p className="text-xs font-black text-white truncate mb-3">{item.topic}</p>
                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01]">
                   <ImageIcon className="w-16 h-16 text-gray-800 mx-auto mb-6" />
                   <p className="text-gray-500 uppercase tracking-[0.4em] font-black text-[10px]">Neural Archive Offline</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'price' ? (
          <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700 py-10">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                <Crown className="w-4 h-4" /> Strategic Infrastructure
              </div>
              <h2 className="text-6xl font-black text-white tracking-tighter leading-none">Choose Your Operational Tier</h2>
              
              <div className="glass inline-flex flex-col items-center p-6 rounded-[32px] border border-white/5 mt-8 max-w-lg mx-auto bg-indigo-500/5">
                <div className="flex items-center gap-3 mb-4">
                   <Phone className="w-6 h-6 text-indigo-400" />
                   <p className="text-lg font-black text-white tracking-widest uppercase">Payment Protocol</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">JazzCash Verification Center</p>
                  <p className="text-3xl font-black text-white tracking-widest bg-black/40 px-6 py-3 rounded-2xl border border-white/10">{JAZZCASH_NUMBER}</p>
                  <p className="text-[10px] text-gray-400 mt-4 text-center font-bold">Transfer required tier amount to this account, then submit your request below with the transaction ID for neural validation.</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              {/* Free Card */}
              <div className="glass p-12 rounded-[48px] border border-white/5 flex flex-col group hover:bg-white/[0.03] transition-all duration-500">
                <div className="mb-12">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-6">Standard Entry</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black text-white">$0</span>
                    <span className="text-gray-500 font-bold text-xs tracking-widest uppercase">/Daily</span>
                  </div>
                </div>
                <ul className="space-y-6 flex-1 mb-12">
                  <li className="flex items-center gap-4 text-sm text-gray-400 font-bold"><CheckCircle2 className="w-6 h-6 text-indigo-500" /> 3 Neural Credits / Day</li>
                  <li className="flex items-center gap-4 text-sm text-gray-400 font-bold"><CheckCircle2 className="w-6 h-6 text-indigo-500" /> Standard Render</li>
                </ul>
                <Button variant="outline" disabled className="w-full h-16 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em]">Current Active Tier</Button>
              </div>

              {/* Pro Card */}
              <div className="glass p-12 rounded-[48px] border-2 border-indigo-500/50 flex flex-col relative scale-110 shadow-[0_0_100px_rgba(79,70,229,0.15)] bg-[#020617]">
                <div className="absolute top-8 right-8 px-4 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2">
                  <Star className="w-3 h-3 fill-current" /> Best Value
                </div>
                <div className="mb-12">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6">Neural Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black text-white">PKR 50</span>
                    <span className="text-gray-500 font-bold text-xs tracking-widest uppercase">/One-time</span>
                  </div>
                </div>
                <ul className="space-y-6 flex-1 mb-12">
                  <li className="flex items-center gap-4 text-sm text-white font-black"><CheckCircle2 className="w-6 h-6 text-indigo-500" /> 10 Neural Credits</li>
                  <li className="flex items-center gap-4 text-sm text-white font-black"><CheckCircle2 className="w-6 h-6 text-indigo-500" /> 4K Ultra Cinematic Export</li>
                </ul>
                <Button className="w-full h-16 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => handleUpgradeClick('pro')}>Request Pro Tier</Button>
              </div>

              {/* Elite Card */}
              <div className="glass p-12 rounded-[48px] border border-white/5 flex flex-col group hover:bg-white/[0.03] transition-all duration-500">
                <div className="mb-12">
                  <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-6">Studio Elite</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black text-white">PKR 100</span>
                    <span className="text-gray-500 font-bold text-xs tracking-widest uppercase">/One-time</span>
                  </div>
                </div>
                <ul className="space-y-6 flex-1 mb-12">
                  <li className="flex items-center gap-4 text-sm text-gray-300 font-black"><CheckCircle2 className="w-6 h-6 text-amber-500" /> Unlimited Neural Rendering</li>
                  <li className="flex items-center gap-4 text-sm text-gray-300 font-black"><CheckCircle2 className="w-6 h-6 text-amber-500" /> Private Style Models</li>
                </ul>
                <Button onClick={() => handleUpgradeClick('elite')} variant="secondary" className="w-full h-16 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em]">Request Elite</Button>
              </div>
            </div>

            <div id="appeal-section" className="max-w-3xl mx-auto glass p-10 rounded-[48px] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
               <div className="flex items-center gap-6 mb-10">
                  <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                     <Mail className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black text-white tracking-tight">Tier Acquisition Protocol</h3>
                     <p className="text-sm text-gray-400">Transmit your transaction ID for neural validation.</p>
                  </div>
               </div>
               
               <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Requested Operational Tier</label>
                       <select 
                         value={appealPlan}
                         onChange={(e) => setAppealPlan(e.target.value)}
                         className="w-full bg-gray-900/50 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                       >
                          <option value="pro">Pro Engine (PKR 50)</option>
                          <option value="elite">Elite Infrastructure (PKR 100)</option>
                          <option value="custom">Custom Commercial Protocol</option>
                       </select>
                    </div>
                    <div className="p-5 bg-black/40 border border-white/5 rounded-2xl">
                       <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Instructions</p>
                       <p className="text-xs text-gray-400 leading-relaxed">Send the exact amount to <span className="text-white font-bold">{JAZZCASH_NUMBER}</span>. Provide the TID below. Activation takes 2-4 neural cycles (hours).</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Transaction Verification Message</label>
                       <textarea 
                          value={appealMessage}
                          onChange={(e) => setAppealMessage(e.target.value)}
                          className="w-full bg-gray-900/50 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 h-40 resize-none"
                          placeholder="Paste your JazzCash Transaction ID here..."
                       />
                    </div>
                    <Button 
                      onClick={submitAppeal}
                      isLoading={isAppealing}
                      disabled={!appealMessage}
                      className="w-full h-16 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      Transmit For Validation
                    </Button>
                  </div>
               </div>
            </div>
          </div>
        ) : activeTab === 'admin' && isAdmin ? (
          <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500">
            {adminError ? (
               <div className="glass rounded-[48px] p-16 border border-red-500/30 bg-red-500/5 shadow-2xl">
                  <div className="flex items-start gap-8">
                     <div className="w-20 h-20 bg-red-500/20 rounded-[32px] flex items-center justify-center border border-red-500/30">
                        <Database className="w-10 h-10 text-red-500" />
                     </div>
                     <div className="flex-1 space-y-6">
                        <div>
                           <h2 className="text-3xl font-black text-white tracking-tight">Neural Database Disconnected</h2>
                           <p className="text-red-400 font-bold mt-2 uppercase tracking-widest text-xs">Error: {adminError}</p>
                        </div>
                        
                        <div className="p-8 bg-black/50 border border-white/5 rounded-[32px] space-y-4">
                           <div className="flex justify-between items-center">
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Required Initialization Protocol</p>
                              <button 
                                onClick={() => { navigator.clipboard.writeText(SQL_INIT_SCRIPT); alert("SQL Protocol Copied!"); }}
                                className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2 hover:text-white"
                              >
                                <Copy className="w-3 h-3" /> Copy Script
                              </button>
                           </div>
                           <pre className="text-[10px] text-gray-400 font-mono bg-gray-950 p-6 rounded-2xl overflow-x-auto custom-scrollbar">
                              {SQL_INIT_SCRIPT}
                           </pre>
                           <p className="text-xs text-gray-500 italic">Run this script in your Supabase SQL Editor to initialize the required tables and schema cache.</p>
                        </div>

                        <div className="flex gap-4">
                           <Button onClick={loadAdminData} isLoading={isAdminLoading} leftIcon={<RefreshCw className="w-4 h-4" />}>Retry Sync</Button>
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
              <div className="space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-8">
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                      <Shield className="w-10 h-10 text-indigo-500" /> Command Center
                    </h2>
                  </div>
                  <div className="flex gap-4">
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={handleResetAllPlans} 
                      isLoading={isResetting}
                      leftIcon={<AlertOctagon className="w-4 h-4" />}
                      className="bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600 hover:text-white"
                    >
                      Reset All Plans
                    </Button>
                    <div className="glass px-6 py-2 rounded-xl flex items-center gap-3">
                       <Activity className="w-5 h-5 text-purple-400" />
                       <div>
                         <p className="text-[10px] font-bold text-gray-500 uppercase">System Renders</p>
                         <p className="text-lg font-black text-white">{totalGens}</p>
                       </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={loadAdminData} isLoading={isAdminLoading} leftIcon={<RefreshCw className="w-4 h-4" />}>Sync Data</Button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                     <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest"><Users className="w-5 h-5" /> User Directory</h3>
                     <div className="glass rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-white/5 text-[10px] uppercase font-black tracking-widest text-gray-400">
                              <th className="px-6 py-4">Identity</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Plan</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {allUsers.map(u => (
                              <tr key={u.id} className="text-sm text-gray-300 hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                  <p className="font-bold text-white">{u.full_name}</p>
                                  <p className="text-[10px] text-gray-500">{u.email}</p>
                                </td>
                                <td className="px-6 py-4">
                                  {u.is_suspended ? <span className="text-red-500 text-[10px] font-black uppercase">Suspended</span> : <span className="text-green-500 text-[10px] font-black uppercase">Active</span>}
                                </td>
                                <td className="px-6 py-4">
                                  <select 
                                    className="bg-gray-900 border border-white/10 rounded-lg p-1.5 text-[10px] font-black uppercase"
                                    value={u.plan}
                                    onChange={(e) => handleAdminPlanChange(u.id, e.target.value as any)}
                                  >
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="elite">Elite</option>
                                  </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button onClick={() => handleToggleSuspension(u.id, !!u.is_suspended)} className="p-2 hover:text-red-500">
                                    {u.is_suspended ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest"><Mail className="w-5 h-5" /> Upgrade Requests</h3>
                     <div className="space-y-4">
                        {appeals.filter(a => a.status === 'pending').map(appeal => (
                          <div key={appeal.id} className="glass p-5 rounded-3xl border border-indigo-500/20 bg-indigo-500/5">
                             <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-black text-white">{appeal.user_email}</p>
                                <span className="text-[9px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-black uppercase">{appeal.requested_plan}</span>
                             </div>
                             <div className="bg-black/40 p-3 rounded-xl mb-4 border border-white/5">
                                <p className="text-[10px] text-gray-400 leading-relaxed whitespace-pre-wrap">{appeal.message}</p>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => handleAdminApproveAppeal(appeal)} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors">Verify & Grant</button>
                                <button onClick={async () => { await adminUpdateAppealStatus(appeal.id, 'rejected'); loadAdminData(); }} className="flex-1 py-2 rounded-xl border border-white/10 text-gray-500 text-[10px] font-black uppercase hover:text-white hover:bg-white/5 transition-colors">Deny</button>
                             </div>
                          </div>
                        ))}
                        {appeals.filter(a => a.status === 'pending').length === 0 && (
                          <div className="py-20 text-center glass rounded-3xl opacity-40">
                             <Mail className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                             <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">No Pending Validation Requests</p>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>

      <footer className="px-8 py-6 flex flex-col md:flex-row items-center justify-between border-t border-white/5 glass text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] gap-6">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-3">&copy; 2025 Neural Copyright &middot; lazyy.</span>
          <span className="h-4 w-px bg-white/10 hidden md:block"></span>
          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" /> Quantum Protocol</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
