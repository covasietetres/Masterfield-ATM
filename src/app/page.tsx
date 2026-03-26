import Link from "next/link";
import { Server, ArrowRight, ShieldCheck, Wrench, Clock } from "lucide-react";

export default function Home() {
  return (
    <div suppressHydrationWarning className="min-h-screen bg-slate-900 text-slate-200 selection:bg-blue-500/30">
      {/* Background gradients */}
      <div suppressHydrationWarning className="fixed inset-0 z-0">
        <div suppressHydrationWarning className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] mix-blend-screen" />
        <div suppressHydrationWarning className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] mix-blend-screen" />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* Logo Section */}
        <div suppressHydrationWarning className="flex flex-col items-center mb-12 animate-fade-in-up">
          <div suppressHydrationWarning className="bg-blue-500/10 p-5 rounded-2xl mb-6 ring-1 ring-blue-500/30 shadow-[0_0_40px_-10px] shadow-blue-500/30">
            <Server className="w-12 h-12 text-blue-400" />
          </div>
          <h1 suppressHydrationWarning className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white uppercase drop-shadow-sm">
            ATM Field Master
          </h1>
          <p suppressHydrationWarning className="mt-4 text-lg sm:text-xl text-slate-400 font-medium tracking-wide uppercase max-w-2xl">
            Engineer Access Portal &bull; NCR &bull; Diebold &bull; GRG
          </p>
        </div>

        {/* Feature Highlights */}
        <div suppressHydrationWarning className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16 opacity-0 animate-fade-in-up animation-delay-200">
          <div suppressHydrationWarning className="flex flex-col items-center p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="font-semibold text-slate-200">Secure Access</h3>
            <p className="text-sm text-slate-400 mt-2 text-center">Encrypted portal for authorized field engineers only.</p>
          </div>
          <div suppressHydrationWarning className="flex flex-col items-center p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <Wrench className="w-8 h-8 text-amber-400 mb-3" />
            <h3 className="font-semibold text-slate-200">Diagnostic Tools</h3>
            <p className="text-sm text-slate-400 mt-2 text-center">Direct access to manufacturer manuals and error code documentation.</p>
          </div>
          <div suppressHydrationWarning className="flex flex-col items-center p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <Clock className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="font-semibold text-slate-200">Real-time Fixes</h3>
            <p className="text-sm text-slate-400 mt-2 text-center">Log reports and resolve hardware faults efficiently.</p>
          </div>
        </div>

        {/* Call to Action */}
        <div suppressHydrationWarning className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-in-up animation-delay-400">
          <Link
            href="/login"
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-blue-600 font-pj rounded-xl hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 focus:ring-offset-slate-900 shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] hover:shadow-[0_0_30px_-5px_rgba(37,99,235,0.7)] uppercase tracking-wider text-sm"
          >
            Enter Portal
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-4 font-bold text-slate-300 transition-all duration-200 bg-slate-800 border border-slate-700 rounded-xl hover:text-white hover:bg-slate-700 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-700 focus:ring-offset-slate-900 uppercase tracking-wider text-sm"
          >
            Register Auth Key
          </Link>
        </div>

      </main>
      
      {/* Footer */}
      <div suppressHydrationWarning className="absolute bottom-0 w-full p-6 text-center z-10">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
          Restricted System &bull; Unauthorized access is prohibited
        </p>
      </div>
    </div>
  );
}
