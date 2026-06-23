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
        <img src={logoIcon} alt="IntellMeet Logo" className="h-14 w-14 object-contain animate-pulse mb-4" />
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-300 font-medium text-sm text-center">{message}</p>
      </div>
    </div>
  );
}
