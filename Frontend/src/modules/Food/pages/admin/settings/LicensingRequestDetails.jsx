import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, ArrowLeft, Calendar, User, Phone, Mail, MapPin, Building, Shield, File, ExternalLink, Download, Loader2, Save, Trash2 } from "lucide-react";
import axiosInstance from "@food/api";
import { toast } from "sonner";

const STATUS_OPTIONS = ["Pending", "Contacted", "In Progress", "Completed", "Rejected"];

export default function LicensingRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");

  // Document preview state
  const [selectedDocUrl, setSelectedDocUrl] = useState("");
  const [selectedDocName, setSelectedDocName] = useState("");

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/licensing-request/${id}`);
      if (res.data.success) {
        const req = res.data.data;
        setRequest(req);
        setStatus(req.status);
        setRemarks(req.adminRemarks || "");
        
        // Auto-select first available document for preview
        const docs = req.uploadedDocuments || {};
        const availableDocKey = Object.keys(docs).find(k => {
          if (k === 'otherDocs') return docs[k] && docs[k].length > 0;
          return !!docs[k];
        });
        
        if (availableDocKey) {
          if (availableDocKey === 'otherDocs') {
            setSelectedDocUrl(docs.otherDocs[0]);
            setSelectedDocName("Other Document #1");
          } else {
            setSelectedDocUrl(docs[availableDocKey]);
            setSelectedDocName(getDocDisplayName(availableDocKey));
          }
        }
      }
    } catch (error) {
      toast.error("Failed to load licensing request details");
      navigate("/ecs/food/consulting/licensing-requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [id]);

  const handleUpdateStatus = async () => {
    try {
      setUpdatingStatus(true);
      const res = await axiosInstance.patch(`/licensing-request/${id}/status`, {
        status,
        remarks
      });
      if (res.data.success) {
        toast.success("Request status and remarks updated successfully");
        fetchRequestDetails();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this licensing request? This action is permanent.")) {
      try {
        const res = await axiosInstance.delete(`/licensing-request/${id}`);
        if (res.data.success) {
          toast.success("Request deleted successfully");
          navigate("/ecs/food/consulting/licensing-requests");
        }
      } catch (error) {
        toast.error("Failed to delete request");
      }
    }
  };

  const getDocDisplayName = (key) => {
    switch (key) {
      case 'aadhaar': return 'Aadhaar Card';
      case 'pan': return 'PAN Card';
      case 'existingFssai': return 'Existing FSSAI License';
      case 'existingGst': return 'Existing GST Certificate';
      case 'shopImage': return 'Shop Image';
      case 'restaurantPhoto': return 'Restaurant Photo';
      default: return key;
    }
  };

  const isPdf = (url) => {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('format=pdf');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Pending":
        return "bg-amber-100 text-amber-800 border-amber-250";
      case "Contacted":
        return "bg-[#f0e7f9] text-[#370a6d] border-orange-250";
      case "In Progress":
        return "bg-[#f0e7f9] text-[#370a6d] border-orange-250";
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-250";
      case "Rejected":
        return "bg-rose-100 text-rose-800 border-rose-250";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        <span className="text-sm text-slate-500 font-medium">Loading request details...</span>
      </div>
    );
  }

  if (!request) return null;

  const docs = request.uploadedDocuments || {};
  const hasDocuments = Object.keys(docs).some(k => {
    if (k === 'otherDocs') return docs[k] && docs[k].length > 0;
    return !!docs[k];
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans antialiased text-slate-800">
      
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/ecs/food/consulting/licensing-requests")}
          className="inline-flex items-center text-xs font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Licensing Requests
        </button>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${getStatusColor(request.status)}`}>
            {request.status}
          </span>
          <span className="text-xs text-slate-400 font-semibold font-mono">
            Submitted: {new Date(request.createdAt).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Details & Document Previewer */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Restaurant & Owner Details Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
            <div>
              <span className="text-[10px] bg-slate-900 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Restaurant Info</span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{request.restaurantName}</h2>
              {request.restaurantId && (
                <p className="text-xs text-slate-400 font-semibold font-mono mt-0.5">Existing ID: {request.restaurantId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 text-xs">
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <User className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold uppercase tracking-wide">Owner / Partner</span>
                    <span className="text-slate-900 font-extrabold text-sm">{request.ownerName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold uppercase tracking-wide">Mobile Number</span>
                    <span className="text-slate-900 font-extrabold font-mono text-sm">{request.mobile}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Mail className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold uppercase tracking-wide">Email Address</span>
                    <span className="text-slate-900 font-extrabold text-sm">{request.email}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-bold uppercase tracking-wide">Location / City</span>
                    <span className="text-slate-900 font-extrabold text-sm">{request.city}</span>
                  </div>
                </div>

                {request.gstNumber && (
                  <div className="flex items-start gap-2.5">
                    <Building className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                    <div>
                      <span className="text-slate-400 block font-bold uppercase tracking-wide">GSTIN Number</span>
                      <span className="text-slate-900 font-extrabold font-mono text-sm uppercase">{request.gstNumber}</span>
                    </div>
                  </div>
                )}

                {request.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4.5 h-4.5 text-slate-400 mt-0.5" />
                    <div>
                      <span className="text-slate-400 block font-bold uppercase tracking-wide">Restaurant Address</span>
                      <span className="text-slate-700 font-semibold leading-relaxed block">{request.address}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Required Licenses Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
              Requested Licensing Assistance
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {request.selectedLicenses.map((lic, idx) => (
                <div key={idx} className="px-3.5 py-2 rounded-2xl bg-rose-50/30 border border-rose-100 text-rose-800 text-xs font-black">
                  {lic === 'Other' && request.otherLicenseText ? `Other: ${request.otherLicenseText}` : lic}
                </div>
              ))}
            </div>
          </div>

          {/* Document Previewer */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
              Document Preview ({selectedDocName || 'No Files'})
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 min-h-[480px] flex items-center justify-center relative">
              {selectedDocUrl ? (
                isPdf(selectedDocUrl) ? (
                  <iframe 
                    src={selectedDocUrl} 
                    className="w-full h-[580px]" 
                    title="PDF Document Preview"
                  />
                ) : (
                  <div className="w-full flex items-center justify-center p-4">
                    <img 
                      src={selectedDocUrl} 
                      alt={selectedDocName} 
                      className="max-w-full max-h-[550px] object-contain rounded-xl shadow-md border" 
                    />
                  </div>
                )
              ) : (
                <div className="text-center p-8 space-y-2">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-500 font-bold">No document selected or submitted.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Review Dashboard, Links & Downloads */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Action Update Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
              Status & Review Panel
            </h2>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wide mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2.5 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-rose-500 focus:bg-white transition-colors"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wide mb-1">Admin Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows="4"
                  placeholder="Enter remarks, consultation progress..."
                  className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-rose-500 focus:bg-white transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleUpdateStatus}
                disabled={updatingStatus}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
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

          {/* Submitted Files Links */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
              Submitted Documents
            </h2>

            <div className="space-y-2.5 text-xs font-semibold">
              {hasDocuments ? (
                <>
                  {[
                    { label: 'Aadhaar Card', key: 'aadhaar' },
                    { label: 'PAN Card', key: 'pan' },
                    { label: 'Existing FSSAI', key: 'existingFssai' },
                    { label: 'Existing GST', key: 'existingGst' },
                    { label: 'Shop Image', key: 'shopImage' },
                    { label: 'Restaurant Photo', key: 'restaurantPhoto' }
                  ].map(doc => {
                    const url = docs[doc.key];
                    if (!url) return null;
                    const isSelected = selectedDocUrl === url;

                    return (
                      <div 
                        key={doc.key} 
                        className={`p-3 border rounded-xl flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-rose-50/20 border-rose-350' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedDocUrl(url); setSelectedDocName(doc.label); }}
                          className="flex items-center gap-2 min-w-0 text-left hover:underline text-slate-700"
                        >
                          <File className={`w-4 h-4 shrink-0 ${isSelected ? 'text-rose-500' : 'text-slate-450'}`} />
                          <span className="truncate font-bold">{doc.label}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <a 
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-slate-200 rounded text-slate-500"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render otherDocs list if available */}
                  {docs.otherDocs && docs.otherDocs.map((url, idx) => {
                    const isSelected = selectedDocUrl === url;
                    const label = `Other Document #${idx + 1}`;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3 border rounded-xl flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-rose-50/20 border-rose-350' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedDocUrl(url); setSelectedDocName(label); }}
                          className="flex items-center gap-2 min-w-0 text-left hover:underline text-slate-700"
                        >
                          <File className={`w-4 h-4 shrink-0 ${isSelected ? 'text-rose-500' : 'text-slate-450'}`} />
                          <span className="truncate font-bold">{label}</span>
                        </button>
                        <a 
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium text-center">
                  No documents were uploaded.
                </div>
              )}
            </div>
          </div>

          {/* Timeline & Metadata */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider border-b border-slate-100 pb-2">
              Timeline Details
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Consultant Assigned:</span>
                <span className="text-slate-800 font-extrabold">{request.vendor}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Submitted On:</span>
                <span className="text-slate-655 font-mono">{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
              {request.reviewedBy && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-400">Reviewed By:</span>
                    <span className="text-slate-800 font-extrabold">{request.reviewedBy.name}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-400">Reviewed On:</span>
                    <span className="text-slate-655 font-mono">{new Date(request.reviewedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50/50 rounded-3xl border border-red-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-red-950 uppercase tracking-wider border-b border-red-200/50 pb-2">
              Danger Zone
            </h3>
            <p className="text-[10px] text-red-600 leading-normal font-semibold">
              Deleting this licensing request is permanent. All record details and document links will be permanently wiped out.
            </p>
            <button
              onClick={handleDelete}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete Request
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
