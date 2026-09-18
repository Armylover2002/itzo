import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, DollarSign, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
const JobApplicationModal = React.lazy(() => import('./JobApplicationModal'));

import Navbar from '../components/Navbar';
import FooterSection from '../components/FooterSection';
import axiosInstance from '@food/api';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchJob = async () => {
      try {
        const res = await axiosInstance.get(`/food/careers/${id}`);
        if (mounted && res.data.success) {
          setJob(res.data.data);
        }
      } catch (err) {
        if (mounted) {
          setError("Job not found or no longer active.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchJob();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <FooterSection />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col justify-center items-center p-4">
          <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
            <Briefcase className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Job Unavailable</h2>
          <p className="text-slate-600 mb-8">{error}</p>
          <button 
            onClick={() => navigate('/food/careers')}
            className="px-6 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors"
          >
            View All Openings
          </button>
        </div>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <Navbar />

      <div className="pt-20 md:pt-24 pb-6 md:pb-10 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/food/careers" className="inline-flex items-center text-slate-500 hover:text-slate-900 font-medium mb-4 md:mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Careers
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 md:gap-8">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="bg-orange-50 text-orange-600 px-3 py-1 text-xs md:text-sm font-semibold rounded-md uppercase tracking-wider">
                  {job.department}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-slate-500 text-xs md:text-sm font-medium">Posted {new Date(job.publishDate).toLocaleDateString()}</span>
              </div>
              
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 md:mb-6 leading-tight">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-slate-600 text-sm md:text-base">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 mr-2 text-slate-400" />
                  <span className="font-medium">{job.location}</span>
                </div>
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 md:w-5 md:h-5 mr-2 text-slate-400" />
                  <span className="font-medium">{job.employmentType}</span>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 md:w-5 md:h-5 mr-2 text-slate-400" />
                  <span className="font-medium">{job.salaryRange}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 mr-2 text-slate-400" />
                  <span className="font-medium">{job.experienceRequired} Experience</span>
                </div>
              </div>
            </div>

              <div className="shrink-0 w-full md:w-auto mt-2 md:mt-0">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex w-full md:w-auto items-center justify-center px-6 md:px-8 py-3 md:py-4 border border-transparent text-base md:text-lg font-bold rounded-full shadow-md text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-95"
                >
                  Apply Now
                </button>
              </div>

          </div>
        </div>
      </div>

      <div className="flex-grow py-6 md:py-10">
        <div className="max-w-4xl mx-auto px-4">
          
          {job.posterImage && (
            <div className="mb-6 md:mb-10 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              <img src={job.posterImage} alt={job.title} className="w-full h-auto object-cover" />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-12">
            
            <section className="mb-8 md:mb-10">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 md:mb-4">About the Role</h2>
              <div className="prose prose-slate max-w-none text-sm md:text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
                {job.detailedDescription}
              </div>
            </section>

            {job.responsibilities && job.responsibilities.length > 0 && (
              <section className="mb-8 md:mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">What You'll Do</h2>
                <ul className="space-y-3">
                  {job.responsibilities.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <ChevronRight className="w-5 h-5 text-orange-500 mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base text-slate-600 mt-0.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {job.requirements && job.requirements.length > 0 && (
              <section className="mb-8 md:mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">What We're Looking For</h2>
                <ul className="space-y-3">
                  {job.requirements.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <ChevronRight className="w-5 h-5 text-orange-500 mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base text-slate-600 mt-0.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {job.benefits && job.benefits.length > 0 && (
              <section className="mb-8 md:mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Perks & Benefits</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {job.benefits.map((item, index) => (
                    <div key={index} className="flex items-start bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100">
                      <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 mr-3 shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base text-slate-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <hr className="border-slate-200 my-8" />

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Questions?</h2>
              <p className="text-slate-600">
                If you have any questions about this role, please contact {job.hiringManagerName ? `${job.hiringManagerName} at ` : 'our recruiting team at '}
                <a href={`mailto:${job.contactEmail || 'careers@itzofood.com'}`} className="text-orange-600 hover:underline font-medium">
                  {job.contactEmail || 'careers@itzofood.com'}
                </a>
              </p>
            </section>

          </div>
          
            <div className="mt-6 md:mt-10 text-center">
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 md:mb-4">Ready to join us?</h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex w-full md:w-auto items-center justify-center px-6 md:px-10 py-3 md:py-4 border border-transparent text-base md:text-lg font-bold rounded-full shadow-md text-white bg-orange-500 hover:bg-orange-600 transition-all active:scale-95"
              >
                Apply for this job
              </button>
            </div>


        </div>
      </div>

      <React.Suspense fallback={null}>
        <JobApplicationModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          job={job}
        />
      </React.Suspense>
      <FooterSection />
    </div>

  );
}
