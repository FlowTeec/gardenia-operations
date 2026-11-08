"use client";

import { useMemo, useState } from "react";

import { PpeLines } from "@/components/ppe-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerData } from "@/components/use-server-data";
import { formatDubai, STATUS_LABEL } from "@/lib/format";
import { createTeamRequestAction, getTeamLeaderHome } from "@/lib/workspace/actions";
import type { PublicMaterial } from "@/lib/workspace/types";

const EMPTY_MATERIALS: PublicMaterial[] = [];

type EmployeeSection = {
  key: string;
  employeeId: string;
  quantities: Record<string, string>;
};

export function LeaderHome() {
  const page = useServerData(getTeamLeaderHome);
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<EmployeeSection[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const materials = page.data?.materials ?? EMPTY_MATERIALS;
  const categories = page.data?.categories ?? [];
  const ppeCategory = categories.find((category) => category.requiresEmployee) ?? null;
  const unassigned = materials.some((material) => !material.categoryId && !material.requiresEmployee);
  const activeCategory = categoryId === "ppe" ? ppeCategory?.id ?? "ppe" : categoryId;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return materials.filter((material) => {
      const inCategory =
        activeCategory === "all"
          ? !material.requiresEmployee
          : activeCategory === "unassigned"
            ? !material.categoryId
            : material.categoryId === activeCategory;
      if (!inCategory) return false;
      if (!needle) return true;
      return (
        material.itemCode.toLowerCase().includes(needle) ||
        material.productName.toLowerCase().includes(needle)
      );
    });
  }, [materials, search, activeCategory]);

  const selectedMaterials = materials.filter((material) => !material.requiresEmployee && quantities[material.id] !== undefined);
  const selectedCount =
    selectedMaterials.length +
    employees.reduce((sum, employee) => sum + Object.keys(employee.quantities).length, 0);

  function chooseCategory(next: string) {
    setCategoryId(next);
    setSearch("");
    if (next === "ppe" && employees.length === 0) {
      setEmployees([{ key: crypto.randomUUID(), employeeId: "", quantities: {} }]);
    }
  }

  function toggleMaterial(material: PublicMaterial) {
    setQuantities((current) => {
      const next = { ...current };
      if (next[material.id] !== undefined) delete next[material.id];
      else next[material.id] = "";
      return next;
    });
  }

  async function submit() {
    setError(null);
    setMessage(null);
    const lines = selectedMaterials.map((material) => ({
      materialId: material.id,
      quantity: (quantities[material.id] ?? "").trim(),
    }));
    const employeePayload = employees
      .filter((employee) => employee.employeeId.trim() || Object.keys(employee.quantities).length > 0)
      .map((employee) => ({
        employeeId: employee.employeeId,
        lines: Object.entries(employee.quantities).map(([materialId, quantity]) => ({
          materialId,
          quantity: quantity.trim(),
        })),
      }));
    if (lines.length === 0 && employeePayload.length === 0) {
      setError("Choose at least one material.");
      return;
    }
    if (lines.some((line) => line.quantity.length === 0)) {
      setError("Enter a quantity for each selected material.");
      return;
    }
    if (employeePayload.some((employee) => employee.employeeId.trim().length === 0)) {
      setError("Enter an employee ID for each person receiving PPE.");
      return;
    }
    const employeeIds = employeePayload.map((employee) => employee.employeeId.trim());
    if (new Set(employeeIds).size !== employeeIds.length) {
      setError("Enter each employee ID once. Add their PPE items in the same section.");
      return;
    }
    if (employeePayload.some((employee) => employee.lines.length === 0 || employee.lines.some((line) => line.quantity.length === 0))) {
      setError("Enter a quantity for each selected PPE item.");
      return;
    }
    setPending(true);
    try {
      const result = await createTeamRequestAction({ lines, employees: employeePayload });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`MR-${result.requestNo} submitted and is pending approval.`);
      setQuantities({});
      setEmployees([]);
      page.reload();
    } catch {
      setError("The request could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose a category, tick the materials, and enter quantities. Stock quantities are not shown.
          For PPE, type each employee ID yourself.
        </p>
      </div>
      {page.data ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Signed in as {page.data.actor.displayName}.</p>
          {page.data.actor.teamName ? (
            <p className="text-sm text-muted-foreground">Team name: {page.data.actor.teamName}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {page.data.actor.zoneName && page.data.supervisorName
              ? `${page.data.actor.zoneName} · ${page.data.supervisorName}`
              : "No supervisor or zone is assigned. You cannot submit a request until an administrator assigns you."}
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">New request</h2>
        {page.data?.requestClosedMessage ? (
          <p role="status" className="tone-watch rounded-lg border border-transparent px-4 py-4 text-sm font-medium leading-6">
            {page.data.requestClosedMessage}
          </p>
        ) : (
          <>
        {page.status === "loading" && !page.data ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : null}
        {page.data && materials.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No requestable products are available.
          </p>
        ) : null}

        {materials.length > 0 ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Material categories">
              <CategoryTab selected={categoryId === "all"} onClick={() => chooseCategory("all")}>
                All
              </CategoryTab>
              {categories.map((category) => (
                <CategoryTab
                  key={category.id}
                  selected={category.requiresEmployee ? categoryId === "ppe" : categoryId === category.id}
                  onClick={() => chooseCategory(category.requiresEmployee ? "ppe" : category.id)}
                >
                  {category.name}
                </CategoryTab>
              ))}
              {unassigned ? (
                <CategoryTab selected={categoryId === "unassigned"} onClick={() => chooseCategory("unassigned")}>
                  Unassigned
                </CategoryTab>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-search">Search</Label>
              <Input
                id="material-search"
                value={search}
                placeholder="Item code or description"
                className="h-11 text-base"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {categoryId === "ppe" && ppeCategory ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  Type the employee ID for each person. The same person can receive several PPE items in one section.
                </p>
                {employees.map((employee, index) => (
                  <EmployeeBlock
                    key={employee.key}
                    index={index}
                    employee={employee}
                    materials={visible.filter((material) => material.requiresEmployee)}
                    onChange={(next) =>
                      setEmployees((current) => current.map((item) => (item.key === employee.key ? next : item)))
                    }
                    onRemove={() => setEmployees((current) => current.filter((item) => item.key !== employee.key))}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    setEmployees((current) => [
                      ...current,
                      { key: crypto.randomUUID(), employeeId: "", quantities: {} },
                    ])
                  }
                >
                  Add Employee
                </Button>
                {visible.filter((material) => material.requiresEmployee).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No PPE matches this search.</p>
                ) : null}
              </div>
            ) : (
              <MaterialChecklist
                materials={visible}
                quantities={quantities}
                onToggle={toggleMaterial}
                onQuantity={(id, quantity) => setQuantities((current) => ({ ...current, [id]: quantity }))}
              />
            )}
          </>
        ) : null}

        <SelectedSummary
          materials={materials}
          quantities={quantities}
          employees={employees}
          onQuantity={(id, quantity) => setQuantities((current) => ({ ...current, [id]: quantity }))}
          onRemove={(id) =>
            setQuantities((current) => {
              const next = { ...current };
              delete next[id];
              return next;
            })
          }
          onEmployeeQuantity={(key, materialId, quantity) =>
            setEmployees((current) =>
              current.map((employee) =>
                employee.key === key
                  ? { ...employee, quantities: { ...employee.quantities, [materialId]: quantity } }
                  : employee,
              ),
            )
          }
          onRemoveEmployeeItem={(key, materialId) =>
            setEmployees((current) =>
              current.map((employee) => {
                if (employee.key !== key) return employee;
                const quantities = { ...employee.quantities };
                delete quantities[materialId];
                return { ...employee, quantities };
              }),
            )
          }
          onRemoveEmployee={(key) => setEmployees((current) => current.filter((employee) => employee.key !== key))}
        />

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3 md:static md:mx-0 md:rounded-lg md:border md:px-3">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            disabled={pending || !page.data?.canSubmit || selectedCount === 0}
            onClick={() => void submit()}
          >
            Submit request
          </Button>
        </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">My requests</h2>
        {page.data && page.data.requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no requests yet.</p>
        ) : null}
        <div className="flex flex-col gap-2">
          {page.data?.requests.map((request) => (
            <article key={request.id} className="rounded-lg border px-3 py-3 text-sm">
              <p className="font-medium">
                {request.requestNo} · {STATUS_LABEL[request.status]}
              </p>
              <p className="text-muted-foreground">{formatDubai(request.requestedAt)}</p>
              {request.rejectionReason ? (
                <p className="text-muted-foreground">Reason: {request.rejectionReason}</p>
              ) : null}
              <ul className="mt-2">
                {request.items.map((item) => (
                  <li key={`${request.id}-${item.name}`}>
                    {item.name} · requested {item.quantity} {item.unit}
                    {item.decision === "APPROVED" ? ` · supervisor approved ${item.approvedQuantity} ${item.unit}` : ""}
                    {item.decision === "REJECTED" ? " · supervisor rejected" : ""}
                    {item.operationDecision === "APPROVED"
                      ? ` · operation manager approved ${item.operationApproved} ${item.unit}`
                      : ""}
                    {item.operationDecision === "REJECTED" ? " · operation manager rejected" : ""}
                    {item.rejectionReason ? ` · ${item.rejectionReason}` : ""}
                  </li>
                ))}
              </ul>
              <PpeLines groups={request.ppe} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoryTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
        selected ? "bg-primary text-primary-foreground" : "border bg-background"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MaterialChecklist({
  materials,
  quantities,
  onToggle,
  onQuantity,
}: {
  materials: PublicMaterial[];
  quantities: Record<string, string>;
  onToggle: (material: PublicMaterial) => void;
  onQuantity: (id: string, quantity: string) => void;
}) {
  if (materials.length === 0) {
    return <p className="text-sm text-muted-foreground">No materials match this category and search.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {materials.map((material) => {
        const checked = quantities[material.id] !== undefined;
        return (
          <li key={material.id} className="rounded-lg border p-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={checked}
                aria-label={material.productName}
                onChange={() => onToggle(material)}
              />
              <span>
                <span className="font-medium">{material.productName}</span>
                <span className="block text-muted-foreground">
                  {material.itemCode} · {material.unit}
                </span>
              </span>
            </label>
            {checked ? (
              <div className="mt-3 flex items-center gap-2 pl-8">
                <Input
                  aria-label={`Quantity for ${material.productName}`}
                  value={quantities[material.id] ?? ""}
                  inputMode="decimal"
                  placeholder="Quantity"
                  className="h-11 text-base"
                  onChange={(event) => onQuantity(material.id, event.target.value)}
                />
                <span className="shrink-0 text-sm text-muted-foreground">{material.unit}</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function EmployeeBlock({
  index,
  employee,
  materials,
  onChange,
  onRemove,
}: {
  index: number;
  employee: EmployeeSection;
  materials: PublicMaterial[];
  onChange: (employee: EmployeeSection) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Employee {index + 1}</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`employee-${employee.key}`}>Employee ID</Label>
        <Input
          id={`employee-${employee.key}`}
          value={employee.employeeId}
          autoComplete="off"
          placeholder="Type the employee ID"
          className="h-11 text-base"
          onChange={(event) => onChange({ ...employee, employeeId: event.target.value })}
        />
      </div>
      <MaterialChecklist
        materials={materials}
        quantities={employee.quantities}
        onToggle={(material) => {
          const quantities = { ...employee.quantities };
          if (quantities[material.id] !== undefined) delete quantities[material.id];
          else quantities[material.id] = "";
          onChange({ ...employee, quantities });
        }}
        onQuantity={(id, quantity) => onChange({ ...employee, quantities: { ...employee.quantities, [id]: quantity } })}
      />
      <Button type="button" variant="outline" size="lg" onClick={onRemove}>
        Remove employee
      </Button>
    </fieldset>
  );
}

function SelectedSummary({
  materials,
  quantities,
  employees,
  onQuantity,
  onRemove,
  onEmployeeQuantity,
  onRemoveEmployeeItem,
  onRemoveEmployee,
}: {
  materials: PublicMaterial[];
  quantities: Record<string, string>;
  employees: EmployeeSection[];
  onQuantity: (id: string, quantity: string) => void;
  onRemove: (id: string) => void;
  onEmployeeQuantity: (key: string, materialId: string, quantity: string) => void;
  onRemoveEmployeeItem: (key: string, materialId: string) => void;
  onRemoveEmployee: (key: string) => void;
}) {
  const plain = materials.filter((material) => quantities[material.id] !== undefined);
  const people = employees.filter(
    (employee) => employee.employeeId.trim() || Object.keys(employee.quantities).length > 0,
  );
  if (plain.length === 0 && people.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing is selected yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <h3 className="text-sm font-medium">Selected items</h3>
      {plain.map((material) => (
        <div key={material.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm">
            {material.productName}
            <span className="text-muted-foreground"> · {material.unit}</span>
          </p>
          <Input
            aria-label={`Selected quantity for ${material.productName}`}
            value={quantities[material.id] ?? ""}
            inputMode="decimal"
            className="h-11 sm:w-28"
            onChange={(event) => onQuantity(material.id, event.target.value)}
          />
          <Button type="button" variant="outline" size="lg" onClick={() => onRemove(material.id)}>
            Remove
          </Button>
        </div>
      ))}
      {people.map((employee) => (
        <div key={employee.key} className="flex flex-col gap-2 border-t pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Employee ID {employee.employeeId.trim() || "not entered"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => onRemoveEmployee(employee.key)}>
              Remove employee
            </Button>
          </div>
          {Object.entries(employee.quantities).map(([materialId, quantity]) => {
            const material = materials.find((item) => item.id === materialId);
            if (!material) return null;
            return (
              <div key={materialId} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-sm">
                  {material.productName}
                  <span className="text-muted-foreground"> · {material.unit}</span>
                </p>
                <Input
                  aria-label={`Quantity for ${material.productName} and ${employee.employeeId || "employee"}`}
                  value={quantity}
                  inputMode="decimal"
                  className="h-11 sm:w-28"
                  onChange={(event) => onEmployeeQuantity(employee.key, materialId, event.target.value)}
                />
                <Button type="button" variant="outline" size="lg" onClick={() => onRemoveEmployeeItem(employee.key, materialId)}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
