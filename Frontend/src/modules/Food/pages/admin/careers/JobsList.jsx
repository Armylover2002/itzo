import { useState, useEffect } from "react";
import { Briefcase, Search, Edit, Trash2, Plus, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";
import axiosInstance from "@food/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function JobsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/food/admin/careers/jobs", { params: { search: searchQuery } });
      if (res.data.success) {
        setJobs(res.data.data.jobs || []);
      }
    } catch (error) {
      toast.error("Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [searchQuery]);

  const toggleFeatured = async (id) => {
    try {
      const res = await axiosInstance.patch(`/food/admin/careers/jobs/${id}/featured`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchJobs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update featured status");
    }
  };

  const updateStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await axiosInstance.patch(`/food/admin/careers/jobs/${id}/status`, { status: newStatus });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchJobs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this job opening?")) {
      try {
        const res = await axiosInstance.delete(`/food/admin/careers/jobs/${id}`);
        if (res.data.success) {
          toast.success(res.data.message);
          fetchJobs();
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to delete job");
      }
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6412c6] flex items-center justify-center shadow-lg shadow-[#6412c6]/20">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Careers / Job Openings</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage job openings and publish them to the careers page.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/ecs/food/careers/add")}
              className="flex items-center gap-2 bg-[#6412c6] hover:bg-[#550fa8] text-white px-6 py-2.5 rounded-lg font-semibold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              ADD NEW JOB
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Jobs List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {jobs.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by title, role or location"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Featured</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  jobs.map((job, index) => (
                    <tr key={job._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-slate-700">{index + 1}</span></td>
                      <td className="px-6 py-4"><span className="text-sm font-medium text-slate-900">{job.title}</span><div className="text-xs text-slate-500">{job.role}</div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-slate-700">{job.department}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-slate-700">{job.location}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleFeatured(job._id)}
                          className={`w-10 h-5 rounded-full relative transition-colors ${job.featuredJob ? 'bg-[#6412c6]' : 'bg-slate-300'}`}
                          title={job.featuredJob ? "Featured" : "Not Featured"}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${job.featuredJob ? 'translate-x-5' : ''}`} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => updateStatus(job._id, job.status)}
                          className={`w-10 h-5 rounded-full relative transition-colors ${job.status === 'Active' ? 'bg-[#6412c6]' : 'bg-slate-300'}`}
                          title={job.status}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${job.status === 'Active' ? 'translate-x-5' : ''}`} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setSelectedJob(job); setIsViewModalOpen(true); }} className="p-1.5 rounded text-[#6412c6] hover:bg-[#f7f3fc] transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/ecs/food/careers/edit/${job._id}`)} className="p-1.5 rounded text-[#6412c6] hover:bg-[#f7f3fc] transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(job._id)} className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-[#6412c6]" /> Job Details</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedJob && (
              <>
                <div className="flex items-center justify-center mb-6">
                  {selectedJob.posterImage ? (
                    <img src={selectedJob.posterImage} alt={selectedJob.title} className="w-full max-h-48 object-contain rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                      <Briefcase className="w-8 h-8 mb-2" />
                      <span>No Poster</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-slate-500 font-medium">Title:</div>
                  <div className="text-slate-900 font-semibold">{selectedJob.title}</div>
                  <div className="text-slate-500 font-medium">Role:</div>
                  <div className="text-slate-900">{selectedJob.role}</div>
                  <div className="text-slate-500 font-medium">Department:</div>
                  <div className="text-slate-900">{selectedJob.department}</div>
                  <div className="text-slate-500 font-medium">Location:</div>
                  <div className="text-slate-900">{selectedJob.location}</div>
                  <div className="text-slate-500 font-medium">Salary:</div>
                  <div className="text-slate-900">{selectedJob.salaryRange}</div>
                  <div className="text-slate-500 font-medium">Experience:</div>
                  <div className="text-slate-900">{selectedJob.experienceRequired}</div>
                  <div className="text-slate-500 font-medium">Status:</div>
                  <div className={`font-semibold ${selectedJob.status === 'Active' ? 'text-[#6412c6]' : 'text-slate-500'}`}>{selectedJob.status}</div>
                </div>
                <div className="mt-4">
                  <div className="text-slate-500 font-medium text-sm mb-1">Short Description:</div>
                  <p className="text-sm text-slate-700">{selectedJob.shortDescription}</p>
                </div>
              </>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
            <button onClick={() => setIsViewModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors">Close</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
