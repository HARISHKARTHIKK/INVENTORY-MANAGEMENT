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
        // Query limited to 50 recent items for performance
        const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(50));

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

    const filteredInvoices = invoices.filter(inv =>
        inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search invoice no, customer..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Invoice No</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Origin</th>
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
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        ₹ {inv.totalAmount?.toLocaleString()}
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
            </div>

            {selectedInvoice && (
                <InvoiceViewModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
            )}
        </div>
    );
}

function CreateInvoice({ onCancel, onSuccess }) {
    const { settings, updateSettings } = useSettings();
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [fromLocation, setFromLocation] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [lines, setLines] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Dynamic Locations from Settings (or fallback)
    const LOCATIONS = settings?.locations?.filter(l => l.active).map(l => l.name) || ['Warehouse A', 'Warehouse B', 'Store Front', 'Factory'];

    // Auto-generate Invoice Number when Location Changes
    useEffect(() => {
        if (fromLocation && settings?.locations) {
            const loc = settings.locations.find(l => l.name === fromLocation);
            if (loc) {
                // If manual mode is disabled (Auto mode), set the number.
                // Or if current invoiceNo is empty.
                if (!settings.invoice?.manualNo || !invoiceNo) {
                    const prefix = loc.prefix || 'INV';
                    const num = loc.nextNumber || 1;
                    setInvoiceNo(`${prefix}-${num}`);
                }
            }
        }
    }, [fromLocation, settings]);

    // Transport Data
    const [transport, setTransport] = useState({
        vehicleNumber: '',
        amount: 0,
        mode: '',
        isExtra: false
    });

    // ... (rest of code)



    // ... (rest)
    // Needs to splice this into correct place.
    // I will use replace_file_content on specific blocks.

    // Fetch data for dropdowns
    useEffect(() => {
        const fetchData = async () => {
            // ... existing fetch logic
            const custSnap = await getDocs(query(collection(db, 'customers'), orderBy('name')));
            const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
            setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchData();
    }, []);

    // Helper to get stock at location
    const getStockAtLocation = (product, loc) => {
        if (!product || !loc) return 0;
        return product.locations?.[loc] || 0;
    };

    const addLine = () => {
        setLines([...lines, { productId: '', qty: 1, price: 0, stock: 0 }]);
    };

    const updateLine = (index, field, value) => {
        const newLines = [...lines];
        if (field === 'productId') {
            const prod = products.find(p => p.id === value);
            newLines[index].productId = value;
            newLines[index].name = prod?.name || '';
            newLines[index].price = prod?.price || 0;
            // Update stock based on currently selected location
            newLines[index].stock = getStockAtLocation(prod, fromLocation);
        } else {
            newLines[index][field] = value;
        }
        setLines(newLines);
    };

    // Update stocks when location changes
    useEffect(() => {
        if (fromLocation) {
            setLines(prevLines => prevLines.map(line => {
                const prod = products.find(p => p.id === line.productId);
                return {
                    ...line,
                    stock: getStockAtLocation(prod, fromLocation)
                };
            }));
        }
    }, [fromLocation, products]);

    const removeLine = (index) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const calculateTotals = () => {
        const linesTotal = lines.reduce((acc, line) => acc + (Number(line.qty) * Number(line.price)), 0);

        // Tax Calculation based on Settings
        // Rule: Transport is NEVER taxed.
        const taxRate = settings?.invoice?.tax ?? 18; // Default 18%
        const tax = linesTotal * (taxRate / 100);

        const transportAmt = Number(transport.amount) || 0;

        let total = linesTotal + tax;

        if (transport.isExtra) {
            total += transportAmt;
        }

        // Round Off
        if (settings?.invoice?.roundOff) {
            total = Math.round(total);
        }

        const taxableValue = linesTotal; // Strictly product value

        return { linesTotal, tax, total, taxableValue };
    };

    const handleSubmit = async () => {
        if (!invoiceNo || !selectedCustomer || !fromLocation || lines.length === 0) {
            alert("Please provide Invoice Number, Customer, Dispatch Location, and Items.");
            return;
        }

        // Validate stock
        for (const line of lines) {
            if (line.qty > line.stock) {
                alert(`Insufficient stock for ${line.name} at ${fromLocation}. Available: ${line.stock}`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const { linesTotal, tax, total, taxableValue } = calculateTotals();
            const customerObj = customers.find(c => c.id === selectedCustomer);

            await createInvoice({
                invoiceNo: invoiceNo,
                customerId: selectedCustomer,
                customerName: customerObj?.name || 'Unknown',
                subtotal: linesTotal, // Product total only
                taxAmount: tax,
                totalAmount: total,
                taxableValue: taxableValue, // Includes transport if extra
                transport: {
                    vehicleNumber: transport.vehicleNumber,
                    amount: Number(transport.amount) || 0,
                    mode: transport.mode,
                    isExtra: transport.isExtra
                },
                status: 'paid'
            }, lines, fromLocation);

            // Increment Invoice Counter
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
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-4">
                <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-2xl font-bold text-slate-800">New Invoice</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-slate-700">Items</h3>
                            <button onClick={addLine} className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline">
                                <Plus className="h-4 w-4" /> Add Item
                            </button>
                        </div>
                        <div className="space-y-3">
                            {lines.map((line, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="flex-1">
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={line.productId}
                                            onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                                            disabled={!fromLocation}
                                        >
                                            <option value="">{fromLocation ? 'Select Product' : 'Select Location First'}</option>
                                            {products.map(p => {
                                                const locStock = p.locations?.[fromLocation] || 0;
                                                return (
                                                    <option key={p.id} value={p.id} disabled={locStock <= 0}>
                                                        {p.name} (Stock: {locStock})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="mts"
                                            value={line.qty}
                                            onChange={(e) => updateLine(idx, 'qty', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="w-28 relative">
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Price"
                                            value={line.price}
                                            onChange={(e) => updateLine(idx, 'price', Number(e.target.value))}
                                        />
                                        <div className="absolute right-1 top-full text-[10px] text-slate-400">Rate/Unit</div>
                                    </div>
                                    <div className="w-24 text-right py-2 text-sm font-medium text-slate-700">
                                        ₹{(line.qty * line.price).toLocaleString()}
                                    </div>
                                    <button onClick={() => removeLine(idx)} className="p-2 text-red-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            {lines.length === 0 && <div className="text-center py-6 text-slate-400 text-sm">No items added. Click "Add Item" to start.</div>}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Customer & Location Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Number</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono"
                                placeholder="e.g. INV-001"
                                value={invoiceNo}
                                onChange={(e) => setInvoiceNo(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                            >
                                <option value="">Select Customer</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Dispatch From (Location)</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={fromLocation}
                                onChange={(e) => setFromLocation(e.target.value)}
                            >
                                <option value="">Select Location</option>
                                {LOCATIONS.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                            {!fromLocation && <p className="text-xs text-amber-600 mt-1">Please select a location to check stock availability.</p>}
                        </div>

                        {selectedCustomer && (
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Billing To:</p>
                                <p className="text-sm font-semibold text-slate-800">{customers.find(c => c.id === selectedCustomer)?.name}</p>
                            </div>
                        )}
                    </div>

                    {/* Transport Details Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            Transport Details
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Vehicle Number</label>
                                <input
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    placeholder="e.g. MH-12-AB-1234"
                                    value={transport.vehicleNumber}
                                    onChange={e => setTransport({ ...transport, vehicleNumber: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Transport Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        value={transport.amount}
                                        onChange={e => setTransport({ ...transport, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                        value={transport.mode}
                                        onChange={e => setTransport({ ...transport, mode: e.target.value })}
                                    >
                                        <option value="">Select Mode</option>
                                        {(settings?.transport?.modes || ['By Road', 'By Sea', 'By Air']).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="transportType"
                                        checked={!transport.isExtra}
                                        onChange={() => setTransport({ ...transport, isExtra: false })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    Included in Product Rate
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-1">
                                    <input
                                        type="radio"
                                        name="transportType"
                                        checked={transport.isExtra}
                                        onChange={() => setTransport({ ...transport, isExtra: true })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    Charged Extra (Adds to Total + GST)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-semibold text-slate-700 mb-4">Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-600">
                                <span>Note Subtotal</span>
                                <span>₹ {linesTotal.toLocaleString()}</span>
                            </div>
                            {transport.isExtra && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Transport Costs</span>
                                    <span>₹ {Number(transport.amount).toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-600">
                                <span>GST (18%)</span>
                                <span>₹ {tax.toLocaleString()}</span>
                            </div>
                            {!transport.isExtra && Number(transport.amount) > 0 && (
                                <div className="text-xs text-slate-400 italic mt-1 text-right">
                                    * Transport (₹{transport.amount}) included in rate
                                </div>
                            )}
                            <div className="pt-3 border-t border-slate-100 flex justify-between font-bold text-lg text-slate-800">
                                <span>Total</span>
                                <span>₹ {total.toLocaleString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex justify-center items-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                            {submitting ? 'Creating...' : 'Create Invoice'}
                        </button>
                    </div>
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
                {/* Header Actions - Hidden in Print */}
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

                {/* Printable Content */}
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
                        {/* <p className="text-slate-600 text-sm">Customer Address...</p> */}
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
                            {/* Items are currently not stored fully in the top invoice doc, usually just totals. 
                                 Ideally we fetch items from subcollection. 
                                 BUT for this simplified prompt, we might not have items data in the 'invoice' object from the list. 
                                 We only have totals. 
                                 Only create passes lines. The list view logic in Invoices.jsx (lines 33) doesn't fetch subcollections.
                                 
                                 Correction: For a View Modal to work perfectly we need the items.
                                 However, I can't break existing logic. 
                                 If the user wants PREVIEW, I can only show what I have. 
                                 Currently Invoices list pulls `snapshot.docs.map...`. 
                                 
                                 Wait, the prompt asked to "Invoice preview... show Per-item rate".
                                 I'll add a fetch for items when current invoice is selected.
                             */}
                            <InvoiceItemsLoader invoiceId={invoice.id} />
                        </tbody>
                    </table>

                    {/* Transport Section */}
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
                                <span>Subtotal</span>
                                <span>₹ {Number(invoice.subtotal).toLocaleString()}</span>
                            </div>
                            {invoice.transport?.isExtra && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Transport</span>
                                    <span>₹ {Number(invoice.transport.amount).toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-600">
                                <span>GST (18%)</span>
                                <span>₹ {Number(invoice.taxAmount).toLocaleString()}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 flex justify-between font-bold text-xl text-slate-900">
                                <span>Total</span>
                                <span>₹ {Number(invoice.totalAmount).toLocaleString()}</span>
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

    // We need to fetch items for this invoice
    // Assuming a query can do this. 
    // Usually items are in 'invoiceItems' collection with 'invoiceId' field based on createInvoice service.

    useEffect(() => {
        const fetchItems = async () => {
            const q = query(collection(db, 'invoiceItems'), orderBy('createdAt'), limit(50));
            // Wait, standard Firestore doesn't support easy "where invoiceId == X" without index if we sorting.
            // We'll rely on a simple query.
            // Actually, createInvoice adds to 'invoiceItems'.

            // Let's use specific query
            const qItems = query(collection(db, 'invoiceItems'));
            // We can filter client side if necessary via the passed data or a where clause.
            // Better:
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
                        {/* We might need to fetch product name if not stored. 
                            CreateInvoice stores `productId`. 
                            But wait! In `createInvoice` service I see:
                            productId, quantity, price...
                            It DOES NOT store name in invoiceItems usually.
                            BUT I checked `services/firestoreService.js` earlier!
                            
                            Line 111: addDoc 'invoiceItems' { invoiceId, productId, quantity, price ... }
                            It does NOT store name.
                            However, the service file was modified in step 59 and I see:
                            `productName: item.name || 'Unknown Product'` in `stockMovements`.
                            But `invoiceItems` adding is:
                             `await addDoc(collection(db, "invoiceItems"), { ... productId, quantity, price ... })`
                            
                            Ah, strictly speaking, I should have stored the name in invoiceItems to freeze it.
                            But I can't change the backend schema heavily right now ("Preserve existing").
                            I will try to find the name from the products list if possible or just show Product ID?
                            
                            Actually, `createInvoice` (in `Invoices.jsx`) passes `lines` which has `name`.
                            But `createInvoice` (service) line 111 DOES NOT SAVE `name`.
                            This is a gap in the existing backend.
                            
                            CRITICAL: The prompt says "DO NOT remove existing working logic".
                            I should extend `createInvoice` service to save `name` inside `invoiceItems` if I can?
                            "ONLY extend... functionality". Adding a field is safe.
                            
                            I will modify `createInvoice` service to store `name` in `invoiceItems`. 
                            It is safer for the Invoice Preview to work efficiently.
                            
                            For now in this replacement, I will assume `item.name` exists or fallback to `Loading...` if I fetched it.
                            Actually, I can fetch the product name from the main `products` collection if needed.
                        */}
                        {item.productName || item.name || <span>Product {item.productId?.slice(0, 5)}...</span>}
                    </td>
                    <td className="py-3 text-right font-mono">
                        <span className="text-[10px] text-slate-400 mr-1 uppercase">Qty</span>
                        {Number(item.quantity).toFixed(3)}
                    </td>
                    <td className="py-3 text-right">
                        <span className="text-[10px] text-slate-400 mr-1 uppercase">Rate</span>
                        ₹ {Number(item.price).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-700">₹ {(Number(item.quantity) * Number(item.price)).toLocaleString()}</td>
                </tr>
            ))}
        </>
    );
}
// End of file
