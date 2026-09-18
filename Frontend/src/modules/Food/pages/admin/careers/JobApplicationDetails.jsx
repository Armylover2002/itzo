import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, ArrowLeft, Calendar, User, Phone, Mail, MapPin, Award, Briefcase, Link as LinkIcon, Trash2, Edit2, Loader2, Save, File, ExternalLink, Download } from "lucide-react";
import axiosInstance from "@food/api";
import { toast } from "sonner";

const STATUS_OPTIONS = ["Applied", "Shortlisted", "Interview Scheduled", "Rejected", "Hired"];

export default function JobApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/food/admin/careers/applications/${id}`);
      if (res.data.success) {
        const app = res.data.data;
        setApplication(app);
        setStatus(app.status);
        setRemarks(app.remarks || "");
      }
    } catch (error) {
      toast.error("Failed to load application details");
      navigate("/ecs/food/careers/applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
  }, [id]);

  const handleUpdateStatus = async () => {
    try {
      setUpdatingStatus(true);
      const res = await axiosInstance.patch(`/food/admin/careers/applications/${id}/status`, {
        status,
        remarks
      });
      if (res.data.success) {
        toast.success("Application updated successfully");
        fetchApplicationDetails();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this job application? This action is permanent.")) {
      try {
        const res = await axiosInstance.delete(`/food/admin/careers/applications/${id}`);
        if (res.data.success) {
          toast.success("Application deleted successfully");
          navigate("/ecs/food/careers/applications");
        }
      } catch (error) {
        toast.error("Failed to delete application");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
        <span className="text-sm text-slate-500 font-medium">Loading application details...</span>
      </div>
    );
  }

  if (!application) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case "Applied":
        return "bg-[#f0e7f9] text-[#370a6d] border-[#d8c4f1]";
      case "Shortlisted":
        return "bg-[#f0e7f9] text-[#370a6d] border-[#d8c4f1]";
      case "Interview Scheduled":
        return "bg-[#f0e7f9] text-[#370a6d] border-[#d8c4f1]";
      case "Rejected":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Hired":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen font-sans text-slate-700">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Back Link & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button 
            onClick={() => navigate("/ecs/food/careers/applications")}
            className="inline-flex items-center text-slate-500 hover:text-slate-900 font-bold transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Applications
          </button>
          
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 transition-all active:scale-95 self-end sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            DELETE APPLICATION
          </button>
        </div>

        {/* Header Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#f0e7f9]/50 flex items-center justify-center border border-[#d8c4f1] shadow-sm text-[#550fa8] shrink-0">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">{application.applicantName}</h1>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Applied for <span className="text-slate-800">{application.jobTitle}</span> &bull; {application.department}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-2">
                <Calendar className="w-3.5 h-3.5" />
                Applied on {new Date(application.appliedAt).toLocaleDateString()} at {new Date(application.appliedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-between gap-2 shrink-0">
            <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${getStatusColor(application.status)}`}>
              {application.status}
            </span>
          </div>
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Columns - Details Forms */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Personal Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <User className="w-4.5 h-4.5 text-[#6412c6]" />
                Personal Details
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Email Address</span>
                  <a href={`mailto:${application.email}`} className="text-slate-800 font-bold hover:underline inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {application.email}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Mobile Number</span>
                  <a href={`tel:${application.mobile}`} className="text-slate-800 font-bold hover:underline inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {application.mobile}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Alternate Mobile</span>
                  <span className="text-slate-850 font-bold">{application.alternateMobile || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Date of Birth</span>
                  <span className="text-slate-850 font-bold">{application.dob ? new Date(application.dob).toLocaleDateString() : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Gender</span>
                  <span className="text-slate-850 font-bold">{application.gender || "—"}</span>
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-[#6412c6]" />
                Address
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">City</span>
                  <span className="text-slate-850 font-bold">{application.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">State</span>
                  <span className="text-slate-850 font-bold">{application.state}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Country</span>
                  <span className="text-slate-850 font-bold">{application.country || "—"}</span>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-slate-400 font-semibold block mb-1">Full Address</span>
                  <span className="text-slate-850 font-bold leading-relaxed">{application.address || "—"}</span>
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-[#6412c6]" />
                Professional Details
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Highest Qualification</span>
                  <span className="text-slate-850 font-bold">{application.qualification}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">College / University</span>
                  <span className="text-slate-850 font-bold">{application.college || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Passing Year</span>
                  <span className="text-slate-850 font-bold">{application.passingYear || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Experience</span>
                  <span className="text-slate-850 font-bold">{application.experience || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Current Company</span>
                  <span className="text-slate-850 font-bold">{application.company || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Current Designation</span>
                  <span className="text-slate-850 font-bold">{application.designation || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Current CTC</span>
                  <span className="text-slate-850 font-bold">{application.currentCTC || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Expected CTC</span>
                  <span className="text-slate-850 font-bold">{application.expectedCTC || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Notice Period</span>
                  <span className="text-slate-850 font-bold">{application.noticePeriod || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Preferred Location</span>
                  <span className="text-slate-850 font-bold">{application.preferredLocation || "—"}</span>
                </div>
              </div>
            </div>

            {/* Skills & Tags */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-[#6412c6]" />
                Skills & Certifications
              </h2>
              
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-2">Technical Skills</span>
                  {application.skills && application.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {application.skills.map((skill, idx) => (
                        <span key={idx} className="bg-[#f7f3fc] text-[#550fa8] font-semibold px-2.5 py-1 rounded-lg border border-[#f0e7f9]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">None specified</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block mb-2">Certifications</span>
                  {application.certifications && application.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {application.certifications.map((cert, idx) => (
                        <span key={idx} className="bg-[#f7f3fc] text-primary font-semibold px-2.5 py-1 rounded-lg border border-[#f0e7f9]">
                          {cert}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">None specified</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block mb-2">Languages Known</span>
                  {application.languages && application.languages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {application.languages.map((lang, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
                          {lang}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">None specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Questions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-[#6412c6]" />
                Additional Questions
              </h2>
              
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Why do you want to join us?</span>
                  <p className="text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap font-medium">
                    {application.whyJoin || "No response provided."}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Tell us about yourself</span>
                  <p className="text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap font-medium">
                    {application.about || "No response provided."}
                  </p>
                </div>
              </div>
            </div>

            {/* Resume Preview & Embed Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-[#6412c6]" />
                  Resume Preview
                </span>
                <a 
                  href={application.resumeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#6412c6] hover:text-[#550fa8] font-bold text-xs inline-flex items-center gap-1"
                >
                  Open in New Tab
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </h2>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 min-h-[500px]">
                {application.resumeUrl.toLowerCase().includes('.pdf') || application.resumeUrl.toLowerCase().includes('format=pdf') ? (
                  <iframe 
                    src={`${application.resumeUrl}#toolbar=0`} 
                    className="w-full h-[500px] border-0" 
                    title="Resume PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-20 text-center gap-4 bg-white">
                    <FileText className="w-16 h-16 text-slate-350" />
                    <div>
                      <h4 className="font-bold text-slate-800">Doc/Docx File Preview Unavailable</h4>
                      <p className="text-xs text-slate-400 mt-1">Previews are supported for PDF formats. Please download the file below to view it.</p>
                    </div>
                    <a 
                      href={application.resumeUrl} 
                      className="inline-flex items-center gap-2 bg-[#6412c6] hover:bg-[#550fa8] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Download Resume
                    </a>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column - Status Panel, Files & Links */}
          <div className="space-y-6">
            
            {/* Update Status Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                Application Review
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold uppercase tracking-wide mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold uppercase tracking-wide mb-1">Admin Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows="4"
                    placeholder="Enter review remarks..."
                    className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus}
                  className="w-full py-2.5 bg-[#6412c6] hover:bg-[#550fa8] text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {updatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Review
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Links Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                Profile Links
              </h2>

              <div className="space-y-2.5 text-xs font-semibold">
                {application.linkedin ? (
                  <a 
                    href={application.linkedin}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl transition-all"
                  >
                    <span className="text-slate-600">LinkedIn Profile</span>
                    <ExternalLink className="w-4 h-4 text-slate-450" />
                  </a>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                    No LinkedIn linked
                  </div>
                )}

                {application.github ? (
                  <a 
                    href={application.github}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl transition-all"
                  >
                    <span className="text-slate-600">GitHub Profile</span>
                    <ExternalLink className="w-4 h-4 text-slate-450" />
                  </a>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                    No GitHub linked
                  </div>
                )}

                {application.portfolio ? (
                  <a 
                    href={application.portfolio}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl transition-all"
                  >
                    <span className="text-slate-600">Portfolio Website</span>
                    <ExternalLink className="w-4 h-4 text-slate-450" />
                  </a>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                    No Portfolio linked
                  </div>
                )}
              </div>
            </div>

            {/* Document Files Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
                Submitted Documents
              </h2>

              <div className="space-y-2.5 text-xs font-semibold">
                {/* Resume download */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#6412c6] shrink-0" />
                    <span className="text-slate-700 truncate">Resume Document</span>
                  </div>
                  <a 
                    href={application.resumeUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Cover letter */}
                {application.coverLetterUrl ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="w-4 h-4 text-slate-450 shrink-0" />
                      <span className="text-slate-700 truncate">Cover Letter</span>
                    </div>
                    <a 
                      href={application.coverLetterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      title="Open File"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                    No Cover Letter submitted
                  </div>
                )}

                {/* Additional supporting files */}
                {application.additionalFiles && application.additionalFiles.length > 0 ? (
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase mb-1">Supporting Files</span>
                    {application.additionalFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600 font-medium truncate">File {idx + 1}</span>
                        </div>
                        <a 
                          href={file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6412c6] font-bold text-[10px] hover:underline"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium">
                    No supporting files
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Statistics */}
            {application.reviewedAt && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-xs space-y-2">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Review Information</span>
                <div>
                  <span className="font-semibold text-slate-500">Reviewed By: </span>
                  <span className="font-bold text-slate-800">{application.reviewedBy?.name || "Admin"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Reviewed On: </span>
                  <span className="font-bold text-slate-800">{new Date(application.reviewedAt).toLocaleString()}</span>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
