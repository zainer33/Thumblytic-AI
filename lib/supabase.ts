
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nntzcfoyksocuvevzsan.supabase.co';
const supabaseKey = 'sb_publishable_KKycI2kdXa52D4Syhwbg0Q_0XISSxqL';

export const supabase = createClient(supabaseUrl, supabaseKey);

/* 
  DATABASE SCHEMA REQUIREMENTS:
  Run the following SQL in your Supabase SQL Editor to resolve "Table not found" errors:

  -- 1. Create Profiles Table
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

  -- 2. Create Generations Table
  CREATE TABLE IF NOT EXISTS public.generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    image_url TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 3. Create Appeals Table
  CREATE TABLE IF NOT EXISTS public.appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    requested_plan TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 4. Enable RLS (Recommended)
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
*/

export interface UserProfile {
  id: string;
  full_name: string;
  credits: number;
  plan: 'free' | 'pro' | 'elite';
  last_credit_reset: string;
  email?: string;
  is_suspended?: boolean;
}

export interface GenerationRecord {
  id: string;
  user_id: string;
  topic: string;
  image_url: string;
  config: any;
  created_at: string;
}

export interface PlanAppeal {
  id: string;
  user_id: string;
  user_email: string;
  requested_plan: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const syncProfile = async (user: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const now = new Date().toISOString().split('T')[0];

  if (error && (error.code === 'PGRST116' || error.message.includes('profiles'))) {
    try {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert([
          { 
            id: user.id, 
            full_name: user.user_metadata?.full_name || 'Designer', 
            credits: 3, 
            plan: 'free', 
            last_credit_reset: now,
            email: user.email,
            is_suspended: false
          }
        ])
        .select()
        .single();
      return newProfile;
    } catch (e) {
      console.warn("Schema initialization needed.");
      return null;
    }
  }

  if (data && data.plan === 'free' && data.last_credit_reset !== now) {
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update({ credits: 3, last_credit_reset: now })
      .eq('id', user.id)
      .select()
      .single();
    return updatedProfile;
  }

  return data;
};

export const saveGeneration = async (userId: string, topic: string, imageUrl: string, config: any) => {
  const { data, error } = await supabase
    .from('generations')
    .insert([{ user_id: userId, topic, image_url: imageUrl, config }])
    .select()
    .single();
  
  if (!error) {
    const { data: profile } = await supabase.from('profiles').select('credits, plan').eq('id', userId).single();
    if (profile && profile.plan === 'free') {
      await supabase.from('profiles').update({ credits: Math.max(0, profile.credits - 1) }).eq('id', userId);
    }
  }
  return data;
};

export const createAppeal = async (userId: string, email: string, plan: string, message: string) => {
  const { data, error } = await supabase
    .from('appeals')
    .insert([{ 
      user_id: userId, 
      user_email: email, 
      requested_plan: plan, 
      message, 
      status: 'pending' 
    }]);
  if (error) throw error;
  return data;
};

export const adminFetchAllProfiles = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data as UserProfile[];
};

export const adminFetchAllAppeals = async () => {
  const { data, error } = await supabase.from('appeals').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as PlanAppeal[];
};

export const adminFetchAllGenerationsCount = async () => {
  const { count, error } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
};

export const adminUpdateUserStatus = async (userId: string, isSuspended: boolean) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: isSuspended })
    .eq('id', userId);
  if (error) throw error;
};

export const adminUpdateUserPlan = async (userId: string, plan: 'free' | 'pro' | 'elite') => {
  const credits = plan === 'free' ? 3 : plan === 'pro' ? 10 : 99999;
  const { data, error } = await supabase
    .from('profiles')
    .update({ plan, credits })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const adminResetAllProfilesToFree = async () => {
  const { error } = await supabase
    .from('profiles')
    .update({ plan: 'free', credits: 3 })
    .neq('plan', 'free');
  if (error) throw error;
};

export const adminUpdateAppealStatus = async (appealId: string, status: 'approved' | 'rejected') => {
  const { error } = await supabase
    .from('appeals')
    .update({ status })
    .eq('id', appealId);
  if (error) throw error;
};
