import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Save, 
  Loader2,
  Settings,
  LayoutGrid,
  Zap,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from "sonner";
import { adminAPI } from "@/services/api";
import { setCachedSettings, getCachedSettings } from "@/modules/common/utils/businessSettings";
import { cn } from "@/lib/utils";

const ModuleCard = ({ title, description, icon: Icon, enabled, onToggle, color }) => (
  <div className={cn(
    "relative group p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden",
    enabled 
      ? `border-${color}-100 bg-${color}-50/30` 
      : "border-gray-100 bg-white"
  )}>
    <div className="flex items-start justify-between relative z-10">
      <div className="flex gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
          enabled ? `bg-${color}-500 text-white` : "bg-gray-100 text-gray-400"
        )}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed max-w-[200px]">
            {description}
          </p>
        </div>
      </div>
      
      <button
        onClick={onToggle}
        className={cn(
          "w-12 h-6 rounded-full relative transition-colors duration-200 outline-none",
          enabled ? `bg-${color}-500` : "bg-gray-200"
        )}
      >
        <div className={cn(
          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
          enabled ? "translate-x-6" : "translate-x-0"
        )} />
      </button>
    </div>
    
    {/* Decorative background shape */}
    <div className={cn(
      "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-10 transition-colors",
      enabled ? `bg-${color}-500` : "bg-transparent"
    )} />
  </div>
);

const ModuleManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState({
    food: true,
    quickCommerce: true,
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings?.modules) {
        setModules({
          food: settings.modules.food ?? true,
          quickCommerce: settings.modules.quickCommerce ?? true,
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load module settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = (name) => {
    setModules(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await adminAPI.updateBusinessSettings({ modules });
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        setCachedSettings(updatedSettings);
        toast.success('Module configuration updated!');
      }
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-10 font-sans">
      
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-black text-gray-800 uppercase tracking-widest">MODULE MANAGEMENT</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">Enable or disable core application features</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
           <span>Customization</span>
           <ChevronRight size={12} strokeWidth={3} />
           <span className="text-gray-600">Modules</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
             <LayoutGrid className="text-indigo-500" size={20} />
             <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">Active Modules</h2>
          </div>
          
          <div className="p-8 lg:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <ModuleCard 
                title="Food Delivery" 
                description="Manage restaurants, menus, and food delivery workflows." 
                icon={Zap} 
                enabled={modules.food} 
                onToggle={() => handleToggle('food')}
                color="red"
              />

              <ModuleCard 
                title="Quick Commerce" 
                description="Instantly deliver groceries and essentials to customers." 
                icon={Zap} 
                enabled={modules.quickCommerce} 
                onToggle={() => handleToggle('quickCommerce')}
                color="green"
              />


            </div>

            <div className="mt-12 bg-indigo-50 rounded-2xl p-6 flex items-start gap-4 border border-indigo-100">
               <AlertCircle className="text-indigo-500 flex-shrink-0 mt-0.5" size={20} />
               <div className="space-y-1">
                  <h4 className="text-sm font-bold text-indigo-900">Important Note</h4>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Disabling a module will hide it from the customer app and ECS dashboard navigation. This action is reversible at any time.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-10 right-10">
         <button 
           onClick={handleSave} 
           disabled={saving} 
           className="bg-indigo-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(79,70,229,0.4)] hover:bg-indigo-700 active:scale-90 transition-all disabled:opacity-50"
         >
            {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
         </button>
      </div>

    </div>
  );
};

export default ModuleManagement;
