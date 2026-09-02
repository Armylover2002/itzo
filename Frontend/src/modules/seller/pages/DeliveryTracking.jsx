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
            deliveryBoy: order.deliveryBoy ? {
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
              ? `${order.address.address || ""}, ${order.address.city || ""}`.trim()
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
        color: "text-primary",
        bg: "bg-[#fef4f4]",
      },
      {
        label: "At Store",
        value: deliveries.filter((d) => d.status === "Picked Up").length,
        icon: HiOutlineMapPin,
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
      {
        label: "Completed Today",
        value: deliveries.filter((d) => d.status === "Delivered").length,
        icon: HiOutlineCheckCircle,
        color: "text-primary",
        bg: "bg-[#fef4f4]",
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
    <div className="space-y-6 pb-16">
      <BlurFade delay={0.1}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Delivery Tracking
              <Badge
                variant="primary"
                className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase bg-[#fde8ea] text-[#a2141c]">
                Live Fleet
              </Badge>
            </h1>
            <p className="text-slate-600 text-base mt-0.5 font-medium">
              Monitor active deliveries and assigned delivery partners.
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Stats Grid */}
      {loading ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-slate-600 font-bold mt-4 uppercase tracking-widest text-xs">Tracking Fleet...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <BlurFade key={i} delay={0.1 + i * 0.05}>
                <MagicCard
                  className="border-none shadow-sm ring-1 ring-slate-100 p-0 overflow-hidden group bg-white"
                  gradientColor={
                    stat.color === "text-primary"
                      ? "#e0f2fe"
                      : stat.color === "text-amber-600"
                        ? "#fef3c7"
                        : "#dcfce7"
                  }>
                  <div className="flex items-center gap-4 p-5 relative z-10">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-sm",
                        stat.bg,
                        stat.color,
                      )}>
                      <stat.icon className="h-7 w-7" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs font-black text-slate-600 uppercase tracking-widest">
                        {stat.label}
                      </p>
                      <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-none mt-1">
                        {stat.value}
                      </h4>
                    </div>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>

          <BlurFade delay={0.3}>
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-lg bg-white">
              {/* Tabs & Search */}
              <div className="border-b border-slate-100 bg-slate-50/30">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between px-6">
                  <div className="flex items-center">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "relative py-5 px-6 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                          activeTab === tab
                            ? "text-[#E71D28] bg-white/50"
                            : "text-slate-600 hover:text-slate-700",
                        )}>
                        {tab}
                        {activeTab === tab && (
                          <motion.div
                            layoutId="tab-underline-tracking"
                            className="absolute bottom-0 left-0 right-0 h-1 bg-[#E71D28] rounded-t-full mx-4"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="py-3 lg:py-0 w-full lg:w-72">
                    <div className="relative group">
                      <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-primary transition-all" />
                      <input
                        type="text"
                        placeholder="Search Order ID or Partner..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border-none rounded-lg text-sm font-bold text-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery List */}
              <div className="p-4 sm:p-6 space-y-4">
                <AnimatePresence mode="popLayout">
                  {paginatedDeliveries.map((dlv, idx) => (
                    <motion.div
                      key={dlv.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative bg-white rounded-lg border border-slate-100 p-2 sm:p-1 hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500 min-w-0">
                      <div className="flex flex-col lg:flex-row items-stretch gap-3 sm:gap-1">
                        {/* Partner Info Section */}
                        <div className="lg:w-1/3 p-3 sm:p-5 bg-slate-50/50 rounded-lg border border-transparent group-hover:bg-primary/[0.02] group-hover:border-primary/5 transition-all min-w-0">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="relative shrink-0">
                              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg overflow-hidden ring-2 sm:ring-4 ring-white shadow-md">
                                <img
                                  src={dlv.deliveryBoy.image}
                                  alt={dlv.deliveryBoy.name}
                                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 h-5 w-5 sm:h-6 sm:w-6 bg-emerald-500 rounded-md border-2 border-white flex items-center justify-center text-white text-[9px] sm:text-[10px] font-black shadow-sm">
                                {dlv.deliveryBoy.rating}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">
                                Delivery Partner
                              </p>
                              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-none truncate">
                                {dlv.deliveryBoy.name}
                              </h3>
                              <a
                                href={`tel:${dlv.deliveryBoy.phone}`}
                                className="inline-flex items-center gap-1.5 mt-1.5 sm:mt-2 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white rounded-lg text-[10px] sm:text-[11px] font-black text-slate-800 shadow-sm border border-slate-100 hover:bg-primary hover:text-white hover:border-primary transition-all"
                              >
                                <HiOutlinePhone className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                                <span className="truncate">{dlv.deliveryBoy.phone}</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Order Info Section */}
                        <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-1.5">
                                <span className="text-[11px] sm:text-xs font-black text-slate-900 tracking-tight break-all">
                                  #{dlv.orderId}
                                </span>
                                <Badge
                                  variant={getStatusVariant(dlv.status)}
                                  className="text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0"
                                >
                                  {dlv.status}
                                </Badge>
                              </div>
                              <h4 className="text-[11px] sm:text-xs font-bold text-slate-600 flex items-center gap-1.5 flex-wrap">
                                <HiOutlineUser className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-600 shrink-0" />
                                Customer:{" "}
                                <span className="text-slate-900 capitalize">{dlv.customerName}</span>
                              </h4>
                            </div>
                            <div className="sm:text-right shrink-0">
                              <p className="text-[9px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
                                Order Date & Time
                              </p>
                              <p className="text-xs sm:text-sm font-black text-primary tracking-tight">
                                {dlv.orderDate && dlv.startTime ? `${dlv.orderDate} • ${dlv.startTime}` : dlv.startTime || dlv.orderDate || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-50/50 p-3 sm:p-4 rounded-lg border border-slate-100/50 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                              <p className="text-[9px] sm:text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <HiOutlineMapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
                                Customer Address
                              </p>
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
                                    className="text-[10px] font-bold text-primary hover:underline"
                                  >
                                    View on map
                                  </button>
                                )}
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-700 leading-relaxed break-words">
                              {dlv.address}
                            </p>
                          </div>
                        </div>

                        {/* Action Button Section */}
                        <div className="lg:w-16 flex items-center justify-center p-2 sm:p-3 shrink-0">
                          <button className="h-10 w-10 lg:h-full lg:w-full bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark rounded-lg lg:rounded-r-lg lg:rounded-l-none flex items-center justify-center text-white transition-all duration-500 shadow-xl">
                            <HiOutlineTruck className="h-5 w-5 group-hover:scale-125 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredDeliveries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <div className="h-20 w-20 bg-white rounded-lg flex items-center justify-center shadow-sm mb-4">
                      <HiOutlineTruck className="h-10 w-10 text-slate-200" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">
                      No active tracking found
                    </h3>
                    <p className="text-sm text-slate-600 font-bold uppercase tracking-widest mt-2">
                      Adjust filters or search terms
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredDeliveries.length > 0 && (
                <div className="px-4 sm:px-6 pb-4">
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
            </Card>
          </BlurFade>
        </>
      )}
    </div>
  );
};

export default DeliveryTracking;
