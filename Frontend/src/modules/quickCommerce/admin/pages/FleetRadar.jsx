import React, { useState, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineTruck,
  HiOutlineMapPin,
  HiOutlineBolt,
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineXMark,
  HiOutlineChevronRight,
  HiOutlineSignal,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const FleetRadar = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedRider, setSelectedRider] = useState(null);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString(),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [fleet] = useState([
    {
      id: "R-101",
      name: "Amit Kumar",
      status: "delivering",
      battery: 85,
      order: "#ORD-9921",
      distance: "1.2km away",
      coords: { x: 45, y: 35 },
    },
    {
      id: "R-102",
      name: "Sunil Singh",
      status: "idle",
      battery: 42,
      order: null,
      distance: "Nearby Hub",
      coords: { x: 25, y: 65 },
    },
    {
      id: "R-103",
      name: "Vikash Pal",
      status: "picking",
      battery: 92,
      order: "#ORD-9925",
      distance: "0.5km to shop",
      coords: { x: 65, y: 25 },
    },
    {
      id: "R-104",
      name: "Deepak Raj",
      status: "delayed",
      battery: 12,
      order: "#ORD-9901",
      distance: "Stuck in traffic",
      coords: { x: 80, y: 70 },
    },
  ]);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-700 overflow-hidden">
      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Fleet Control Radar
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-full">
              <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Live: {currentTime}
              </span>
            </div>
          </h1>
          <p className="ds-description mt-0.5">
            Real-time tracking and delivery reliability monitor.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Active Riders
              </p>
              <h4 className="text-xl font-black text-slate-900">42 / 50</h4>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Avg Deliv. Time
              </p>
              <h4 className="text-xl font-black text-emerald-600">14.2m</h4>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                SLA Health
              </p>
              <h4 className="text-xl font-black text-primary">98.5%</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Fleet List Side Panel */}
        <div className="lg:w-80 flex flex-col gap-4 h-full shrink-0">
          <Card className="flex-1 flex flex-col border-none shadow-xl ring-1 ring-slate-100 rounded-xl overflow-hidden bg-white">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Active Units
              </h3>
              <HiOutlineSignal className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {fleet.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRider(r)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl transition-all group",
                    selectedRider?.id === r.id
                      ? "bg-red-600 text-white shadow-lg"
                      : "hover:bg-slate-50 text-slate-700",
                  )}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                        selectedRider?.id === r.id
                          ? "bg-white/10"
                          : "bg-slate-100/50",
                      )}>
                      <HiOutlineTruck
                        className={cn(
                          "h-5 w-5",
                          r.status === "delayed"
                            ? "text-rose-500"
                            : "text-primary",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black truncate">
                          {r.name}
                        </p>
                        <Badge
                          variant={
                            r.status === "delivering"
                              ? "success"
                              : r.status === "delayed"
                                ? "danger"
                                : "secondary"
                          }
                          className={cn(
                            "text-[7px] font-black uppercase",
                            selectedRider?.id === r.id &&
                              "bg-white/20 text-white border-none",
                          )}>
                          {r.status}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "text-[9px] font-bold opacity-60 mt-0.5",
                          selectedRider?.id === r.id
                            ? "text-white"
                            : "text-slate-500",
                        )}>
                        {r.distance}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Radar Map Area */}
        <Card className="flex-1 border-none shadow-2xl ring-1 ring-slate-200 rounded-2xl overflow-hidden bg-red-600 relative">
          {/* Dark Map Grid Background */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://api.dicebear.com/7.x/identicon/svg?seed=grid')] bg-[length:100px_100px]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-transparent to-slate-900" />

          {/* Scanning Line Animation */}
          <div className="absolute inset-0 w-full h-[2px] bg-primary/20 shadow-[0_0_20px_rgba(37,99,235,0.5)] animate-scan-slow opacity-20" />

          {/* Radar Content */}
          <div className="relative w-full h-full p-5">
            {fleet.map((r) => (
              <motion.div
                key={r.id}
                className="absolute"
                style={{ left: `${r.coords.x}%`, top: `${r.coords.y}%` }}
                whileHover={{ scale: 1.2 }}>
                <div
                  onClick={() => setSelectedRider(r)}
                  className={cn(
                    "relative h-10 w-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all border-2",
                    selectedRider?.id === r.id
                      ? "bg-primary border-white shadow-[0_0_30px_rgba(37,99,235,0.6)]"
                      : "bg-slate-800 border-slate-700",
                  )}>
                  <HiOutlineTruck
                    className={cn(
                      "h-5 w-5",
                      selectedRider?.id === r.id
                        ? "text-white"
                        : r.status === "delayed"
                          ? "text-rose-500"
                          : "text-primary/60",
                    )}
                  />
                  {r.status === "delivering" && (
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-ping" />
                  )}
                </div>
              </motion.div>
            ))}

            {/* Info Overlay (Top Left) */}
            <AnimatePresence>
              {selectedRider && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute top-4 left-8 w-72">
                  <Card className="bg-slate-950/90 backdrop-blur-xl border border-white/10 p-6 rounded-xl text-white">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                          <HiOutlineTruck className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black">
                            {selectedRider.name}
                          </h4>
                          <p className="text-[10px] font-bold text-white/40">
                            {selectedRider.id}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedRider(null)}>
                        <HiOutlineXMark className="h-5 w-5 text-white/20 hover:text-white" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">
                            Load
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <HiOutlineBolt
                              className={cn(
                                "h-3.5 w-3.5",
                                selectedRider.battery < 20
                                  ? "text-rose-500 animate-pulse"
                                  : "text-emerald-500",
                              )}
                            />
                            <span className="text-xs font-black">
                              {selectedRider.battery}% Energy
                            </span>
                          </div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">
                            Status
                          </p>
                          <p className="text-xs font-black mt-1 uppercase text-primary tracking-tighter">
                            {selectedRider.status}
                          </p>
                        </div>
                      </div>

                      {selectedRider.order && (
                        <div
                          onClick={() => {
                            showToast(
                              `Navigating to ${selectedRider.order} overview...`,
                              "info",
                            );
                            // Navigate to orders list or specific order (mocking destination)
                            navigate("/ecs/orders");
                          }}
                          className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-between group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <HiOutlineClock className="h-4 w-4" />
                            <div>
                              <p className="text-[8px] font-black opacity-60 uppercase">
                                Active Order
                              </p>
                              <p className="text-xs font-black">
                                {selectedRider.order}
                              </p>
                            </div>
                          </div>
                          <HiOutlineChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Legend (Bottom Right) */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-2">
            <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
              <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                Real-time Telemetry Active
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FleetRadar;
