import { addQty, cmpQty, isPositiveQty, isZeroQty, parseQty, subQty } from "./decimal";
import { ticketLabel } from "@/lib/format";
import { dubaiDayNumber } from "./usage";
import type {
  MaterialRequest,
  PpeCycleStatus,
  PpeEmployeeCheck,
  PpeHistoryRow,
  PpeIssueLine,
  Role,
  Workspace,
} from "./types";

/**
 * PPE eligibility is one employee and one PPE material.
 *
 * The only source is a store-keeper issue confirmation that records a
 * quantity for that employee. Requested, approved, and prepared quantities
 * are not issues. A receipt line with no employee split is not assigned to
 * anyone: when such a line exists for the material, the status is
 * "No PPE History" rather than a claim that the employee never received it.
 *
 * Days use the Asia/Dubai calendar. Eligible means the last issue was at
 * least `ppeReplacementDays` ago. The default interval is 90 days.
 * The status does not approve, reduce, reject, or block an issue.
 */

export const DEFAULT_PPE_REPLACEMENT_DAYS = 90;

const PPE_READERS = new Set<Role>(["OPERATION_MANAGER", "STORE_KEEPER", "ADMIN"]);

export function canReadPpeHistory(actor: { role: Role; active: boolean }) {
  return actor.active && PPE_READERS.has(actor.role);
}

export function normalizeEmployeeId(value: string) {
  return value.trim();
}

export function ppeReplacementDays(state: Workspace) {
  const value = state.ppeReplacementDays;
  if (!Number.isInteger(value) || value < 1 || value > 3650) return DEFAULT_PPE_REPLACEMENT_DAYS;
  return value;
}

type ConfirmedPpeIssue = {
  employeeId: string;
  materialId: string;
  issuedAt: string;
  quantity: string;
  reference: string;
  itemCode: string;
  productName: string;
  unit: string;
  issuedBy: string;
};

function materialIsPpe(state: Workspace, materialId: string) {
  const material = state.materials.find((item) => item.id === materialId);
  if (!material?.categoryId) return false;
  return state.categories.some(
    (category) => category.id === material.categoryId && category.requiresEmployee,
  );
}

function collect(state: Workspace) {
  const issues: ConfirmedPpeIssue[] = [];
  const unattributed = new Set<string>();
  for (const request of state.requests) {
    const reference = ticketLabel(request.requestNo);
    const items = new Map(request.items.map((item) => [item.id, item]));
    for (const receipt of request.issueReceipts ?? []) {
      for (const line of receipt.lines) {
        if (!isPositiveQty(line.quantity)) continue;
        const item = items.get(line.itemId);
        if (!item) continue;
        const allocated = (request.ppeAllocations ?? []).some(
          (allocation) => allocation.materialId === item.materialId,
        );
        const ppe = allocated || materialIsPpe(state, item.materialId);
        const employees = (line.employees ?? []).filter((employee) => isPositiveQty(employee.quantity));
        if (employees.length === 0) {
          if (ppe) unattributed.add(item.materialId);
          continue;
        }
        for (const employee of employees) {
          const employeeId = normalizeEmployeeId(employee.employeeId);
          if (!employeeId) continue;
          issues.push({
            employeeId,
            materialId: item.materialId,
            issuedAt: receipt.issuedAt,
            quantity: employee.quantity,
            reference,
            itemCode: item.itemCode,
            productName: item.productName,
            unit: item.unit,
            issuedBy: receipt.issuedBy,
          });
        }
      }
    }
  }
  issues.sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  return { issues, unattributed };
}

export function ppeIndex(state: Workspace, asOf: string) {
  const intervalDays = ppeReplacementDays(state);
  const today = dubaiDayNumber(asOf);
  const { issues, unattributed } = collect(state);

  function matching(employeeId: string, materialId: string) {
    const key = normalizeEmployeeId(employeeId);
    return issues.filter((issue) => {
      if (issue.employeeId !== key || issue.materialId !== materialId) return false;
      const day = dubaiDayNumber(issue.issuedAt);
      return day !== null && (today === null || day <= today);
    });
  }

  return {
    intervalDays,
    check(
      employeeId: string,
      materialId: string,
      quantity: string,
      unit: string,
      issuedOnRequest: string,
    ): PpeEmployeeCheck {
      const rows = matching(employeeId, materialId);
      const latest = rows[0];
      const base = {
        employeeId: normalizeEmployeeId(employeeId),
        materialId,
        quantity,
        unit,
        issuedOnRequest,
        intervalDays,
      };
      if (!latest) {
        const status: PpeCycleStatus = unattributed.has(materialId) ? "No PPE History" : "No Previous Issue";
        return { ...base, lastQuantity: null, lastIssuedAt: null, daysSince: null, status };
      }
      const issuedDay = dubaiDayNumber(latest.issuedAt);
      const daysSince = today !== null && issuedDay !== null ? today - issuedDay : null;
      const status: PpeCycleStatus =
        daysSince === null
          ? "No PPE History"
          : daysSince >= intervalDays
            ? "Eligible"
            : "Within 3-Month Cycle";
      return {
        ...base,
        lastQuantity: latest.quantity,
        lastIssuedAt: latest.issuedAt,
        daysSince,
        status,
      };
    },
    history(employeeId: string, materialId: string, nameOf: (id: string) => string): PpeHistoryRow[] {
      return matching(employeeId, materialId).map((issue) => ({
        issuedAt: issue.issuedAt,
        quantity: issue.quantity,
        unit: issue.unit,
        reference: issue.reference,
        itemCode: issue.itemCode,
        productName: issue.productName,
        issuedByName: nameOf(issue.issuedBy),
      }));
    },
    records(nameOf: (id: string) => string): (PpeHistoryRow & { employeeId: string })[] {
      return issues
        .filter((issue) => {
          const day = dubaiDayNumber(issue.issuedAt);
          return day !== null && (today === null || day <= today);
        })
        .map((issue) => ({
          employeeId: issue.employeeId,
          issuedAt: issue.issuedAt,
          quantity: issue.quantity,
          unit: issue.unit,
          reference: issue.reference,
          itemCode: issue.itemCode,
          productName: issue.productName,
          issuedByName: nameOf(issue.issuedBy),
        }));
    },
  };
}

