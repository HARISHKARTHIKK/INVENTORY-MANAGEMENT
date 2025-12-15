import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Truck, Calendar, MapPin, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Dispatch() {
    const [dispatches, setDispatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        // Query dispatches
        const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'), limit(100));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDispatches(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching dispatches:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredDispatches = dispatches.filter(d => {
        const matchesSearch =
            (d.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.location || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = dateFilter
            ? d.createdAt?.seconds && format(new Date(d.createdAt.seconds * 1000), 'yyyy-MM-dd') === dateFilter
            : true;

        return matchesSearch && matchesDate;
    });

    if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="h-6 w-6 text-blue-600" />
                        Dispatch Log
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Track all inventory dispatches via invoices</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search invoice, product, location..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <input
                            type="date"
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Invoice No</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Origin</th>
                                <th className="px-6 py-4 text-right">Quantity (mts)</th>
                                <th className="px-6 py-4">Transport</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDispatches.map((disp) => (
                                <tr key={disp.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                        {disp.createdAt?.seconds ? format(new Date(disp.createdAt.seconds * 1000), 'dd MMM yyyy, h:mm a') : '-'}
                                    </td>
                                    <td className="px-6 py-4 font-mono font-medium text-slate-700">
                                        {disp.invoiceNo}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {disp.productName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs font-semibold text-slate-600 w-fit">
                                            <MapPin className="h-3 w-3" />
                                            {disp.location}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        {(Number(disp.quantity) || 0).toFixed(3)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs space-y-1">
                                            {disp.transport?.vehicleNumber ? (
                                                <div className="font-semibold text-slate-700">{disp.transport.vehicleNumber}</div>
                                            ) : (
                                                <span className="text-slate-400 italic">No Vehicle Info</span>
                                            )}
                                            {disp.transport?.mode && <div className="text-slate-500">{disp.transport.mode}</div>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredDispatches.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        No dispatches found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
