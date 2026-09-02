import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
  HiOutlinePlus,
  HiOutlinePhoto,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineCalendarDays,
  HiOutlineMapPin,
  HiOutlineTag,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineEye,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { resolveQuickImageUrl } from '../../user/utils/image';

const INITIAL_FORM = {
  title: '',
  subtitle: '',
  image: '',
  imageFile: null,
  targetZoneType: 'all',
  zoneIds: [],
  targetCategoryType: 'all',
  headerCategoryIds: [],
  isAlwaysActive: true,
  startDate: '',
  endDate: '',
  status: 'active',
  priority: 0,
};

export default function BannerManagement() {
  const { showToast } = useToast();

  const [banners, setBanners] = useState([]);
  const [zones, setZones] = useState([]);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    activeNow: 0,
    alwaysActive: 0,
    scheduled: 0,
    expired: 0,
    inactive: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // 1. Fetch metadata (Zones and Header Categories)
  const fetchMetadata = useCallback(async () => {
    try {
      const [zonesRes, catsRes] = await Promise.all([
        adminApi.getZones().catch(() => ({ data: { success: false, data: [] } })),
        adminApi.getCategories({ type: 'header', limit: 100 }).catch(() => ({ data: { success: false, result: [] } })),
      ]);

      // Robust Zone Parsing
      if (zonesRes?.data?.success) {
        const rawZones =
          zonesRes.data?.data?.zones ||
          zonesRes.data?.data ||
          zonesRes.data?.results ||
          zonesRes.data?.result ||
          [];
        setZones(Array.isArray(rawZones) ? rawZones : []);
      }

      // Robust Header Category Parsing
      if (catsRes?.data?.success) {
        const rawCats =
          catsRes.data?.result?.items ||
          catsRes.data?.results ||
          catsRes.data?.result ||
          catsRes.data?.data?.items ||
          catsRes.data?.data ||
          [];
        const catList = Array.isArray(rawCats) ? rawCats : [];
        const headers = catList.filter(
          (c) => c.type === 'header' || !c.type || c.parentId === null
        );
        setHeaderCategories(headers);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  // 2. Fetch Banners list
  const fetchBanners = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        search: searchTerm || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        zoneId: zoneFilter === 'all' ? undefined : zoneFilter,
        headerCategoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      };

      const res = await adminApi.getBanners(params);
      if (res?.data?.success) {
        const list = res.data.banners || [];
        setBanners(list);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Error loading banners:', err);
      showToast(err?.response?.data?.message || 'Failed to load banners', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter, zoneFilter, categoryFilter, showToast]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Open Add/Edit Modal
  const handleOpenModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image: banner.image || '',
        imageFile: null,
        targetZoneType: banner.targetZoneType || 'all',
        zoneIds: Array.isArray(banner.zoneIds)
          ? banner.zoneIds.map((z) => (z?._id ? String(z._id) : String(z)))
          : [],
        targetCategoryType: banner.targetCategoryType || 'all',
        headerCategoryIds: Array.isArray(banner.headerCategoryIds)
          ? banner.headerCategoryIds.map((c) => (c?._id ? String(c._id) : String(c)))
          : [],
        isAlwaysActive: Boolean(banner.isAlwaysActive),
        startDate: banner.startDate
          ? new Date(banner.startDate).toISOString().slice(0, 16)
          : '',
        endDate: banner.endDate
          ? new Date(banner.endDate).toISOString().slice(0, 16)
          : '',
        status: banner.status || 'active',
        priority: banner.priority || 0,
      });
      setImagePreviewUrl(resolveQuickImageUrl(banner.image));
    } else {
      setEditingBanner(null);
      setFormData(INITIAL_FORM);
      setImagePreviewUrl('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setFormData(INITIAL_FORM);
    setImagePreviewUrl('');
  };

  // Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be less than 5MB', 'error');
        return;
      }
      setFormData((prev) => ({ ...prev, imageFile: file }));
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Please enter a banner title', 'error');
      return;
    }

    if (!editingBanner && !formData.imageFile) {
      showToast('Please upload a banner image', 'error');
      return;
    }

    if (!formData.isAlwaysActive) {
      if (!formData.startDate || !formData.endDate) {
        showToast('Please set both start and end dates or enable Always Active', 'error');
        return;
      }
      if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        showToast('End date must be after start date', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('subtitle', formData.subtitle.trim());
      data.append('targetZoneType', formData.targetZoneType);
      data.append('zoneIds', JSON.stringify(formData.zoneIds));
      data.append('targetCategoryType', formData.targetCategoryType);
      data.append('headerCategoryIds', JSON.stringify(formData.headerCategoryIds));
      data.append('isAlwaysActive', String(formData.isAlwaysActive));
      data.append('status', formData.status);
      data.append('priority', Number(formData.priority) || 0);

      if (!formData.isAlwaysActive) {
        data.append('startDate', formData.startDate);
        data.append('endDate', formData.endDate);
      }

      if (formData.imageFile) {
        data.append('image', formData.imageFile);
      } else if (formData.image) {
        data.append('image', formData.image);
      }

      let res;
      if (editingBanner) {
        res = await adminApi.updateBanner(editingBanner._id || editingBanner.id, data);
        showToast('Banner updated successfully', 'success');
      } else {
        res = await adminApi.createBanner(data);
        showToast('Banner created successfully', 'success');
      }

      if (res?.data?.success) {
        handleCloseModal();
        fetchBanners();
      }
    } catch (err) {
      console.error('Error saving banner:', err);
      showToast(err?.response?.data?.message || 'Failed to save banner', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (bannerId, currentStatus) => {
    try {
      const res = await adminApi.toggleBannerStatus(bannerId);
      if (res?.data?.success) {
        showToast(
          `Banner ${currentStatus === 'active' ? 'deactivated' : 'activated'}`,
          'success'
        );
        fetchBanners();
      }
    } catch (err) {
      showToast('Failed to change status', 'error');
    }
  };

  // Delete Banner
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminApi.deleteBanner(deleteTarget._id || deleteTarget.id);
      if (res?.data?.success) {
        showToast('Banner deleted successfully', 'success');
        setDeleteTarget(null);
        fetchBanners();
      }
    } catch (err) {
      showToast('Failed to delete banner', 'error');
    }
  };

  // Date Preset Helper
  const applyDatePreset = (days) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setFormData((prev) => ({
      ...prev,
      isAlwaysActive: false,
      startDate: start.toISOString().slice(0, 16),
      endDate: end.toISOString().slice(0, 16),
    }));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlinePhoto className="h-7 w-7 text-primary" />
            Banner Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage storefront promotional banners with zone targeting, category scheduling, and date rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBanners}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh">
            <HiOutlineArrowPath className={cn('h-5 w-5', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-md transition-all active:scale-95">
            <HiOutlinePlus className="h-5 w-5 stroke-[2.5]" />
            Add New Banner
          </button>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-blue-950/20 dark:to-transparent border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Banners</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <HiOutlinePhoto className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-green-50/40 dark:from-emerald-950/20 dark:to-transparent border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live & Active</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.activeNow}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <HiOutlineCheckCircle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-fuchsia-50/40 dark:from-purple-950/20 dark:to-transparent border-purple-100 dark:border-purple-900/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Always Active</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.alwaysActive}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <HiOutlineSparkles className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50/40 dark:from-amber-950/20 dark:to-transparent border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Scheduled</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.scheduled}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <HiOutlineClock className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-50 to-red-50/40 dark:from-rose-950/20 dark:to-transparent border-rose-100 dark:border-rose-900/30 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Expired / Off</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.expired + stats.inactive}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <HiOutlineXMark className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search title or subtitle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Zone Filter */}
          <div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
              <option value="all">🌐 All Zones (Filter)</option>
              {zones.map((zone) => (
                <option key={zone._id || zone.id} value={zone._id || zone.id}>
                  📍 {zone.name || zone.zoneName}
                </option>
              ))}
            </select>
          </div>

          {/* Header Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
              <option value="all">🏷️ All Categories (Filter)</option>
              {headerCategories.map((cat) => (
                <option key={cat._id || cat.id} value={cat._id || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
              <option value="all">⚡ All Statuses</option>
              <option value="active">🟢 Active</option>
              <option value="inactive">🔴 Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Banners Grid View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-gray-500 font-medium">Loading banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <HiOutlinePhoto className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Banners Found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {searchTerm || zoneFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'No banners match your active filters. Try resetting the filters.'
              : 'You haven’t created any banners yet. Click the button below to add your first promotional banner!'}
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            <HiOutlinePlus className="h-5 w-5" />
            Add First Banner
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {banners.map((banner) => {
            const isAlways = banner.isAlwaysActive;
            const isScheduled = banner.scheduleStatus === 'scheduled';
            const isExpired = banner.scheduleStatus === 'expired';

            return (
              <Card
                key={banner._id || banner.id}
                className={cn(
                  'overflow-hidden border transition-all duration-200 hover:shadow-xl flex flex-col',
                  !banner.isCurrentlyActive && 'opacity-80'
                )}>
                {/* Banner Thumbnail Header */}
                <div
                  className="relative h-44 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden group cursor-pointer"
                  onClick={() => setPreviewImage(resolveQuickImageUrl(banner.image))}>
                  <img
                    src={resolveQuickImageUrl(banner.image)}
                    alt={banner.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-between p-3.5">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isAlways ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-500 text-white shadow-sm">
                            <HiOutlineSparkles className="h-3.5 w-3.5" />
                            All Time / Default
                          </span>
                        ) : isScheduled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm">
                            <HiOutlineClock className="h-3.5 w-3.5" />
                            Scheduled
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500 text-white shadow-sm">
                            <HiOutlineXMark className="h-3.5 w-3.5" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-sm">
                            <HiOutlineCheckCircle className="h-3.5 w-3.5" />
                            Live Now
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(banner._id || banner.id, banner.status);
                        }}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-md',
                          banner.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
                        )}>
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                            banner.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </div>

                    {/* Banner Title on overlay */}
                    <div>
                      <h4 className="text-white font-bold text-base leading-tight drop-shadow-md line-clamp-1">
                        {banner.title}
                      </h4>
                      {banner.subtitle && (
                        <p className="text-white/80 text-xs mt-0.5 line-clamp-1 drop-shadow-sm">
                          {banner.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banner Details Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5 text-xs">
                    {/* Zone Targeting */}
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <HiOutlineMapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">Zone: </span>
                        {banner.targetZoneType === 'all' || !banner.zoneIds?.length ? (
                          <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                            🌐 All Zones (Universal)
                          </span>
                        ) : (
                          <span className="inline-block bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                            📍 {banner.zoneIds.map((z) => z.name || z.zoneName || z).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Header Category Targeting */}
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <HiOutlineTag className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">Category: </span>
                        {banner.targetCategoryType === 'all' || !banner.headerCategoryIds?.length ? (
                          <span className="inline-block bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                            🏷️ All Header Categories (Home)
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                            🛍️ {banner.headerCategoryIds.map((c) => c.name || c).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date Scheduling */}
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <HiOutlineCalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">Schedule: </span>
                        {banner.isAlwaysActive ? (
                          <span className="text-gray-500 font-medium">Always Active (All Time)</span>
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300 font-mono text-[11px]">
                            {banner.startDate ? new Date(banner.startDate).toLocaleDateString() : 'Start'}
                            {' → '}
                            {banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'End'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-gray-500 border-t border-gray-100 dark:border-gray-800">
                      <span>Priority: <strong className="text-gray-900 dark:text-white font-bold">{banner.priority || 0}</strong></span>
                      <span className="text-gray-400 text-[11px]">Storefront Promo</span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => handleOpenModal(banner)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <HiOutlinePencilSquare className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(banner)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition-colors">
                      <HiOutlineTrash className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
        size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Banner Title & Subtitle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Banner Title *
              </label>
              <input
                type="text"
                placeholder="e.g. 50% Off Fresh Fruits"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Subtitle / Tagline
              </label>
              <input
                type="text"
                placeholder="e.g. Delivered in 10 minutes flat"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Banner Image Upload & Live Preview */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Banner Image * {!editingBanner && '(Recommended: 1200x400 / 3:1 ratio)'}
            </label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Dropzone */}
              <label className="flex-1 w-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                <HiOutlinePhoto className="h-10 w-10 text-gray-400 mb-2" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {formData.imageFile ? formData.imageFile.name : 'Click or Drag to Upload Image'}
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, WEBP up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>

              {/* Preview Thumbnail */}
              {imagePreviewUrl && (
                <div className="relative h-28 w-44 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 bg-black/5">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Preview
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Target Zone Configuration */}
          <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-3">
            <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              📍 Zone Targeting
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold',
                  formData.targetZoneType === 'all'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}>
                <input
                  type="radio"
                  name="targetZoneType"
                  value="all"
                  checked={formData.targetZoneType === 'all'}
                  onChange={() => setFormData({ ...formData, targetZoneType: 'all', zoneIds: [] })}
                  className="accent-primary"
                />
                All Zones (Global)
              </label>

              <label
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold',
                  formData.targetZoneType === 'specific'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}>
                <input
                  type="radio"
                  name="targetZoneType"
                  value="specific"
                  checked={formData.targetZoneType === 'specific'}
                  onChange={() => setFormData({ ...formData, targetZoneType: 'specific' })}
                  className="accent-primary"
                />
                Specific Zone(s)
              </label>
            </div>

            {formData.targetZoneType === 'specific' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Target Zones:
                </label>
                {zones.length === 0 ? (
                  <p className="text-xs text-amber-600 p-2 bg-amber-50 rounded-lg">
                    No active zones found. Please ensure zones are configured in Zone Setup.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    {zones.map((z) => {
                      const zid = String(z._id || z.id);
                      const isChecked = formData.zoneIds.includes(zid);
                      return (
                        <label
                          key={zid}
                          className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...formData.zoneIds, zid]
                                : formData.zoneIds.filter((id) => id !== zid);
                              setFormData({ ...formData, zoneIds: next });
                            }}
                            className="accent-primary rounded"
                          />
                          <span className="truncate">{z.name || z.zoneName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Target Header Category Configuration */}
          <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-3">
            <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              🏷️ Header Category Targeting
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold',
                  formData.targetCategoryType === 'all'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}>
                <input
                  type="radio"
                  name="targetCategoryType"
                  value="all"
                  checked={formData.targetCategoryType === 'all'}
                  onChange={() => setFormData({ ...formData, targetCategoryType: 'all', headerCategoryIds: [] })}
                  className="accent-primary"
                />
                All Categories (Home)
              </label>

              <label
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold',
                  formData.targetCategoryType === 'specific'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}>
                <input
                  type="radio"
                  name="targetCategoryType"
                  value="specific"
                  checked={formData.targetCategoryType === 'specific'}
                  onChange={() => setFormData({ ...formData, targetCategoryType: 'specific' })}
                  className="accent-primary"
                />
                Specific Header Category
              </label>
            </div>

            {formData.targetCategoryType === 'specific' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Header Category:
                </label>
                {headerCategories.length === 0 ? (
                  <p className="text-xs text-amber-600 p-2 bg-amber-50 rounded-lg">
                    No header categories found. Please configure header categories first.
                  </p>
                ) : (
                  <select
                    value={formData.headerCategoryIds[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, headerCategoryIds: val ? [val] : [] });
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                    <option value="">-- Choose Category --</option>
                    {headerCategories.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Date Validity & Scheduling Options */}
          <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                ⏰ Date Scheduling & Validity
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyDatePreset(7)}
                  className="text-[11px] font-bold text-gray-600 hover:text-primary bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset(14)}
                  className="text-[11px] font-bold text-gray-600 hover:text-primary bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  +14 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset(30)}
                  className="text-[11px] font-bold text-gray-600 hover:text-primary bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  +30 Days
                </button>
              </div>
            </div>

            {/* Always Active Checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAlwaysActive}
                onChange={(e) => setFormData({ ...formData, isAlwaysActive: e.target.checked })}
                className="h-4 w-4 accent-purple-600 rounded"
              />
              <div>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                  All Time / Default Banner (Always Active)
                </span>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-400">
                  Check this to display the banner continuously with no expiration date.
                </p>
              </div>
            </label>

            {/* Custom Dates if not always active */}
            {!formData.isAlwaysActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required={!formData.isAlwaysActive}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required={!formData.isAlwaysActive}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Priority Order */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Priority Order (Higher number displays first)
            </label>
            <input
              type="number"
              placeholder="0"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
              {isSubmitting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {editingBanner ? 'Save Changes' : 'Create Banner'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete Banner"
        size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete banner{' '}
            <strong className="text-gray-900 dark:text-white font-bold">"{deleteTarget?.title}"</strong>? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Delete Banner
            </button>
          </div>
        </div>
      </Modal>

      {/* Fullsize Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm cursor-pointer">
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black">
            <img src={previewImage} alt="Full Preview" className="w-full h-auto max-h-[85vh] object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black">
              <HiOutlineXMark className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
