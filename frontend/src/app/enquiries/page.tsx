"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { enquiriesApi } from "@/lib/api/services";
import {
  Plus, UserSearch, Phone, Calendar, ArrowRightCircle,
  XCircle, Search, RefreshCw, X, MessageSquare,
  TrendingUp, Clock, AlertTriangle, Filter
} from "lucide-react";
import { ENQUIRY_STATUS_CONFIG } from "@/types";
import type { Enquiry, EnquiryStatus } from "@/types";

const LEAD_SOURCES = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE_CALL", label: "Phone Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEBSITE", label: "Website" },
  { value: "GOOGLE", label: "Google Search" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "REFERRAL", label: "Referral" },
  { value: "JUSTDIAL", label: "JustDial" },
  { value: "SULEKHA", label: "Sulekha" },
  { value: "OTHER", label: "Other" },
];

export default function EnquiriesPage() {
  const { currentBranch } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    customer_mobile: "",
    customer_email: "",
    device_type: "",
    brand: "",
    model_name: "",
    problem_description: "",
    quoted_price: "",
    source: "WALK_IN",
    follow_up_date: "",
    notes: "",
  });

  const fetchEnquiries = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await enquiriesApi.list(params);
      setEnquiries(res.results || []);
    } catch (err) {
      console.error("Failed to load enquiries:", err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      const res = await enquiriesApi.getStats(params);
      setStats(res);
    } catch (err) {
      console.error("Failed to load enquiry stats:", err);
    }
  }, [currentBranch]);

  useEffect(() => {
    fetchEnquiries();
    fetchStats();
  }, [fetchEnquiries, fetchStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await enquiriesApi.create({
        ...form,
        quoted_price: form.quoted_price ? parseFloat(form.quoted_price) : null,
        branch: currentBranch?.id,
      });
      setShowForm(false);
      setForm({
        customer_name: "",
        customer_mobile: "",
        customer_email: "",
        device_type: "",
        brand: "",
        model_name: "",
        problem_description: "",
        quoted_price: "",
        source: "WALK_IN",
        follow_up_date: "",
        notes: "",
      });
      fetchEnquiries();
      fetchStats();
    } catch (err) {
      console.error("Failed to create enquiry:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (id: string) => {
    if (!confirm("Convert this enquiry to a Job Card?")) return;
    try {
      const res = await enquiriesApi.convertToJob(id);
      alert(res.message);
      fetchEnquiries();
      fetchStats();
    } catch (err) {
      console.error("Failed to convert:", err);
    }
  };

  const handleMarkLost = async (id: string) => {
    const reason = prompt("Reason for loss (e.g., PRICE_HIGH, WENT_ELSEWHERE):");
    if (!reason) return;
    try {
      await enquiriesApi.markLost(id, reason);
      fetchEnquiries();
      fetchStats();
    } catch (err) {
      console.error("Failed to mark lost:", err);
    }
  };

  return (
    <AppLayout>
      <Header
        title="Enquiries"
        subtitle="Track leads, follow-ups & conversions"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Plus className="w-4 h-4" /> New Enquiry
          </button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                <UserSearch className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Leads</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.total || 0}</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Conversion Rate</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.conversion_rate || 0}%</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Today&apos;s Follow-ups</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.today_followups || 0}</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Overdue</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{stats?.overdue_followups || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(ENQUIRY_STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button onClick={() => { fetchEnquiries(); fetchStats(); }} className="p-2 rounded-xl border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Enquiries List */}
        <div className="space-y-3">
          {loading ? (
            <div className="card p-8 text-center text-neutral-400">Loading enquiries...</div>
          ) : enquiries.length === 0 ? (
            <div className="card p-8 text-center text-neutral-400">No enquiries found. Create your first lead!</div>
          ) : (
            enquiries.map((enq) => {
              const statusConfig = ENQUIRY_STATUS_CONFIG[enq.status as EnquiryStatus] || ENQUIRY_STATUS_CONFIG.NEW;
              return (
                <div key={enq.id} className="card p-4 hover:shadow-lg transition-shadow">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-neutral-900 dark:text-white">{enq.customer_name}</h3>
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.textColor }}
                        >
                          {statusConfig.label}
                        </span>
                        {enq.source_display && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-neutral-300">
                            {enq.source_display}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{enq.customer_mobile}</span>
                        {enq.brand && <span>{enq.brand} {enq.model_name}</span>}
                        {enq.follow_up_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Follow-up: {new Date(enq.follow_up_date).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">{enq.problem_description}</p>
                      {enq.quoted_price && (
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                          Quoted: ₹{Number(enq.quoted_price).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {enq.status !== "CONVERTED" && enq.status !== "LOST" && enq.status !== "CLOSED" && (
                        <>
                          <button
                            onClick={() => handleConvert(enq.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" /> Convert
                          </button>
                          <button
                            onClick={() => handleMarkLost(enq.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Lost
                          </button>
                        </>
                      )}
                      {enq.converted_job_number && (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          → Job #{enq.converted_job_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Enquiry Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">New Enquiry / Lead</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Customer Name *</label>
                  <input required type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Mobile *</label>
                  <input required type="tel" value={form.customer_mobile} onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="+91..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Device</label>
                  <input type="text" value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="Laptop"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Brand</label>
                  <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="HP, Dell..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Model</label>
                  <input type="text" value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="Model name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Problem Description *</label>
                <textarea required value={form.problem_description} onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
                  placeholder="What the customer described..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Quoted Price (₹)</label>
                  <input type="number" step="0.01" value={form.quoted_price} onChange={(e) => setForm({ ...form, quoted_price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Lead Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Follow-up Date</label>
                <input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  {saving ? "Saving..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
