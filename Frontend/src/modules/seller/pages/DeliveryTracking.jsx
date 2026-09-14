import React, { useState, useMemo, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineTruck,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineUser,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import { Loader2 } from "lucide-react";
import Pagination from "@shared/components/ui/Pagination";

const DeliveryTracking = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Active");
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await sellerApi.getOrders();
      // Only show orders that are confirmed, packed, or out for delivery (Tracking flow)
      const payload = response.data.result || {};
      const orderList = Array.isArray(payload.items)
        ? payload.items
        : (response.data.results || []);

      const formattedDeliveries = orderList
        .filter(order => order.status !== 'pending' && order.status !== 'cancelled')
        .map(order => {
          let uiStatus = "Active";
          if (order.status === 'delivered') uiStatus = "Delivered";
          else if (order.status === 'out_for_delivery') uiStatus = "On the Way";
          else uiStatus = "Picked Up";

          return {
            id: order._id,
            orderId: order.orderId,
            status: uiStatus,
            deliveryBoy: order.deliveryPartner ? {
              name: order.deliveryPartner.name,
              phone: order.deliveryPartner.phone,
              avatar: order.deliveryPartner.name?.charAt(0) || "?",
              image: order.deliveryPartner.image || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
              rating: order.deliveryPartner.rating || 4.5,
            } : order.deliveryBoy ? {
              name: order.deliveryBoy.name,
              phone: order.deliveryBoy.phone,
              avatar: order.deliveryBoy.name?.charAt(0) || "?",
              image: order.deliveryBoy.image || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
              rating: order.deliveryBoy.rating || 4.5,
            } : {
              name: "Not Assigned",
              phone: "N/A",
              avatar: "?",
              image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
              rating: 0,
            },
            location: order.status === 'delivered' && order.updatedAt
              ? `Delivered at ${new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : "In Progress",
            orderDate: order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "",
            startTime: order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : "",
            estimatedDelivery: "20-30 mins",
            customerName: order.customer?.name || "Customer",
            address: order.address
              ? [order.address.street || order.address.address || "", order.address.additionalDetails || "", order.address.city || "", order.address.zipCode || ""].filter(Boolean).join(", ").trim()
              : "",
            addressCoords: order.address?.location || null,
          };
        });

      setDeliveries(formattedDeliveries);
    } catch (error) {
      console.error("Tracking Error:", error);
      showToast("Failed to fetch tracking data", "error");
    } finally {
      setLoading(false);
    }
  };

  const tabs = ["Active", "Completed", "All"];

  const filteredDeliveries = useMemo(() => {
    const result = deliveries.filter((dlv) => {
      const matchesSearch =
        dlv.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dlv.deliveryBoy.name.toLowerCase().includes(searchTerm.toLowerCase());

      const isCompleted = dlv.status === "Delivered";
      if (activeTab === "Active") return matchesSearch && !isCompleted;
      if (activeTab === "Completed") return matchesSearch && isCompleted;
      return matchesSearch;
    });
    // Reset to first page if current page exceeds total pages
    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
    return result;
  }, [deliveries, searchTerm, activeTab, page, pageSize]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDeliveries.slice(start, end);
  }, [filteredDeliveries, page, pageSize]);

  const stats = useMemo(
    () => [
      {
        label: "On the Way",
        value: deliveries.filter((d) => d.status === "On the Way").length,
        icon: HiOutlineTruck,
        iconColor: "text-red-600",
        iconBg: "bg-red-50 border-red-200/80",
      },
      {
        label: "At Store",
        value: deliveries.filter((d) => d.status === "Picked Up").length,
        icon: HiOutlineMapPin,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-50 border-amber-200/80",
      },
      {
        label: "Completed Today",
        value: deliveries.filter((d) => d.status === "Delivered").length,
        icon: HiOutlineCheckCircle,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50 border-emerald-200/80",
      },
      {
        label: "Fleet Orders",
        value: deliveries.length,
        icon: HiOutlineUser,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-50 border-purple-200/80",
      },
    ],
    [deliveries],
  );

  const getStatusVariant = (status) => {
    switch (status) {
      case "On the Way":
        return "info";
      case "Picked Up":
        return "warning";
      case "Delivered":
        return "success";
      default:
        return "primary";
    }
  };

  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
      {/* Header Bar */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
              Delivery Tracking
              <span className="text-[10px] px-2 py-0.5 font-medium uppercase tracking-wider rounded-md bg-red-100 text-red-700 border border-red-200">
                Live Fleet
              </span>
            </h1>
            <p className="text-xs font-normal text-slate-500 mt-0.5">
              Monitor active deliveries and assigned delivery partners in real time.
            </p>
          </div>
        </div>
      </BlurFade>

      {/* 2-by-2 Pure White Stats Grid with Colorful Icon Badges */}
      {loading ? (
        <div className="min-h-[250px] flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
          <p className="text-slate-500 font-medium mt-2 text-xs">Tracking Fleet...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            {stats.map((stat, i) => (
              <BlurFade key={i} delay={0.1 + i * 0.05}>
                <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-2.5 transition-all hover:border-slate-300">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
                      {stat.label}
                    </p>
                    <h4 className="text-base sm:text-lg font-semibold text-[#1c1c1e] mt-0.5 tracking-tight truncate">
                      {stat.value}
                    </h4>
                  </div>
                  <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs", stat.iconBg)}>
                    <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={0.3}>
            <div className="border border-slate-200/80 shadow-xs overflow-hidden rounded-xl bg-white space-y-3 p-3.5 sm:p-4">
              {/* Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0 min-w-max">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                          activeTab === tab
                            ? "bg-white text-[#1c1c1e] shadow-2xs font-semibold"
                            : "text-slate-600 hover:text-slate-900",
                        )}>
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Order ID or partner..."
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Delivery List */}
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {paginatedDeliveries.map((dlv, idx) => (
                    <motion.div
                      key={dlv.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group relative bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs hover:border-slate-300 transition-all text-xs">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        {/* Partner Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={dlv.deliveryBoy.image}
                              alt={dlv.deliveryBoy.name}
                              className="h-10 w-10 rounded-lg object-cover border border-slate-200 shadow-2xs"
                            />
                            <div className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-emerald-600 rounded text-[9px] font-semibold text-white">
                              {dlv.deliveryBoy.rating}★
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1c1c1e] text-xs truncate">
                                #{dlv.orderId}
                              </span>
                              <span className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                                dlv.status === 'Delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : dlv.status === 'On the Way'
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {dlv.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">
                              Partner: <span className="text-slate-900 font-semibold">{dlv.deliveryBoy.name}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-normal truncate">
                              Customer: {dlv.customerName} • {dlv.address}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <a
                            href={`tel:${dlv.deliveryBoy.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-md text-[11px] font-medium text-slate-700 border border-slate-200 transition-colors"
                          >
                            <HiOutlinePhone className="h-3 w-3 text-slate-500" />
                            <span>Call</span>
                          </a>

                          {dlv.addressCoords &&
                            typeof dlv.addressCoords.lat === "number" &&
                            typeof dlv.addressCoords.lng === "number" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const { lat, lng } = dlv.addressCoords;
                                  window.open(
                                    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                                    "_blank",
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-md text-[11px] font-medium text-red-600 border border-red-200 transition-colors cursor-pointer"
                              >
                                <HiOutlineMapPin className="h-3 w-3 text-red-500" />
                                <span>Map</span>
                              </button>
                            )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredDeliveries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-center">
                    <HiOutlineTruck className="h-8 w-8 text-slate-400 mb-2" />
                    <h3 className="text-xs font-semibold text-[#1c1c1e]">
                      No active tracking orders found
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                      Adjust search query or switch between filter tabs.
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredDeliveries.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <Pagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(filteredDeliveries.length / pageSize))}
                    total={filteredDeliveries.length}
                    pageSize={pageSize}
                    onPageChange={(newPage) => setPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    loading={loading}
                  />
                </div>
              )}
            </div>
          </BlurFade>
        </>
      )}
    </div>
  );
};

export default DeliveryTracking;
