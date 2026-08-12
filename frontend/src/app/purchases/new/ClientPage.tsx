"use client";

// Focused interactive island below the server route boundary.

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UploadCloud, FileSpreadsheet, CheckCircle2, FileType2, PenSquare, Trash2, Plus, BadgePercent } from "lucide-react";
import { purchasesApi, inventoryApi, suppliersApi } from "@/lib/api/services";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { PageShell, SegmentedControl, type SegmentedOption } from "@/components/shell";
import { InventoryItem } from "@/types";

const PURCHASE_ENTRY_SEGMENTS: readonly SegmentedOption<"excel" | "manual">[] = [
  {
    value: "excel",
    label: <span className="flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Import Excel/CSV</span>,
    selectedClassName: "bg-white text-primary-700 shadow-sm dark:bg-primary-600 dark:text-white",
  },
  {
    value: "manual",
    label: <span className="flex items-center gap-2"><PenSquare className="h-4 w-4" /> Manual Entry</span>,
    selectedClassName: "bg-white text-primary-700 shadow-sm dark:bg-primary-600 dark:text-white",
  },
];

export default function NewPurchasePage() {
  const router = useRouter();
  const { currentBranch } = useAuth();

  const [vendorName, setVendorName] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [gstRate, setGstRate] = useState("18");
  const [taxableAmount, setTaxableAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [entryMode, setEntryMode] = useState<"excel" | "manual">("excel");
  const [manualItems, setManualItems] = useState<{ inventory_item: string; quantity: number; unit_price: number }[]>([
    { inventory_item: "", quantity: 1, unit_price: 0 }
  ]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [supplierList, setSupplierList] = useState<any[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await suppliersApi.list({ branch: currentBranch?.id, limit: 1000 });
      setSupplierList(res.results || res);
    } catch(e) {
      console.error("Failed to fetch suppliers", e);
    }
  }, [currentBranch?.id]);

  const loadInventory = useCallback(async () => {
    try {
      const res = await inventoryApi.list({ branch: currentBranch?.id, limit: 1000 });
      setInventoryList(res.results);
    } catch(e) {
      console.error("Failed to fetch inventory for manual entry", e);
    }
  }, [currentBranch?.id]);

  useEffect(() => {
    if (currentBranch) {
      void loadInventory();
      void loadSuppliers();
    }
  }, [currentBranch, loadInventory, loadSuppliers]);

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
        const res = await purchasesApi.importExcel(file, vendorName, invoiceNumber, purchaseDate, paidAmount, paymentMethod);
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
          vendor_gstin: vendorGstin,
          invoice_number: invoiceNumber,
          purchase_date: purchaseDate,
          taxable_amount: taxableAmount ? parseFloat(taxableAmount) : undefined,
          gst_rate: gstRate ? parseFloat(gstRate) : undefined,
          paid_amount: paidAmount ? parseFloat(paidAmount) : undefined,
          payment_method: paymentMethod,
          items: validItems as any
        } as any);
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
    <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "ACCOUNTANT"]}>
      <AppLayout>
        <Header
          title="Add New Purchase"
          subtitle="Record an inbound transfer of inventory from a vendor."
          breadcrumbs={[
            { label: "Purchases", href: "/purchases" },
            { label: "Add Purchase" },
          ]}
          actions={
            <Button
              variant="secondary"
              onClick={() => router.push("/purchases")}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          }
        />
        <PageShell width="wizard" className="pb-24 font-sans">
          <div className="w-full space-y-6">

            {error && <Alert variant="error" title="Could not save purchase">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Form Fields Section */}
              <Card className="space-y-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                  Purchase Metadata
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Vendor Name"
                      required
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      options={[
                        { value: "", label: "Select a Vendor..." },
                        ...supplierList.map(s => ({ value: s.name, label: s.name }))
                      ]}
                    />

                  <Input
                      label="Vendor GSTIN"
                      type="text"
                      value={vendorGstin}
                      onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                      maxLength={15}
                      placeholder="27XXXXX1234X1Z5"
                      className="font-mono"
                  />

                  <Input
                      label="Invoice Number"
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-2023-001"
                  />

                  <Input
                      label="Purchase Date"
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                  />

                  {/* GST on purchase */}
                  <div className="md:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="flex items-center gap-2 text-sm font-semibold text-neutral-700 mb-3">
                      <BadgePercent className="w-4 h-4 text-primary-600" />
                      GST on This Purchase (for ITC claim)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                          label="GST Rate (%)"
                          value={gstRate}
                          onChange={(e) => setGstRate(e.target.value)}
                          options={["5", "12", "18", "28"].map((rate) => ({ value: rate, label: `${rate}%` }))}
                        />
                      <Input
                          label="Taxable Amount (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          value={taxableAmount}
                          onChange={(e) => setTaxableAmount(e.target.value)}
                          placeholder="Amount before GST"
                        />
                    </div>
                    {taxableAmount && (
                      <div className="mt-3 flex gap-4 text-sm font-medium text-primary-700 dark:text-primary-300">
                        <span>CGST: ₹{((parseFloat(taxableAmount) * parseFloat(gstRate)) / 100 / 2).toFixed(2)}</span>
                        <span>SGST: ₹{((parseFloat(taxableAmount) * parseFloat(gstRate)) / 100 / 2).toFixed(2)}</span>
                        <span className="font-bold">Total GST: ₹{((parseFloat(taxableAmount) * parseFloat(gstRate)) / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="flex-1">Purchase Items</span>
                </h2>

                {/* Mode Toggle */}
                <SegmentedControl
                  aria-label="Purchase item entry method"
                  className="mb-6"
                  value={entryMode}
                  onValueChange={setEntryMode}
                  options={PURCHASE_ENTRY_SEGMENTS}
                />

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
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="mt-2"
                        >
                          Remove File
                        </Button>
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
                          <Select
                            label="Inventory Item"
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
                          <Input
                            label="Qty"
                            type="number" min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...manualItems];
                              newItems[index].quantity = parseInt(e.target.value) || 0;
                              setManualItems(newItems);
                            }}
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            label="Unit Cost (₹)"
                            type="number" min="0" step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const newItems = [...manualItems];
                              newItems[index].unit_price = parseFloat(e.target.value) || 0;
                              setManualItems(newItems);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove item row ${index + 1}`}
                          onClick={() => {
                            const newItems = manualItems.filter((_, i) => i !== index);
                            setManualItems(newItems);
                          }}
                          className="mt-6 text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setManualItems([...manualItems, { inventory_item: "", quantity: 1, unit_price: 0 }])}
                      className="mt-2 w-full border-dashed"
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      Add Another Item Row
                    </Button>
                  </div>
                )}
              </Card>

              {/* Initial Payment Section */}
              <Card className="space-y-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold">₹</span>
                  Initial Payment
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                      label="Amount Paid (Optional)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="e.g. 5000"
                  />
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 dark:text-slate-400 mb-1">
                      Payment Method
                    </label>
                    <Select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      options={[
                        { value: "CASH", label: "Cash" },
                        { value: "UPI", label: "UPI" },
                        { value: "CARD", label: "Credit/Debit Card" },
                        { value: "BANK_TRANSFER", label: "Bank Transfer" }
                      ]}
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  If you paid the vendor immediately upon purchase, enter the amount here to automatically update their Ledger/Balance.
                </p>
              </Card>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={isUploading || (entryMode === "excel" && !file)}
                  isLoading={isUploading}
                  size="lg"
                >
                  {isUploading ? "Processing..." : (entryMode === "excel" ? "Import Purchase & Add Stock" : "Save Manual Purchase")}
                </Button>
              </div>
            </form>
          </div>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
