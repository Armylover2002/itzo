import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Search, ArrowRight, Star, Users, Zap, Heart } from 'lucide-react';
import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import axiosInstance from '@food/api';

export default function Careers() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get('/food/careers', { params: { search: searchQuery } });
        if (mounted && res.data.success) {
          setJobs(res.data.data.jobs || []);
        }
      } catch (error) {
        console.error("Failed to fetch careers", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    // Debounce search slightly
    const timeoutId = setTimeout(() => {
      fetchJobs();
    }, 300);
    
    return () => { 
      mounted = false; 
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-orange-500 selection:text-white flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative pt-24 pb-20 lg:pt-28 lg:pb-28 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl mix-blend-multiply"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl mix-blend-multiply"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-white/10 text-orange-300 text-sm font-semibold tracking-wider mb-6 border border-white/20 backdrop-blur-sm">
              JOIN 
              <span className="font-black italic tracking-tighter text-lg leading-none lowercase" style={{ marginTop: '-2px' }}>
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to bottom, #ff7800 42%, white 42%)' }}>i</span>
                <span className="text-white">tz</span>
                <span className="text-[#ff7800]">o</span>
                <span className="text-white">food</span>
              </span>
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Build the Future of <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                Food Delivery
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
              We're looking for passionate individuals to help us revolutionize how people experience food. 
              Discover your next career move with us.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Why Work With Us */}
      <div className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Work With Us</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">We offer more than just a job. We offer a community, growth, and the chance to make a real impact.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: "Fast-Paced Growth", desc: "Learn and grow in a dynamic, high-growth environment." },
              { icon: Users, title: "Great Team", desc: "Work with passionate, talented, and supportive colleagues." },
              { icon: Star, title: "Impactful Work", desc: "See your work directly affect millions of users every day." },
              { icon: Heart, title: "Comprehensive Benefits", desc: "Enjoy health, wellness, and lifestyle perks." }
            ].map((perk, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center"
              >
                <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <perk.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{perk.title}</h3>
                <p className="text-slate-600">{perk.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div className="py-20 flex-grow">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Open Positions</h2>
              <p className="text-slate-600 mt-2">Find a role that fits your skills and passions.</p>
            </div>
            
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No open positions found</h3>
              <p className="text-slate-600">We couldn't find any jobs matching your search. Please check back later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job, index) => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  onClick={() => navigate(`/food/careers/${job._id}`)}
                  className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-semibold rounded-md uppercase tracking-wide">
                        {job.department}
                      </span>
                      {job.featuredJob && (
                        <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold rounded-md uppercase tracking-wide flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> Featured
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-orange-600 transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-slate-400" /> {job.location}</span>
                      <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1 text-slate-400" /> {job.employmentType}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center text-orange-600 font-medium md:opacity-0 md:-translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    View Details
                    <ArrowRight className="w-5 h-5 ml-1" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FooterSection />
    </div>
  );
}
