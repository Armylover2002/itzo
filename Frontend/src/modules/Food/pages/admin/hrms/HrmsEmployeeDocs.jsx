import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { FileText, Loader2, Upload, Trash2, Eye, Download, X, Search, Image as ImageIcon, Plus } from 'lucide-react';

export default function HrmsEmployeeDocs() {
    const [employees, setEmployees] = useState([]);
    const [offerLetterDocs, setOfferLetterDocs] = useState({});
    const [otherDocs, setOtherDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('Offer Letter');
    
    // Modal states
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [uploadType, setUploadType] = useState('Offer Letter'); // 'Offer Letter' or 'Other'
    
    // Upload states
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [uploading, setUploading] = useState(false);
    const [docName, setDocName] = useState('');
    const fileInputRef = useRef(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 500, status: 'Active' });
            if (search) params.append('search', search);
            
            const [empRes, offerRes, otherRes] = await Promise.all([
                axiosInstance.get(`/hrms/employees?${params}`),
                axiosInstance.get('/hrms/documents?documentType=Offer Letter'),
                axiosInstance.get('/hrms/documents?documentType=Other')
            ]);
            
            const emps = empRes.data?.data?.employees || [];
            const offerList = offerRes.data?.data || [];
            const otherList = otherRes.data?.data || [];
            
            const docMap = {};
            offerList.forEach(doc => {
                docMap[doc.employeeId] = doc;
            });
            
            setEmployees(emps);
            setOfferLetterDocs(docMap);
            setOtherDocs(otherList);
        } catch (e) { 
            console.error(e);
        } finally { 
            setLoading(false); 
        }
    }, [search]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
            return toast.error('Please upload a valid image file (JPG, PNG, WEBP)');
        }
        if (selected.size > 5 * 1024 * 1024) {
            return toast.error('File size must be less than 5MB');
        }
        
        setFile(selected);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(selected);
    };

    const handleUpload = async () => {
        if (!file || !selectedEmployee) return;

        if (uploadType === 'Other' && !docName.trim()) {
            return toast.error('Please enter a document name');
        }

        setUploading(true);
        
        try {
            // If replacing an offer letter, delete old one first
            if (uploadType === 'Offer Letter') {
                const existingDoc = offerLetterDocs[selectedEmployee._id];
                if (existingDoc) {
                    await axiosInstance.delete(`/hrms/documents/${existingDoc._id}`);
                }
            }

            // Upload image to Cloudinary via backend proxy
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', uploadType === 'Offer Letter' ? 'hrms/offer-letters' : 'hrms/other-docs');
            
            const uploadRes = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = uploadRes.data?.data?.url;
            
            if (!imageUrl) throw new Error('Failed to get image URL');

            const empName = selectedEmployee.adminId?.name || 'Employee';

            // Save document record
            await axiosInstance.post('/hrms/documents', {
                employeeId: selectedEmployee._id,
                documentType: uploadType === 'Offer Letter' ? 'Offer Letter' : 'Other',
                name: uploadType === 'Offer Letter' 
                    ? `${empName} - Offer Letter`
                    : docName.trim(),
                url: imageUrl
            });

            toast.success(uploadType === 'Offer Letter' ? 'Offer Letter uploaded successfully' : `"${docName.trim()}" uploaded successfully`);
            closeUploadModal();
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId, label) => {
        if (!window.confirm(`Are you sure you want to delete this ${label || 'document'}?`)) return;
        try {
            await axiosInstance.delete(`/hrms/documents/${docId}`);
            toast.success(`${label || 'Document'} deleted`);
            fetchData();
        } catch (e) {
            toast.error('Failed to delete document');
        }
    };

    const openUploadModal = (emp, type) => {
        setSelectedEmployee(emp);
        setUploadType(type);
        setUploadModalOpen(true);
    };

    const closeUploadModal = () => {
        setUploadModalOpen(false);
        setSelectedEmployee(null);
        setFile(null);
        setPreview('');
        setDocName('');
        setUploadType('Offer Letter');
    };

    const openPreview = (doc) => {
        setSelectedDocument(doc);
        setPreviewModalOpen(true);
    };

    // Get other docs grouped by employee for the Other Docs tab
    const getOtherDocsForEmployee = (empId) => {
        return otherDocs.filter(d => d.employeeId === empId);
    };

    // Filtered other docs based on search
    const filteredOtherDocs = otherDocs.filter(doc => {
        if (!search) return true;
        const emp = employees.find(e => e._id === doc.employeeId);
        const empName = emp?.adminId?.name || '';
        return empName.toLowerCase().includes(search.toLowerCase()) || doc.name.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Employee Documents</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage offer letters, official records and other documents</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'Other Docs' && (
                        <button
                            onClick={() => {
                                // Open modal in 'select employee' mode
                                if (employees.length === 0) {
                                    return toast.error('No employees found');
                                }
                                setUploadType('Other');
                                setUploadModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-4 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Upload Document
                        </button>
                    )}
                    <div className="relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Search employees..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 h-10 w-full sm:w-64 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('Offer Letter')}
                    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'Offer Letter'
                            ? 'border-[#6412c6] text-[#550fa8]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Offer Letter
                </button>
                <button
                    onClick={() => setActiveTab('Other Docs')}
                    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'Other Docs'
                            ? 'border-[#6412c6] text-[#550fa8]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Other Docs
                    {otherDocs.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{otherDocs.length}</span>
                    )}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : activeTab === 'Offer Letter' ? (
                    /* ═══════ OFFER LETTER TAB ═══════ */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Employee</th>
                                    <th className="px-6 py-4 font-medium">Department</th>
                                    <th className="px-6 py-4 font-medium">Offer Letter Status</th>
                                    <th className="px-6 py-4 font-medium">Upload Date</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map(emp => {
                                    const doc = offerLetterDocs[emp._id];
                                    const hasDoc = !!doc;
                                    return (
                                        <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#f0e7f9] text-[#550fa8] flex items-center justify-center font-bold text-xs">
                                                        {(emp.adminId?.name || 'E').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{emp.adminId?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-500">{emp.adminId?.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{emp.department || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                {hasDoc ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Uploaded
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {hasDoc ? new Date(doc.createdAt).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {hasDoc ? (
                                                        <>
                                                            <button onClick={() => openPreview(doc)} className="p-1.5 text-[#6412c6] hover:bg-[#f7f3fc] rounded-lg transition-colors" title="Preview">
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#6412c6] hover:bg-[#f7f3fc] rounded-lg transition-colors" title="Download">
                                                                <Download className="w-4 h-4" />
                                                            </a>
                                                            <button onClick={() => openUploadModal(emp, 'Offer Letter')} className="p-1.5 text-[#550fa8] hover:bg-[#f7f3fc] rounded-lg transition-colors" title="Replace">
                                                                <Upload className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDelete(doc._id, 'Offer Letter')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => openUploadModal(emp, 'Offer Letter')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors">
                                                            <Upload className="w-3.5 h-3.5" /> Upload
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {employees.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                            No employees found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* ═══════ OTHER DOCS TAB ═══════ */
                    <div>
                        {filteredOtherDocs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center p-12">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">No Documents Yet</h3>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    Upload documents for employees using the "Upload Document" button above.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Employee</th>
                                            <th className="px-6 py-4 font-medium">Document Name</th>
                                            <th className="px-6 py-4 font-medium">Upload Date</th>
                                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOtherDocs.map(doc => {
                                            const emp = employees.find(e => e._id === doc.employeeId);
                                            return (
                                                <tr key={doc._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">
                                                                {(emp?.adminId?.name || 'E').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-900">{emp?.adminId?.name || 'Unknown'}</p>
                                                                <p className="text-xs text-slate-500">{emp?.adminId?.email || ''}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                                            <span className="font-medium text-slate-800">{doc.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => openPreview(doc)} className="p-1.5 text-[#6412c6] hover:bg-[#f7f3fc] rounded-lg transition-colors" title="Preview">
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#6412c6] hover:bg-[#f7f3fc] rounded-lg transition-colors" title="Download">
                                                                <Download className="w-4 h-4" />
                                                            </a>
                                                            <button onClick={() => handleDelete(doc._id, doc.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900">
                                {uploadType === 'Offer Letter'
                                    ? `${offerLetterDocs[selectedEmployee?._id] ? 'Replace' : 'Upload'} Offer Letter`
                                    : 'Upload Document'
                                }
                            </h3>
                            <button onClick={closeUploadModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Employee selector for Other Docs when no employee pre-selected */}
                            {uploadType === 'Other' && !selectedEmployee ? (
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Employee</label>
                                    <select
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30 bg-white"
                                        value=""
                                        onChange={(e) => {
                                            const emp = employees.find(em => em._id === e.target.value);
                                            if (emp) setSelectedEmployee(emp);
                                        }}
                                    >
                                        <option value="">-- Choose Employee --</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.adminId?.name || 'Unknown'} ({emp.adminId?.email || ''})</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 mb-4">
                                    Employee: <span className="font-semibold text-slate-900">{selectedEmployee?.adminId?.name}</span>
                                </p>
                            )}

                            {/* Document Name field for Other Docs */}
                            {uploadType === 'Other' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Document Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={docName}
                                        onChange={(e) => setDocName(e.target.value)}
                                        placeholder="e.g. Experience Certificate, NDA, ID Proof..."
                                        maxLength={100}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30"
                                    />
                                </div>
                            )}
                            
                            <div 
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${preview ? 'border-[#6412c6] bg-[#f7f3fc]' : 'border-slate-200 hover:border-[#6412c6] hover:bg-[#f7f3fc]/50'}`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/jpeg,image/png,image/webp" 
                                    onChange={handleFileChange} 
                                />
                                {preview ? (
                                    <div className="space-y-3">
                                        <img src={preview} alt="Preview" className="h-32 object-contain mx-auto rounded-lg shadow-sm" />
                                        <p className="text-sm font-medium text-[#550fa8]">Click to change image</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                                        <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                                        <p className="text-xs text-slate-500">JPG, PNG, WEBP (Max 5MB)</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={closeUploadModal} className="px-4 h-10 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors text-sm">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleUpload} 
                                    disabled={!file || uploading || (uploadType === 'Other' && !selectedEmployee) || (uploadType === 'Other' && !docName.trim())} 
                                    className="px-4 h-10 bg-[#6412c6] text-white font-medium rounded-xl hover:bg-[#550fa8] transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {uploading ? 'Uploading...' : 'Save Document'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewModalOpen && selectedDocument && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
                    <div className="flex items-center justify-between p-4 text-white">
                        <div>
                            <h3 className="font-medium">{selectedDocument.name}</h3>
                            <p className="text-xs text-slate-400">Uploaded {new Date(selectedDocument.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <a href={selectedDocument.url} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-[#9359d7] transition-colors">
                                <Download className="w-4 h-4" /> Download
                            </a>
                            <button onClick={() => setPreviewModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                        <img 
                            src={selectedDocument.url} 
                            alt="Document Preview" 
                            className="max-w-full max-h-full object-contain cursor-zoom-in rounded-lg shadow-2xl"
                            onClick={(e) => e.target.classList.toggle('scale-150')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
