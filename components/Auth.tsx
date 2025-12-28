
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, Mail, Lock, User, AlertCircle, Sparkles } from 'lucide-react';
import Button from './Button';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginErr) throw loginErr;
      } else {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (signUpErr) throw signUpErr;
        // Supabase sends confirmation email by default unless disabled in dashboard
        setError("Account created! Please check your email for verification.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full animate-pulse delay-1000"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/20 mb-6 animate-bounce">
            <Zap className="text-white w-8 h-8 fill-current" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            Thumblytic<span className="text-indigo-400">.ai</span>
          </h1>
          <p className="text-gray-400 font-medium text-sm">Professional AI Design Engine</p>
        </div>

        <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex mb-8 p-1 bg-gray-900/50 rounded-xl border border-white/5">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-medium animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              <input
                type="email"
                required
                className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Password
                </label>
                {isLogin && <button type="button" className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-tighter">Forgot?</button>}
              </div>
              <input
                type="password"
                required
                className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 text-sm tracking-widest uppercase font-black" 
              isLoading={isLoading}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              {isLogin ? 'Authenticate' : 'Initialize Account'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.2em] text-gray-600">
              <span className="bg-[#030712] px-4">Secure Gateway</span>
            </div>
          </div>
          
          <p className="text-center mt-4 text-[10px] text-gray-600 uppercase tracking-widest">
            By accessing you agree to our <a href="#" className="text-gray-400 hover:text-white transition-colors">Neural Protocols</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
