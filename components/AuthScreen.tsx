import React, { useState } from 'react';
import { ApiService } from '../services/api.ts';
import { User, UserRole } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login State
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Signup State
  const [role, setRole] = useState<UserRole>(UserRole.USER);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Real API Call
      const user = await ApiService.login(loginId, loginPass); 
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      
      try {
        const user = await ApiService.register({
            username: handle,
            password: password,
            fullName: `${firstName} ${lastName}`,
            role: role,
            npiNumber: '1234567890' // Simplified for demo
        });
        onLogin(user);
      } catch(err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="bg-teal-600 p-8 text-center text-white pb-12">
         <h1 className="text-3xl font-bold tracking-tight">MedGram</h1>
         <p className="text-teal-100 text-sm mt-1">Medical Education Community</p>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-6 pt-6 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
            <button 
                onClick={() => setActiveTab('login')}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors ${activeTab === 'login' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-400'}`}
            >
                LOGIN
            </button>
            <button 
                onClick={() => setActiveTab('signup')}
                className={`flex-1 pb-3 text-sm font-semibold transition-colors ${activeTab === 'signup' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-400'}`}
            >
                SIGN UP
            </button>
        </div>

        {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Username</label>
                    <input 
                        type="text" 
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="username"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Password</label>
                    <input 
                        type="password" 
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                </div>
                
                {error && <p className="text-red-500 text-xs">{error}</p>}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-black text-white py-3 rounded-lg font-bold text-sm mt-4 hover:bg-gray-900 transition-colors"
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        ) : (
            <form onSubmit={handleSignup} className="space-y-4 pb-10">
                {/* Account Type */}
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Select Account Type</label>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {[
                            { l: 'Moderator', v: UserRole.MODERATOR },
                            { l: 'Creator', v: UserRole.CREATOR },
                            { l: 'User', v: UserRole.USER },
                        ].map((opt) => (
                            <button
                                key={opt.v}
                                type="button"
                                onClick={() => setRole(opt.v)}
                                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all ${role === opt.v ? 'bg-black text-white shadow-md' : 'text-gray-500'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">First Name</label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm outline-none" />
                    </div>
                    <div className="flex-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Last Name</label>
                         <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm outline-none" />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Username</label>
                    <input type="text" value={handle} onChange={e => setHandle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm outline-none" />
                </div>
                
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm outline-none" />
                </div>
                
                {error && <p className="text-red-500 text-xs">{error}</p>}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-black text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-900 transition-colors"
                >
                    {loading ? 'Registering...' : 'Register'}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};