"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CategoryPanel } from "@/components/store/category-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { downloadWorkbook } from "@/components/store/download-workbook";
import {
  createCategoryAction,
  createMaterialAction,
  exportInventoryAction,
  getInventoryPage,
  getOperationMaterialList,
  setMaterialActiveAction,
  setMaterialCategoryAction,
  setRequestableAction,
  updateCategoryAction,
} from "@/lib/workspace/actions";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function InventoryManager({ access = "store" }: { access?: "store" | "operations" }) {
  const managing = access === "store";
  const materialHref = (id: string) =>
    managing ? `/store-keeper/inventory/${id}` : `/operation-manager/inventory/${id}`;
  const page = useServerData(
    managing ? getInventoryPage : getOperationMaterialList,
    access,
  );
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [activity, setActivity] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("code");
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const materials = page.data?.materials;
  const visible = useMemo(
    () =>
      (materials ?? []).filter((material) => {
        const needle = search.trim().toLowerCase();
        const matchesSearch =
          needle.length === 0 ||
          material.itemCode.toLowerCase().includes(needle) ||
          material.productName.toLowerCase().includes(needle);
        const matchesAvailability =
          availability === "all" ||
          (availability === "requestable" ? material.requestable : !material.requestable);
        const matchesActivity =
          activity === "all" || (activity === "active" ? material.active : !material.active);
        const matchesCategory =
          categoryFilter === "all" ||
          (categoryFilter === "unassigned"
            ? !material.categoryId
            : material.categoryId === categoryFilter);
        return matchesSearch && matchesAvailability && matchesActivity && matchesCategory;
      }).sort((left, right) => {
        if (sort === "name") return left.productName.localeCompare(right.productName);
        if (sort === "category") return (left.categoryName ?? "").localeCompare(right.categoryName ?? "");
        if (sort === "status") return Number(right.active) - Number(left.active) || left.itemCode.localeCompare(right.itemCode);
        if (sort === "stock") return Number(left.currentStock) - Number(right.currentStock) || left.itemCode.localeCompare(right.itemCode);
        return left.itemCode.localeCompare(right.itemCode);
      }),
    [materials, search, availability, activity, categoryFilter, sort],
  );
  const filtersActive =
    search.trim().length > 0 || availability !== "all" || activity !== "all" || categoryFilter !== "all";

  async function run(
    action: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    success: string,
  ) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The change was refused.");
        return;
      }
      setMessage(result.message ?? success);
      page.reload();
    } catch {
      setError("The change could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {managing
            ? "Add and edit materials here. Open a material to see its full stock history, record a receipt, or adjust the balance. Opening stock, quantity received, quantity issued, and current stock stay as separate figures. Deactivate a material that already has history."
            : "Review materials, current stock, and transaction history. Available stock is the current balance. Approval does not reserve or commit stock. The store keeper records receipts, adjustments, and issues."}
        </p>
        {page.data ? (
          <p className="text-sm text-muted-foreground">Signed in as {page.data.actor.displayName}.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {managing ? (
          <Button type="button" size="lg" onClick={() => setShowAdd((current) => !current)}>
            Add material
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending || !page.data || visible.length === 0}
          onClick={() =>
            void run(async () => {
              const result = await exportInventoryAction(filtersActive ? visible.map((material) => material.id) : null);
              if (!result.ok) return result;
              downloadWorkbook(result.fileName, result.base64);
              return { ok: true, message: `Inventory report downloaded. ${result.scopeLabel}` };
            }, "Inventory report downloaded.")
          }
        >
          Export to Excel
        </Button>
      </div>

      {managing && page.data ? (
        <CategoryPanel
          categories={page.data.categories}
          pending={pending}
          onCreate={(name) => void run(() => createCategoryAction(name), "Category created.")}
          onSave={(input) =>
            void run(
              () => updateCategoryAction(input),
              input.active ? "Category saved." : "Category deactivated. Materials stay in the inventory.",
            )
          }
        />
      ) : null}

      {managing && showAdd ? (
        <AddMaterial
          key={message ?? "new-material"}
          categories={page.data?.categories ?? []}
          pending={pending}
          onCreate={(input) =>
            void run(
              () => createMaterialAction(input),
              "Material added to the demonstration file.",
            )
          }
        />
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="material-search">Item code or description</Label>
          <Input
            id="material-search"
            value={search}
            placeholder="Item code or description"
            className="h-10"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="availability-filter">Availability</Label>
          <select
            id="availability-filter"
            className={fieldClass}
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="all">All</option>
            <option value="requestable">Requestable</option>
            <option value="hidden">Not requestable</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-filter">Category</Label>
          <select
            id="category-filter"
            className={fieldClass}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            <option value="unassigned">Unassigned</option>
            {(page.data?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="material-sort">Sort</Label>
          <select
            id="material-sort"
            className={fieldClass}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="code">Item code</option>
            <option value="name">Description</option>
            <option value="category">Category</option>
            <option value="stock">Current stock</option>
            <option value="status">Active status</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-filter">Active</Label>
          <select
            id="activity-filter"
            className={fieldClass}
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {page.status === "loading" && !page.data ? (
        <p className="text-sm text-muted-foreground">Loading inventory…</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}
      {page.data && visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No materials match.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Item code</th>
                <th className="px-2 py-2 font-medium">Product</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Current stock</th>
                {managing ? null : (
                  <>
                    <th className="px-2 py-2 font-medium">Available</th>
                    <th className="px-2 py-2 font-medium">Committed</th>
                  </>
                )}
                <th className="px-2 py-2 font-medium">Requestable</th>
                <th className="px-2 py-2 font-medium">Active</th>
                <th className="px-2 py-2 font-medium">Updated</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map((material) => (
                <tr key={material.id} className="border-b">
                  <td className="px-2 py-2 font-medium">
                    <Link href={materialHref(material.id)} className="underline-offset-4 hover:underline">
                      {material.itemCode}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Link href={materialHref(material.id)} className="font-medium underline-offset-4 hover:underline">
                      {material.productName}
                    </Link>
                    {material.activeIngredient ? (
                      <span className="block text-xs text-muted-foreground">
                        {material.activeIngredient}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{material.unit}</td>
                  <td className="px-2 py-2">
                    {managing ? (
                      <select
                        aria-label={`Category for ${material.itemCode}`}
                        className="h-8 max-w-40 rounded-lg border border-input bg-background px-2 text-sm"
                        value={material.categoryId ?? ""}
                        disabled={pending}
                        onChange={(event) =>
                          void run(
                            () =>
                              setMaterialCategoryAction(material.id, event.target.value || null),
                            "Category assigned.",
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        {(page.data?.categories ?? []).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                            {category.active ? "" : " (inactive)"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      material.categoryName ?? "Unassigned"
                    )}
                  </td>
                  <td className="px-2 py-2 font-medium">
                    {material.currentStock} {material.unit}
                  </td>
                  {managing ? null : (
                    <>
                      <td className="px-2 py-2">{material.currentStock} {material.unit}</td>
                      <td className="px-2 py-2">None</td>
                    </>
                  )}
                  <td className="px-2 py-2">
                    {managing ? (
                      <select
                        aria-label={`Requestable for ${material.itemCode}`}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        value={material.requestable ? "yes" : "no"}
                        disabled={pending}
                        onChange={(event) =>
                          void run(
                            () =>
                              setRequestableAction(material.id, event.target.value === "yes"),
                            "Requestable status updated.",
                          )
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : material.requestable ? "Yes" : "No"}
                  </td>
                  <td className="px-2 py-2">
                    {managing ? (
                      <select
                        aria-label={`Active status for ${material.itemCode}`}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        value={material.active ? "yes" : "no"}
                        disabled={pending}
                        onChange={(event) =>
                          void run(
                            () => setMaterialActiveAction(material.id, event.target.value === "yes"),
                            event.target.value === "yes"
                              ? "Material activated."
                              : "Material deactivated. It stays in the history.",
                          )
                        }
                      >
                        <option value="yes">Active</option>
                        <option value="no">Inactive</option>
                      </select>
                    ) : material.active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {formatDubai(material.updatedAt)}
                    <span className="block text-muted-foreground">{material.updatedByName}</span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={materialHref(material.id)}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        History
                      </Link>
                      {managing && material.active ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void run(
                              () => setMaterialActiveAction(material.id, false),
                              `${material.itemCode} deactivated. Its history stays in the ledger.`,
                            )
                          }
                        >
                          Deactivate material
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

    </div>
  );
}

function AddMaterial({
  categories,
  pending,
  onCreate,
}: {
  categories: { id: string; name: string; active: boolean }[];
  pending: boolean;
  onCreate: (input: {
    itemCode: string;
    productName: string;
    activeIngredient: string;
    unit: string;
    currentStock: string;
    requestable: boolean;
    categoryId: string | null;
  }) => void;
}) {
  const [itemCode, setItemCode] = useState("");
  const [productName, setProductName] = useState("");
  const [activeIngredient, setActiveIngredient] = useState("");
  const [unit, setUnit] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [requestable, setRequestable] = useState(true);
  const [categoryId, setCategoryId] = useState("");

  return (
    <form
      className="grid gap-3 rounded-lg border p-3 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({
          itemCode,
          productName,
          activeIngredient,
          unit,
          currentStock,
          requestable,
          categoryId: categoryId || null,
        });
      }}
    >
      <Field id="add-code" label="Item code" value={itemCode} onChange={setItemCode} />
      <Field id="add-name" label="Product name" value={productName} onChange={setProductName} />
      <Field id="add-ingredient" label="Active ingredient" value={activeIngredient} onChange={setActiveIngredient} />
      <Field id="add-unit" label="Unit" value={unit} onChange={setUnit} />
      <label className="flex flex-col gap-2 text-sm">
        Category
        <select
          aria-label="Category for the new material"
          className={fieldClass}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Unassigned</option>
          {categories.filter((category) => category.active).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <Field id="add-stock" label="Opening stock" value={currentStock} onChange={setCurrentStock} />
      <label className="flex items-end gap-2 text-sm">
        <input
          type="checkbox"
          checked={requestable}
          onChange={(event) => setRequestable(event.target.checked)}
        />
        Requestable
      </label>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          Save material
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} className="h-10" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
