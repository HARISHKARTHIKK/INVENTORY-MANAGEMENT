import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { exportToCSV } from '../utils/exportToCSV';
import { Plus, Search, FileText, User, Calendar, Trash2, ArrowLeft, Loader2, CheckCircle, MapPin } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, limit, where } from 'firebase/firestore';
import { createInvoice } from '../services/firestoreService';
import { format } from 'date-fns';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

export default function Invoices() {
    const { userRole } = useAuth();
    const [view, setView] = useState('list'); // 'list' or 'create'
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const location = useLocation();

    // Check for navigation state to open Create Invoice automatically
    useEffect(() => {
        if (location.state?.create && userRole !== 'viewer') {
            setView('create');
        }
    }, [location.state, userRole]);

    // Real-time invoices fetch
    useEffect(() => {
        const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(100));

        try {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setInvoices(data);
                setLoading(false);
            }, (err) => {
                console.error("Invoices Fetch Error:", err);
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Invoices Setup Error:", error);
            setLoading(false);
        }
    }, []);

    const filteredInvoices = invoices
        .filter(inv => {
            const matchesSearch = inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());

            const invDate = inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000) : null;
            let matchesDate = true;

            if (invDate) {
                if (startDate) {
                    const s = new Date(startDate);
                    s.setHours(0, 0, 0, 0);
                    if (invDate < s) matchesDate = false;
                }
                if (endDate) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    if (invDate > e) matchesDate = false;
                }
            }

            return matchesSearch && matchesDate;
        })
        .sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

    const handleExport = () => {
        const dataToExport = invoices.map(inv => ({
            'Invoice Number': inv.invoiceNo,
            'Customer Name': inv.customerName,
            'Subtotal': inv.subtotal || 0,
            'Transport Amount': inv.transport?.amount || 0,
            'Transport Included': inv.transport?.isExtra ? 'No' : 'Yes',
            'Vehicle Number': inv.transport?.vehicleNumber || '-',
            'GST Amount': inv.taxAmount || 0,
            'Total Amount': inv.totalAmount,
            'Invoice Date': inv.createdAt?.seconds ? format(new Date(inv.createdAt.seconds * 1000), 'dd MMM yyyy') : '-'
        }));
        exportToCSV('invoices_export.csv', dataToExport);
    };

    if (view === 'create') {
        return <CreateInvoice onCancel={() => setView('list')} onSuccess={() => setView('list')} />;
    }

    if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-600" />
                        Invoices
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Manage and generate tax invoices</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm active:scale-95"
                    >
                        Export CSV
                    </button>
                    {userRole !== 'viewer' && (
                        <button
                            onClick={() => setView('create')}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-md shadow-blue-500/20 active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            New Invoice
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search invoice no, customer..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                className="outline-none text-sm text-slate-600 bg-transparent"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-300 text-xs text-center px-1">to</span>
                            <input
                                type="date"
                                className="outline-none text-sm text-slate-600 bg-transparent"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Invoice No</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Origin</th>
                                <th className="px-6 py-4 text-right">Basic</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredInvoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-slate-700">{inv.invoiceNo}</td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {inv.createdAt?.seconds ? format(new Date(inv.createdAt.seconds * 1000), 'dd MMM yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{inv.customerName}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                                            <MapPin className="h-3 w-3" /> {inv.fromLocation || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                                        ₹ {(Number(inv.subtotal) || 0).toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900 border-l border-slate-50">
                                        ₹ {(Number(inv.totalAmount) || 0).toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">Paid</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedInvoice(inv)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                            title="View Invoice"
                                        >
                                            <FileText className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredInvoices.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        No invoices found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="sm:hidden grid grid-cols-1 divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                        <div
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-4 bg-white active:bg-slate-50 transition-colors flex flex-col gap-3"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <span className="font-mono font-bold text-slate-900">{inv.invoiceNo}</span>
                                    <p className="text-[11px] text-slate-500">
                                        {inv.createdAt?.seconds ? format(new Date(inv.createdAt.seconds * 1000), 'dd MMM yyyy') : '-'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-blue-600">₹{(Number(inv.totalAmount) || 0).toFixed(0)}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Basic: ₹{(Number(inv.subtotal) || 0).toFixed(0)}</div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                                    {inv.customerName}
                                </div>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">
                                    <MapPin className="h-3 w-3" /> {inv.fromLocation || '-'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {filteredInvoices.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No invoices found.
                        </div>
                    )}
                </div>
            </div>

            {selectedInvoice && (
                <InvoiceViewModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
            )}
        </div>
    );
}

function CreateInvoice({ onCancel, onSuccess }) {
    const { settings, updateSettings } = useSettings();
    const { userData } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [fromLocation, setFromLocation] = useState(userData?.location || 'CHENNAI');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [lines, setLines] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const baseLocations = settings?.locations?.filter(l => l.active).map(l => l.name) || ['Warehouse A', 'Warehouse B', 'Store Front', 'Factory'];
    const LOCATIONS = [...new Set([...baseLocations, userData?.location].filter(Boolean))];

    useEffect(() => {
        if (!fromLocation && userData?.location) {
            setFromLocation(userData.location);
        }
    }, [userData]);

    useEffect(() => {
        if (fromLocation && settings?.locations) {
            const loc = settings.locations.find(l => l.name === fromLocation);
            if (loc) {
                const prefix = loc.prefix || 'INV';
                const num = loc.nextNumber || 1;
                const newNo = `${prefix}-${num}`;
                if (!settings.invoice?.manualNo || !invoiceNo || invoiceNo.includes('-')) {
                    setInvoiceNo(newNo);
                }
            }
        }
    }, [fromLocation, settings]);

    const [transport, setTransport] = useState({
        vehicleNumber: '',
        amount: 0,
        mode: 'By Road',
        isExtra: false
    });

    useEffect(() => {
        const qCustomers = query(collection(db, 'customers'), orderBy('name'));
        const qProducts = query(collection(db, 'products'), orderBy('name'));

        const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
            setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubProducts = onSnapshot(qProducts, (snapshot) => {
            setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubCustomers();
            unsubProducts();
        };
    }, []);

    const getStockAtLocation = (product) => {
        if (!product) return 0;
        return Object.values(product.locations || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    };

    const addLine = () => {
        setLines([...lines, { productId: '', qty: '0', price: '0', stock: 0, bags: '', bagWeight: '' }]);
    };

    const updateLine = (index, field, value) => {
        const newLines = [...lines];
        const updatedLine = { ...newLines[index] };

        let processedValue = value;
        if (field === 'qty' || field === 'price' || field === 'bags' || field === 'bagWeight') {
            processedValue = String(value).replace(/,/g, '.');
            processedValue = processedValue.replace(/[^0-9.]/g, '');
            const dots = (processedValue.match(/\./g) || []).length;
            if (dots > 1) {
                const parts = processedValue.split('.');
                processedValue = parts[0] + '.' + parts.slice(1).join('');
            }
        }

        if (field === 'productId') {
            const prod = products.find(p => p.id === String(value));
            updatedLine.productId = String(value);
            updatedLine.name = prod?.name || '';
            updatedLine.price = String(prod?.price || '0');
            updatedLine.qty = String(updatedLine.qty || '0');
            updatedLine.stock = Number(getStockAtLocation(prod));
            updatedLine.bags = '';
            updatedLine.bagWeight = '';
        } else {
            updatedLine[field] = processedValue;
        }

        if (field === 'bags' || field === 'bagWeight') {
            const bagsCount = Number(updatedLine.bags) || 0;
            const weightPerBag = Number(updatedLine.bagWeight) || 0;
            if (bagsCount > 0 && weightPerBag > 0) {
                updatedLine.qty = String((bagsCount * weightPerBag) / 1000);
            }
        }

        newLines[index] = updatedLine;
        setLines(newLines);
    };

    const removeLine = (index) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const calculateTotals = () => {
        const linesTotal = lines.reduce((acc, line) => {
            const qty = Number(String(line.qty || 0).replace(/,/g, '.'));
            const price = Number(String(line.price || 0).replace(/,/g, '.'));
            return acc + (qty * price);
        }, 0);

        const taxRate = settings?.invoice?.tax ?? 18;
        const tax = linesTotal * (taxRate / 100);
        const transportAmt = Number(transport.amount) || 0;
        let total = linesTotal + tax;
        if (transport.isExtra) {
            total += transportAmt;
        }
        if (settings?.invoice?.roundOff) {
            total = Math.round(total);
        }
        const taxableValue = linesTotal;
        return { linesTotal, tax, total, taxableValue };
    };

    const handleSubmit = async () => {
        const validLines = lines.filter(l => l.productId && l.qty && parseFloat(String(l.qty).replace(/,/g, '.')) > 0);

        if (!invoiceNo || !selectedCustomer || !fromLocation || validLines.length === 0) {
            alert("Please provide Invoice Number, Customer, Dispatch Location, and at least one valid Item.");
            return;
        }

        for (const line of validLines) {
            const qtyVal = Number(String(line.qty).replace(/,/g, '.'));
            if (isNaN(qtyVal) || qtyVal <= 0) {
                alert(`Please enter a valid quantity greater than 0 for ${line.name || 'Selected Item'}`);
                return;
            }
            const prod = products.find(p => p.id === line.productId);
            const globalStock = getStockAtLocation(prod);
            if (globalStock < qtyVal) {
                alert(`Insufficient global stock for ${line.name}. Available: ${globalStock.toFixed(1)}, Requested: ${qtyVal.toFixed(1)}`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const { linesTotal, tax, total, taxableValue } = calculateTotals();
            const customerObj = customers.find(c => c.id === selectedCustomer);

            const preparedItems = validLines.map(l => ({
                ...l,
                quantity: Number(String(l.qty).replace(/[^0-9.]/g, '')),
                bags: Number(l.bags) || 0,
                bagWeight: Number(l.bagWeight) || 0,
                price: Number(String(l.price).replace(/[^0-9.]/g, '')) || 0
            }));

            await createInvoice({
                invoiceNo: invoiceNo,
                customerId: selectedCustomer,
                customerName: customerObj?.name || 'Unknown',
                subtotal: Number(linesTotal) || 0,
                taxAmount: Number(tax) || 0,
                totalAmount: Number(total) || 0,
                taxableValue: Number(taxableValue) || 0,
                taxRate: settings?.invoice?.tax ?? 18,
                remarks: remarks,
                transport: {
                    vehicleNumber: transport.vehicleNumber,
                    amount: Number(transport.amount) || 0,
                    mode: transport.mode,
                    isExtra: transport.isExtra
                },
                status: 'paid'
            }, preparedItems, fromLocation);

            if (settings?.locations) {
                const locIndex = settings.locations.findIndex(l => l.name === fromLocation);
                if (locIndex >= 0) {
                    const newSettings = JSON.parse(JSON.stringify(settings));
                    const currentNext = newSettings.locations[locIndex].nextNumber || 1;
                    newSettings.locations[locIndex].nextNumber = currentNext + 1;
                    await updateSettings(newSettings);
                }
            }

            onSuccess();
        } catch (error) {
            alert("Failed to create invoice: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const { linesTotal, tax, total } = calculateTotals();

    return (
        <div className="max-w-[1600px] mx-auto space-y-3 animate-fade-in-up pb-20">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">Create Invoice</h2>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Invoice Number</label>
                        <input
                            type="text"
                            className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-right font-mono font-bold text-base text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none w-28"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Primary Details Bar - Lighter Professional Style */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5 p-1">
                    <label className="text-slate-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <User className="h-3 w-3 text-blue-500" /> Select Customer
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                            <option value="" className="text-slate-900">Choose Customer...</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                            <Plus className="h-4 w-4 rotate-45" />
                        </div>
                    </div>
                </div>
                <div className="space-y-1.5 p-1">
                    <label className="text-slate-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-blue-500" /> Dispatch Location
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold text-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                            value={fromLocation}
                            onChange={(e) => setFromLocation(e.target.value)}
                        >
                            <option value="" className="text-slate-900">Select Warehouse...</option>
                            {LOCATIONS.map(loc => (
                                <option key={loc} value={loc} className="text-slate-900">{loc}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                            <Plus className="h-4 w-4 rotate-45" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                <div className="lg:col-span-3 space-y-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Line Items</h3>
                            <button onClick={addLine} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95">
                                <Plus className="h-3.5 w-3.5" /> Add Item
                            </button>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50/50 text-[11px] font-black uppercase text-slate-400 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Product Selection</th>
                                        <th className="px-2 py-3 text-center w-24">Bags</th>
                                        <th className="px-2 py-3 text-center w-24">Wt (kg)</th>
                                        <th className="px-2 py-3 text-center w-32" title="Quantity in MTS">Quantity</th>
                                        <th className="px-2 py-3 text-center w-32">Rate (₹)</th>
                                        <th className="px-4 py-3 text-right w-36">Line Total</th>
                                        <th className="px-4 py-3 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {lines.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-2.5">
                                                <select
                                                    className="w-full bg-slate-100/50 border-none rounded-lg px-2.5 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={line.productId}
                                                    onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                                                    disabled={!fromLocation}
                                                >
                                                    <option value="">{fromLocation ? 'Select Product' : 'Select Location'}</option>
                                                    {products.map(p => {
                                                        const totalStock = Object.values(p.locations || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                                                        return (
                                                            <option key={p.id} value={String(p.id)}>
                                                                {p.name} ({totalStock.toFixed(1)} mts)
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-100/50 border-none rounded-lg px-2 py-2 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={line.bags}
                                                    onChange={(e) => updateLine(idx, 'bags', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-100/50 border-none rounded-lg px-2 py-2 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="50"
                                                    value={line.bagWeight}
                                                    onChange={(e) => updateLine(idx, 'bagWeight', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-100/50 border-none rounded-lg pl-2 pr-8 py-2 text-center text-sm font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={line.qty}
                                                        onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">MTS</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-100/50 border-none rounded-lg px-2 py-2 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0"
                                                    value={line.price}
                                                    onChange={(e) => updateLine(idx, 'price', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <span className="text-sm font-black text-slate-900 uppercase">
                                                    ₹ {(Number(String(line.qty || 0).replace(/[^0-9.]/g, '')) * Number(String(line.price || 0).replace(/[^0-9.]/g, ''))).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button onClick={() => removeLine(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {lines.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-bold">No items listed. Start adding products.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Transportation & Notes</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Vehicle / Truck Number</label>
                                    <input
                                        className="w-full bg-slate-50 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono"
                                        placeholder="MH-XX-XX-XXXX"
                                        value={transport.vehicleNumber}
                                        onChange={e => setTransport({ ...transport, vehicleNumber: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Cost (₹)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={transport.amount}
                                            onChange={e => setTransport({ ...transport, amount: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Method</label>
                                        <select
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={transport.mode}
                                            onChange={e => setTransport({ ...transport, mode: e.target.value })}
                                        >
                                            <option value="">N/A</option>
                                            {(settings?.transport?.modes || ['By Road', 'By Sea', 'By Air']).map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Pricing Logic</label>
                                <div className="space-y-2">
                                    <label className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${!transport.isExtra ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                                        <input type="radio" name="transportType" checked={!transport.isExtra} onChange={() => setTransport({ ...transport, isExtra: false })} className="hidden" />
                                        <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${!transport.isExtra ? 'border-blue-600' : 'border-slate-300'}`}>
                                            {!transport.isExtra && <div className="h-1.5 w-1.5 bg-blue-600 rounded-full"></div>}
                                        </div>
                                        <span className="text-xs font-bold">Included in Rate</span>
                                    </label>
                                    <label className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${transport.isExtra ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                                        <input type="radio" name="transportType" checked={transport.isExtra} onChange={() => setTransport({ ...transport, isExtra: true })} className="hidden" />
                                        <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${transport.isExtra ? 'border-indigo-600' : 'border-slate-300'}`}>
                                            {transport.isExtra && <div className="h-1.5 w-1.5 bg-indigo-600 rounded-full"></div>}
                                        </div>
                                        <span className="text-xs font-bold">Charged Extra</span>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">Remarks / Internal Notes</label>
                                <textarea
                                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none"
                                    placeholder="Add notes about this dispatch..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <FileText className="h-24 w-24 rotate-12 text-slate-900" />
                        </div>
                        <h4 className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] mb-8">Billing Summary</h4>
                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                                <span className="text-slate-500 text-sm font-bold">Subtotal</span>
                                <span className="text-xl font-bold text-slate-800 tracking-tighter">₹ {linesTotal.toFixed(1)}</span>
                            </div>
                            {transport.isExtra && (
                                <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                                    <span className="text-slate-500 text-sm font-bold">Transport</span>
                                    <span className="text-xl font-bold text-blue-600 tracking-tighter">+ ₹ {Number(transport.amount).toFixed(1)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                                <span className="text-slate-500 text-sm font-bold">GST (18%)</span>
                                <span className="text-xl font-bold text-amber-600 tracking-tighter">+ ₹ {tax.toFixed(1)}</span>
                            </div>
                            <div className="pt-4 flex flex-col gap-2">
                                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center">Grand Total</span>
                                <div className="text-5xl font-black text-center text-slate-900 tracking-tighter whitespace-nowrap">
                                    <span className="text-blue-600 text-2xl mr-1">₹</span>
                                    {total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    <span className="text-slate-300 text-xl font-light">.{total.toFixed(1).split('.')[1]}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className={`w-full mt-10 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-[0.98] transition-all flex justify-center items-center gap-3 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle className="h-6 w-6" />}
                                {submitting ? 'PROCESSING...' : 'FINAL DISPATCH'}
                            </button>
                            <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest mt-4">Safe & Secure Entry</p>
                        </div>
                    </div>
                    {!fromLocation && (
                        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-start gap-4">
                            <MapPin className="h-6 w-6 text-amber-500 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Select Warehouse</p>
                                <p className="text-[10px] text-amber-600 font-bold leading-relaxed">You must select a dispatch location before adding products to verify available stock levels.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InvoiceViewModal({ invoice, onClose }) {
    const { settings } = useSettings();
    if (!invoice) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:shadow-none print:max-h-none print:h-full print:rounded-none">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
                    <h3 className="font-bold text-lg text-slate-800">Invoice Details</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                            <FileText className="h-4 w-4" /> Print
                        </button>
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
                            Close
                        </button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto print:overflow-visible">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">INVOICE</h1>
                            <p className="text-slate-500 mt-1">#{invoice.invoiceNo}</p>
                            <p className="text-sm text-slate-500 mt-2">
                                Date: {invoice.createdAt?.seconds ? format(new Date(invoice.createdAt.seconds * 1000), 'dd MMM yyyy') : '-'}
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-lg font-bold text-slate-800 uppercase">{settings?.company?.name || 'MAB CHEMICALS PVT. LTD.'}</h2>
                            <p className="text-sm text-slate-500">GSTIN: {settings?.company?.gstin || '27ABCDE1234F1Z5'}</p>
                            <p className="text-sm text-slate-500 whitespace-pre-wrap max-w-[200px] ml-auto">{settings?.company?.address || 'Maharashtra, India'}</p>
                        </div>
                    </div>

                    <div className="mb-8 p-4 bg-slate-50 rounded-lg print:border print:border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
                        <p className="font-bold text-slate-800 text-lg">{invoice.customerName}</p>
                    </div>

                    <table className="w-full text-left text-sm mb-8">
                        <thead className="border-b-2 border-slate-200 text-slate-700">
                            <tr>
                                <th className="py-3 font-bold">Item Description</th>
                                <th className="py-3 text-right">Qty (mts)</th>
                                <th className="py-3 text-right">Rate</th>
                                <th className="py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <InvoiceItemsLoader invoiceId={invoice.id} />
                        </tbody>
                    </table>

                    {invoice.transport && (
                        <div className="mb-6 p-4 rounded border border-dashed border-slate-300">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">Transport / Delivery</h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500 block text-xs">Vehicle No</span>
                                    <span className="font-mono">{invoice.transport.vehicleNumber || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs">Mode</span>
                                    <span>{invoice.transport.mode || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs">Charges</span>
                                    <span>
                                        ₹ {invoice.transport.amount}
                                        {invoice.transport.isExtra ? ' (Extra)' : ' (Included)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <div className="w-64 space-y-2 text-sm text-right">
                            <div className="flex justify-between text-slate-600">
                                <span>Basic Amount</span>
                                <span>₹ {Number(invoice.subtotal).toFixed(1)}</span>
                            </div>
                            {invoice.transport?.isExtra && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Transport</span>
                                    <span>₹ {Number(invoice.transport.amount).toFixed(1)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-600">
                                <span>GST (18%)</span>
                                <span>₹ {Number(invoice.taxAmount).toFixed(1)}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 flex justify-between font-bold text-xl text-slate-900">
                                <span>Total</span>
                                <span>₹ {Number(invoice.totalAmount).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InvoiceItemsLoader({ invoiceId }) {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchItems = async () => {
            const finalQ = query(collection(db, 'invoiceItems'), where('invoiceId', '==', invoiceId));
            const snap = await getDocs(finalQ);
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchItems();
    }, [invoiceId]);

    return (
        <>
            {items.map((item, idx) => (
                <tr key={idx}>
                    <td className="py-3 font-medium text-slate-800">
                        {item.name || item.productId || 'Unknown Item'}
                    </td>
                    <td className="py-3 text-right">{Number(item.quantity).toFixed(3)}</td>
                    <td className="py-3 text-right">₹ {Number(item.price).toFixed(2)}</td>
                    <td className="py-3 text-right">₹ {(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
                </tr>
            ))}
        </>
    );
}
