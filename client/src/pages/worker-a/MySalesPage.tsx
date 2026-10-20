import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from 
"@tanstack/react-query";
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
                    <SaleEditButton sale={sale} onEdit={onEdit} />
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

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["my-sales"],
    queryFn: async () => {
      const res = await api.get("/sales/my-sales");
      return res.data.data;
    },
  });

  const deleteSale = async (sale: any) => {
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
              {formatCurrency(stats.toda