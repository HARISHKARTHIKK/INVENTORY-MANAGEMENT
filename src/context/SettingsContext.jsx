import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    const defaultSettings = {
        company: {
            name: 'MAB CHEM. (P) LTD',
            address: '',
            gstin: '',
            pan: '',
            state: '',
            currency: '₹',
            unit: 'mts'
        },
        invoice: {
            manualNo: true,
            prefix: 'INV-',
            tax: 18,
            roundOff: true,
            transportExtra: false, // Default behavior
            lockAfterDispatch: true
        },
        inventory: {
            allowNegative: false,
            lowStock: 10,
            enableLogs: true
        },
        locations: [
            { name: 'Warehouse A', type: 'Warehouse', active: true },
            { name: 'Warehouse B', type: 'Warehouse', active: true },
            { name: 'Store Front', type: 'Store', active: true },
            { name: 'Factory', type: 'Plant', active: true }
        ],
        transport: {
            enable: true,
            required: false,
            modes: ['By Road', 'By Sea', 'By Air']
        }
    };

    // Ensure we have robust defaults for existing users
    const ensureDefaults = (s) => {
        const merged = { ...defaultSettings, ...s };
        // Deep merge specific objects if needed
        merged.company = { ...defaultSettings.company, ...s.company };
        merged.invoice = { ...defaultSettings.invoice, ...s.invoice };
        merged.inventory = { ...defaultSettings.inventory, ...s.inventory };
        merged.transport = { ...defaultSettings.transport, ...s.transport };

        // Ensure locations have prefix/nextNumber
        if (Array.isArray(merged.locations)) {
            merged.locations = merged.locations.map(loc => ({
                prefix: 'INV',
                nextNumber: 1,
                ...loc
            }));
        }
        return merged;
    };

    useEffect(() => {
        let unsubscribe = () => { };

        if (currentUser) {
            setLoading(true);
            const ref = doc(db, 'settings', currentUser.uid);

            unsubscribe = onSnapshot(ref, (snap) => {
                if (snap.exists()) {
                    // Merge with defaults to ensure new fields exist
                    setSettings(ensureDefaults(snap.data()));
                } else {
                    // Initialize if missing
                    setDoc(ref, defaultSettings);
                    setSettings(defaultSettings);
                }
                setLoading(false);
            }, (error) => {
                console.error("Settings load error:", error);
                setLoading(false);
            });
        } else {
            setSettings(defaultSettings); // Fallback for no auth (shouldn't happen in protected routes)
            setLoading(false);
        }

        return () => unsubscribe();
    }, [currentUser]);

    const updateSettings = async (newSettings) => {
        if (!currentUser) return;
        const ref = doc(db, 'settings', currentUser.uid);
        await setDoc(ref, newSettings, { merge: true });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};
