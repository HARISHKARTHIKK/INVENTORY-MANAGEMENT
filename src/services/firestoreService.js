
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    getDoc,
    getDocs,
    runTransaction,
    query,
    where
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";

/* =========================
   PRODUCTS
========================= */

export const addProduct = async (data) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");

    await addDoc(collection(db, "products"), {
        name: data.name,
        sku: data.sku,
        hsn: data.hsn || "",
        price: Number(data.price),
        stockQty: 0, // Initial stock is now always 0, must add via Stock Entry
        locations: {}, // Initialize empty locations map
        lowStockThreshold: Number(data.lowStockThreshold || 10),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
};

export const updateProduct = async (id, data) => {
    await updateDoc(doc(db, "products", id), {
        name: data.name,
        sku: data.sku,
        hsn: data.hsn || "",
        price: Number(data.price),
        stockQty: Number(data.stockQty),
        lowStockThreshold: Number(data.lowStockThreshold || 10),
        updatedAt: serverTimestamp()
    });
};

export const deleteProduct = async (id) => {
    await deleteDoc(doc(db, "products", id));
};

/* =========================
   CUSTOMERS (FIX)
========================= */

export const addCustomer = async (data) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");

    await addDoc(collection(db, "customers"), {
        ...data,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
    });
};

export const updateCustomer = async (id, data) => {
    await updateDoc(doc(db, "customers", id), {
        ...data,
        updatedAt: serverTimestamp()
    });
};

export const deleteCustomer = async (id) => {
    await deleteDoc(doc(db, "customers", id));
};

/* =========================
   INVOICES
========================= */

export const createInvoice = async (invoice, items, fromLocation) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");
    const uid = auth.currentUser.uid;

    if (!fromLocation) throw new Error("Dispatch location is required.");
    if (!invoice.invoiceNo) throw new Error("Invoice Number is required.");

    // Check Uniqueness (Query before transaction)
    const qInvoice = query(collection(db, 'invoices'), where('invoiceNo', '==', invoice.invoiceNo));
    const invoiceSnap = await getDocs(qInvoice);
    if (!invoiceSnap.empty) {
        throw new Error(`Invoice Number "${invoice.invoiceNo}" already exists.`);
    }

    return await runTransaction(db, async (transaction) => {
        // 1. Read all products first
        const productRefs = items.map(item => doc(db, "products", item.productId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        // 2. Validate Stock & Prepare Updates
        const productUpdates = [];
        const itemsSummary = [];

        items.forEach((item, index) => {
            const snap = productSnaps[index];
            if (!snap.exists()) throw new Error(`Product not found: ${item.name}`);

            const rawQty = item.quantity !== undefined ? item.quantity : item.qty;
            let quantity = Number(rawQty);

            // Backend Safety: Force convert to number if type check fails
            if (typeof quantity !== 'number' || isNaN(quantity)) {
                quantity = Number(rawQty) || 0;
            }

            if (isNaN(quantity) || rawQty === '' || rawQty === null || rawQty === undefined) {
                throw new Error(`Invalid numeric quantity [${rawQty}] for product: ${item.name || 'Unknown'}`);
            }
            if (quantity < 0) throw new Error(`Quantity cannot be negative for product: ${item.name}`);

            const data = snap.data();
            const globalStock = Number(data.stockQty) || 0;

            if (globalStock < quantity) {
                // Allow if quantity is 0, otherwise block
                if (quantity > 0) {
                    throw new Error(`Insufficient global stock for ${item.name}. Available: ${globalStock.toFixed(1)}, Requested: ${quantity.toFixed(1)}`);
                }
            }

            const locations = data.locations || {};
            const currentLocStock = Number(locations[fromLocation]) || 0;
            const newLocStock = Number((currentLocStock - quantity).toFixed(1));

            // Derive new locations map
            const newLocations = { ...locations, [fromLocation]: newLocStock };
            // Calculate new Total Logic directly from locations
            const newTotalStock = Object.values(newLocations).reduce((sum, qty) => sum + (Number(qty) || 0), 0);

            productUpdates.push({
                ref: snap.ref,
                data: {
                    locations: newLocations,
                    stockQty: Number(newTotalStock.toFixed(1)),
                    updatedAt: serverTimestamp()
                }
            });

            itemsSummary.push({
                productName: item.name || '',
                quantity: quantity,
                price: Number(item.price) || 0
            });
        });

        // 3. Write Invoice with itemsSummary
        const invoiceRef = doc(collection(db, "invoices"));
        transaction.set(invoiceRef, {
            ...invoice,
            fromLocation,
            itemsSummary, // Added for Report Efficiency
            userId: uid,
            createdAt: serverTimestamp()
        });

        // 4. Process Items (InvoiceItems, Stock Updates, Movements, Dispatches)
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Invoice Item
            const itemRef = doc(collection(db, "invoiceItems"));
            transaction.set(itemRef, {
                invoiceId: invoiceRef.id,
                productId: item.productId,
                productName: item.name || '',
                quantity: Number(item.quantity),
                price: Number(item.price),
                userId: uid,
                createdAt: serverTimestamp()
            });

            // Product Update
            const update = productUpdates[i];
            transaction.update(update.ref, update.data);

            // Stock Movement Log
            const moveRef = doc(collection(db, "stockMovements"));
            transaction.set(moveRef, {
                productId: item.productId,
                productName: item.name || '',
                location: fromLocation,
                changeQty: -Number(item.quantity),
                type: 'INVOICE',
                reason: `Invoice #${invoice.invoiceNo} `,
                relatedInvoiceId: invoiceRef.id,
                transport: invoice.transport || {},
                userId: uid,
                createdAt: serverTimestamp()
            });

            // Dispatch Record (Auto-Create)
            const dispatchRef = doc(collection(db, "dispatches"));
            transaction.set(dispatchRef, {
                invoiceId: invoiceRef.id,
                invoiceNo: invoice.invoiceNo,
                productId: item.productId,
                productName: item.name || '',
                quantity: Number(item.quantity),
                location: fromLocation,
                transport: invoice.transport || {},
                userId: uid,
                createdAt: serverTimestamp()
            });
        }

        return invoiceRef.id;
    });
};

