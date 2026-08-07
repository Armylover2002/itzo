import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Plus, Trash2, Check, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@food/components/ui/dialog';
import axiosInstance from '@food/api';
import { toast } from 'sonner';

export default function JobApplicationModal({ isOpen, onClose, job }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    applicantName: '',
    email: '',
    mobile: '',
    alternateMobile: '',
    dob: '',
    gender: 'Male',
    address: '',
    city: '',
    state: '',
    country: 'India',
    qualification: '',
    college: '',
    passingYear: '',
    company: '',
    designation: '',
    experience: '',
    currentCTC: '',
    expectedCTC: '',
    noticePeriod: '',
    preferredLocation: '',
    skills: '',
    certifications: '',
    languages: '',
    linkedin: '',
    github: '',
    portfolio: '',
    whyJoin: '',
    about: '',
    declaration: false,
  });

  const [files, setFiles] = useState({
    resume: null,
    coverLetter: null,
    additionalFiles: []
  });

  if (!job) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e, type) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (type === 'resume') {
      const file = fileList[0];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!['.pdf', '.doc', '.docx'].includes(ext)) {
        toast.error('Only PDF, DOC, and DOCX resumes are allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size cannot exceed 10 MB.');
        return;
      }
      setFiles(prev => ({ ...prev, resume: file }));
      setErrors(prev => ({ ...prev, resume: null }));
    } else if (type === 'coverLetter') {
      const file = fileList[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size cannot exceed 10 MB.');
        return;
      }
      setFiles(prev => ({ ...prev, coverLetter: file }));
    } else if (type === 'additionalFiles') {
      const newFiles = Array.from(fileList);
      for (const file of newFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds 10 MB.`);
          return;
        }
      }
      setFiles(prev => ({
        ...prev,
        additionalFiles: [...prev.additionalFiles, ...newFiles].slice(0, 5) // cap at 5 files
      }));
    }
  };

  const removeFile = (type, index = null) => {
    if (type === 'resume') {
      setFiles(prev => ({ ...prev, resume: null }));
    } else if (type === 'coverLetter') {
      setFiles(prev => ({ ...prev, coverLetter: null }));
    } else if (type === 'additionalFiles' && index !== null) {
      setFiles(prev => ({
        ...prev,
        additionalFiles: prev.additionalFiles.filter((_, i) => i !== index)
      }));
    }
  };

  const validateStep = (step) => {
    const tempErrors = {};
    if (step === 1) {
      if (!formData.applicantName.trim()) tempErrors.applicantName = 'Full Name is required.';
      if (!formData.email.trim()) {
        tempErrors.email = 'Email Address is required.';
      } else if (!/^[a-zA-Z0-9._%+-]+@(?!(gmail\\.comm|yahoo\\.con)$)[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/.test(formData.email)) {
        tempErrors.email = 'Invalid email format.';
      }
      if (!formData.mobile.trim()) {
        tempErrors.mobile = 'Mobile Number is required.';
      } else if (!/^\+?\d{10,14}$/.test(formData.mobile.replace(/[\s-]/g, ''))) {
        tempErrors.mobile = 'Invalid phone number format.';
      }
      if (!formData.city.trim()) tempErrors.city = 'City is required.';
      if (!formData.state.trim()) tempErrors.state = 'State is required.';
    } else if (step === 2) {
      if (!formData.qualification.trim()) tempErrors.qualification = 'Highest Qualification is required.';
    } else if (step === 3) {
      if (!files.resume) tempErrors.resume = 'Resume is required.';
    } else if (step === 4) {
      if (!formData.declaration) tempErrors.declaration = 'You must declare that the information is true.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setSubmitting(true);
    const dataToSend = new FormData();
    
    // Append text fields
    Object.keys(formData).forEach(key => {
      dataToSend.append(key, formData[key]);
    });
    dataToSend.append('jobId', job._id);

    // Append files
    if (files.resume) dataToSend.append('resume', files.resume);
    if (files.coverLetter) dataToSend.append('coverLetter', files.coverLetter);
    if (files.additionalFiles && files.additionalFiles.length > 0) {
      files.additionalFiles.forEach(file => {
        dataToSend.append('additionalFiles', file);
      });
    }

    try {
      const res = await axiosInstance.post('/job-applications', dataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        toast.success('Application submitted successfully.');
        onClose();
        // Reset form
        setFormData({
          applicantName: '',
          email: '',
          mobile: '',
          alternateMobile: '',
          dob: '',
          gender: 'Male',
          address: '',
          city: '',
          state: '',
          country: 'India',
          qualification: '',
          college: '',
          passingYear: '',
          company: '',
          designation: '',
          experience: '',
          currentCTC: '',
          expectedCTC: '',
          noticePeriod: '',
          preferredLocation: '',
          skills: '',
          certifications: '',
          languages: '',
          linkedin: '',
          github: '',
          portfolio: '',
          whyJoin: '',
          about: '',
          declaration: false,
        });
        setFiles({ resume: null, coverLetter: null, additionalFiles: [] });
        setCurrentStep(1);
      } else {
        toast.error(res.data.message || 'Something went wrong.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !submitting && !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white border border-slate-100 shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Apply for Position</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {job.title} &bull; {job.department}
            </p>
          </div>
          <button 
            disabled={submitting}
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 h-1.5 w-full flex">
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step} 
              className={`h-full flex-grow transition-all duration-300 ${
                step <= currentStep ? 'bg-orange-500' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Personal Details & Address</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      name="applicantName"
                      value={formData.applicantName}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.applicantName ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="John Doe"
                    />
                    {errors.applicantName && <p className="text-red-500 text-xs mt-1">{errors.applicantName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Email Address *</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.email ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="johndoe@example.com"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Mobile Number *</label>
                    <input 
                      type="tel" 
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.mobile ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="9876543210"
                    />
                    {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Alternate Mobile</label>
                    <input 
                      type="tel" 
                      name="alternateMobile"
                      value={formData.alternateMobile}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="Alternate Phone"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Date of Birth</label>
                    <input 
                      type="date" 
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Gender</label>
                    <select 
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Current City *</label>
                    <input 
                      type="text" 
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.city ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="Mumbai"
                    />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">State *</label>
                    <input 
                      type="text" 
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.state ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="Maharashtra"
                    />
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Country</label>
                    <input 
                      type="text" 
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Full Address</label>
                  <textarea 
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows="2"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm resize-none"
                    placeholder="House details, building, street..."
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Professional Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Highest Qualification *</label>
                    <input 
                      type="text" 
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.qualification ? 'border-red-500' : 'border-slate-200'} rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm`}
                      placeholder="B.Tech, MBA, etc."
                    />
                    {errors.qualification && <p className="text-red-500 text-xs mt-1">{errors.qualification}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">College / University</label>
                    <input 
                      type="text" 
                      name="college"
                      value={formData.college}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="IIT Bombay, Delhi University"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Passing Year</label>
                    <input 
                      type="number" 
                      name="passingYear"
                      value={formData.passingYear}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="2024"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Years of Experience</label>
                    <input 
                      type="text" 
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="2.5 Years, Freshers"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Current Company</label>
                    <input 
                      type="text" 
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="ABC Solutions"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Current Designation</label>
                    <input 
                      type="text" 
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="Software Engineer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Current CTC</label>
                    <input 
                      type="text" 
                      name="currentCTC"
                      value={formData.currentCTC}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="LPA or Hourly Rate"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Expected CTC</label>
                    <input 
                      type="text" 
                      name="expectedCTC"
                      value={formData.expectedCTC}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="LPA or Hourly Rate"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Notice Period (Days)</label>
                    <input 
                      type="text" 
                      name="noticePeriod"
                      value={formData.noticePeriod}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="Immediate, 30 days"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Preferred Job Location</label>
                    <input 
                      type="text" 
                      name="preferredLocation"
                      value={formData.preferredLocation}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="Mumbai, Remote, etc."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Skills, Documents & Links</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Technical Skills</label>
                    <input 
                      type="text" 
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="Node, React, Python"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Certifications</label>
                    <input 
                      type="text" 
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="AWS, Scrum Master"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Languages Known</label>
                    <input 
                      type="text" 
                      name="languages"
                      value={formData.languages}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="English, Hindi"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">LinkedIn Profile</label>
                    <input 
                      type="url" 
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="linkedin.com/in/username"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">GitHub Profile</label>
                    <input 
                      type="url" 
                      name="github"
                      value={formData.github}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="github.com/username"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Portfolio Website</label>
                    <input 
                      type="url" 
                      name="portfolio"
                      value={formData.portfolio}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm"
                      placeholder="myportfolio.com"
                    />
                  </div>
                </div>

                {/* File Upload Grid */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  
                  {/* Resume Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Upload Resume * (PDF, DOC, DOCX - Max 10MB)</label>
                    {!files.resume ? (
                      <div className="border-2 border-dashed border-slate-200 hover:border-orange-400 transition-colors rounded-2xl p-6 text-center cursor-pointer relative bg-slate-50">
                        <input 
                          type="file" 
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileChange(e, 'resume')}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <span className="text-sm font-medium text-slate-600">Click or drag resume file here</span>
                        <span className="block text-[10px] text-slate-400 mt-1">Accepts PDF, DOC, DOCX up to 10MB</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 bg-orange-50/50 border border-orange-200 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-orange-500 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">{files.resume.name}</span>
                          <span className="text-xs text-slate-400 shrink-0">({(files.resume.size / (1024 * 1024)).toFixed(2)} MB)</span>
                        </div>
                        <button type="button" onClick={() => removeFile('resume')} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-slate-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {errors.resume && <p className="text-red-500 text-xs mt-1">{errors.resume}</p>}
                  </div>

                  {/* Optional Files */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cover Letter */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Cover Letter (Optional - Max 10MB)</label>
                      {!files.coverLetter ? (
                        <div className="border-2 border-dashed border-slate-200 hover:border-orange-400 transition-colors rounded-2xl p-4 text-center cursor-pointer relative bg-slate-50">
                          <input 
                            type="file" 
                            onChange={(e) => handleFileChange(e, 'coverLetter')}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                          <span className="text-xs font-medium text-slate-600">Choose file</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-600 truncate">{files.coverLetter.name}</span>
                          </div>
                          <button type="button" onClick={() => removeFile('coverLetter')} className="text-slate-400 hover:text-red-500 p-0.5 rounded-full">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Supporting Documents */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Supporting Documents (Optional - Max 5 files)</label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-orange-400 transition-colors rounded-2xl p-4 text-center cursor-pointer relative bg-slate-50">
                        <input 
                          type="file" 
                          multiple
                          onChange={(e) => handleFileChange(e, 'additionalFiles')}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                        <span className="text-xs font-medium text-slate-600">Attach files</span>
                      </div>
                      
                      {files.additionalFiles.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {files.additionalFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                              <span className="text-[11px] font-medium text-slate-500 truncate max-w-[80%]">{file.name}</span>
                              <button type="button" onClick={() => removeFile('additionalFiles', idx)} className="text-slate-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Questions & Declaration</h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Why do you want to join us?</label>
                  <textarea 
                    name="whyJoin"
                    value={formData.whyJoin}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm resize-none"
                    placeholder="Share your motivation..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Tell us about yourself</label>
                  <textarea 
                    name="about"
                    value={formData.about}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors text-sm resize-none"
                    placeholder="Summarize your experience, personality, etc..."
                  />
                </div>

                {/* Auto Fill Read-Only Fields Container */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Job Title</span>
                    <span className="text-slate-700 font-bold">{job.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <span className="text-slate-700 font-bold">{job.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Employment Type</span>
                    <span className="text-slate-700 font-bold">{job.employmentType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Job ID</span>
                    <span className="text-slate-500 font-bold font-mono truncate block max-w-full">{job._id}</span>
                  </div>
                </div>

                {/* Declaration checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="declaration"
                      checked={formData.declaration}
                      onChange={handleChange}
                      disabled={submitting}
                      className="mt-1 accent-orange-500 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      I hereby declare that all information provided is true. *
                    </span>
                  </label>
                  {errors.declaration && <p className="text-red-500 text-xs mt-1">{errors.declaration}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal Footer / Navigation Controls */}
          <div className="border-t border-slate-100 pt-6 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                disabled={submitting}
                onClick={prevStep}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                Previous
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-sm transition-all active:scale-95 ml-auto"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-sm transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50 ml-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Submit Application
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
