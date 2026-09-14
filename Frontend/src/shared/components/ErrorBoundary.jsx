import React, { Component } from 'react';
import { AlertCircle, RefreshCw, Home, ShoppingBag } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-outfit">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>

                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                        <p className="text-gray-500 mb-6">
                            {this.state.error?.message || "An unexpected error occurred while loading the application."}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-[#0c831f] hover:bg-[#0a6d1a] text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Refresh Page
                            </button>

                            <a
                                href="/"
                                className="w-full bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Home className="w-5 h-5" />
                                Back to Home
                            </a>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                {new Date().toLocaleTimeString()} - System Error
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-[#0c831f] font-semibold">
                        <ShoppingBag className="w-6 h-6" />
                        <span className="text-xl tracking-tight">App</span>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
