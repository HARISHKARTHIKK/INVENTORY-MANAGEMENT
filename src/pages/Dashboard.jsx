import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, ArrowRight, Truck, MapPin, Package, AlertTriangle, Box, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { addStock } from '../services/firestoreService';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { settings } = useSettings();
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const navigate = useNavigate();

    // Stock Update Modal State
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [stockForm, setStockForm] = useState({ location: '', quantity: '', reason: 'Dashboard Update' });

    useEffect(() => {
        setLoading(true);
        // Products
        const qProducts = query(collection(db, 'products'));
        // Recent Dispatches
        const qDispatches = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'), limit(10));

        const unsubProducts = onSnapshot(qProducts, (snap) => {
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubDispatches = onSnapshot(qDispatches, (snap) => {
            setDispatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => {
            unsubProducts();
            unsubDispatches();
        };
    }, []);

    const handleOpenStockModal = (product) => {
        setSelectedProduct(product);
        setStockForm({ location: '', quantity: '', reason: 'Dashboard Update' });
        setIsStockModalOpen(true);
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        try {
            await addStock({
                productId: selectedProduct.id,
                location: stockForm.location,
                quantity: stockForm.quantity,
                reason: stockForm.reason
            });
            setIsStockModalOpen(false);
        } catch (error) {
            alert(error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const LOCATIONS = settings?.locations?.filter(l => l.active).map(l => l.name) || ['Warehouse A', 'Warehouse B', 'Store Front', 'Factory'];

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-1">Real-time inventory and dispatch overview</p>
                </div>
                <div className="flex gap-2">
                    {userRole !== 'viewer' && (
                        <button
                            onClick={() => navigate('/invoices', { state: { create: true } })}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            <Plus className="h-4 w-4" /> New Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Inventory Status Cards */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Inventory Status
                    </h3>
                    <button onClick={() => navigate('/inventory')} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
                        View All <ArrowRight className="h-3 w-3" />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map(p => {
                        const totalStock = Object.values(p.locations || {}).reduce((a, b) => {
                            const val = Number(b);
                            return a + (isNaN(val) ? 0 : val);
                        }, 0);
                        const isLow = totalStock < (p.lowStockThreshold || 10);
                        const hasLocations = p.locations && Object.keys(p.locations).length > 0;

                        return (
                            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[240px] flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-slate-800 truncate pr-4 text-lg" title={p.name}>{p.name}</h4>
                                        {isLow && <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />}
                                    </div>
                                    <div className="mb-5">
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-3xl font-bold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>{totalStock.toFixed(1)}</span>
                                            <span className="text-sm text-slate-500 font-medium">mts</span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-mono mt-1">SKU: {p.sku || '-'}</p>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-slate-100 mb-2">
                                        {hasLocations ? (
                                            Object.entries(p.locations).map(([loc, qty]) => (
                                                <div key={loc} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                        {loc}
                                                    </span>
                                                    <span className="font-medium text-slate-700">{(Number(qty) || 0).toFixed(1)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No location allocated</span>
                                        )}
                                    </div>
                                </div>
                                {userRole !== 'viewer' && (
                                    <button
                                        onClick={() => handleOpenStockModal(p)}
                                        className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-slate-200"
                                    >
                                        <Box className="h-4 w-4" /> Update Stock
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {products.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            No products found. Add products to see inventory status.
                        </div>
                    )}
                </div>
            </section>

            {/* Daily Dispatch Summary */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="h-5 w-5 text-indigo-600" />
                        Recent Dispatches
                    </h3>
                    <button onClick={() => navigate('/dispatch')} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
                        View All Log <ArrowRight className="h-3 w-3" />
                    </button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Invoice</th>
                                    <th className="px-6 py-3">Product</th>
                                    <th className="px-6 py-3">Origin</th>
                                    <th className="px-6 py-3 text-right">Qty (mts)</th>
                                    <th className="px-6 py-3">Vehicle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dispatches.map(d => (
                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-mono text-slate-700">{d.invoiceNo}</td>
                                        <td className="px-6 py-3 font-medium text-slate-900">{d.productName || 'Unknown'}</td>
                                        <td className="px-6 py-3">
                                            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                                                <MapPin className="h-3 w-3" /> {d.location}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-slate-800">
                                            {(Number(d.quantity) || 0).toFixed(1)}
                                        </td>
                                        <td className="px-6 py-3 text-xs text-slate-500">
                                            {d.transport?.vehicleNumber || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {dispatches.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                            No recent dispatches today.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Update Stock Modal */}
            {isStockModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Update Stock</h3>
                            <button onClick={() => setIsStockModalOpen(false)} className="text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Updating inventory for: <span className="font-semibold text-slate-800">{selectedProduct?.name}</span></p>
                        <form onSubmit={handleStockSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Target Location</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={stockForm.location}
                                    onChange={e => setStockForm({ ...stockForm, location: e.target.value })}
                                    required
                                >
                                    <option value="">Select Location</option>
                                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Adjustment (mts)</label>
                                <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    type="number"
                                    step="0.001"
                                    placeholder="Enter quantity (e.g. 10.5 or -5)"
                                    value={stockForm.quantity}
                                    onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })}
                                    required
                                />
                                <p className="text-xs text-slate-400 mt-1">Positive to add, negative to reduce.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Note</label>
                                <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. New Batch, Correction"
                                    value={stockForm.reason}
                                    onChange={e => setStockForm({ ...stockForm, reason: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
