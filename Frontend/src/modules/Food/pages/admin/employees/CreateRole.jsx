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
    // Preserving dashboard permissions as explicitly requested by user
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

  const getModuleState = (moduleKey) => {
    const rootNode = rawPermissionTree.find(n => n.permissionKey === moduleKey);
    if (!rootNode) return { checked: false, indeterminate: false };

    let totalApplicable = 0;
    let totalSelected = 0;

    const traverse = (n) => {
      if (!n.children || n.children.length === 0) {
        const permissions = roleData.permissions[n.permissionKey] || { view: false, create: false, edit: false, delete: false };
        const actions = ["view", "create", "edit", "delete"];
        actions.forEach(a => {
          const isAllowed = !n.allowedActions || n.allowedActions.includes(a);
          if (isAllowed) {
            totalApplicable++;
            if (permissions[a]) {
              totalSelected++;
            }
          }
        });
      } else {
        n.children.forEach(traverse);
      }
    };

    traverse(rootNode);

    if (totalApplicable === 0) return { checked: false, indeterminate: false };
    return {
      checked: totalSelected === totalApplicable,
      indeterminate: totalSelected > 0 && totalSelected < totalApplicable
    };
  };

  const foodState = useMemo(() => getModuleState("food"), [roleData.permissions, rawPermissionTree]);
  const quickState = useMemo(() => getModuleState("quick"), [roleData.permissions, rawPermissionTree]);

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
      view: { icon: "👁", label: "View", color: "text-blue-500" },
      create: { icon: "➕", label: "Create", color: "text-green-500" },
      edit: { icon: "✏️", label: "Edit", color: "text-amber-500" },
      delete: { icon: "🗑", label: "Delete", color: "text-red-500" }
    };

    return (
      <div key={node.permissionKey} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center justify-between py-3 px-4 border-b border-neutral-50 hover:bg-neutral-50/80 transition-all duration-200 group min-w-[720px]",
            depth === 0 && "bg-neutral-100/50 border-neutral-200/50 backdrop-blur-sm",
            depth === 1 && "bg-white"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div 
              className="flex items-center gap-2 cursor-pointer select-none" 
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
              {depth === 0 && (node.permissionKey === "food" || node.permissionKey === "quick") && (
                <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center mr-1">
                  <Checkbox 
                    checked={
                      node.permissionKey === "food" 
                        ? (foodState.checked ? true : foodState.indeterminate ? "indeterminate" : false)
                        : (quickState.checked ? true : quickState.indeterminate ? "indeterminate" : false)
                    }
                    onCheckedChange={(checked) => {
                      handleSectionSelectAll(node, checked === true || checked === "indeterminate");
                    }}
                    className="w-4.5 h-4.5 border-2 border-neutral-800 transition-all duration-200"
                  />
                </div>
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

          <div className="flex items-center gap-4 md:gap-8 shrink-0 justify-end w-[280px] md:w-[320px]">
            {["view", "create", "edit", "delete"].map(action => {
              const isAllowed = !node.allowedActions || node.allowedActions.includes(action);
              return (
                <div key={action} className="flex flex-col items-center gap-1.5 min-w-[44px]" title={depth > 0 ? actionIcons[action].label : ""}>
                  {depth === 0 ? (
                    <span className={cn("text-[9px] font-bold uppercase tracking-tighter", actionIcons[action].color)}>
                      {actionIcons[action].label}
                    </span>
                  ) : (
                    hasChildren ? (
                      <div className="w-4.5 h-4.5" />
                    ) : isAllowed ? (
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

            <div className="w-12 flex justify-center border-l border-neutral-100 ml-2">
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
                      ? "bg-primary/10 text-primary" 
                      : "text-neutral-400 hover:text-primary hover:bg-primary/5"
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
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-100/50 sticky top-4 z-20">
        <div className="flex items-center gap-5">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/ecs/food/employee-role")}
            className="rounded-2xl hover:bg-neutral-100 h-12 w-12 transition-all active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-neutral-900 tracking-tighter flex items-center gap-2.5">
              <div className="bg-primary/10 p-2 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              {isEdit ? "EDIT ACCESS ROLE" : "CREATE STAFF ROLE"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Security Layer</span>
              <div className="w-1 h-1 rounded-full bg-neutral-300" />
              <p className="text-xs text-neutral-500 font-medium">Define granular access levels for administrative modules.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedCount} Permissions</span>
            <span className="text-[9px] text-neutral-400 font-bold uppercase">Ready to Commit</span>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate("/ecs/food/employee-role")}
            className="rounded-2xl border-neutral-200 text-neutral-600 h-12 px-6 font-bold transition-all hover:bg-neutral-50"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-2xl bg-primary hover:bg-primary/90 text-white h-12 px-8 font-black shadow-2xl shadow-primary/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "PROVISIONING..." : <><Save className="w-4 h-4 mr-2" /> {isEdit ? "UPDATE ROLE" : "SAVE ROLE"}</>}
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

          <div className="bg-violet-600 p-8 rounded-[2rem] shadow-2xl shadow-violet-600/30 text-white space-y-6">
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
            <div className="p-5 bg-primary border-b border-primary/80 flex flex-col md:flex-row items-center gap-4">
               <div className="relative flex-1 w-full">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                 <input 
                  type="text"
                  placeholder="Search permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/15 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/50 transition-all font-bold"
                 />
               </div>
               <div className="flex items-center gap-2 shrink-0">
                 <Button type="button" size="sm" onClick={expandAll} className="bg-white/15 hover:bg-white/25 text-white rounded-xl font-bold text-[10px]">
                   <Maximize2 className="w-3 h-3 mr-1.5" /> EXPAND ALL
                 </Button>
                 <Button type="button" size="sm" onClick={collapseAll} className="bg-white/15 hover:bg-white/25 text-white rounded-xl font-bold text-[10px]">
                   <Minimize2 className="w-3 h-3 mr-1.5" /> COLLAPSE ALL
                 </Button>
                </div>
             </div>

            {/* Module Quick Access Toggles */}
            <div className="p-4 bg-neutral-50/60 border-b border-neutral-200/60 flex flex-wrap items-center gap-6 px-6">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Quick Section Toggles:</span>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md transition-all duration-200">
                <Checkbox 
                  id="toggle-food-module"
                  checked={foodState.checked ? true : foodState.indeterminate ? "indeterminate" : false}
                  onCheckedChange={(checked) => {
                    const rootNode = rawPermissionTree.find(n => n.permissionKey === "food");
                    if (rootNode) {
                      handleSectionSelectAll(rootNode, checked === true || checked === "indeterminate");
                    }
                  }}
                  className="w-4.5 h-4.5 border-2 border-neutral-800 transition-all duration-200"
                />
                <label htmlFor="toggle-food-module" className="text-xs font-bold text-neutral-700 cursor-pointer select-none flex items-center gap-1.5">
                  🍔 Food Section
                </label>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md transition-all duration-200">
                <Checkbox 
                  id="toggle-quick-module"
                  checked={quickState.checked ? true : quickState.indeterminate ? "indeterminate" : false}
                  onCheckedChange={(checked) => {
                    const rootNode = rawPermissionTree.find(n => n.permissionKey === "quick");
                    if (rootNode) {
                      handleSectionSelectAll(rootNode, checked === true || checked === "indeterminate");
                    }
                  }}
                  className="w-4.5 h-4.5 border-2 border-neutral-800 transition-all duration-200"
                />
                <label htmlFor="toggle-quick-module" className="text-xs font-bold text-neutral-700 cursor-pointer select-none flex items-center gap-1.5">
                  ⚡ Quick Commerce Section
                </label>
              </div>
            </div>

             {/* Tree Container */}
            <div className="bg-white min-h-[600px] max-h-[800px] overflow-x-auto overflow-y-auto custom-scrollbar flex flex-col">
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
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" /> ACTIVE INHERITANCE</div>
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
