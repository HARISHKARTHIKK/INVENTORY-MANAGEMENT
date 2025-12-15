import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, ArrowRight, Truck, MapPin, Package, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const navigate = useNavigate();

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

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-1">Real-time inventory and dispatch overview</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/invoices', { state: { create: true } })}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        <Plus className="h-4 w-4" /> New Invoice
                    </button>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map(p => {
                        const totalStock = Object.values(p.locations || {}).reduce((a, b) => {
                            const val = Number(b);
                            return a + (isNaN(val) ? 0 : val);
                        }, 0);
                        const isLow = totalStock < (p.lowStockThreshold || 10);
                        const hasLocations = p.locations && Object.keys(p.locations).length > 0;

                        return (
                            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800 truncate pr-4" title={p.name}>{p.name}</h4>
                                    {isLow && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                                </div>
                                <div className="mb-4">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>{totalStock.toFixed(3)}</span>
                                        <span className="text-xs text-slate-500 font-medium">mts</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku || '-'}</p>
                                </div>

                                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                                    {hasLocations ? (
                                        Object.entries(p.locations).map(([loc, qty]) => (
                                            <div key={loc} className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                    {loc}
                                                </span>
                                                <span className="font-medium text-slate-700">{(Number(qty) || 0).toFixed(3)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">No location allocated</span>
                                    )}
                                </div>
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
                                            {(Number(d.quantity) || 0).toFixed(3)}
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
        </div>
    );
}