/* =========================
   BACKFILL / MAINTENANCE
   ========================= */
export const backfillDispatches = async () => {
    const auth = getAuth();
    if (!auth.currentUser) return;

    console.log("Starting Backfill...");
    const invoicesSnap = await getDocs(collection(db, "invoices"));

    let processed = 0;
    for (const invDoc of invoicesSnap.docs) {
        const inv = { id: invDoc.id, ...invDoc.data() };

        // Check if dispatches exist
        const qDisp = query(collection(db, "dispatches"), where("invoiceId", "==", inv.id));
        const dispSnap = await getDocs(qDisp);

        if (dispSnap.empty) {
            // Need to backfill
            // Fetch items
            const qItems = query(collection(db, "invoiceItems"), where("invoiceId", "==", inv.id));
            const itemsSnap = await getDocs(qItems);

            const promises = itemsSnap.docs.map(async (itemDoc) => {
                const item = itemDoc.data();
                await addDoc(collection(db, "dispatches"), {
                    invoiceId: inv.id,
                    invoiceNo: inv.invoiceNo || "UNKNOWN",
                    productId: item.productId,
                    productName: item.productName || item.name || "Unknown Product",
                    quantity: Number(item.quantity),
                    location: inv.fromLocation || "Warehouse A",
                    transport: inv.transport || {},
                    userId: inv.userId || auth.currentUser.uid,
                    createdAt: inv.createdAt // Keep original date!
                });
            });

            await Promise.all(promises);
            processed++;
        }

        // Also update itemsSummary if missing?
        if (!inv.itemsSummary) {
            const qItems = query(collection(db, "invoiceItems"), where("invoiceId", "==", inv.id));
            const itemsSnap = await getDocs(qItems);
            const summary = itemsSnap.docs.map(d => ({
                productName: d.data().productName || d.data().name || '',
                quantity: Number(d.data().quantity),
                price: Number(d.data().price)
            }));

            await updateDoc(doc(db, "invoices", inv.id), {
                itemsSummary: summary
            });
        }
    }
    console.log(`Backfilled ${processed} invoices.`);
    return processed;
};

/* =========================
   ADD STOCK (NEW)
   ========================= */

export const addStock = async ({ productId, location, quantity, reason }) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");
    const uid = auth.currentUser.uid;

    const qty = Number(quantity);
    if (isNaN(qty)) throw new Error("Invalid numeric quantity.");
    if (!location) throw new Error("Location is required.");

    await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) throw new Error("Product not found.");

        const data = productSnap.data();
        const locations = data.locations || {};
        const currentLocStock = Number(locations[location]) || 0;

        // No checks on negative result, assume allowed or managed by UI warning? 
        // "Stock quantity is allowed to be ZERO".
        // addStock adds to current.

        const newLocStock = Number((currentLocStock + qty).toFixed(1));

        const newLocations = { ...locations, [location]: newLocStock };
        // Recalc total from locations to be safe
        const newTotalStock = Object.values(newLocations).reduce((a, b) => a + (Number(b) || 0), 0);

        transaction.update(productRef, {
            locations: newLocations,
            stockQty: Number(newTotalStock.toFixed(1)),
            updatedAt: serverTimestamp()
        });

        // Log Movement
        const moveRef = doc(collection(db, "stockMovements"));
        transaction.set(moveRef, {
            productId,
            location,
            changeQty: qty,
            reason: reason || "Stock Entry",
            userId: uid,
            createdAt: serverTimestamp()
        });
    });
};

