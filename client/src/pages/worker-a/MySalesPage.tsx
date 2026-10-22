import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Trash2,
  Pencil,
  Search,
  ShoppingCart,
  DollarSign,
  CreditCard,
  Layers,
  Clock,
  Calendar,
  Tag,
  X,
  ChevronRight,
  ChevronDown,
  Save,
} from "lucide-react";
import api from "../../api/axios";
import { formatCurrency, formatDateTime } from "../../lib/utils";
import Spinner from "../../components/ui/Spinner";
import Badge from "../../components/ui/Badge";
import toast from "react-hot-toast";

const todayStr = () => new Date().toISOString().split("T")[0];

const nDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const paymentLabel = (paymentMode: string) => {
  if (paymentMode === "CC") return "Cash & Carry";
  if (paymentMode === "PAYMENT_ONLY") return "Payment Only";
  return "Credit";
};

const paymentBadgeVariant = (paymentMode: string) =>
  paymentMode === "CC" ? "green" : "orange";

function EditSaleModal({
  sale,
  onClose,
  onSaved,
}: {
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saleDate, setSaleDate] = useState(
    sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 16) : "",
  );
  const [paymentMode, setPaymentMode] = useState(sale.paymentMode || "CC");
  const [saleType, setSaleType] = useState(sale.saleType || "");
  const [customerName, setCustomerName] = useState(sale.customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(
    sale.customer?.phone || "",
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        saleDate: saleDate ? new Date(saleDate).toISOString() : sale.saleDate,
        paymentMode,
        saleType,
        customerName,
        customerPhone,
      };

      return api.put(`/sales/${sale.id}`, payload);
    },
    onSuccess: () => {
      toast.success("Sale updated successfully");
      onSaved();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Sale could not be updated");
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-900 to-indigo-900 px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-bold">Edit Sale #{sale.id}</h2>
            <p className="text-xs text-blue-200">
              Correct the recorded sale information
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
            aria-label="Close edit sale dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Customer name
              </span>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Walk-in Customer"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Customer phone
              </span>
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Sale date and time
            </span>
            <input
              type="datetime-local"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Payment
              </span>
              <select
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CC">Cash & Carry</option>
                <option value="CREDIT">Credit</option>
                <option value="PAYMENT_ONLY">Payment Only</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Sale type
              </span>
              <select
                value={saleType}
                onChange={(event) => setSaleType(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select sale type</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="RETAIL">Retail</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Items in this sale
            </p>
            {sale.saleItems?.length ? (
              <div className="space-y-1.5">
                {sale.saleItems.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex justify-between text-xs text-slate-700"
                  >
                    <span>
                      {item.quantity}x{" "}
                      {item.product?.name || `Product #${item.productId}`}
                    </span>
                    <span>
                      {formatCurrency(parseFloat(item.subtotal || "0"))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No item details available.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Total:{" "}
              <strong className="text-slate-900">
                {formatCurrency(parseFloat(sale.finalTotal || "0"))}
              </strong>
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaleEditButton({
  sale,
  onEdit,
}: {
  sale: any;
  onEdit: (sale: any) => void;
}) {
  return (
    <button
      type="button"
      title={`Edit sale #${sale.id}`}
      onClick={() => onEdit(sale)}
      className="flex items-center gap-1 rounded-xl border border-blue-100 p-2 text-xs font-bold text-blue-600 hover:bg-blue-50"
    >
      <Pencil className="h-3.5 w-3.5" />
      <span>Edit</span>
    </button>
  );
}

function SalesHistoryDrawer({
  onClose,
  onEdit,
}: {
  onClose: () => void;
  onEdit: (sale: any) => void;
}) {
  const [dateFrom, setDateFrom] = useState(nDaysAgo(30));
  const [dateTo, setDateTo] = useState(todayStr());
  const [applied, setApplied] = useState({
    from: nDaysAgo(30),
    to: todayStr(),
  });

  const { data: historySales = [], isFetching } = useQuery({
    queryKey: ["my-sales-history", applied.from, applied.to],
    queryFn: async () => {
      const res = await api.get("/sales/my-sales", {
        params: { dateFrom: applied.from, dateTo: applied.to },
      });
      return res.data.data;
    },
  });

  const periodTotal = useMemo(
    () =>
      historySales.reduce(
        (sum: number, sale: any) => sum + parseFloat(sale.finalTotal || "0"),
        0,
      ),
    [historySales],
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-900 to-indigo-900 px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-bold">Sales History</h2>
            <p className="text-xs text-blue-200">
              Select a date range to explore
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
            aria-label="Close sales history"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="flex flex-col items-end gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                From
              </span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                To
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayStr()}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button
              onClick={() => setApplied({ from: dateFrom, to: dateTo })}
              className="whitespace-nowrap rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isFetching ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : historySales.length === 0 ? (
            <div className="space-y-2 py-16 text-center text-slate-400">
              <Calendar className="mx-auto h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium">No sales in this period.</p>
            </div>
          ) : (
            <div className="space-y-2.5 p-4">
              {historySales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                      Sale #{sale.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(sale.saleDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {sale.customer?.name || "Walk-in Customer"}
                    </span>
                    <span className="font-black text-slate-900">
                      {formatCurrency(parseFloat(sale.finalTotal || "0"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={paymentBadgeVariant(sale.paymentMode)}>
                      {paymentLabel(sale.paymentMode)}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500">
                      {sale.saleType}
                    </span>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-2">
                    {sale.adminVerified ? (
                      <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                        Verified
                      </span>
                    ) : (
                      <SaleEditButton sale={sale} onEdit={onEdit} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {historySales.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {historySales.length} transaction
                  {historySales.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-slate-400">
                  {applied.from} → {applied.to}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Period Total</p>
                <p className="text-xl font-black text-blue-700">
                  {formatCurrency(periodTotal)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MySalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "CC" | "CREDIT">(
    "ALL",
  );
  const [showHistory, setShowHistory] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["my-sales"],
    queryFn: async () => {
      const res = await api.get("/sales/my-sales");
      return res.data.data;
    },
  });

  const deleteSale = async (sale: any) => {
    if (sale.adminVerified) {
      toast.error("Verified sales cannot be deleted");
      return;
    }
    if (
      !window.confirm(`Delete sale #${sale.id}? This action cannot be undone.`)
    )
      return;
    try {
      await api.delete(`/sales/${sale.id}`);
      toast.success(
        "Sale removed; the store owner can review the retained record",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-sales"] }),
        queryClient.invalidateQueries({ queryKey: ["my-sales-history"] }),
        queryClient.invalidateQueries({ queryKey: ["products-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["products-catalog-b"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Sale could not be deleted");
    }
  };

  const refreshAfterEdit = async () => {
    setEditTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["my-sales-history"] }),
      queryClient.invalidateQueries({ queryKey: ["products-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["products-catalog-b"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
    ]);
  };

  const todayDate = todayStr();
  const stats = useMemo(() => {
    let todayTotal = 0;
    let allTimeTotal = 0;
    let ccCount = 0;
    let creditCount = 0;
    sales.forEach((sale: any) => {
      const amount = parseFloat(sale.finalTotal || "0");
      allTimeTotal += amount;
      if (String(sale.saleDate).startsWith(todayDate)) todayTotal += amount;
      if (sale.paymentMode === "CC") ccCount++;
      else if (sale.paymentMode === "CREDIT") creditCount++;
    });
    return {
      totalCount: sales.length,
      todayTotal,
      allTimeTotal,
      ccCount,
      creditCount,
    };
  }, [sales, todayDate]);

  const filteredSales = useMemo(
    () =>
      sales.filter((sale: any) => {
        const customerName = sale.customer?.name?.toLowerCase() || "";
        const saleId = String(sale.id);
        const matchesSearch =
          !search ||
          customerName.includes(search.toLowerCase()) ||
          saleId.includes(search);
        const matchesPayment =
          paymentFilter === "ALL" || sale.paymentMode === paymentFilter;
        return matchesSearch && matchesPayment;
      }),
    [sales, search, paymentFilter],
  );

  const groupedSales = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredSales.forEach((sale: any) => {
      const rawDate = sale.saleDate || sale.createdAt;
      const dateKey = rawDate ? String(rawDate).split("T")[0] : "Unknown Date";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(sale);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => ({
        dateKey,
        sales: groups[dateKey].sort(
          (a, b) =>
            new Date(b.saleDate || b.createdAt || 0).getTime() -
            new Date(a.saleDate || a.createdAt || 0).getTime(),
        ),
      }));
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white shadow-lg sm:p-6">
        <div className="relative z-10">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Sales Desk Log</span>
          </div>
          <h1 className="text-xl font-black sm:text-2xl">Sales History</h1>
          <p className="mt-0.5 text-xs text-blue-100/80 sm:text-sm">
            Review and track customer transactions recorded from your desk
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md active:scale-95"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Today's Sales
            </p>
            <p className="truncate text-xl font-bold text-blue-700">
              {formatCurrency(stats.todayTotal)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
              <span>Resets daily</span>
              <ChevronRight className="h-3 w-3" />
            </p>
          </div>
        </button>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Sales
            </p>
            <p className="text-xl font-bold text-slate-900">
              {stats.totalCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cash & Carry
            </p>
            <p className="text-xl font-bold text-slate-900">{stats.ccCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Credit Sales
            </p>
            <p className="text-xl font-bold text-slate-900">
              {stats.creditCount}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All Transactions" },
              { id: "CC", label: "Cash & Carry" },
              { id: "CREDIT", label: "Credit Sales" },
              { id: "PAYMENT_ONLY", label: "Payment Only" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPaymentFilter(tab.id as any)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${paymentFilter === tab.id ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by customer or sale #..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3.5 text-xs transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="space-y-2 py-16 text-center text-slate-400">
            <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium">
              No sales recorded matching your filter.
            </p>
          </div>
        ) : (
          <>
            {groupedSales.map(({ dateKey, sales: daySales }) => {
              const isExpanded = expandedDates[dateKey] !== false;
              const dayTotal = daySales.reduce(
                (total, sale) => total + (parseFloat(sale.finalTotal) || 0),
                0,
              );
              const dayLabel =
                dateKey === "Unknown Date"
                  ? "Unknown Date"
                  : new Date(`${dateKey}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    );

              return (
                <section
                  key={dateKey}
                  className="mb-3 overflow-hidden border-b border-slate-200 last:mb-0 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDates((previous) => ({
                        ...previous,
                        [dateKey]: !isExpanded,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 bg-slate-100/80 px-4 py-3 text-left transition hover:bg-slate-200/80"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-blue-700" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-blue-700" />
                      )}
                      <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate text-sm font-bold text-slate-900">
                        {dayLabel}
                      </span>
                      <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 sm:inline">
                        {daySales.length} sale{daySales.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="hidden text-xs text-slate-400 sm:inline">Day Total: </span>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {formatCurrency(dayTotal)}
                      </span>
                    </span>
                  </button>

                  {isExpanded && (
                    <>
                      <div className="space-y-3 bg-slate-50/50 p-3 md:hidden">
              {daySales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      Sale #{sale.id}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDateTime(sale.saleDate)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between border-t border-slate-100 pt-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {sale.customer?.name?.charAt(0).toUpperCase() || "C"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {sale.customer?.name || "Walk-in"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {sale.customer?.phone || "Walk-in Customer"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">
                        Final Total
                      </p>
                      <p className="text-base font-black text-slate-900">
                        {formatCurrency(parseFloat(sale.finalTotal || "0"))}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span>Items Purchased</span>
                    </div>
                    {sale.saleItems?.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-slate-800">
                          {item.quantity}x{" "}
                          {item.product?.name || `Product #${item.productId}`}
                        </span>
                        <span className="font-mono text-slate-500">
                          {formatCurrency(parseFloat(item.subtotal || "0"))}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={paymentBadgeVariant(sale.paymentMode)}>
                        {paymentLabel(sale.paymentMode)}
                      </Badge>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {sale.saleType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sale.adminVerified ? (
                        <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                          Verified
                        </span>
                      ) : (
                        <>
                          <SaleEditButton sale={sale} onEdit={setEditTarget} />
                          <button
                            type="button"
                            title="Delete this sale entry"
                            onClick={() => deleteSale(sale)}
                            className="flex items-center gap-1 rounded-xl border border-red-100 p-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      "Sale #",
                      "Date & Time",
                      "Customer",
                      "Items Summary",
                      "Payment",
                      "Type",
                      "Total Amount",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {daySales.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">
                        #{sale.id}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDateTime(sale.saleDate)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {sale.customer?.name || "Walk-in Customer"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {sale.customer?.phone || "—"}
                        </p>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-xs text-slate-600">
                        {sale.saleItems?.map((item: any, index: number) => (
                          <div key={index}>
                            {item.quantity}x{" "}
                            {item.product?.name || `Product #${item.productId}`}
                          </div>
                        ))}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={paymentBadgeVariant(sale.paymentMode)}>
                          {paymentLabel(sale.paymentMode)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {sale.saleType}
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900">
                        {formatCurrency(parseFloat(sale.finalTotal || "0"))}
                      </td>
                      <td className="px-5 py-4">
                        {sale.adminVerified ? (
                          <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                            Verified
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <SaleEditButton
                              sale={sale}
                              onEdit={setEditTarget}
                            />
                            <button
                              type="button"
                              title="Delete this sale entry"
                              onClick={() => deleteSale(sale)}
                              className="rounded-xl border border-red-100 p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>

      {showHistory && (
        <SalesHistoryDrawer
          onClose={() => setShowHistory(false)}
          onEdit={setEditTarget}
        />
      )}
      {editTarget && (
        <EditSaleModal
          sale={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={refreshAfterEdit}
        />
      )}
    </div>
  );
}
