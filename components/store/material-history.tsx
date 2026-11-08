"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { downloadWorkbook } from "@/components/store/download-workbook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import {
  adjustStockAction,
  deleteMaterialAction,
  exportMaterialHistoryAction,
  getMaterialHistory,
  getOperationMaterialHistory,
  receiveStockAction,
  reverseMovementAction,
  setMaterialActiveAction,
  updateMaterialAction,
} from "@/lib/workspace/actions";
import type { LedgerEntry, LedgerKind } from "@/lib/workspace/types";

const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";
const PAGE_SIZE = 8;

function dubaiDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function todayDubai() {
  return dubaiDay(new Date().toISOString());
}

export function MaterialHistory({
  materialId,
  access = "store",
}: {
  materialId: string;
  access?: "store" | "operations";
}) {
  const managing = access === "store";
  const inventoryHref = managing ? "/store-keeper/inventory" : "/operation-manager/inventory";
  const router = useRouter();
  const page = useServerData(
    () => (managing ? getMaterialHistory(materialId) : getOperationMaterialHistory(materialId)),
    `${access}:${materialId}`,
  );
  const history = page.data?.ok ? page.data.page : null;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<LedgerKind | "all">("all");
  const [reference, setReference] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const receiptKey = useRef(crypto.randomUUID());
  const adjustKey = useRef(crypto.randomUUID());
  const reverseKey = useRef(crypto.randomUUID());

  const filtered = useMemo(() => {
    const needle = reference.trim().toLowerCase();
    return (history?.entries ?? []).filter((entry) => {
      const day = dubaiDay(entry.createdAt);
      const receiptDay = entry.receiptDate ?? "";
      const inRange = (value: string) =>
        (!from || value >= from) && (!to || value <= to);
      const dated = inRange(day) || (receiptDay ? inRange(receiptDay) : false);
      if ((from || to) && !dated) return false;
      if (kind !== "all" && entry.kind !== kind) return false;
      if (!needle) return true;
      return (entry.reference ?? "").toLowerCase().includes(needle);
    });
  }, [history?.entries, from, to, kind, reference]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const filtersActive = Boolean(from || to || kind !== "all" || reference.trim());

  async function run(
    action: () => Promise<{ ok: boolean; error?: string; replayed?: boolean; message?: string }>,
    success: string,
  ) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The change was refused.");
        return false;
      }
      setMessage(result.replayed ? "This submission was already recorded. Stock was not changed again." : (result.message ?? success));
      page.reload();
      return true;
    } catch {
      setError("The change could not be saved.");
      return false;
    } finally {
      setPending(false);
    }
  }

  if (page.status === "error") {
    return <p role="alert" className="text-sm text-destructive">{page.error}</p>;
  }
  if (page.data && !page.data.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">{page.data.error}</p>
        <Link href={inventoryHref} className="text-sm underline-offset-4 hover:underline">
          Back to inventory
        </Link>
      </div>
    );
  }
  if (!history) {
    return <p className="text-sm text-muted-foreground">Loading material history…</p>;
  }

  const material = history.material;
  const details = [
    ["Item code", material.itemCode],
    ["Material description", material.productName],
    ["Category", material.categoryName ?? "Unassigned"],
    ["Unit of measurement", material.unit],
    ["Status", material.active ? "Active" : "Inactive"],
    ["Opening inventory balance", `${material.beginningInventory} ${material.unit}`],
    ["Current stock balance", `${material.currentStock} ${material.unit}`],
    ["Total quantity received", `${material.newStock} ${material.unit}`],
    ["Total quantity issued", `${material.out} ${material.unit}`],
    ["Inventory transactions", String(material.transactionCount)],
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={inventoryHref} className="text-sm underline-offset-4 hover:underline">
          Inventory
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {material.itemCode} · {material.productName}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Stock increases when a receipt is confirmed, and decreases when a material issue is confirmed.
          Adjustments and reversals each keep their own ledger line.
        </p>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() =>
            void run(async () => {
              const result = await exportMaterialHistoryAction(
                material.id,
                filtersActive ? filtered.map((entry) => entry.id) : null,
              );
              if (!result.ok) return result;
              downloadWorkbook(result.fileName, result.base64);
              return { ok: true, message: `Material history downloaded. ${result.scopeLabel}` };
            }, "Material history downloaded.")
          }
        >
          Export Material History
        </Button>
        {managing && material.active ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() =>
              void run(
                () => setMaterialActiveAction(material.id, false),
                "Material deactivated. The ledger and related requests stay in place.",
              )
            }
          >
            Deactivate material
          </Button>
        ) : null}
        {managing && !material.active ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => void run(() => setMaterialActiveAction(material.id, true), "Material activated.")}
          >
            Activate material
          </Button>
        ) : null}
        {managing && material.canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                const result = await deleteMaterialAction(material.id);
                if (result.ok) router.push("/store-keeper/inventory");
                return result;
              }, "Material deleted.")
            }
          >
            Delete material
          </Button>
        ) : null}
      </div>
      {managing ? null : (
        <p className="text-sm text-muted-foreground">
          This history is read-only. The store keeper records receipts, adjustments, reversals, and issues.
        </p>
      )}

      {managing ? (
      <div className="grid gap-4 lg:grid-cols-2">
        <ReceiptForm
          pending={pending}
          onSubmit={async (input) => {
            const ok = await run(
              () => receiveStockAction({ ...input, materialId: material.id, idempotencyKey: receiptKey.current }),
              "Receipt confirmed. Stock increased once.",
            );
            if (ok) receiptKey.current = crypto.randomUUID();
            return ok;
          }}
        />
        <AdjustmentForm
          pending={pending}
          currentStock={material.currentStock}
          unit={material.unit}
          onSubmit={async (input) => {
            const ok = await run(
              () => adjustStockAction({ ...input, materialId: material.id, idempotencyKey: adjustKey.current }),
              "Adjustment recorded.",
            );
            if (ok) adjustKey.current = crypto.randomUUID();
            return ok;
          }}
        />
      </div>
      ) : null}

      {managing ? (
      <EditDetails
        material={material}
        categories={history.categories}
        pending={pending}
        onSave={(input) => void run(() => updateMaterialAction(input), "Material details saved.")}
      />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Inventory ledger</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm">
            From
            <Input type="date" value={from} className="h-10" onChange={(event) => { setFrom(event.target.value); setPageIndex(0); }} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            To
            <Input type="date" value={to} className="h-10" onChange={(event) => { setTo(event.target.value); setPageIndex(0); }} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Transaction type
            <select className={fieldClass} value={kind} onChange={(event) => { setKind(event.target.value as LedgerKind | "all"); setPageIndex(0); }}>
              <option value="all">All types</option>
              <option value="opening">Opening Balance</option>
              <option value="receipt">Stock Receipt</option>
              <option value="issue">Stock Issue</option>
              <option value="adjustment">Adjustment</option>
              <option value="reversal">Reversal</option>
              <option value="status">Status change</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Reference number
            <Input
              value={reference}
              placeholder="Receipt, request, or ticket"
              className="h-10"
              onChange={(event) => { setReference(event.target.value); setPageIndex(0); }}
            />
          </label>
        </div>
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No transactions match these filters.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:hidden">
              {visible.map((entry) => (
                <LedgerCard
                  key={entry.id}
                  entry={entry}
                  allowReverse={managing}
                  pending={pending}
                  reverseId={reverseId}
                  reverseReason={reverseReason}
                  onReverseReason={setReverseReason}
                  onStart={() => {
                    setReverseId(entry.id);
                    setReverseReason("");
                    reverseKey.current = crypto.randomUUID();
                  }}
                  onCancel={() => setReverseId(null)}
                  onConfirm={() =>
                    void run(
                      () =>
                        reverseMovementAction({
                          movementId: entry.id,
                          reason: reverseReason,
                          idempotencyKey: reverseKey.current,
                        }),
                      "Reversal recorded.",
                    ).then((ok) => {
                      if (ok) setReverseId(null);
                    })
                  }
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    {["Date and time", "Type", "Quantity", "Previous", "Resulting", "Reference", "Supplier or source", "Team leader", "Supervisor", "Store keeper", "Recorded by", "Reason", ""].map((heading) => (
                      <th key={heading || "action"} className="px-2 py-2 font-medium">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => (
                    <tr key={entry.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        {formatDubai(entry.createdAt)}
                        {entry.receiptDate ? <span className="block text-xs text-muted-foreground">Receipt date {entry.receiptDate}</span> : null}
                      </td>
                      <td className="px-2 py-2">{entry.typeLabel}</td>
                      <td className="px-2 py-2">{entry.quantityChange}</td>
                      <td className="px-2 py-2">{entry.quantityBefore}</td>
                      <td className="px-2 py-2">{entry.quantityAfter}</td>
                      <td className="px-2 py-2">
                        {entry.reference ?? "—"}
                        {entry.requestHref ? <Link href={entry.requestHref} className="block text-xs underline-offset-4 hover:underline">Request</Link> : null}
                        {entry.ticketHref ? <Link href={entry.ticketHref} className="block text-xs underline-offset-4 hover:underline">Ticket</Link> : null}
                      </td>
                      <td className="px-2 py-2">{entry.supplier ?? "—"}</td>
                      <td className="px-2 py-2">{entry.teamLeaderName ?? "—"}</td>
                      <td className="px-2 py-2">{entry.supervisorName ?? "—"}</td>
                      <td className="px-2 py-2">{entry.storeKeeperName ?? "—"}</td>
                      <td className="px-2 py-2">{entry.performedByName}</td>
                      <td className="px-2 py-2">{entry.reason}</td>
                      <td className="px-2 py-2">
                        {managing && entry.canReverse ? (
                          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => { setReverseId(entry.id); setReverseReason(""); reverseKey.current = crypto.randomUUID(); }}>
                            Reverse
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {managing && reverseId ? (
              <form
                className="hidden max-w-xl flex-col gap-2 rounded-lg border p-3 md:flex"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () => reverseMovementAction({ movementId: reverseId, reason: reverseReason, idempotencyKey: reverseKey.current }),
                    "Reversal recorded.",
                  ).then((ok) => {
                    if (ok) setReverseId(null);
                  });
                }}
              >
                <Label htmlFor="reverse-reason">Reason for reversal</Label>
                <Input id="reverse-reason" value={reverseReason} className="h-10" onChange={(event) => setReverseReason(event.target.value)} />
                <div className="flex gap-2">
                  <Button type="submit" size="lg" disabled={pending || reverseReason.trim().length === 0}>Confirm reversal</Button>
                  <Button type="button" variant="outline" size="lg" onClick={() => setReverseId(null)}>Cancel</Button>
                </div>
              </form>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPageIndex(safePage - 1)}>
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPageIndex(safePage + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReceiptForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: {
    quantity: string;
    receiptDate: string;
    reference: string;
    supplier: string;
    notes: string;
  }) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayDubai);
  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ quantity, receiptDate, reference, supplier, notes }).then((ok) => {
          if (!ok) return;
          setQuantity("");
          setReference("");
          setSupplier("");
          setNotes("");
        });
      }}
    >
      <h2 className="text-base font-medium">Record stock receipt</h2>
      <p className="text-sm text-muted-foreground">Stock increases only after you confirm this receipt.</p>
      <Field id="receipt-qty" label="Quantity received" value={quantity} onChange={setQuantity} />
      <label className="flex flex-col gap-2 text-sm">
        Receipt date
        <Input type="date" value={receiptDate} className="h-10" onChange={(event) => setReceiptDate(event.target.value)} />
      </label>
      <Field id="receipt-ref" label="Reference number" value={reference} onChange={setReference} />
      <Field id="receipt-supplier" label="Supplier" value={supplier} onChange={setSupplier} />
      <Field id="receipt-notes" label="Notes" value={notes} onChange={setNotes} />
      <Button type="submit" size="lg" disabled={pending || !quantity.trim() || !reference.trim() || !receiptDate}>
        Confirm receipt
      </Button>
    </form>
  );
}

function AdjustmentForm({
  pending,
  currentStock,
  unit,
  onSubmit,
}: {
  pending: boolean;
  currentStock: string;
  unit: string;
  onSubmit: (input: { mode: "increase" | "decrease" | "count"; quantity: string; reason: string; reference: string }) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"increase" | "decrease" | "count">("decrease");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ mode, quantity, reason, reference }).then((ok) => {
          if (!ok) return;
          setQuantity("");
          setReason("");
          setReference("");
        });
      }}
    >
      <h2 className="text-base font-medium">Stock adjustment</h2>
      <p className="text-sm text-muted-foreground">
        Current balance {currentStock} {unit}. A reason is required. This does not change received or issued totals.
      </p>
      <label className="flex flex-col gap-2 text-sm">
        Adjustment
        <select className={fieldClass} value={mode} onChange={(event) => setMode(event.target.value as "increase" | "decrease" | "count")}>
          <option value="increase">Increase by a quantity</option>
          <option value="decrease">Decrease by a quantity</option>
          <option value="count">Set counted quantity</option>
        </select>
      </label>
      <Field id="adjust-qty" label={mode === "count" ? "Counted quantity" : "Adjustment quantity"} value={quantity} onChange={setQuantity} />
      <Field id="adjust-ref" label="Reference number" value={reference} onChange={setReference} />
      <Field id="adjust-reason" label="Reason" value={reason} onChange={setReason} />
      <Button type="submit" size="lg" disabled={pending || !quantity.trim() || reason.trim().length === 0}>
        Record adjustment
      </Button>
    </form>
  );
}