export const updateStockLevel = async ({ productId, location, newQuantity, reason }) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");
    const uid = auth.currentUser.uid;

    const newQty = Number(newQuantity);
    if (isNaN(newQty)) throw new Error("Invalid numeric quantity.");
    if (newQty < 0) throw new Error("Stock cannot be negative."); // Basic sanity, though "Allow 0" implies not negative? 
    // Requirement "Stock quantity allowed to be ZERO". Usually inventory constraint is >= 0.

    if (!location) throw new Error("Location is required.");

    await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) throw new Error("Product not found.");

        const data = productSnap.data();
        const locations = data.locations || {};
        const currentLocStock = Number(locations[location]) || 0;

        const diff = newQty - currentLocStock;

        if (diff === 0) return; // No change

        const newLocations = { ...locations, [location]: Number(newQty.toFixed(1)) };
        const newTotalStock = Object.values(newLocations).reduce((a, b) => a + (Number(b) || 0), 0);

        transaction.update(productRef, {
            locations: newLocations,
            stockQty: Number(newTotalStock.toFixed(1)),
            updatedAt: serverTimestamp()
        });

        // Log Movement
        const moveRef = doc(collection(db, "stockMovements"));
        transaction.set(moveRef, {
            productId,
            location,
            changeQty: Number(diff.toFixed(1)),
            reason: reason || "Stock Correction",
            userId: uid,
            createdAt: serverTimestamp()
        });
    });
};

/* =========================
   STOCK TRANSFER
   ========================= */

export const transferStock = async ({ productId, productName, fromLocation, toLocation, quantity }) => {
    const auth = getAuth();
    if (!auth.currentUser) throw new Error("User not authenticated");
    const uid = auth.currentUser.uid;

    if (quantity <= 0) throw new Error("Transfer quantity must be greater than zero.");
    if (fromLocation === toLocation) throw new Error("Source and destination cannot be the same.");

    // Transaction to ensure atomicity
    await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", productId);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) throw new Error("Product not found.");

        const data = productSnap.data();
        const locations = data.locations || {};

        // Check source stock
        // If location stock doesn't accept "From" (because it's undefined), assume all stock is in 'Warehouse A' or similar default if not set?
        // But requirement says: "Maintain location-level stock logically".
        // If locations map doesn't exist yet, we must initialize it IF the current stockQty > 0.
        // We can assume if no map exists, all stock is in "Warehouse A" (or user must pick from where).
        // Let's rely on what's in the map. If key misses, it's 0.

        const currentFromStock = locations[fromLocation] || 0;

        // Strict Validation:
        if (currentFromStock < quantity) {
            // Fallback: If map is empty BUT global `stockQty` matches what they want, 
            // maybe we haven't migrated to location-based yet.
            // But to be safe and strict:
            throw new Error(`Insufficient stock at ${fromLocation}.Available: ${currentFromStock} mts.`);
        }

        const newFromStock = currentFromStock - quantity;
        const currentToStock = locations[toLocation] || 0;
        const newToStock = currentToStock + quantity;

        // Updates
        const newLocations = { ...locations, [fromLocation]: newFromStock, [toLocation]: newToStock };

        // Verify total wasn't messed up (floating point limit)
        // const newTotal = Object.values(newLocations).reduce((a, b) => a + b, 0); 
        // We don't touch global stockQty because it's just a transfer.

        transaction.update(productRef, {
            locations: newLocations,
            updatedAt: serverTimestamp()
        });

        // Logs - create new ref for logs to key them
        const transferRef = doc(collection(db, "stockTransfers"));
        transaction.set(transferRef, {
            productId,
            productName,
            fromLocation,
            toLocation,
            quantity,
            userId: uid,
            createdAt: serverTimestamp()
        });

        const moveOutRef = doc(collection(db, "stockMovements"));
        transaction.set(moveOutRef, {
            productId,
            location: fromLocation,
            changeQty: -quantity,
            reason: "Transfer Out",
            referenceId: transferRef.id,
            userId: uid,
            createdAt: serverTimestamp()
        });

        const moveInRef = doc(collection(db, "stockMovements"));
        transaction.set(moveInRef, {
            productId,
            location: toLocation,
            changeQty: quantity,
            reason: "Transfer In",
            referenceId: transferRef.id,
            userId: uid,
            createdAt: serverTimestamp()
        });
    });
};
