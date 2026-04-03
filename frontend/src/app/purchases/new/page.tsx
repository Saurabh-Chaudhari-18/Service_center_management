"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, FileType2, Target, PenSquare, Trash2, Plus } from "lucide-react";
import { purchasesApi, inventoryApi } from "@/lib/api/services";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Select } from "@/components/ui";
import { InventoryItem } from "@/types";

export default function NewPurchasePage() {
  const router = useRouter();
  const { currentBranch } = useAuth();
  
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  
  const [entryMode, setEntryMode] = useState<"excel" | "manual">("excel");
  const [manualItems, setManualItems] = useState<{ inventory_item: string; quantity: number; unit_price: number }[]>([
    { inventory_item: "", quantity: 1, unit_price: 0 }
  ]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentBranch) {
      loadInventory();
    }
  }, [currentBranch]);

  const loadInventory = async () => {
    try {
      const res = await inventoryApi.list({ branch: currentBranch?.id, limit: 1000 });
      setInventoryList(res.results);
    } catch(e) {
      console.error("Failed to fetch inventory for manual entry", e);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls') || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a valid Excel (.xlsx, .xls) or CSV file.");
        setFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please drop a valid Excel (.xlsx, .xls) or CSV file.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vendorName.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (!purchaseDate) {
      setError("Purchase date is required.");
      return;
    }
    
    setIsUploading(true);
    try {
      if (entryMode === "excel") {
        if (!file) {
          setError("Please select an Excel file to import items.");
          setIsUploading(false);
          return;
        }
        const res = await purchasesApi.importExcel(file, vendorName, invoiceNumber, purchaseDate);
        router.push(`/purchases/${res.purchase_id}`);
      } else {
        const validItems = manualItems.filter(i => i.inventory_item && i.quantity > 0 && i.unit_price >= 0);
        if (validItems.length === 0) {
          setError("Please add at least one valid item row with quantity > 0.");
          setIsUploading(false);
          return;
        }
        
        const res = await purchasesApi.create({
          vendor_name: vendorName,
          invoice_number: invoiceNumber,
          purchase_date: purchaseDate,
          items: validItems as any
        });
        if (res && res.id) {
          router.push(`/purchases/${res.id}`);
        } else {
          setError("Failed to create purchase record properly.");
        }
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during import.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header 
          title="Add New Purchase"
          subtitle="Record an inbound transfer of inventory from a vendor."
          actions={
            <button
              onClick={() => router.push("/purchases")}
              className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors bg-white dark:bg-slate-800/50 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-700/50 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          }
        />
        <div className="p-6 font-sans flex justify-center pb-24">
          <div className="max-w-3xl w-full space-y-6">

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 whitespace-pre-line">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Form Fields Section */}
              <div className="bg-white/90 dark:bg-slate-800/60 backdrop-blur-xl border border-neutral-200 dark:border-slate-700/50 shadow-sm rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                  Purchase Metadata
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-slate-400 mb-1">
                      Vendor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700/50 rounded-xl text-neutral-900 dark:text-slate-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-neutral-400 dark:placeholder:text-slate-500"
                      placeholder="e.g. Dell Distributors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-slate-400 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700/50 rounded-xl text-neutral-900 dark:text-slate-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-neutral-400 dark:placeholder:text-slate-500"
                      placeholder="e.g. INV-2023-001"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-600 dark:text-slate-400 mb-1">
                      Purchase Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700/50 rounded-xl text-neutral-900 dark:text-slate-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 dark:bg-slate-800/60 backdrop-blur-xl border border-neutral-200 dark:border-slate-700/50 shadow-sm rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="flex-1">Purchase Items</span>
                </h2>
                
                {/* Mode Toggle */}
                <div className="flex bg-neutral-100 dark:bg-slate-900/50 p-1 rounded-xl border border-neutral-200 dark:border-slate-700/50 w-full mb-6">
                  <button
                    type="button"
                    onClick={() => setEntryMode("excel")}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      entryMode === "excel" 
                        ? "bg-white dark:bg-primary-600 text-neutral-900 dark:text-white shadow-sm border-neutral-200 dark:border-transparent" 
                        : "text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 hover:bg-neutral-200/50 dark:hover:bg-slate-800 border-transparent"
                    } border`}
                  >
                    <UploadCloud className="w-4 h-4" /> Import Excel/CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode("manual")}
                    className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                      entryMode === "manual" 
                        ? "bg-white dark:bg-primary-600 text-neutral-900 dark:text-white shadow-sm border-neutral-200 dark:border-transparent" 
                        : "text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 hover:bg-neutral-200/50 dark:hover:bg-slate-800 border-transparent"
                    } border`}
                  >
                    <PenSquare className="w-4 h-4" /> Manual Entry
                  </button>
                </div>

                {/* Entry Views */}
                {entryMode === "excel" ? (
                  <div 
                    className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 text-center ${
                      file 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
                        : 'border-neutral-300 dark:border-slate-600/50 bg-neutral-50 dark:bg-slate-800/20 hover:border-primary-400 hover:bg-neutral-100 dark:hover:bg-slate-800/40'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-slate-200">{file.name}</h3>
                        <p className="text-sm text-neutral-500 dark:text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors mt-2"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="flex flex-col items-center gap-3 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-slate-700/50 flex items-center justify-center mb-2">
                          <FileType2 className="w-8 h-8 text-neutral-400 dark:text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-neutral-700 dark:text-slate-300">
                          <span className="text-primary-600 dark:text-primary-400 hover:underline">Click to upload</span> or drag and drop
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-slate-500">Excel (.xlsx) or CSV format</p>
                        
                        <div className="mt-4 p-4 bg-white dark:bg-slate-900/50 rounded-lg text-xs text-neutral-600 dark:text-slate-400 text-left w-full max-w-sm border border-neutral-200 dark:border-slate-700/50">
                          <p className="font-semibold text-neutral-800 dark:text-slate-300 mb-2">Required Columns:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li><span className="text-primary-600 dark:text-primary-400 whitespace-nowrap">SKU</span> or <span className="text-primary-600 dark:text-primary-400 whitespace-nowrap">Name</span> (Must match inventory exactly)</li>
                            <li><span className="text-primary-600 dark:text-primary-400 whitespace-nowrap">Quantity</span> (Number &gt; 0)</li>
                            <li><span className="text-primary-600 dark:text-primary-400 whitespace-nowrap">Unit Price</span> (Number &ge; 0)</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {manualItems.map((item, index) => (
                      <div key={index} className="flex gap-4 items-start bg-neutral-50 dark:bg-slate-900/40 p-4 rounded-xl border border-neutral-200 dark:border-slate-700/50">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Inventory Item</label>
                          <Select
                            value={item.inventory_item}
                            onChange={(e) => {
                              const newItems = [...manualItems];
                              newItems[index].inventory_item = e.target.value;
                              setManualItems(newItems);
                            }}
                            options={inventoryList.map(inv => ({
                              value: inv.id,
                              label: `${inv.name}${inv.sku ? ` (SKU: ${inv.sku})` : ''}`
                            }))}
                            placeholder="Select an Item..."
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-xs font-semibold text-neutral-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Qty</label>
                          <input 
                            type="number" min="1" 
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...manualItems];
                              newItems[index].quantity = parseInt(e.target.value) || 0;
                              setManualItems(newItems);
                            }}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg text-neutral-900 dark:text-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-semibold text-neutral-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Unit Cost (₹)</label>
                          <input 
                            type="number" min="0" step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const newItems = [...manualItems];
                              newItems[index].unit_price = parseFloat(e.target.value) || 0;
                              setManualItems(newItems);
                            }}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg text-neutral-900 dark:text-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newItems = manualItems.filter((_, i) => i !== index);
                            setManualItems(newItems);
                          }}
                          className="mt-6 p-2.5 rounded-lg text-neutral-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setManualItems([...manualItems, { inventory_item: "", quantity: 1, unit_price: 0 }])}
                      className="text-sm px-4 py-2 mt-2 border border-dashed border-primary-200 dark:border-emerald-500/30 text-primary-600 dark:text-emerald-400 hover:text-primary-700 dark:hover:text-emerald-300 hover:bg-primary-50 dark:hover:bg-emerald-500/10 flex items-center justify-center gap-2 font-medium transition-colors w-full rounded-xl"
                    >
                      <Plus className="w-4 h-4" /> Add Another Item Row
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isUploading || (entryMode === "excel" && !file)}
                  className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 dark:from-emerald-500 dark:to-teal-500 text-white font-medium rounded-xl hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    entryMode === "excel" ? "Import Purchase & Add Stock" : "Save Manual Purchase"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
