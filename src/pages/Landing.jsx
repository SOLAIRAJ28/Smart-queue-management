import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MonitorPlay, Briefcase, BarChart2, ShieldAlert } from 'lucide-react';

const Landing = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col justify-between overflow-hidden relative font-sans select-none">

      {/* Main Section */}
      <main className="w-full max-w-7xl mx-auto px-6 py-16 flex-grow flex flex-col justify-center z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-slate-900 animate-fade-in font-sans">
              Smart Queue <br/>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Management System</span>
            </h1>
            <p className="text-slate-500 text-base md:text-lg max-w-lg leading-relaxed font-medium">
              Optimize customer flow, reduce wait times, and elevate teller efficiency with NexaQueue's enterprise banking solution.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link 
                to="/login?role=customer" 
                className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 shadow-md text-sm"
              >
                Join Queue Online
              </Link>
              <Link 
                to="/display" 
                className="px-6 py-3.5 bg-white/80 backdrop-blur-sm border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center gap-2 text-sm"
              >
                Open Lobby Display <MonitorPlay className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* Right Cards Column */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link 
              to="/login?role=staff" 
              className="glass-panel-premium p-6 flex flex-col items-center justify-center h-40 group text-center block"
            >
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-600">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">Staff Counter</h3>
              </div>
            </Link>

            <Link 
              to="/login?role=manager" 
              className="glass-panel-premium p-6 flex flex-col items-center justify-center h-40 group text-center block"
            >
              <div className="w-11 h-11 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">Manager Desk</h3>
              </div>
            </Link>

            <Link 
              to="/login?role=admin" 
              className="glass-panel-premium p-6 flex flex-col items-center justify-center h-40 group text-center block sm:col-span-2 sm:max-w-xs sm:mx-auto sm:w-full"
            >
              <div className="w-11 h-11 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-sm text-slate-800 group-hover:text-red-600 transition-colors">System Admin</h3>
              </div>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Landing;