export function issuedOnRequest(request: MaterialRequest, materialId: string, employeeId: string) {
  const key = normalizeEmployeeId(employeeId);
  let total = "0";
  const itemIds = new Set(request.items.filter((item) => item.materialId === materialId).map((item) => item.id));
  for (const receipt of request.issueReceipts ?? []) {
    for (const line of receipt.lines) {
      if (!itemIds.has(line.itemId)) continue;
      for (const employee of line.employees ?? []) {
        if (normalizeEmployeeId(employee.employeeId) !== key || !isPositiveQty(employee.quantity)) continue;
        total = addQty(total, employee.quantity) ?? total;
      }
    }
  }
  return total;
}

export function planEmployeeIssue(
  rows: { employeeId: string; remaining: string }[],
  quantityText: string,
) {
  const quantity = parseQty(quantityText);
  let left = quantity && isPositiveQty(quantity) ? quantity : "0";
  return rows.map((row) => {
    const cap = isPositiveQty(row.remaining) ? row.remaining : "0";
    const give = cmpQty(left, cap) > 0 ? cap : left;
    left = subQty(left, give) ?? "0";
    return { employeeId: row.employeeId, quantity: isPositiveQty(give) ? give : "0" };
  });
}

export function distributeIssuedPpe(
  allocations: { employeeId: string; quantity: string }[],
  already: { employeeId: string; quantity: string }[],
  issueQuantity: string,
  explicit?: PpeIssueLine[] | null,
): { ok: true; employees: PpeIssueLine[] } | { ok: false; error: string } {
  const remaining = new Map<string, string>();
  const order: string[] = [];
  for (const allocation of allocations) {
    const employeeId = normalizeEmployeeId(allocation.employeeId);
    if (!employeeId || !isPositiveQty(allocation.quantity)) continue;
    if (!remaining.has(employeeId)) order.push(employeeId);
    remaining.set(employeeId, addQty(remaining.get(employeeId) ?? "0", allocation.quantity) ?? allocation.quantity);
  }
  for (const prior of already) {
    const employeeId = normalizeEmployeeId(prior.employeeId);
    const current = remaining.get(employeeId);
    if (current === undefined) continue;
    remaining.set(employeeId, subQty(current, prior.quantity) ?? "0");
  }

  let chosen: PpeIssueLine[];
  if (explicit == null) {
    chosen = planEmployeeIssue(
      order.map((employeeId) => ({ employeeId, remaining: remaining.get(employeeId) ?? "0" })),
      issueQuantity,
    ).filter((row) => isPositiveQty(row.quantity));
  } else {
    const seen = new Set<string>();
    chosen = [];
    for (const row of explicit) {
      const employeeId = normalizeEmployeeId(row.employeeId);
      const quantity = parseQty(row.quantity);
      if (!employeeId) return { ok: false, error: "Enter an employee ID for each PPE quantity." };
      if (seen.has(employeeId)) return { ok: false, error: "Enter each employee once for this PPE item." };
      seen.add(employeeId);
      if (!remaining.has(employeeId)) {
        return { ok: false, error: "That employee is not on this PPE request." };
      }
      if (!quantity || !isPositiveQty(quantity)) continue;
      if (cmpQty(quantity, remaining.get(employeeId) ?? "0") > 0) {
        return { ok: false, error: "An employee cannot be issued more PPE than their allocation." };
      }
      chosen.push({ employeeId, quantity });
    }
  }

  const assigned = chosen.reduce((sum, row) => addQty(sum, row.quantity) ?? sum, "0");
  if (!isZeroQty(subQty(issueQuantity, assigned) ?? "1")) {
    return {
      ok: false,
      error: "The PPE quantities for each employee must add up to the quantity being issued.",
    };
  }
  return { ok: true, employees: chosen };
}
