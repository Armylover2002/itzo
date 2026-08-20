import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlinePhone,
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ActiveSellers = () => {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null); // { seller }
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [filter, setFilter] = useState('active');

  const loadActiveSellers = async (currentFilter = filter) => {
    setIsLoading(true);
    try {
      const response = currentFilter === 'deleted' 
        ? await adminApi.getDeletedSellers()
        : await adminApi.getSellers();
      const items =
        response?.data?.result?.items ||
        response?.data?.data?.items ||
        response?.data?.result ||
        [];
      setSellers(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error('Failed to load approved sellers');
      setSellers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSellers(filter);
  }, [filter]);

  const filteredSellers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sellers;
    return sellers.filter((seller) =>
      [
        seller.shopName,
        seller.ownerName,
        seller.email,
        seller.phone,
        seller.category,
        seller.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchTerm, sellers]);

  const handleDeleteClick = (seller) => {
    setDeleteConfirmDialog({ seller });
    setDeletePassword("");
    setShowDeletePassword(false);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmDialog) return;
    if (!deletePassword.trim()) {
      toast.error("Please enter the password");
      return;
    }

    const { seller } = deleteConfirmDialog;
    try {
      setDeleting(true);
      await adminApi.softDeleteSeller(seller._id || seller.id, deletePassword);
      
      setSellers(prev => prev.filter(s => (s._id || s.id) !== (seller._id || seller.id)));
      setDeleteConfirmDialog(null);
      setDeletePassword("");
      toast.success(`Seller "${seller.shopName || seller.name || 'Seller'}" deleted successfully!`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete seller. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialog(null);
    setDeletePassword("");
  };

  const stats = useMemo(
    () => ({
      total: sellers.length,
      withLocation: sellers.filter((seller) => seller.location).length,
      withDocs: sellers.filter(
        (seller) =>
          seller?.documents?.shopLicenseNumber ||
          seller?.documents?.gstNumber ||
          seller?.documents?.panNumber ||
          seller?.documents?.fssaiNumber,
      ).length,
    }),
    [sellers],
  );

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="ds-h1 flex items-center gap-2">
            Active Sellers
            <Badge variant="success" className="admin-tiny px-1.5 py-0 font-bold">
              Approved
            </Badge>
          </h1>
          <p className="ds-description mt-0.5">
            Approved quick-commerce sellers who can access the seller dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadActiveSellers()}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white"
        >
          <HiOutlineArrowPath className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: 'Approved sellers',
            val: stats.total,
            icon: HiOutlineCheckCircle,
            tone: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Location ready',
            val: stats.withLocation,
            icon: HiOutlineMapPin,
            tone: 'text-primary bg-orange-50',
          },
          {
            label: 'Docs added',
            val: stats.withDocs,
            icon: HiOutlineBuildingOffice2,
            tone: 'text-amber-600 bg-amber-50',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="ds-label">{stat.label}</p>
                <h4 className="ds-stat-medium mt-1">{stat.val}</h4>
              </div>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner ${stat.tone}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
        <div className="p-6 border-b border-slate-50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white">
          <div className="relative flex-1 w-full max-w-md">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shop, owner, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/10"
            >
              <option value="active">Active Sellers</option>
              <option value="deleted">Deleted Sellers</option>
            </select>
            {filter === 'active' ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 ring-1 ring-emerald-100">
                <HiOutlineCheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                  Live approved
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 ring-1 ring-red-100">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest">
                  Soft Deleted
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="ds-table-header-cell px-6">Seller</th>
                <th className="ds-table-header-cell px-6">Contact</th>
                <th className="ds-table-header-cell px-6">Category</th>
                <th className="ds-table-header-cell px-6">Approved on</th>
                <th className="ds-table-header-cell px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!isLoading && filteredSellers.length > 0 ? (
                filteredSellers.map((seller) => (
                  <tr key={seller._id || seller.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 flex items-center justify-center text-slate-400">
                          <HiOutlineBuildingOffice2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{seller.shopName || 'Store'}</p>
                          <p className="text-[10px] font-bold text-slate-400">{seller.ownerName || 'Seller'}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            {seller.location || 'Location not added yet'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                          <span>{seller.email || 'No email'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                          <span>{seller.phone || 'No phone'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                        {seller.category || 'General'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">
                          {formatDate(seller.approvedAt || seller.applicationDate)}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400">
                          {seller.serviceRadius ? `${seller.serviceRadius} km radius` : 'Radius not set'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/ecs/quick-commerce/sellers/active/${seller._id || seller.id}`)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-bold text-white shadow-lg"
                        >
                          <HiOutlineEye className="h-3.5 w-3.5" />
                          View
                        </button>
                        {!seller.isDeleted && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(seller)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Seller"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <HiOutlineCalendarDays className={`h-10 w-10 ${isLoading ? 'animate-pulse' : ''}`} />
                      <p className="text-sm font-semibold text-slate-500">
                        {isLoading ? 'Loading approved sellers...' : 'No approved sellers found yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelDelete}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Delete Seller</h3>
                  <p className="text-sm text-slate-600">
                    {deleteConfirmDialog.seller.shopName || deleteConfirmDialog.seller.name || 'Seller'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-red-800 bg-red-50 p-3 rounded-lg border border-red-200 mb-4">
                Are you sure you want to delete <strong>{deleteConfirmDialog.seller.shopName || deleteConfirmDialog.seller.name || 'Seller'}</strong>? This action will hide the seller from the admin panel and the seller will be shown that their account was deleted by admin.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Enter Password to Confirm
                </label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmDelete() }}
                    placeholder="Enter admin password"
                    className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 text-sm"
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting || !deletePassword.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete Seller"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveSellers;
