import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ChevronLeft, Save, ShieldCheck, ChevronRight, ChevronDown, 
  Check, Info, Search, ListFilter, Layers, 
  Maximize2, Minimize2, CheckSquare, Square, Copy, Trash2
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Textarea } from "@food/components/ui/textarea";
import { Checkbox } from "@food/components/ui/checkbox";
import { toast } from "react-hot-toast";
import axiosInstance from "@food/api";
import { generatePermissionTree } from "@food/utils/permissionGenerator";
import { cn } from "@/lib/utils";
import { getCachedSettings } from "@/modules/common/utils/businessSettings";

export default function CreateRole() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [roleData, setRoleData] = useState({
    roleName: "",
    description: "",
    permissions: {}, // Flat map for API: { key: { view: true, ... } }
  });
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [enabledModules, setEnabledModules] = useState(() => {
    const cached = getCachedSettings();
    return cached?.modules || null;
  });
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const buildSubmitPermissions = (permissions) => {
    const nextPermissions = { ...(permissions || {}) };
    delete nextPermissions["food::dashboard"];
    delete nextPermissions["quick::dashboard"];
    return nextPermissions;
  };

  // Generate tree from sidebar configs
  const rawPermissionTree = useMemo(() => generatePermissionTree(enabledModules), [enabledModules]);

  // Filter tree based on search
  const permissionTree = useMemo(() => {
    if (!searchQuery.trim()) return rawPermissionTree;
    
    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matches = node.label.toLowerCase().includes(searchQuery.toLowerCase());
        const filteredChildren = node.children ? filterNodes(node.children) : [];
        
        if (matches || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }).filter(Boolean);
    };
    
    return filterNodes(rawPermissionTree);
  }, [rawPermissionTree, searchQuery]);

  useEffect(() => {
    const initPage = async () => {
      try {
        setFetching(true);
        const settingsRes = await axiosInstance.get("/common/settings");
        const settings = settingsRes.data.data || settingsRes.data;
        if (settings?.modules) setEnabledModules(settings.modules);

        if (isEdit) {
          const roleRes = await axiosInstance.get(`/food/admin/roles/${id}`);
          if (roleRes.data.success) {
            const data = roleRes.data.data;
            setRoleData({
              roleName: data.roleName,
              description: data.description || "",
              permissions: data.permissions || {},
            });
            // Auto expand roots for edit
            setExpandedNodes(new Set(["food", "quick", "global"]));
          }
        } else {
          setExpandedNodes(new Set(["food", "quick", "global"]));
        }
      } catch (error) {
        const cached = getCachedSettings();
        if (!cached?.modules) {
          toast.error("Failed to load page data");
          if (isEdit) navigate("/ecs/food/employee-role");
        } else {
          console.warn("Failed to fetch fresh settings, using cached settings:", error);
          if (isEdit) {
            // Still try to load the role even if settings failed but we have cache
            try {
              const roleRes = await axiosInstance.get(`/food/admin/roles/${id}`);
              if (roleRes.data.success) {
                const data = roleRes.data.data;
                setRoleData({
                  roleName: data.roleName,
                  description: data.description || "",
                  permissions: data.permissions || {},
                });
                setExpandedNodes(new Set(["food", "quick", "global"]));
              }
            } catch (roleError) {
              toast.error("Failed to load role data");
              navigate("/ecs/food/employee-role");
            }
          }
        }
      } finally {
        setFetching(false);
      }
    };
    initPage();
  }, [id, isEdit, navigate]);

  const toggleExpand = (nodeKey) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(nodeKey)) newSet.delete(nodeKey);
    else newSet.add(nodeKey);
    setExpandedNodes(newSet);
  };

  const expandAll = () => {
    const allKeys = new Set();
    const collectKeys = (nodes) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allKeys.add(n.permissionKey);
          collectKeys(n.children);
        }
      });
    };
    collectKeys(rawPermissionTree);
    setExpandedNodes(allKeys);
  };

  const collapseAll = () => setExpandedNodes(new Set());

  /**
   * Logic Fix: Child select -> auto preserve parent visibility
   */
  const ensureParentVisibility = (targetKey, newPermissions) => {
    const parts = targetKey.split('::');
    if (parts.length <= 1) return;

    for (let i = 1; i < parts.length; i++) {
      const parentKey = parts.slice(0, i).join('::');
      if (!newPermissions[parentKey]) {
        newPermissions[parentKey] = { view: false, create: false, edit: false, delete: false };
      }
      newPermissions[parentKey].view = true;
    }
  };

  /**
   * Checkbox Logic Fix
   */
  const handlePermissionChange = (node, action, isChecked) => {
    const newPermissions = { ...roleData.permissions };
    const key = node.permissionKey;

    if (!newPermissions[key]) {
      newPermissions[key] = { view: false, create: false, edit: false, delete: false };
    }

    newPermissions[key][action] = isChecked;

    // Rule 2: If create/edit/delete selected -> AUTO enable View
    if (isChecked && (action === "create" || action === "edit" || action === "delete")) {
      newPermissions[key].view = true;
    }

    // Rule 3: Unchecking View -> remove all other actions
    if (!isChecked && action === "view") {
      newPermissions[key].create = false;
      newPermissions[key].edit = false;
      newPermissions[key].delete = false;
    }

    // Rule 5: Child select -> preserve parent visibility
    if (isChecked) {
      ensureParentVisibility(key, newPermissions);
    }

    setRoleData(prev => ({ ...prev, permissions: newPermissions }));
  };

  /**
   * Select All Section (Explicit Action)
   */
  const handleSectionSelectAll = (node, isChecked) => {
    const newPermissions = { ...roleData.permissions };
    const actions = ["view", "create", "edit", "delete"];
    
    const applyRecursive = (n) => {
      const k = n.permissionKey;
      if (!newPermissions[k]) newPermissions[k] = { view: false, create: false, edit: false, delete: false };
      actions.forEach(a => {
        const isAllowed = !n.allowedActions || n.allowedActions.includes(a);
        if (isAllowed) {
          newPermissions[k][a] = isChecked;
        }
      });
      if (n.children) n.children.forEach(applyRecursive);
    };

    applyRecursive(node);
    if (isChecked) ensureParentVisibility(node.permissionKey, newPermissions);

    setRoleData(prev => ({ ...prev, permissions: newPermissions }));
  };

  const selectedCount = useMemo(() => {
    let count = 0;
    Object.values(roleData.permissions).forEach(p => {
      if (p.view || p.create || p.edit || p.delete) count++;
    });
    return count;
  }, [roleData.permissions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleData.roleName.trim()) return toast.error("Role name is required");

    try {
      setLoading(true);
      const url = isEdit ? `/food/admin/roles/${id}` : "/food/admin/roles";
      const method = isEdit ? "patch" : "post";
      const payload = {
        ...roleData,
        permissions: buildSubmitPermissions(roleData.permissions),
      };
      
      const response = await axiosInstance[method](url, payload);
      if (response.data.success) {
        toast.success(response.data.message);
        navigate("/ecs/food/employee-role");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  const renderPermissionNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.permissionKey);
    const hasChildren = node.children && node.children.length > 0;
    const permissions = roleData.permissions[node.permissionKey] || { view: false, create: false, edit: false, delete: false };
    
    const actionIcons = {
      view: { icon: "👁", label: "View", color: "text-[#9359d7]" },
      create: { icon: "➕", label: "Create", color: "text-[#6412c6]" },
      edit: { icon: "✏️", label: "Edit", color: "text-[#550fa8]" },
      delete: { icon: "🗑", label: "Delete", color: "text-red-500" }
    };

    return (
      <div key={node.permissionKey} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center justify-between py-3 px-4 border-b border-neutral-50 hover:bg-neutral-50/80 transition-all duration-200 group",
            depth === 0 && "bg-neutral-100/50 border-neutral-200/50 backdrop-blur-sm",
            depth === 1 && "bg-white"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div 
              className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0" 
              onClick={() => hasChildren && toggleExpand(node.permissionKey)}
              style={{ paddingLeft: `${depth * 20}px` }}
            >
              {hasChildren ? (
                isExpanded ? 
                  <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : 
                  <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <span className={cn(
                "text-sm truncate",
                depth === 0 ? "font-black text-neutral-800 uppercase text-[11px] tracking-widest" : 
                depth === 1 ? "font-bold text-neutral-700" : "text-neutral-600 font-medium"
              )}>
                {node.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-8 shrink-0">
            {["view", "create", "edit", "delete"].map(action => {
              const isAllowed = !node.allowedActions || node.allowedActions.includes(action);
              return (
                <div key={action} className="flex flex-col items-center gap-1.5 min-w-[36px] md:min-w-[44px] shrink-0" title={depth > 0 ? actionIcons[action].label : ""}>
                  {depth === 0 ? (
                    <span className={cn("text-[9px] font-bold uppercase tracking-tighter", actionIcons[action].color)}>
                      {actionIcons[action].label}
                    </span>
                  ) : (
                    isAllowed ? (
                      <Checkbox 
                        checked={permissions[action]}
                        onCheckedChange={(checked) => handlePermissionChange(node, action, checked)}
                        className={cn(
                          "w-4.5 h-4.5 border-2 border-neutral-800 transition-all duration-200",
                          permissions[action] && "scale-110 shadow-sm"
                        )}
                      />
                    ) : (
                      <div className="w-4.5 h-4.5 flex items-center justify-center opacity-30" title={`'${actionIcons[action].label}' not applicable`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      </div>
                    )
                  )}
                </div>
              );
            })}

            <div className="w-12 flex justify-center border-l border-neutral-100 ml-2 shrink-0">
               {depth > 0 && (
                 <button 
                  type="button"
                  onClick={() => {
                    const applicableActions = ["view", "create", "edit", "delete"].filter(a => !node.allowedActions || node.allowedActions.includes(a));
                    const allSelected = applicableActions.length > 0 ? applicableActions.every(a => permissions[a]) : false;
                    handleSectionSelectAll(node, !allSelected);
                  }}
                  className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded transition-all duration-200",
                    (() => {
                      const applicableActions = ["view", "create", "edit", "delete"].filter(a => !node.allowedActions || node.allowedActions.includes(a));
                      return applicableActions.length > 0 && applicableActions.every(a => permissions[a]);
                    })()
                      ? "bg-[#f0e7f9] text-[#6412c6]" 
                      : "text-neutral-400 hover:text-[#6412c6] hover:bg-[#f7f3fc]"
                  )}
                 >
                   ALL
                 </button>
               )}
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className={cn(
            "flex flex-col",
            depth === 0 && "bg-neutral-50/20"
          )}>
            {node.children.map(child => renderPermissionNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (fetching) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-neutral-400">
      <Layers className="w-12 h-12 animate-pulse" />
      <p className="text-sm font-bold animate-pulse">Initializing Role Engine...</p>
    </div>
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Sticky Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-100/50 sticky top-4 z-30 gap-4">
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/ecs/food/employee-role")}
            className="rounded-2xl hover:bg-neutral-100 h-10 w-10 md:h-12 md:w-12 transition-all active:scale-90 shrink-0"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-black text-neutral-900 tracking-tighter flex items-center gap-2 md:gap-2.5">
              <div className="bg-[#f0e7f9] p-1.5 md:p-2 rounded-xl shrink-0">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-[#6412c6]" />
              </div>
              <span className="truncate">{isEdit ? "EDIT ACCESS ROLE" : "CREATE STAFF ROLE"}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-1 md:mt-0.5">
              <span className="text-[9px] md:text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">Security Layer</span>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-neutral-300" />
              <p className="text-[10px] md:text-xs text-neutral-500 font-medium truncate sm:whitespace-normal">Define granular access levels for administrative modules.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 md:gap-4 w-full xl:w-auto">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[9px] md:text-[10px] font-black text-[#6412c6] uppercase tracking-widest">{selectedCount} Permissions</span>
            <span className="text-[8px] md:text-[9px] text-neutral-400 font-bold uppercase">Ready to Commit</span>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate("/ecs/food/employee-role")}
            className="rounded-xl md:rounded-2xl border-neutral-200 text-neutral-600 h-10 md:h-12 px-4 md:px-6 text-xs md:text-sm font-bold transition-all hover:bg-neutral-50 flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl md:rounded-2xl bg-[#6412c6] hover:bg-[#550fa8] text-white h-10 md:h-12 px-4 md:px-8 text-xs md:text-sm font-black shadow-lg md:shadow-2xl shadow-[#6412c6]/30 transition-all active:scale-95 disabled:opacity-50 flex-1 sm:flex-none"
          >
            {loading ? "PROVISIONING..." : <><Save className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" /> {isEdit ? "UPDATE ROLE" : "SAVE ROLE"}</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Info (35%) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-[100px]">
          <div className="bg-white p-8 rounded-[2rem] border border-neutral-200 shadow-xl shadow-neutral-100/50 space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
               <Info className="w-5 h-5 text-neutral-400" />
               <h3 className="font-black text-neutral-800 text-xs uppercase tracking-[0.2em]">Primary Config</h3>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Role Title</label>
                <Input 
                  value={roleData.roleName}
                  onChange={(e) => setRoleData(prev => ({ ...prev, roleName: e.target.value }))}
                  placeholder="e.g. Senior Order Manager"
                  className="bg-neutral-50/50 border-neutral-200 focus:bg-white focus:ring-0 transition-all h-14 rounded-2xl text-sm font-bold placeholder:font-medium"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Scope Description</label>
                <Textarea 
                  value={roleData.description}
                  onChange={(e) => setRoleData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the operational boundaries of this role..."
                  className="bg-neutral-50/50 border-neutral-200 focus:bg-white focus:ring-0 transition-all min-h-[160px] rounded-2xl text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#6412c6] p-8 rounded-[2rem] shadow-2xl shadow-[#6412c6]/30 text-white space-y-6">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 opacity-80" />
              <h4 className="font-black text-[11px] uppercase tracking-widest">Permission Logic</h4>
            </div>
            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-[11px] font-bold leading-relaxed opacity-90">Actions (Create/Edit/Delete) automatically grant 'View' access for that section.</p>
               </div>
               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-[11px] font-bold leading-relaxed opacity-90">Removing 'View' access will instantly revoke all associated operational actions.</p>
               </div>
               <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-[11px] font-bold leading-relaxed opacity-90">Hierarchical Select allows provisioning entire sub-trees with a single click.</p>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Tree (65%) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-2xl shadow-neutral-100/50 overflow-hidden flex flex-col">
            {/* Tree Toolbar */}
            <div className="p-5 bg-neutral-900 border-b border-neutral-800 flex flex-col md:flex-row items-center gap-4">
               <div className="relative flex-1 w-full">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                 <input 
                  type="text"
                  placeholder="Search permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:ring-2 focus:ring-[#6412c6]/50 transition-all font-bold"
                 />
               </div>
               <div className="flex items-center gap-2 shrink-0">
                 <Button type="button" size="sm" onClick={expandAll} className="bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl font-bold text-[10px]">
                   <Maximize2 className="w-3 h-3 mr-1.5" /> EXPAND ALL
                 </Button>
                 <Button type="button" size="sm" onClick={collapseAll} className="bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl font-bold text-[10px]">
                   <Minimize2 className="w-3 h-3 mr-1.5" /> COLLAPSE ALL
                 </Button>
               </div>
            </div>

            {/* Tree Container */}
            <div className="bg-white min-h-[600px] max-h-[800px] overflow-y-auto custom-scrollbar flex flex-col">
              {permissionTree.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-4">
                  <Search className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-bold">No permissions match your search</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {permissionTree.map(module => renderPermissionNode(module))}
                </div>
              )}
            </div>

            {/* Tree Footer Info */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[10px] font-black text-neutral-400 uppercase tracking-widest">
               <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#6412c6]" /> ACTIVE INHERITANCE</div>
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-neutral-300" /> SYSTEM DEFAULT</div>
               </div>
               <div>REVISION v1.0.4</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
