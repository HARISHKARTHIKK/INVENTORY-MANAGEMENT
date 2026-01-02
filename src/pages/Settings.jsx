import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Save, Building2, FileText, Package, Truck, Shield, Calendar, Wrench, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { backfillDispatches } from '../services/firestoreService';
import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { Users } from 'lucide-react';

export default function Settings() {
    const { settings, updateSettings, loading } = useSettings();
    const [formData, setFormData] = useState(null);
    const [activeTab, setActiveTab] = useState('company');
    const [saving, setSaving] = useState(false);

    // User Management State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const snap = await getDocs(collection(db, 'users'));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUserUpdate = async (userId, field, value) => {
        try {
            await updateDoc(doc(db, 'users', userId), { [field]: value });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
        } catch (error) {
            alert("Failed to update user: " + error.message);
        }
    };

    useEffect(() => {
        if (settings) {
            setFormData(JSON.parse(JSON.stringify(settings))); // Deep copy
        }
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettings(formData);
            alert("Settings saved successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const handleLocationChange = (index, field, value) => {
        const newLocs = [...formData.locations];
        newLocs[index][field] = value;
        setFormData(prev => ({ ...prev, locations: newLocs }));
    };

    const addLocation = () => {
        setFormData(prev => ({
            ...prev,
            locations: [...prev.locations, { name: 'New Location', type: 'Warehouse', active: true }]
        }));
    };

    const toggleLocation = (index) => {
        const newLocs = [...formData.locations];
        newLocs[index].active = !newLocs[index].active;
        setFormData(prev => ({ ...prev, locations: newLocs }));
    };

    const handleBackfill = async () => {
        if (!confirm("Sync/Backfill will generate dispatch records for historical invoices. Continue?")) return;
        setSaving(true);
        try {
            const count = await backfillDispatches();
            alert(`Synced ${count} historical invoices.`);
        } catch (e) {
            alert("Sync failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !formData) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    const tabs = [
        { id: 'company', label: 'Company', icon: Building2 },
        { id: 'invoice', label: 'Invoices', icon: FileText },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'locations', label: 'Locations', icon: MapPinIcon },
        { id: 'transport', label: 'Transport', icon: Truck },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'system', label: 'System', icon: Wrench },
    ];

    function MapPinIcon(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> }

    return (
        <div className="space-y-6 animate-fade-in-up pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
                    <p className="text-sm text-slate-500">Manage application configuration and defaults</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 sm:py-2 rounded-lg font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-70"
                >
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Save Changes
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Tabs - Horizontal Scroll on Mobile */}
                <div className="w-full lg:w-64 flex-shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible items-center lg:items-stretch gap-1 pb-2 lg:pb-0 scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 whitespace-nowrap flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 min-h-[500px]">
                    {activeTab === 'company' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Company Details</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                <input type="text" className="w-full p-2.5 border rounded-lg" value={formData.company.name} onChange={e => handleChange('company', 'name', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Address</label>
                                <textarea rows="3" className="w-full p-2.5 border rounded-lg" value={formData.company.address} onChange={e => handleChange('company', 'address', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                                    <input type="text" className="w-full p-2.5 border rounded-lg" value={formData.company.gstin} onChange={e => handleChange('company', 'gstin', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">PAN</label>
                                    <input type="text" className="w-full p-2.5 border rounded-lg" value={formData.company.pan} onChange={e => handleChange('company', 'pan', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                                <input type="text" className="w-full p-2.5 border rounded-lg" value={formData.company.state} onChange={e => handleChange('company', 'state', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'invoice' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Invoice Configuration</h3>
                            <div className="flex items-center justify-between py-2">
                                <span className="font-medium text-slate-700">Manual Invoice Numbers</span>
                                <input type="checkbox" checked={formData.invoice.manualNo} onChange={e => handleChange('invoice', 'manualNo', e.target.checked)} className="h-6 w-6 accent-blue-600 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix (if auto)</label>
                                <input type="text" className="w-full p-2.5 border rounded-lg uppercase" value={formData.invoice.prefix} onChange={e => handleChange('invoice', 'prefix', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Tax %</label>
                                    <input type="number" className="w-full p-2.5 border rounded-lg" value={formData.invoice.tax} onChange={e => handleChange('invoice', 'tax', parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Enable Round Off</label>
                                    <select className="w-full p-2.5 border rounded-lg" value={formData.invoice.roundOff ? 'yes' : 'no'} onChange={e => handleChange('invoice', 'roundOff', e.target.value === 'yes')}>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t pt-4 mt-4 text-sm sm:text-base">
                                <div>
                                    <span className="font-medium text-slate-700 block">Lock After Dispatch</span>
                                    <span className="text-xs text-slate-500">Prevent editing invoices that have been dispatched</span>
                                </div>
                                <input type="checkbox" checked={formData.invoice.lockAfterDispatch !== false} onChange={e => handleChange('invoice', 'lockAfterDispatch', e.target.checked)} className="h-6 w-6 accent-blue-600 rounded" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Inventory Rules</h3>
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <span className="font-medium text-slate-700 block">Allow Negative Stock</span>
                                    <span className="text-xs text-slate-500">Allow dispatch/sales even if stock is 0</span>
                                </div>
                                <input type="checkbox" checked={formData.inventory.allowNegative} onChange={e => handleChange('inventory', 'allowNegative', e.target.checked)} className="h-6 w-6 accent-blue-600 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Default Low Stock Threshold (mts)</label>
                                <input type="number" className="w-full p-2.5 border rounded-lg" value={formData.inventory.lowStock} onChange={e => handleChange('inventory', 'lowStock', parseFloat(e.target.value))} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'locations' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b text-sm sm:text-base">
                                <h3 className="text-lg font-bold text-slate-800">Manage Locations</h3>
                                <button onClick={addLocation} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium">
                                    <Plus className="h-4 w-4" /> Add New
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {formData.locations.map((loc, idx) => (
                                    <div key={idx} className={`p-4 rounded-xl border transition-all ${loc.active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Location Name</label>
                                                    <input type="text" placeholder="Location Name" className="w-full p-2.5 border rounded-lg text-sm font-bold text-slate-800" value={loc.name} onChange={e => handleLocationChange(idx, 'name', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Type</label>
                                                    <select className="w-full p-2.5 border rounded-lg text-sm" value={loc.type} onChange={e => handleLocationChange(idx, 'type', e.target.value)}>
                                                        <option value="Warehouse">Warehouse</option>
                                                        <option value="Plant">Plant</option>
                                                        <option value="Yard">Yard</option>
                                                        <option value="Store">Store</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Invoice Prefix</label>
                                                    <input type="text" placeholder="e.g. MUM" className="w-full p-2.5 border rounded-lg text-sm font-mono uppercase font-bold" value={loc.prefix || ''} onChange={e => handleLocationChange(idx, 'prefix', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Start Inv #</label>
                                                    <input type="number" placeholder="1001" className="w-full p-2.5 border rounded-lg text-sm font-mono font-bold" value={loc.nextNumber || ''} onChange={e => handleLocationChange(idx, 'nextNumber', parseInt(e.target.value) || 0)} />
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-3 border-t border-slate-50">
                                                <button onClick={() => toggleLocation(idx)} className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider ${loc.active ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                                                    {loc.active ? 'Active' : 'Inactive'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'transport' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Transport & Dispatch</h3>
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 text-sm text-amber-800 mb-4">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <p>System Rule: Transport charges are always considered Non-Taxable (0% GST) for invoicing purposes.</p>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="font-medium text-slate-700">Enable Dispatch Module</span>
                                <input type="checkbox" checked={formData.transport.enable} onChange={e => handleChange('transport', 'enable', e.target.checked)} className="h-6 w-6 accent-blue-600 rounded" />
                            </div>
                            <div className="pt-4 border-t">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Transport Modes (comma separated)</label>
                                <input
                                    type="text"
                                    className="w-full p-2.5 border rounded-lg bg-white text-sm"
                                    placeholder="By Road, By Air, By Sea"
                                    value={(formData.transport.modes || []).join(', ')}
                                    onChange={e => handleChange('transport', 'modes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">User Management</h3>
                            {loadingUsers ? <div className="flex py-10 justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div> : (
                                <div className="grid grid-cols-1 gap-3">
                                    {users.map(user => (
                                        <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-slate-50 gap-4">
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-800">{user.email}</p>
                                                <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{user.id}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <select
                                                    className="flex-1 sm:flex-none p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                                                    value={user.role || 'viewer'}
                                                    onChange={(e) => handleUserUpdate(user.id, 'role', e.target.value)}
                                                >
                                                    <option value="viewer">Viewer</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                <select
                                                    className="flex-1 sm:flex-none p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                                                    value={user.location || ''}
                                                    onChange={(e) => handleUserUpdate(user.id, 'location', e.target.value)}
                                                >
                                                    <option value="">All Locs</option>
                                                    {(formData.locations || []).map(l => (
                                                        <option key={l.name} value={l.name}>{l.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleUserUpdate(user.id, 'active', !user.active)}
                                                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border ${user.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                                                >
                                                    {user.active ? 'Active' : 'Inactive'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {users.length === 0 && <p className="text-slate-500 italic text-center py-10">No users found.</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-4 max-w-lg">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">System & Maintenance</h3>
                            <div className="p-4 border rounded-xl bg-slate-50">
                                <h4 className="font-semibold text-slate-800 mb-2">Data Backfill</h4>
                                <p className="text-sm text-slate-500 mb-4">Regenerate dispatch records for historical invoices. Use this if you see missing data in reports.</p>
                                <button onClick={handleBackfill} className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded shadow-sm">
                                    Run Sync History
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