function EditDetails({
  material,
  categories,
  pending,
  onSave,
}: {
  material: {
    id: string;
    productName: string;
    activeIngredient: string;
    unit: string;
    categoryId: string | null;
  };
  categories: { id: string; name: string; active: boolean }[];
  pending: boolean;
  onSave: (input: { materialId: string; productName: string; activeIngredient: string; unit: string; categoryId: string | null }) => void;
}) {
  const [productName, setProductName] = useState(material.productName);
  const [ingredient, setIngredient] = useState(material.activeIngredient);
  const [unit, setUnit] = useState(material.unit);
  const [categoryId, setCategoryId] = useState(material.categoryId ?? "");
  const [seen, setSeen] = useState("");
  const marker = `${material.id}|${material.productName}|${material.unit}|${material.activeIngredient}|${material.categoryId ?? ""}`;
  if (seen !== marker) {
    setSeen(marker);
    setProductName(material.productName);
    setIngredient(material.activeIngredient);
    setUnit(material.unit);
    setCategoryId(material.categoryId ?? "");
  }
  return (
    <form
      className="grid gap-3 rounded-lg border p-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          materialId: material.id,
          productName,
          activeIngredient: ingredient,
          unit,
          categoryId: categoryId || null,
        });
      }}
    >
      <h2 className="text-base font-medium md:col-span-4">Edit material details</h2>
      <Field id="edit-name" label="Description" value={productName} onChange={setProductName} />
      <Field id="edit-ingredient" label="Active ingredient" value={ingredient} onChange={setIngredient} />
      <Field id="edit-unit" label="Unit" value={unit} onChange={setUnit} />
      <label className="flex flex-col gap-2 text-sm">
        Category
        <select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Unassigned</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}{category.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Button type="submit" variant="outline" size="lg" disabled={pending}>Save details</Button>
      </div>
    </form>
  );
}

