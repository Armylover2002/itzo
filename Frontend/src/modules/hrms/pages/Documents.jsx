import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { FileText, Loader2, Download, X, ZoomIn } from 'lucide-react';
import appLogo from '../../../assets/Logo.png';

export default function Documents() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Offer Letter');
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get('/hrms/documents/me');
                setDocuments(res.data?.data || []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const offerLetter = documents.find(d => d.documentType === 'Offer Letter');
    const otherDocuments = documents.filter(d => d.documentType !== 'Offer Letter');

    const openPreview = (url) => {
        setSelectedImage(url);
        setPreviewModalOpen(true);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Documents</h1>
                <p className="text-sm text-slate-500 mt-1">View and download your official documents</p>
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
                    onClick={() => setActiveTab('Other Documents')}
                    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                        activeTab === 'Other Documents'
                            ? 'border-[#6412c6] text-[#550fa8]'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Other Documents
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center p-12 h-full items-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : activeTab === 'Offer Letter' ? (
                    <div className="p-6 h-full">
                        {offerLetter ? (
                            <div className="max-w-md mx-auto bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className="h-48 bg-slate-100 relative group overflow-hidden border-b border-slate-200">
                                    <img 
                                        src={offerLetter.url} 
                                        alt="Offer Letter Thumbnail" 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]">
                                        <button onClick={() => openPreview(offerLetter.url)} className="p-3 bg-white text-slate-900 rounded-full hover:bg-[#f7f3fc] hover:text-[#550fa8] transition-colors shadow-lg" title="Full-Screen Preview">
                                            <ZoomIn className="w-5 h-5" />
                                        </button>
                                        <a href={offerLetter.url} download target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-slate-900 rounded-full hover:bg-[#f7f3fc] hover:text-[#550fa8] transition-colors shadow-lg" title="Download">
                                            <Download className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-[#f0e7f9] text-[#550fa8] rounded-lg">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">Official Offer Letter</h3>
                                            <p className="text-xs font-medium text-slate-500">
                                                Uploaded on {new Date(offerLetter.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-12 h-full">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                                    <FileText className="w-10 h-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Offer Letter Unavailable</h3>
                                <p className="text-slate-500 max-w-sm mx-auto">
                                    Your offer letter has not been uploaded yet. Please contact HR.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-5 h-full">
                        {otherDocuments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center p-12 h-full">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                                    <FileText className="w-10 h-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">No Other Documents</h3>
                                <p className="text-slate-500 max-w-sm mx-auto">
                                    No additional documents have been uploaded yet. Please contact HR.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {otherDocuments.map(doc => (
                                    <div key={doc._id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-[#d8c4f1] transition-all group">
                                        <div className="h-36 bg-slate-100 relative overflow-hidden border-b border-slate-200">
                                            <img 
                                                src={doc.url} 
                                                alt={doc.name} 
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                onError={(e) => { e.target.onerror = null; e.target.src = appLogo; }}
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                                <button onClick={() => openPreview(doc.url)} className="p-2.5 bg-white text-slate-900 rounded-full hover:bg-[#f7f3fc] hover:text-[#550fa8] transition-colors shadow-lg" title="Full-Screen Preview">
                                                    <ZoomIn className="w-4 h-4" />
                                                </button>
                                                <a href={doc.url} download target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white text-slate-900 rounded-full hover:bg-[#f7f3fc] hover:text-[#550fa8] transition-colors shadow-lg" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="w-4 h-4 text-[#6412c6] shrink-0" />
                                                <h3 className="font-semibold text-slate-900 text-sm truncate">{doc.name}</h3>
                                            </div>
                                            <p className="text-xs text-slate-400 pl-6">
                                                {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewModalOpen && selectedImage && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md">
                    <div className="flex items-center justify-end p-4">
                        <div className="flex items-center gap-4">
                            <a href={selectedImage} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-white hover:text-[#9359d7] transition-colors font-medium">
                                <Download className="w-4 h-4" /> Download
                            </a>
                            <button onClick={() => setPreviewModalOpen(false)} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                        <img 
                            src={selectedImage} 
                            alt="Document Preview" 
                            className="max-w-full max-h-full object-contain cursor-zoom-in rounded-lg shadow-2xl transition-transform duration-300"
                            onClick={(e) => e.target.classList.toggle('scale-[1.75]')}
                            onError={(e) => { e.target.onerror = null; e.target.src = appLogo; }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
