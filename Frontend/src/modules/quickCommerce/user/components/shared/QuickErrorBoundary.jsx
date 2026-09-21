import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import Loader from '@food/components/Loader';

class QuickErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", autoRetrying: false };
    this.autoRetryCount = 0;
    this.autoRetryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message ? String(error.message) : "",
    };
  }

  componentDidUpdate(prevProps) {
    if (
      (this.props.resetKey !== prevProps.resetKey ||
        this.props.locationKey !== prevProps.locationKey) &&
      this.state.hasError
    ) {
      this.autoRetryCount = 0;
      if (this.autoRetryTimer) {
        clearTimeout(this.autoRetryTimer);
        this.autoRetryTimer = null;
      }
      this.setState({ hasError: false, errorMessage: "", autoRetrying: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by QuickErrorBoundary:", error, errorInfo);

    // Order tracking path: silent auto-retry once so a one-frame crash
    // (object-as-child / race after place-order) never flashes the error page.
    const path = String(this.props.resetKey || "");
    const isOrderRoute = /\/orders\//.test(path);
    if (isOrderRoute && this.autoRetryCount < 1) {
      this.autoRetryCount += 1;
      this.setState({ autoRetrying: true });
      if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = setTimeout(() => {
        this.setState({ hasError: false, errorMessage: "", autoRetrying: false });
      }, 50);
    }
  }

  componentWillUnmount() {
    if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer);
  }

  handleBack = () => {
    this.autoRetryCount = 0;
    this.setState({ hasError: false, errorMessage: "", autoRetrying: false });
    window.history.back();
  }

  handleRetry = () => {
    this.autoRetryCount = 0;
    this.setState({ hasError: false, errorMessage: "", autoRetrying: false });
  }

  render() {
    if (this.state.hasError && this.state.autoRetrying) {
      return <Loader />;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            
            <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Something went wrong</h1>
            <h2 className="text-xl font-bold text-gray-800 mb-3">We hit a snag loading this page</h2>
            <p className="text-gray-500 mb-8 text-[15px] leading-relaxed">
              The page could not be loaded right now. Please go back and try again.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={this.handleBack}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex items-center justify-center px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors"
              >
                Try Again
              </button>
              <Link 
                to="/quick"
                onClick={() => this.setState({ hasError: false, errorMessage: "", autoRetrying: false })}
                className="flex items-center justify-center px-6 py-3.5 bg-[#FE5502] hover:bg-[#E54D02] text-white rounded-xl font-bold transition-colors shadow-lg shadow-[#FE5502]/20"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default QuickErrorBoundary;
