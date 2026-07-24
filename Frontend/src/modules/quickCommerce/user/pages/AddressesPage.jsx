import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Home, Briefcase, MapPin, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useLocation } from '../context/LocationContext';

const AddressesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshAddresses } = useLocation();
    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? '');
            setProfilePhone(profile?.phone ?? '');
            setAddresses(raw.map((addr, idx) => ({
                id: addr._id ?? idx,
                type: (addr.label || 'home').charAt(0).toUpperCase() + (addr.label || 'home').slice(1),
                name: profile?.name ?? '',
                address: addr.fullAddress || [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || '',
                city: addr.city,
                state: addr.state,
                pincode: addr.pincode,
                phone: profile?.phone ?? '',
                isDefault: idx === 0
            })));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Auto-open Add modal when navigated from LocationDrawer with ?add=1
    useEffect(() => {
        if (searchParams.get('add') === '1' && !loading) {
            setSearchParams({}, { replace: true });
            openAddModal();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, loading]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [saving, setSaving] = useState(false);

    const [addForm, setAddForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: ''
    });

    const openAddModal = () => {
        setAddForm({
            type: 'home',
            name: profileName,
            phone: profilePhone || '',
            address: '',
            landmark: '',
            city: '',
            state: '',
            pincode: ''
        });
        setIsAddOpen(true);
    };

    const handleSaveNewAddress = async () => {
        const name = addForm.name?.trim();
        const address = addForm.address?.trim();
        const city = addForm.city?.trim();
        const landmark = addForm.landmark?.trim();
        const state = addForm.state?.trim();
        const pincode = addForm.pincode?.trim();
        if (!address) {
            toast.error('Please enter the address');
            return;
        }
        const newAddr = {
            label: addForm.type.toLowerCase(),
            fullAddress: address,
            ...(landmark && { landmark }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode })
        };
        setSaving(true);
        try {
            // Best-effort: store coordinates + placeId so checkout can calculate distance-based delivery fees
            // without repeated Maps calls.
            try {
                const query = [address, landmark, city, state, pincode].filter(Boolean).join(', ');
                const geo = await customerApi.geocodeAddress(query);
                const loc = geo.data?.result?.location;
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                    newAddr.location = { lat: loc.lat, lng: loc.lng };
                    if (geo.data?.result?.placeId) newAddr.placeId = geo.data.result.placeId;
                    if (geo.data?.result?.formattedAddress) newAddr.formattedAddress = geo.data.result.formattedAddress;
                }
            } catch (e) {
                toast.error(
                    e.response?.data?.message ||
                    'Could not fetch coordinates for this address. Delivery fees may be inaccurate.'
                );
            }

            await customerApi.updateProfile({
                ...(name && { name }),
                ...(addForm.phone && { phone: addForm.phone.trim() }),
                addresses: [...rawAddresses, newAddr]
            });
            toast.success('Address saved successfully');
            setIsAddOpen(false);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save address');
        } finally {
            setSaving(false);
        }
    };

    const [editForm, setEditForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: ''
    });
    const [updating, setUpdating] = useState(false);

    const handleEdit = (addr) => {
        setSelectedAddress(addr);
        setEditForm({
            type: (addr.type || 'Home').toLowerCase(),
            name: addr.name ?? '',
            phone: addr.phone ?? '',
            address: addr.address ?? '',
            landmark: addr.landmark ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            pincode: addr.pincode ?? ''
        });
        setIsEditOpen(true);
    };

    const handleUpdateAddress = async () => {
        if (!selectedAddress) return;
        const address = editForm.address?.trim();
        if (!address) {
            toast.error('Please enter the address');
            return;
        }
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsEditOpen(false);
            return;
        }
        const updatedRaw = {
            ...(rawAddresses[idx] && typeof rawAddresses[idx] === 'object' ? rawAddresses[idx] : {}),
            label: editForm.type.toLowerCase(),
            fullAddress: address,
            ...(editForm.landmark?.trim() && { landmark: editForm.landmark.trim() }),
            ...(editForm.city?.trim() && { city: editForm.city.trim() }),
            ...(editForm.state?.trim() && { state: editForm.state.trim() }),
            ...(editForm.pincode?.trim() && { pincode: editForm.pincode.trim() })
        };

        // Best-effort: refresh coordinates + placeId whenever address fields change.
        try {
            const query = [
                editForm.address?.trim(),
                editForm.landmark?.trim(),
                editForm.city?.trim(),
                editForm.state?.trim(),
                editForm.pincode?.trim(),
            ].filter(Boolean).join(', ');
            const geo = await customerApi.geocodeAddress(query);
            const loc = geo.data?.result?.location;
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                updatedRaw.location = { lat: loc.lat, lng: loc.lng };
                if (geo.data?.result?.placeId) updatedRaw.placeId = geo.data.result.placeId;
                if (geo.data?.result?.formattedAddress) updatedRaw.formattedAddress = geo.data.result.formattedAddress;
            }
        } catch (e) {
            toast.error(
                e.response?.data?.message ||
                'Could not refresh coordinates for this address. Delivery fees may be inaccurate.'
            );
        }

        const updatedAddresses = rawAddresses.map((raw, i) => (i === idx ? updatedRaw : raw));
        setUpdating(true);
        try {
            await customerApi.updateProfile({
                ...(editForm.name?.trim() && { name: editForm.name.trim() }),
                ...(editForm.phone?.trim() && { phone: editForm.phone.trim() }),
                addresses: updatedAddresses
            });
            toast.success('Address updated successfully');
            setIsEditOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update address');
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = (addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    };

    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsDeleteOpen(false);
            return;
        }
        const updatedAddresses = rawAddresses.filter((_, i) => i !== idx);
        setDeleting(true);
        try {
            await customerApi.updateProfile({ addresses: updatedAddresses });
            toast.success('Address deleted successfully');
            setIsDeleteOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete address');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 font-sans transition-colors duration-500">
            <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-white/5 mb-4 flex items-center gap-2 transition-colors">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800 dark:text-slate-200" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Saved Addresses</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Add New Address Button */}
                <button
                    onClick={openAddModal}
                    className="w-full bg-white dark:bg-card p-4 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-sm">Add New Address</span>
                </button>

                {/* Address List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <p className="text-slate-500 font-medium">Loading addresses...</p>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <MapPin size={30} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-700 font-semibold mb-1">No saved addresses</p>
                            <p className="text-slate-500 text-sm">Add your first delivery address above</p>
                        </div>
                    ) : addresses.map((addr) => (
                        <div key={addr.id} className="bg-white dark:bg-card rounded-xl p-4 border border-slate-200 dark:border-white/5 relative overflow-hidden transition-colors">
                            {addr.isDefault && (
                                <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-bl-lg uppercase tracking-wide">
                                    Default
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                                    {addr.type === 'Home' ? <Home size={18} /> : addr.type === 'Work' ? <Briefcase size={18} /> : <MapPin size={18} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-sm font-semibold text-slate-800">{addr.type}</h3>
                                    </div>
                                    <p className="text-slate-800 font-medium text-sm mb-1">{addr.name}</p>
                                    <p className="text-slate-500 text-xs leading-relaxed mb-1">{addr.address}</p>
                                    <p className="text-slate-500 text-xs mb-2">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                                    <p className="text-slate-700 font-medium text-xs">Phone: {addr.phone}</p>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => handleEdit(addr)}
                                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(addr)}
                                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Address Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Address</DialogTitle>
                        <DialogDescription>
                            Enter your delivery details below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Address Type</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'home' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'home' }))}>Home</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'work' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'work' }))}>Work</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'other' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'other' }))}>Other</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" placeholder="John Doe" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" placeholder="+91 98765 43210" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea id="address" placeholder="Flat No, Building, Street" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="landmark">Nearest Landmark (optional)</Label>
                            <Input
                                id="landmark"
                                placeholder="Near City Mall, Opp. Temple"
                                value={addForm.landmark}
                                onChange={e => setAddForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" placeholder="New Delhi" value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="state">State</Label>
                                <Input id="state" placeholder="Delhi" value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pincode">Pincode</Label>
                            <Input id="pincode" placeholder="110075" value={addForm.pincode} onChange={e => setAddForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
                        <Button className="bg-[#FE5502] hover:bg-[#ea580c]" onClick={handleSaveNewAddress} disabled={saving}>{saving ? 'Saving...' : 'Save Address'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Address Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Address</DialogTitle>
                        <DialogDescription>
                            Update your delivery details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Address Type</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'home' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'home' }))}>Home</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'work' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'work' }))}>Work</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'other' ? 'border-[#FE5502] text-[#FE5502] bg-green-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'other' }))}>Other</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Full Name</Label>
                            <Input id="edit-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-phone">Phone Number</Label>
                            <Input id="edit-phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-address">Address</Label>
                            <Textarea id="edit-address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-landmark">Nearest Landmark (optional)</Label>
                            <Input
                                id="edit-landmark"
                                placeholder="Near City Mall, Opp. Temple"
                                value={editForm.landmark}
                                onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-city">City</Label>
                                <Input id="edit-city" placeholder="New Delhi" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-state">State</Label>
                                <Input id="edit-state" placeholder="Delhi" value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-pincode">Pincode</Label>
                            <Input id="edit-pincode" placeholder="110075" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancel</Button>
                        <Button className="bg-[#FE5502] hover:bg-[#ea580c]" onClick={handleUpdateAddress} disabled={updating}>{updating ? 'Updating...' : 'Update Address'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Address?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this address? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{selectedAddress.type}</span>
                            </div>
                            <p className="text-slate-600 text-sm">{selectedAddress.address}</p>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button variant="destructive" className="bg-red-500 hover:bg-red-600" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddressesPage;
