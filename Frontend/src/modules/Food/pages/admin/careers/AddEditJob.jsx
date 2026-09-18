import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import axiosInstance from "@food/api";

export default function AddEditJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    role: "",
    department: "",
    location: "",
    employmentType: "Full Time",
    experienceRequired: "",
    salaryRange: "",
    numberOfOpenings: 1,
    shortDescription: "",
    detailedDescription: "",
    responsibilities: [""],
    requirements: [""],
    benefits: [""],
    posterImage: "",
    applicationFormLink: "",
    contactEmail: "",
    contactPhone: "",
    hiringManagerName: "",
    status: "Active"
  });

  useEffect(() => {
    if (isEdit) {
      const fetchJob = async () => {
        try {
          const res = await axiosInstance.get(`/food/admin/careers/jobs/${id}`);
          if (res.data.success) {
            const data = res.data.data;
            setFormData({
              ...data,
              responsibilities: data.responsibilities?.length ? data.responsibilities : [""],
              requirements: data.requirements?.length ? data.requirements : [""],
              benefits: data.benefits?.length ? data.benefits : [""]
            });
          }
        } catch (error) {
          toast.error("Failed to fetch job details");
          navigate("/ecs/food/careers");
        }
      };
      fetchJob();
    }
  }, [id, isEdit, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayChange = (index, field, value) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, [field]: updated }));
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  };

  const removeArrayItem = (index, field) => {
    const updated = [...formData[field]];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, [field]: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSubmit = {
      ...formData,
      responsibilities: formData.responsibilities.filter(item => item.trim() !== ""),
      requirements: formData.requirements.filter(item => item.trim() !== ""),
      benefits: formData.benefits.filter(item => item.trim() !== "")
    };

    try {
      if (isEdit) {
        await axiosInstance.put(`/food/admin/careers/jobs/${id}`, dataToSubmit);
        toast.success("Job updated successfully");
      } else {
        await axiosInstance.post(`/food/admin/careers/jobs`, dataToSubmit);
        toast.success("Job created successfully");
      }
      navigate("/ecs/food/careers");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate("/ecs/food/careers")}
          className="flex items-center text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs List
        </button>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit Job Opening" : "Add New Job"}</h1>
            <p className="text-sm text-slate-500 mt-1">Fill in the details below to publish a job opening.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
              <input type="text" name="title" required value={formData.title} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. Senior Frontend Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <input type="text" name="role" required value={formData.role} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. Engineering" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
              <input type="text" name="department" required value={formData.department} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. Technology" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
              <input type="text" name="location" required value={formData.location} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. Remote, India" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employment Type *</label>
              <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none">
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Draft">Draft</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Experience Required *</label>
              <input type="text" name="experienceRequired" required value={formData.experienceRequired} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. 3-5 Years" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salary Range *</label>
              <input type="text" name="salaryRange" required value={formData.salaryRange} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. Competitive" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Application Form Link (URL)</label>
              <input type="url" name="applicationFormLink" value={formData.applicationFormLink} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="e.g. https://forms.gle/..." />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Short Description *</label>
            <textarea name="shortDescription" required rows="2" value={formData.shortDescription} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="Brief summary of the role..."></textarea>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description *</label>
            <textarea name="detailedDescription" required rows="5" value={formData.detailedDescription} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="Full job description..."></textarea>
          </div>

          {['responsibilities', 'requirements', 'benefits'].map((field) => (
            <div key={field} className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-slate-700 capitalize">{field}</label>
                <button type="button" onClick={() => addArrayItem(field)} className="text-xs bg-white border border-slate-300 px-2 py-1 rounded shadow-sm flex items-center gap-1 hover:bg-slate-100 text-slate-600">
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>
              <div className="space-y-3">
                {formData[field].map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayChange(index, field, e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none text-sm"
                      placeholder={`Enter ${field.slice(0, -1)}...`}
                    />
                    {formData[field].length > 1 && (
                      <button type="button" onClick={() => removeArrayItem(index, field)} className="mt-1.5 p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="careers@itzofood.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
              <input type="text" name="contactPhone" value={formData.contactPhone} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="+91..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Poster Image URL (Optional)</label>
              <input type="text" name="posterImage" value={formData.posterImage} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6412c6] focus:outline-none" placeholder="https://..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <button type="button" onClick={() => navigate("/ecs/food/careers")} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-lg bg-[#6412c6] text-white font-semibold hover:bg-[#550fa8] shadow-md flex items-center gap-2 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
              {loading ? "Saving..." : (isEdit ? "Update Job" : "Publish Job")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
