import { useState, useEffect, useMemo } from "react";
import { 
  Plus, Edit2, Trash2, Search, ShieldCheck, ToggleLeft, ToggleRight,
  MoreVertical, Users, CheckCircle2, AlertCircle, Copy,
  ArrowRight, ShieldAlert, Layers
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Badge } from "@food/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@food/components/ui/dropdown-menu";
import { toast } from "react-hot-toast";
import axiosInstance from "@food/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";

export default function RoleList() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedPermissions, setResolvedPermissions] = useState({});

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/food/admin/roles");
      if (response.data.success) {
        setRoles(response.data.data || []);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }

      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };

    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const rolePermissionKey = "food::staff_management::roles";
  const canCreateRole = canPerformAdminPermissionAction(currentUser, resolvedPermissions, rolePermissionKey, "create");
  const canEditRole = canPerformAdminPermissionAction(currentUser, resolvedPermissions, rolePermissionKey, "edit");
  const canDeleteRole = canPerformAdminPermissionAction(currentUser, resolvedPermissions, rolePermissionKey, "delete");

  const handleToggleStatus = async (roleId) => {
    if (!canEditRole) {
      toast.error("You do not have permission to update roles");
      return;
    }
    try {
      const response = await axiosInstance.patch(`/food/admin/roles/${roleId}/toggle`);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchRoles();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to toggle status");
    }
  };

  const filteredRoles = (roles || []).filter(role => 
    role.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { 
      label: "TOTAL ROLES", 
      value: (roles || []).length, 
      icon: Layers, 
      color: "bg-[#6412c6]", 
      textColor: "text-white",
      sub: "Administrative Layers"
    },
    { 
      label: "ACTIVE", 
      value: (roles || []).filter(r => r.status === 'active').length, 
      icon: CheckCircle2, 
      color: "bg-[#9359d7]", 
      textColor: "text-white",
      sub: "Operational Access"
    },
    { 
      label: "INACTIVE", 
      value: (roles || []).filter(r => r.status !== 'active').length, 
      icon: ShieldAlert, 
      color: "bg-[#c1a0e8]", 
      textColor: "text-white",
      sub: "Restricted Access"
    }
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
             <div className="bg-[#f0e7f9] p-2.5 rounded-2xl">
               <ShieldCheck className="w-8 h-8 text-[#6412c6]" />
             </div>
             <div>
               <h1 className="text-2xl font-black text-neutral-900 tracking-tighter">
                 ROLES & PERMISSIONS
               </h1>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Access Control</span>
                  <div className="w-1 h-1 rounded-full bg-neutral-300" />
                  <p className="text-xs text-neutral-500 font-medium">Provision and audit administrative security policies.</p>
               </div>
             </div>
          </div>
        </div>
        {canCreateRole && (
          <Button 
            onClick={() => navigate("/ecs/food/employee-role/create")}
            className="bg-[#6412c6] hover:bg-[#550fa8] text-white h-12 px-8 rounded-2xl font-black shadow-2xl shadow-[#6412c6]/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 mr-2" />
            CREATE NEW ROLE
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-xl shadow-neutral-100/50 flex items-center justify-between group hover:border-primary/20 transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[10px] text-neutral-400 font-black tracking-[0.2em]">{stat.label}</p>
              <p className="text-3xl font-black text-neutral-900">{stat.value}</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase">{stat.sub}</p>
            </div>
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300", stat.color, stat.textColor)}>
              <stat.icon className="w-7 h-7" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/50 p-2 rounded-[1.5rem] border border-neutral-100 backdrop-blur-sm">
          <div className="relative w-full md:w-96 ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input 
              placeholder="Search roles by name or intent..." 
              className="pl-10 h-11 bg-white border-neutral-200 focus:ring-0 rounded-2xl text-sm font-medium transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 mr-2">
          </div>
        </div>

        {/* Roles List */}
        <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-2xl shadow-neutral-100/50 overflow-hidden">
          {loading ? (
            <div className="p-12 space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-20 bg-neutral-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="py-24 px-6 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-[#f7f3fc] rounded-[2.5rem] flex items-center justify-center relative">
                <ShieldCheck className="w-12 h-12 text-[#d8c4f1]" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                   <div className="w-4 h-4 bg-[#6412c6]/20 rounded-full animate-ping" />
                </div>
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-black text-neutral-900 tracking-tight">NO ROLES CREATED YET</h3>
                <p className="text-sm text-neutral-500 font-medium leading-relaxed">
                  Start by creating a role to define access boundaries for your staff members.
                </p>
              </div>
              {canCreateRole && (
                <Button 
                  onClick={() => navigate("/ecs/food/employee-role/create")}
                  className="bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-2xl h-12 px-8 font-black shadow-xl shadow-[#6412c6]/20"
                >
                  PROVISION FIRST ROLE <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50 border-b border-neutral-100">
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Layer Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Description</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-center">Permissions</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Security Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRoles.map((role) => (
                    <tr key={role._id} className="hover:bg-neutral-50/50 transition-all duration-200 group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner transition-transform group-hover:scale-110 duration-300",
                            role.status === 'active' ? "bg-[#f0e7f9] text-[#6412c6]" : "bg-neutral-100 text-neutral-400"
                          )}>
                            {role.roleName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-neutral-900 tracking-tight leading-none group-hover:text-[#6412c6] transition-colors">
                              {role.roleName.toUpperCase()}
                            </p>
                            {role.isDefault && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                 <div className="w-1.5 h-1.5 rounded-full bg-[#6412c6] shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                 <span className="text-[9px] font-black text-[#6412c6] uppercase tracking-widest">SYSTEM CORE</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs text-neutral-500 font-bold max-w-xs leading-relaxed line-clamp-2">
                          {role.description || "Operational boundary not explicitly defined."}
                        </p>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <Badge className="bg-[#6412c6] text-[10px] font-black text-white hover:bg-[#550fa8] transition-all px-3 py-1 rounded-xl shadow-lg shadow-[#6412c6]/20">
                          {Object.keys(role.permissions || {}).length} MODULES
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => handleToggleStatus(role._id)}
                          disabled={!canEditRole}
                          className={cn(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                            role.status === 'active' 
                            ? 'bg-[#f7f3fc] text-[#550fa8] border border-[#f0e7f9] hover:bg-[#f0e7f9]' 
                            : 'bg-neutral-50 text-neutral-400 border border-neutral-100 hover:bg-neutral-100'
                          )}
                        >
                          {role.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {role.status === 'active' ? 'ENFORCED' : 'RESTRICTED'}
                        </button>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-10 w-10 rounded-xl hover:bg-neutral-100 transition-all">
                              <MoreVertical className="h-5 w-5 text-neutral-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-neutral-100 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-3 py-2">Role Management</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-neutral-100" />
                            {canEditRole && (
                              <DropdownMenuItem 
                                className="rounded-xl h-11 font-bold text-sm focus:bg-[#f7f3fc] focus:text-[#6412c6] cursor-pointer px-3"
                                onClick={() => navigate(`/ecs/food/employee-role/edit/${role._id}`)}
                              >
                                <Edit2 className="w-4 h-4 mr-3 opacity-60" /> Edit Configuration
                              </DropdownMenuItem>
                            )}
                            {!role.isDefault && canDeleteRole && (
                              <>
                                <DropdownMenuSeparator className="bg-neutral-100" />
                                <DropdownMenuItem 
                                  className="rounded-xl h-11 font-bold text-sm text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer px-3" 
                                  onClick={() => toast.error("Revocation requires SuperAdmin approval")}
                                >
                                  <Trash2 className="w-4 h-4 mr-3 opacity-60" /> Revoke Role
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between text-[10px] font-black text-neutral-300 uppercase tracking-[0.3em] px-4">
           <div className="flex items-center gap-6">
             <span>SECURED BY ITZO CORE</span>
             <span>RBAC v2.1.0</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#6412c6] shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              NODE STATUS: STABLE
           </div>
        </div>
      </div>
    </div>
  );
}