function LedgerCard({
  entry,
  allowReverse,
  pending,
  reverseId,
  reverseReason,
  onReverseReason,
  onStart,
  onCancel,
  onConfirm,
}: {
  entry: LedgerEntry;
  allowReverse: boolean;
  pending: boolean;
  reverseId: string | null;
  reverseReason: string;
  onReverseReason: (value: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <article className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <p className="font-medium">{entry.typeLabel} · {entry.quantityChange}</p>
      <p className="text-muted-foreground">{formatDubai(entry.createdAt)}</p>
      <p>Previous {entry.quantityBefore} → {entry.quantityAfter}</p>
      <p>Reference {entry.reference ?? "—"}{entry.supplier ? ` · ${entry.supplier}` : ""}</p>
      <p>{entry.reason}</p>
      {entry.teamLeaderName ? <p>Team leader {entry.teamLeaderName}</p> : null}
      {entry.supervisorName ? <p>Supervisor {entry.supervisorName}</p> : null}
      <p>Recorded by {entry.performedByName}</p>
      {entry.requestHref ? <Link href={entry.requestHref} className="underline-offset-4 hover:underline">Open request</Link> : null}
      {entry.ticketHref ? <Link href={entry.ticketHref} className="underline-offset-4 hover:underline">Open ticket</Link> : null}
      {allowReverse && entry.canReverse && reverseId !== entry.id ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onStart}>Reverse</Button>
      ) : null}
      {allowReverse && reverseId === entry.id ? (
        <div className="mt-2 flex flex-col gap-2">
          <Input aria-label="Reason for reversal" value={reverseReason} className="h-10" onChange={(event) => onReverseReason(event.target.value)} />
          <Button type="button" size="lg" disabled={pending || reverseReason.trim().length === 0} onClick={onConfirm}>Confirm reversal</Button>
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>Cancel</Button>
        </div>
      ) : null}
    </article>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm" htmlFor={id}>
      {label}
      <Input id={id} value={value} className="h-10" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
