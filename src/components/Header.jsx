import { useAuth } from '../context/AuthContext';
import { LogOut, Bell, User, Search } from 'lucide-react';

export default function Header() {
    const { logout, currentUser } = useAuth();

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10 ml-64 shadow-sm">
            <div className="flex items-center gap-4 flex-1">
                {/* Company Context */}
                <div className="hidden md:flex items-center gap-2 mr-6 border-r border-slate-200 pr-6">
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-800 leading-tight">MAB CHEMICALS PVT. LTD.</span>
                        <span className="text-xs text-slate-500 font-mono">GSTIN: 27ABCDE1234F1Z5</span>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative w-full max-w-md hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search invoices, products, customers..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </button>

                <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-700">{currentUser?.email || 'Admin User'}</p>
                        <p className="text-xs text-slate-500 capitalize">Administrator</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <span className="font-bold text-sm">A</span>
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 ml-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sign out"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}
