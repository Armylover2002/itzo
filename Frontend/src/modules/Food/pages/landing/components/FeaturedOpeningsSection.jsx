import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Clock, ArrowRight, Users } from 'lucide-react';
import axiosInstance from '@food/api';
import { EYEBROW, HEADING, BODY } from './typography';

const FeaturedOpeningsSection = React.memo(function FeaturedOpeningsSection() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchJobs = async () => {
      try {
        // Fetch only featured active jobs
        const res = await axiosInstance.get('/food/careers', { params: { featured: 'true', limit: 3 } });
        if (mounted && res.data.success) {
          setJobs(res.data.data.jobs || []);
        }
      } catch (error) {
        console.error("Failed to fetch featured jobs", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchJobs();
    return () => { mounted = false; };
  }, []);

  if (loading || jobs.length === 0) {
    return null; // Don't show the section if no featured jobs exist or while loading
  }

  return (
    <div className="w-full bg-slate-50 py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`inline-flex mb-5 ${EYEBROW}`}
          >
            <Users className="w-3.5 h-3.5" />
            Careers
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`${HEADING} mb-5`}
          >
            Join Our Team
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`${BODY} max-w-2xl mx-auto`}
          >
            Help us shape the future of food delivery. Explore our featured open positions and start your journey with ItzoFood today.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {jobs.map((job, index) => (
            <motion.div
              key={job._id || job.id || index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              whileHover={{ y: -6 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full group"
              onClick={() => navigate(`/food/careers/${job._id || job.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-orange-50 text-primary rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <Briefcase className="w-6 h-6" />
                </div>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium rounded-full">
                  {job.department}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                  {job.location}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" />
                  {job.employmentType}
                </div>
              </div>

              <p className="text-slate-600 text-sm line-clamp-2 mb-6 flex-grow">
                {job.shortDescription}
              </p>

              <div className="flex items-center text-primary font-medium text-sm pt-4 border-t border-slate-100 mt-auto">
                View Details
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center"
        >
          <Link
            to="/food/careers"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-slate-900 hover:bg-slate-800 hover:scale-105 transition-all"
          >
            View All Openings
          </Link>
        </motion.div>

      </div>
    </div>
  );
});

export default FeaturedOpeningsSection;
