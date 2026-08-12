"use client";

// Focused interactive island below the server route boundary.

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { auditApi, billingApi, branchesApi, inventoryApi, suppliersApi } from "@/lib/api/services";
import { Badge, Button, Card, EmptyState, Input, LoadingState, Modal, Select, Textarea } from "@/components/ui";
import { PageShell } from "@/components/shell";
import type { Branch, CreditNote, InventoryItem, PurchaseOrder, StockTransfer, Supplier } from "@/types";
import { ArrowRightLeft, Download, FileMinus2, Plus, ShieldCheck, ShoppingCart, Trash2 } from "lucide-react";

type Section = "transfers" | "orders" | "credits" | "audit";
type Line = { inventory_item: string; description?: string; quantity: string; unit_price?: string };
type EligibleInvoice = { id: string; invoice_number: string; customer_name: string; total_amount: number; balance_due: number };
const money = (value: number | string | undefined) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const rows = <T,>(data: T[] | { results?: T[] } | undefined): T[] => Array.isArray(data) ? data : data?.results || [];

function OperationsContent() {
  const { user, currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.role === "OWNER";
  const canManageOperations = user?.role === "OWNER" || user?.role === "MANAGER";
  const [section, setSection] = React.useState<Section>(() => user?.role === "ACCOUNTANT" ? "credits" : "transfers");
  const [modal, setModal] = React.useState<"transfer" | "order" | "credit" | "receive" | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [transferLines, setTransferLines] = React.useState<Line[]>([{ inventory_item: "", quantity: "1" }]);
  const [orderLines, setOrderLines] = React.useState<Line[]>([{ inventory_item: "", description: "", quantity: "1", unit_price: "" }]);
  const [receivingOrder, setReceivingOrder] = React.useState<PurchaseOrder | null>(null);
  const [receiptQuantities, setReceiptQuantities] = React.useState<Record<string, string>>({});
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditAction, setAuditAction] = React.useState("");
  const [auditView, setAuditView] = React.useState<"changes" | "passwords" | "logins" | "exports">("changes");

  React.useEffect(() => {
    if (!canManageOperations && section !== "credits") setSection("credits");
  }, [canManageOperations, section]);

  const branches = useQuery({ queryKey: ["branches"], queryFn: branchesApi.list, enabled: canManageOperations });
  const transferInventory = useQuery({
    queryKey: ["inventory", form.from_branch],
    queryFn: () => inventoryApi.list({ branch: form.from_branch, limit: 500 }),
    enabled: modal === "transfer" && Boolean(form.from_branch),
  });
  const orderInventory = useQuery({
    queryKey: ["inventory", currentBranch?.id],
    queryFn: () => inventoryApi.list({ branch: currentBranch?.id, limit: 500 }),
    enabled: modal === "order" && Boolean(currentBranch?.id),
  });
  const transfers = useQuery({ queryKey: ["stock-transfers"], queryFn: inventoryApi.listTransfers, enabled: canManageOperations && section === "transfers" });
  const orders = useQuery({ queryKey: ["purchase-orders"], queryFn: suppliersApi.listPurchaseOrders, enabled: canManageOperations && section === "orders" });
  const credits = useQuery({ queryKey: ["credit-notes"], queryFn: billingApi.listCreditNotes, enabled: section === "credits" });
  const audit = useQuery({
    queryKey: ["audit-logs", auditView, auditPage, auditAction],
    queryFn: () => auditView === "changes" ? auditApi.listLogs({ page: auditPage, action: auditAction || undefined }) : auditView === "passwords" ? auditApi.listPasswordAccess(auditPage) : auditView === "logins" ? auditApi.listLogins(auditPage) : auditApi.listExports(auditPage),
    enabled: section === "audit" && isOwner,
  });
  const suppliers = useQuery({ queryKey: ["suppliers", currentBranch?.id], queryFn: () => suppliersApi.list({ branch: currentBranch?.id, limit: 200 }), enabled: modal === "order" });
  const invoices = useQuery({ queryKey: ["credit-eligible-invoices"], queryFn: billingApi.listCreditEligibleInvoices, enabled: modal === "credit" });

  const refresh = (key: string) => void queryClient.invalidateQueries({ queryKey: [key] });
  const createTransfer = useMutation({
    mutationFn: () => inventoryApi.createTransfer({
      from_branch: form.from_branch,
      to_branch: form.to_branch,
      notes: form.notes,
      items: transferLines.map(line => ({ inventory_item: line.inventory_item, quantity: Number(line.quantity) })),
    }),
    onSuccess: () => { toast.success("Transfer created."); closeModal(); refresh("stock-transfers"); },
    onError: (e: Error) => toast.error(e.message || "Could not create transfer."),
  });
  const createOrder = useMutation({
    mutationFn: () => suppliersApi.createPurchaseOrder({
      branch: currentBranch?.id,
      supplier: form.supplier,
      order_date: form.order_date,
      expected_delivery_date: form.expected_delivery_date || null,
      tax_amount: Number(form.tax_amount || 0),
      notes: form.notes || "",
      items: orderLines.map(line => ({
        inventory_item: line.inventory_item || null,
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
      })),
    }),
    onSuccess: () => { toast.success("Purchase order created as a draft."); closeModal(); refresh("purchase-orders"); },
    onError: (e: Error) => toast.error(e.message || "Could not create purchase order."),
  });
  const createCredit = useMutation({
    mutationFn: () => billingApi.createCreditNote({ invoice: form.invoice, amount: Number(form.amount), reason: form.reason }),
    onSuccess: (note) => {
      const delivery = ["QUEUED", "SENT"].includes(note.customer_delivery?.status || "")
        ? " Customer delivery was queued."
        : " Add a customer email or enable a consented message channel to deliver it.";
      toast.success(`Credit note created and the customer balance was adjusted.${delivery}`);
      closeModal(); refresh("credit-notes");
    },
    onError: (e: Error) => toast.error(e.message || "Could not create credit note."),
  });
  const transferAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "dispatch" | "complete" | "cancel" }) => {
      return action === "dispatch" ? inventoryApi.dispatchTransfer(id) : action === "complete" ? inventoryApi.completeTransfer(id) : inventoryApi.cancelTransfer(id);
    },
    onSuccess: () => { toast.success("Transfer updated."); refresh("stock-transfers"); },
    onError: (e: Error) => toast.error(e.message || "Could not update transfer."),
  });
  const orderAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "confirm" | "cancel" }) =>
      action === "send" ? suppliersApi.sendPurchaseOrder(id) : action === "confirm" ? suppliersApi.confirmPurchaseOrder(id) : suppliersApi.cancelPurchaseOrder(id),
    onSuccess: () => { toast.success("Purchase order updated."); refresh("purchase-orders"); },
    onError: (e: Error) => toast.error(e.message || "Could not update the order."),
  });
  const receiveOrder = useMutation({
    mutationFn: () => suppliersApi.receivePurchaseOrder(
      receivingOrder!.id,
      Object.entries(receiptQuantities).filter(([, qty]) => Number(qty) > 0).map(([id, qty]) => ({ id, quantity: Number(qty) })),
    ),
    onSuccess: () => { toast.success("Selected stock received and inventory updated."); closeModal(); refresh("purchase-orders"); },
    onError: (e: Error) => toast.error(e.message || "Could not receive the order."),
  });
  const sendCredit = useMutation({
    mutationFn: (id: string) => billingApi.sendCreditNoteToCustomer(id),
    onSuccess: () => { toast.success("Credit note delivery queued."); refresh("credit-notes"); },
    onError: (e: Error) => toast.error(e.message || "No customer delivery channel is available."),
  });

  const closeModal = () => { setModal(null); setForm({}); setReceivingOrder(null); };
  const openCreate = () => {
    setForm(section === "transfers" ? { from_branch: currentBranch?.id || "" } : section === "orders" ? { order_date: new Date().toISOString().slice(0, 10) } : {});
    setTransferLines([{ inventory_item: "", quantity: "1" }]);
    setOrderLines([{ inventory_item: "", description: "", quantity: "1", unit_price: "" }]);
    setModal(section === "transfers" ? "transfer" : section === "orders" ? "order" : "credit");
  };
  const openReceipt = (order: PurchaseOrder) => {
    setReceivingOrder(order);
    setReceiptQuantities(Object.fromEntries((order.items || []).map(item => [item.id, String(item.quantity - item.received_quantity)])));
    setModal("receive");
  };
  const updateLine = (setter: React.Dispatch<React.SetStateAction<Line[]>>, index: number, values: Partial<Line>) => setter(lines => lines.map((line, i) => i === index ? { ...line, ...values } : line));
  const transferValid = transferLines.length > 0 && transferLines.every(line => line.inventory_item && Number(line.quantity) > 0) && new Set(transferLines.map(line => line.inventory_item)).size === transferLines.length;
  const orderValid = orderLines.length > 0 && orderLines.every(line => line.description?.trim() && Number(line.quantity) > 0 && Number(line.unit_price) >= 0);
  const selectedReceiptCount = Object.values(receiptQuantities).filter(qty => Number(qty) > 0).length;

  const sections: Array<{ id: Section; label: string; visible: boolean }> = [
    { id: "transfers", label: "Stock transfers", visible: canManageOperations },
    { id: "orders", label: "Purchase orders", visible: canManageOperations },
    { id: "credits", label: "Credit notes", visible: true },
    { id: "audit", label: "Audit trail", visible: isOwner },
  ];
  const currentLoading = section === "transfers" ? transfers.isLoading : section === "orders" ? orders.isLoading : section === "credits" ? credits.isLoading : audit.isLoading;

  return <AppLayout>
    <Header title="Operations" subtitle="Control stock movement, purchasing, credits, and accountability" actions={section !== "audit" ? <Button leftIcon={<Plus />} onClick={openCreate}>New {section === "transfers" ? "transfer" : section === "orders" ? "order" : "credit note"}</Button> : undefined} />
    <PageShell width="fluid" className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">{sections.filter(item => item.visible).map(item => <Button key={item.id} variant={section === item.id ? "primary" : "secondary"} onClick={() => setSection(item.id)}>{item.label}</Button>)}</div>
      {section === "audit" && <div className="flex flex-wrap gap-3"><Select aria-label="Audit category" value={auditView} onChange={event => { setAuditView(event.target.value as typeof auditView); setAuditPage(1); }} options={[{ value: "changes", label: "Record changes" }, { value: "passwords", label: "Password access" }, { value: "logins", label: "Login activity" }, { value: "exports", label: "Data exports" }]} />{auditView === "changes" && <Select aria-label="Audit action" value={auditAction} onChange={event => { setAuditAction(event.target.value); setAuditPage(1); }} options={[{ value: "", label: "All actions" }, ...["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "PRIVILEGE_CHANGE", "DEACTIVATE"].map(value => ({ value, label: value.replaceAll("_", " ") }))]} />}</div>}
      {currentLoading ? <LoadingState message="Loading operational records…" /> : <Card padding="none">
        {section === "transfers" && <TransferList items={rows<StockTransfer>(transfers.data)} onAction={(id, action) => transferAction.mutate({ id, action })} />}
        {section === "orders" && <OrderList items={rows<PurchaseOrder>(orders.data)} onAction={(id, action) => orderAction.mutate({ id, action })} onReceive={openReceipt} />}
        {section === "credits" && <CreditList items={rows<CreditNote>(credits.data)} onSend={id => sendCredit.mutate(id)} />}
        {section === "audit" && isOwner && <AuditList items={rows<any>(audit.data)} />}
      </Card>}
      {section === "audit" && isOwner && <Pagination page={auditPage} previous={Boolean(audit.data?.previous)} next={Boolean(audit.data?.next)} onChange={setAuditPage} />}
    </PageShell>

    <Modal isOpen={modal === "transfer"} onClose={closeModal} title="Create stock transfer" footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button isLoading={createTransfer.isPending} disabled={!form.from_branch || !form.to_branch || !transferValid} onClick={() => createTransfer.mutate()}>Create transfer</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><Select label="Source branch" required value={form.from_branch || ""} onChange={event => { setForm({ ...form, from_branch: event.target.value }); setTransferLines([{ inventory_item: "", quantity: "1" }]); }} options={rows<Branch>(branches.data).map(item => ({ value: item.id, label: item.name }))} /><Select label="Destination branch" required value={form.to_branch || ""} onChange={event => setForm({ ...form, to_branch: event.target.value })} options={rows<Branch>(branches.data).filter(item => item.id !== form.from_branch).map(item => ({ value: item.id, label: item.name }))} /></div>
        <LineHeading title="Items" onAdd={() => setTransferLines(lines => [...lines, { inventory_item: "", quantity: "1" }])} />
        {transferLines.map((line, index) => <div key={index} className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_8rem_auto]"><Select label={`Item ${index + 1}`} required value={line.inventory_item} onChange={event => updateLine(setTransferLines, index, { inventory_item: event.target.value })} options={rows<InventoryItem>(transferInventory.data).map(item => ({ value: item.id, label: `${item.name} (${item.quantity} available)` }))} /><Input label="Quantity" required type="number" min="1" value={line.quantity} onChange={event => updateLine(setTransferLines, index, { quantity: event.target.value })} /><RemoveLine disabled={transferLines.length === 1} onClick={() => setTransferLines(lines => lines.filter((_, i) => i !== index))} /></div>)}
        <Textarea label="Notes" value={form.notes || ""} onChange={event => setForm({ ...form, notes: event.target.value })} />
      </div>
    </Modal>

    <Modal isOpen={modal === "order"} onClose={closeModal} title="Create purchase order" size="xl" footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button isLoading={createOrder.isPending} disabled={!form.supplier || !form.order_date || !orderValid} onClick={() => createOrder.mutate()}>Save draft</Button></>}>
      <div className="space-y-4">
        <Select label="Supplier" required value={form.supplier || ""} onChange={event => setForm({ ...form, supplier: event.target.value })} options={rows<Supplier>(suppliers.data).map(item => ({ value: item.id, label: item.name }))} />
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Order date" required type="date" value={form.order_date || ""} onChange={event => setForm({ ...form, order_date: event.target.value })} /><Input label="Expected delivery" type="date" value={form.expected_delivery_date || ""} onChange={event => setForm({ ...form, expected_delivery_date: event.target.value })} /></div>
        <LineHeading title="Order lines" onAdd={() => setOrderLines(lines => [...lines, { inventory_item: "", description: "", quantity: "1", unit_price: "" }])} />
        {orderLines.map((line, index) => <div key={index} className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_7rem_9rem_auto]"><Select label="Inventory link" value={line.inventory_item} onChange={event => { const item = rows<InventoryItem>(orderInventory.data).find(option => option.id === event.target.value); updateLine(setOrderLines, index, { inventory_item: event.target.value, description: item?.name || line.description, unit_price: item ? String(item.cost_price) : line.unit_price }); }} options={[{ value: "", label: "New / unlinked item" }, ...rows<InventoryItem>(orderInventory.data).map(item => ({ value: item.id, label: item.name }))]} /><Input label="Description" required value={line.description || ""} onChange={event => updateLine(setOrderLines, index, { description: event.target.value })} /><Input label="Qty" required type="number" min="1" value={line.quantity} onChange={event => updateLine(setOrderLines, index, { quantity: event.target.value })} /><Input label="Unit price" required type="number" min="0" value={line.unit_price || ""} onChange={event => updateLine(setOrderLines, index, { unit_price: event.target.value })} /><RemoveLine disabled={orderLines.length === 1} onClick={() => setOrderLines(lines => lines.filter((_, i) => i !== index))} /></div>)}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Tax amount" type="number" min="0" value={form.tax_amount || ""} onChange={event => setForm({ ...form, tax_amount: event.target.value })} /><Textarea label="Notes" value={form.notes || ""} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
      </div>
    </Modal>

    <Modal isOpen={modal === "credit"} onClose={closeModal} title="Create credit note" footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button isLoading={createCredit.isPending} disabled={!form.invoice || Number(form.amount) <= 0 || !form.reason} onClick={() => createCredit.mutate()}>Create credit note</Button></>}>
      <div className="space-y-4"><Select label="Invoice" required value={form.invoice || ""} onChange={event => setForm({ ...form, invoice: event.target.value })} options={rows<EligibleInvoice>(invoices.data).map(item => ({ value: item.id, label: `${item.invoice_number} — ${item.customer_name} (${money(item.balance_due)} eligible)` }))} /><Input label="Credit amount" required type="number" min="0.01" step="0.01" value={form.amount || ""} onChange={event => setForm({ ...form, amount: event.target.value })} /><Textarea label="Reason" required value={form.reason || ""} onChange={event => setForm({ ...form, reason: event.target.value })} /></div>
    </Modal>

    <Modal isOpen={modal === "receive"} onClose={closeModal} title={`Receive ${receivingOrder?.po_number || "purchase order"}`} footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button isLoading={receiveOrder.isPending} disabled={!selectedReceiptCount} onClick={() => receiveOrder.mutate()}>Receive selected</Button></>}>
      <div className="space-y-3">{(receivingOrder?.items || []).map(item => { const outstanding = item.quantity - item.received_quantity; return <div key={item.id} className="grid grid-cols-[1fr_8rem] items-end gap-3"><div><p className="font-medium">{item.description}</p><p className="text-sm text-neutral-500">{outstanding} outstanding of {item.quantity}</p></div><Input aria-label={`Receive ${item.description}`} type="number" min="0" max={outstanding} disabled={outstanding === 0} value={receiptQuantities[item.id] || "0"} onChange={event => setReceiptQuantities(values => ({ ...values, [item.id]: event.target.value }))} /></div>; })}</div>
    </Modal>
  </AppLayout>;
}

function LineHeading({ title, onAdd }: { title: string; onAdd: () => void }) { return <div className="flex items-center justify-between"><p className="font-semibold">{title}</p><Button size="sm" variant="secondary" leftIcon={<Plus />} onClick={onAdd}>Add line</Button></div>; }
function RemoveLine({ disabled, onClick }: { disabled: boolean; onClick: () => void }) { return <Button className="self-end" size="sm" variant="ghost" aria-label="Remove line" disabled={disabled} onClick={onClick}><Trash2 className="h-4 w-4" /></Button>; }
function Pagination({ page, previous, next, onChange }: { page: number; previous: boolean; next: boolean; onChange: (page: number) => void }) { return <div className="flex items-center justify-end gap-3"><Button size="sm" variant="secondary" disabled={!previous} onClick={() => onChange(page - 1)}>Previous</Button><span className="text-sm">Page {page}</span><Button size="sm" variant="secondary" disabled={!next} onClick={() => onChange(page + 1)}>Next</Button></div>; }

function TransferList({ items, onAction }: { items: StockTransfer[]; onAction: (id: string, action: "dispatch" | "complete" | "cancel") => void }) {
  if (!items.length) return <EmptyState title="No stock transfers" description="Create a transfer when stock needs to move between branches." />;
  return <div className="divide-y divide-neutral-100 dark:divide-slate-700">{items.map(item => <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-semibold"><ArrowRightLeft className="h-4 w-4" />{item.from_branch_name} → {item.to_branch_name} <Badge variant={item.status === "COMPLETED" ? "success" : item.status === "CANCELLED" ? "danger" : "warning"}>{item.status.replace("_", " ")}</Badge></div><p className="mt-1 text-sm text-neutral-500">{item.items.map(line => `${line.item_name} × ${line.quantity}`).join(", ")}</p></div><div className="flex flex-wrap gap-2">{item.status === "PENDING" && <><Button size="sm" onClick={() => onAction(item.id, "dispatch")}>Dispatch</Button><Button size="sm" variant="secondary" onClick={() => onAction(item.id, "cancel")}>Cancel</Button></>}{item.status === "IN_TRANSIT" && <Button size="sm" onClick={() => onAction(item.id, "complete")}>Confirm receipt</Button>}</div></div>)}</div>;
}
function OrderList({ items, onAction, onReceive }: { items: PurchaseOrder[]; onAction: (id: string, action: "send" | "confirm" | "cancel") => void; onReceive: (order: PurchaseOrder) => void }) {
  if (!items.length) return <EmptyState title="No purchase orders" description="Create an order before buying stock from a supplier." />;
  return <div className="divide-y divide-neutral-100 dark:divide-slate-700">{items.map(item => <div key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold"><ShoppingCart className="mr-2 inline h-4 w-4" />{item.po_number} · {item.supplier_name}</p><p className="mt-1 text-sm text-neutral-500">{(item.items || []).map(line => `${line.description} × ${line.quantity}`).join(", ") || `Ordered ${item.order_date}`}</p></div><div className="flex flex-wrap items-center gap-2"><Badge>{item.status_display}</Badge><span className="font-semibold">{money(item.total_amount)}</span>{item.status === "DRAFT" && <Button size="sm" onClick={() => onAction(item.id, "send")}>Send</Button>}{item.status === "SENT" && <Button size="sm" onClick={() => onAction(item.id, "confirm")}>Confirm</Button>}{["SENT", "CONFIRMED", "PARTIAL"].includes(item.status) && <Button size="sm" onClick={() => onReceive(item)}>Receive</Button>}{["DRAFT", "SENT", "CONFIRMED"].includes(item.status) && <Button size="sm" variant="secondary" onClick={() => onAction(item.id, "cancel")}>Cancel</Button>}</div></div>)}</div>;
}
function CreditList({ items, onSend }: { items: CreditNote[]; onSend: (id: string) => void }) {
  if (!items.length) return <EmptyState title="No credit notes" description="Credits issued against invoices will appear here." />;
  return <div className="divide-y divide-neutral-100 dark:divide-slate-700">{items.map(item => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold"><FileMinus2 className="mr-2 inline h-4 w-4" />{item.credit_note_number}</p><p className="mt-1 text-sm text-neutral-500">Invoice {item.invoice_number} · {item.reason}</p><p className="mt-1 text-xs text-neutral-500">Customer delivery: {(item.customer_delivery?.status || "NOT_AVAILABLE").replaceAll("_", " ").toLowerCase()}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><p className="font-semibold">{money(item.total_amount)}</p><Button size="sm" variant="secondary" onClick={() => onSend(item.id)}>Send to customer</Button><Button size="sm" variant="secondary" aria-label={`Download ${item.credit_note_number}`} onClick={() => billingApi.downloadCreditNote(item.id, item.credit_note_number)}><Download className="h-4 w-4" /></Button></div></div>)}</div>;
}
function AuditList({ items }: { items: any[] }) {
  if (!items.length) return <EmptyState title="No audit events" description="Accountable changes will appear here." />;
  return <div className="divide-y divide-neutral-100 dark:divide-slate-700">{items.map(item => <div key={item.id} className="p-4"><p className="font-semibold"><ShieldCheck className="mr-2 inline h-4 w-4" />{item.user_name || item.accessed_by_name || item.user_email || item.email || "System"} · {item.action || item.export_type || item.reason || (item.success ? "Successful login" : "Failed login")}</p><p className="mt-1 text-sm text-neutral-500">{item.model_name ? `${item.model_name} ${item.object_id}` : item.job_number || item.report_name || item.failure_reason || "Activity recorded"} · {new Date(item.timestamp || item.accessed_at || item.created_at).toLocaleString()}</p></div>)}</div>;
}

export default function OperationsPage() { return <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "ACCOUNTANT"]}><OperationsContent /></ProtectedRoute>; }
