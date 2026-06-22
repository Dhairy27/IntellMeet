import { Loader2 } from 'lucide-react';
import logoIcon from '../assets/logo-icon.png';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading IntellMeet Workspace...' }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[120px]" />

      <div className="flex flex-col items-center z-10 glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/40 shadow-2xl">
        <div className="inline-flex items-center justify-center p-2.5 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
          <img src={logoIcon} alt="IntellMeet Logo" className="h-10 w-10 object-contain animate-pulse" />
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-300 font-medium text-sm text-center">{message}</p>
      </div>
    </div>
  );
}
