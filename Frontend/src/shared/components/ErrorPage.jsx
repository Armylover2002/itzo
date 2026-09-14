import React from 'react';
import { useRouteError, Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, RotateCcw, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ErrorPage = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const isDev = import.meta.env.DEV;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] text-center border border-slate-100">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <AlertTriangle size={40} className="text-red-500" />
                </div>
                
                <h1 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Oops! Something went wrong</h1>
                <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                    We encountered an unexpected error. Don't worry, our team has been notified.
                </p>

                {isDev && (
                    <div className="mb-8 p-4 bg-slate-50 rounded-2xl text-left border border-slate-200 overflow-hidden">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Developer info</p>
                        <p className="text-xs font-mono text-red-600 break-words">
                            {error?.statusText || error?.message || "Unknown Error"}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    <Button 
                        onClick={() => window.location.reload()}
                        className="h-14 rounded-2xl bg-[#0c831f] hover:bg-[#0a701a] text-white font-bold text-lg shadow-lg shadow-green-600/20 gap-2"
                    >
                        <RotateCcw size={20} /> Try Again
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="h-14 rounded-2xl border-slate-200 text-slate-600 font-bold gap-2"
                        >
                            <ChevronLeft size={20} /> Go Back
                        </Button>
                        <Link to="/" className="w-full">
                            <Button 
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-slate-200 text-slate-600 font-bold gap-2"
                            >
                                <Home size={20} /> Home
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-50">
                    <p className="text-slate-400 text-xs font-medium">
                        If the problem persists, please contact support.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ErrorPage;
