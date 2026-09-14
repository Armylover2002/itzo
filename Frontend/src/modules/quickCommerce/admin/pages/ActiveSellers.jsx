import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineCube,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlinePhone,
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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

const resolveSellerZoneName = (seller = {}) =>
  String(
    seller.zoneName ||
      seller.shopInfo?.zoneName ||
      '',
  ).trim();

const resolveSellerProductCount = (seller = {}) => {
  const raw = seller.productCount ?? seller.productsCount ?? seller.totalProducts;
  const count = Number(raw);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const ActiveSellers = () => {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadActiveSellers = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getSellers();
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
    loadActiveSellers();
  }, []);

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
        resolveSellerZoneName(seller),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchTerm, sellers]);

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
          onClick={loadActiveSellers}
          className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white"
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
            tone: 'text-sky-600 bg-sky-50',
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
              placeholder="Search by shop, owner, email, phone, zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 ring-1 ring-emerald-100">
            <HiOutlineCheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
              Live approved seller accounts
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="ds-table-header-cell px-6">Seller</th>
                <th className="ds-table-header-cell px-6">Contact</th>
                <th className="ds-table-header-cell px-6">Category</th>
                <th className="ds-table-header-cell px-6">Zone</th>
                <th className="ds-table-header-cell px-6">Products</th>
                <th className="ds-table-header-cell px-6">Approved on</th>
                <th className="ds-table-header-cell px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!isLoading && filteredSellers.length > 0 ? (
                filteredSellers.map((seller) => {
                  const zoneName = resolveSellerZoneName(seller);
                  const productCount = resolveSellerProductCount(seller);
                  return (
                    <tr key={seller._id || seller.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            {seller.shopInfo?.shopImage ? (
                              <img src={seller.shopInfo.shopImage} alt={seller.shopName || 'Store'} className="h-full w-full object-cover" />
                            ) : (
                              <HiOutlineBuildingOffice2 className="h-5 w-5" />
                            )}
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
                        <div className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
                          <HiOutlineMapPin className="h-4 w-4 text-sky-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-700">
                            {zoneName || 'Zone not set'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100">
                          <HiOutlineCube className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">
                            {productCount}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {productCount === 1 ? 'product' : 'products'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-700">
                          {formatDate(seller.approvedAt || seller.applicationDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          title="View seller"
                          aria-label={`View ${seller.shopName || 'seller'}`}
                          onClick={() => navigate(`/ecs/quick-commerce/sellers/active/${seller._id || seller.id}`)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-100"
                        >
                          <HiOutlineEye className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
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
    </div>
  );
};

export default ActiveSellers;
