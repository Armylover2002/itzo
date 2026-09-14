import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { deliveryAPI } from "@food/api";
import { toast } from "sonner";
import { useCompanyName } from "@food/hooks/useCompanyName";
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation";

export default function ShowIdCardV2() {
  const companyName = useCompanyName();
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);

  // Fetch delivery partner profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getProfile();
        
        if (response?.data?.success && response?.data?.data?.profile) {
          setProfileData(response.data.data.profile);
        } else {
          toast.error("Failed to load profile data");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load ID card data");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Format date for validity
  const formatValidDate = () => {
    if (!profileData?.createdAt) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const createdDate = new Date(profileData.createdAt);
    const validTill = new Date(createdDate);
    validTill.setFullYear(validTill.getFullYear() + 1);
    return validTill.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Get status display
  const getStatusDisplay = () => {
    if (!profileData) return "Active";
    const status = profileData.status?.toLowerCase() || (profileData.isActive ? 'active' : 'inactive');
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Get status color
  const getStatusColor = () => {
    if (!profileData) return "bg-green-500";
    const status = profileData.status?.toLowerCase() || (profileData.isActive ? 'active' : 'inactive');
    if (status === 'active' || status === 'approved') return "bg-green-500";
    if (status === 'pending') return "bg-yellow-500";
    if (status === 'suspended' || status === 'blocked') return "bg-red-500";
    return "bg-gray-500";
  };

  // Get profile image URL
  const getProfileImageUrl = () => {
    if (profileData?.profileImage?.url) return profileData.profileImage.url;
    if (profileData?.documents?.photo) return profileData.documents.photo;
    const name = profileData?.name || "Delivery Partner";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff8100&color=fff&size=128`;
  };

  // Get vehicle display text
  const getVehicleDisplay = () => {
    if (!profileData?.vehicle) return null;
    const vehicle = profileData.vehicle;
    const parts = [];
    if (vehicle.type) parts.push(vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1));
    if (vehicle.number) parts.push(vehicle.number);
    return parts.length > 0 ? parts.join(" - ") : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
          <p className="text-gray-600">Loading ID card...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load ID card data</p>
          <button onClick={goBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Go Back</button>
        </div>
      </div>
    );
  }

  const idCardData = {
    name: profileData.name || "Delivery Partner",
    id: profileData.deliveryId || profileData._id?.toString().slice(-8).toUpperCase() || "N/A",
    phone: profileData.phone || "N/A",
    status: getStatusDisplay(),
    statusColor: getStatusColor(),
    validTill: formatValidDate(),
    vehicle: getVehicleDisplay(),
    profileImage: getProfileImageUrl()
  };

  return (
    <div className="min-h-screen bg-black relative">
      <div className="max-w-md mx-auto min-h-screen bg-gray-100 relative shadow-2xl">
        {/* Close Button - Top Right */}
        <button
          onClick={goBack}
          className="absolute top-4 right-4 p-2 hover:bg-gray-200 rounded-full transition-colors z-30 bg-white/50 backdrop-blur-md"
        >
          <X className="w-6 h-6 text-black" />
        </button>

        {/* Top Grey Background Section */}
        <div className="bg-gray-300 h-40 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent" />
          {/* Profile Picture */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
            <div className="p-1.5 bg-white rounded-full shadow-2xl">
              <img
                src={idCardData.profileImage}
                alt={idCardData.name}
                className="w-36 h-36 rounded-full object-cover border-4 border-gray-100"
                onError={(e) => {
                  const name = idCardData.name || "Delivery Partner";
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff8100&color=fff&size=128`;
                }}
              />
            </div>
          </div>
        </div>

        {/* Main White Content Area */}
        <div className="bg-white min-h-[calc(100vh-10rem)] relative pt-20 px-6 pb-12">
          <div className="flex flex-col items-center text-center">
            {/* Brand Name */}
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500 mb-2">{companyName}</p>

            {/* Delivery Partner Title */}
            <h1 className="text-4xl font-black text-gray-900 mb-1 leading-tight">PARTNER</h1>
            <h2 className="text-xl font-bold text-gray-400 uppercase tracking-widest mb-6">ID CARD</h2>

            {/* Active Status Badge */}
            <div className="mb-8">
              <span className={`${idCardData.statusColor} text-white px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-green-500/20`}>
                {idCardData.status}
              </span>
            </div>

            {/* Details Grid */}
            <div className="w-full space-y-8 mt-4">
              <div className="flex flex-col items-center">
                 <h3 className="text-2xl font-black text-gray-950 uppercase tracking-tight">{idCardData.name}</h3>
                 <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Full Name</p>
              </div>

              <div className="grid grid-cols-2 gap-8 w-full">
                 <div className="flex flex-col items-center">
                    <span className="text-sm font-black text-gray-950">{idCardData.id}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Partner ID</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-sm font-black text-gray-950">{idCardData.phone}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Mobile</span>
                 </div>
              </div>

              {idCardData.vehicle && (
                <div className="flex flex-col items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <span className="text-sm font-black text-gray-950 uppercase">{idCardData.vehicle}</span>
                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Registered Vehicle</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose">
                   This ID card is issued for essential delivery services only. <br/>
                   Valid On: {idCardData.validTill}
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
