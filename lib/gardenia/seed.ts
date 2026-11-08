import { randomBytes } from "node:crypto";
import type { GardeniaWorkspace } from "./types";
import { hashPassword } from "./password";
import { normalizeWorkspace } from "./normalize";

/**
 * Returns the password to hash for a given role's seed account.
 * Passwords are read from environment variables only — no plaintext ever
 * ships in source files.  When no variable is set a random placeholder is
 * used so the account exists but cannot be signed into without a reset.
 */
function seedPassword(kind: "admin" | "staff"): string {
  if (process.env.GARDENIA_SEED_PASSWORD) return process.env.GARDENIA_SEED_PASSWORD;
  if (kind === "admin" && process.env.GARDENIA_ADMIN_PASSWORD)
    return process.env.GARDENIA_ADMIN_PASSWORD;
  if (kind === "staff" && process.env.GARDENIA_STAFF_PASSWORD)
    return process.env.GARDENIA_STAFF_PASSWORD;
  return randomBytes(24).toString("hex");
}

export async function createGardeniaSeed(): Promise<GardeniaWorkspace> {
  const now = new Date().toISOString();

  // ─── Branches ────────────────────────────────────────────────────────────
  const branches = [
    { id: "branch-1", name: "Branch 1 – Al Ain Region",      code: "B1", active: true, createdAt: now },
    { id: "branch-2", name: "Branch 2 – Abu Dhabi Central",  code: "B2", active: true, createdAt: now },
    { id: "branch-3", name: "Branch 3 – Dubai North",        code: "B3", active: true, createdAt: now },
    { id: "branch-4", name: "Branch 4 – Sharjah & Northern Emirates", code: "B4", active: true, createdAt: now },
    { id: "branch-5", name: "Branch 5 – Eastern Region",     code: "B5", active: true, createdAt: now },
  ];

  // ─── Product Categories ──────────────────────────────────────────────────
  const productCategories = [
    { id: "cat-1", name: "Insecticides",              active: true, position: 1 },
    { id: "cat-2", name: "Rodenticides",              active: true, position: 2 },
    { id: "cat-3", name: "Termiticides",              active: true, position: 3 },
    { id: "cat-4", name: "Larvicides & Repellents",   active: true, position: 4 },
    { id: "cat-5", name: "Disinfectants & Sanitisers",active: true, position: 5 },
    { id: "cat-6", name: "Equipment & PPE",           active: true, position: 6 },
  ];

  // ─── Products ────────────────────────────────────────────────────────────
  const products = [
    // Insecticides
    { id: "p-01", sku: "GRD-0001", name: "Cypermethrin 10% EC",          categoryId: "cat-1", unit: "Litre",      description: "Broad-spectrum pyrethroid for crawling insects",        minStockLevel: 50,  active: true, createdAt: now, updatedAt: now },
    { id: "p-02", sku: "GRD-0002", name: "Deltamethrin 2.5% WP",         categoryId: "cat-1", unit: "kg",         description: "Wettable powder for indoor/outdoor residual spraying",  minStockLevel: 40,  active: true, createdAt: now, updatedAt: now },
    { id: "p-03", sku: "GRD-0003", name: "Imidacloprid 20% SL",          categoryId: "cat-1", unit: "Litre",      description: "Systemic insecticide for cockroach & ant control",      minStockLevel: 30,  active: true, createdAt: now, updatedAt: now },
    { id: "p-04", sku: "GRD-0004", name: "Bifenthrin 10% EC",            categoryId: "cat-1", unit: "Litre",      description: "Long-residual pyrethroid for perimeter treatment",      minStockLevel: 25,  active: true, createdAt: now, updatedAt: now },
    // Rodenticides
    { id: "p-05", sku: "GRD-0005", name: "Bromadiolone 0.005% Bait",     categoryId: "cat-2", unit: "kg",         description: "Second-generation anticoagulant bait blocks",           minStockLevel: 20,  active: true, createdAt: now, updatedAt: now },
    { id: "p-06", sku: "GRD-0006", name: "Brodifacoum 0.005% Pellets",   categoryId: "cat-2", unit: "kg",         description: "Highly effective rodent bait for severe infestations",  minStockLevel: 15,  active: true, createdAt: now, updatedAt: now },
    // Termiticides
    { id: "p-07", sku: "GRD-0007", name: "Fipronil 0.5% SC (Termite)",   categoryId: "cat-3", unit: "Litre",      description: "Non-repellent soil treatment for subterranean termites", minStockLevel: 30, active: true, createdAt: now, updatedAt: now },
    { id: "p-08", sku: "GRD-0008", name: "Imidacloprid 0.05% Soil Drench",categoryId: "cat-3", unit: "Litre",     description: "Pre- and post-construction termite barrier treatment",   minStockLevel: 25,  active: true, createdAt: now, updatedAt: now },
    // Larvicides & Repellents
    { id: "p-09", sku: "GRD-0009", name: "Bacillus thuringiensis (Bti) WG",categoryId: "cat-4", unit: "kg",       description: "Biological larvicide for mosquito breeding sites",       minStockLevel: 20,  active: true, createdAt: now, updatedAt: now },
    { id: "p-10", sku: "GRD-0010", name: "Temephos 1% Granules",         categoryId: "cat-4", unit: "kg",         description: "Organophosphate larvicide for water bodies",            minStockLevel: 25,  active: true, createdAt: now, updatedAt: now },
    { id: "p-11", sku: "GRD-0011", name: "DEET 40% Spray (500ml)",       categoryId: "cat-4", unit: "Bottle",     description: "Personal insect repellent for field technicians",       minStockLevel: 30,  active: true, createdAt: now, updatedAt: now },
    // Disinfectants & Sanitisers
    { id: "p-12", sku: "GRD-0012", name: "Quaternary Ammonium 10% Conc.", categoryId: "cat-5", unit: "Litre",     description: "Broad-spectrum disinfectant for surfaces & drains",     minStockLevel: 40,  active: true, createdAt: now, updatedAt: now },
    { id: "p-13", sku: "GRD-0013", name: "Sodium Hypochlorite 12% Solution",categoryId: "cat-5", unit: "Litre",  description: "Heavy-duty disinfectant and deodoriser",                minStockLevel: 50,  active: true, createdAt: now, updatedAt: now },
    // Equipment & PPE
    { id: "p-14", sku: "GRD-0014", name: "Knapsack Sprayer 16L (Manual)",  categoryId: "cat-6", unit: "Unit",    description: "Heavy-duty manual sprayer for field operations",        minStockLevel: 5,   active: true, createdAt: now, updatedAt: now },
    { id: "p-15", sku: "GRD-0015", name: "Full-Face Respirator (P3 Filter)",categoryId: "cat-6", unit: "Unit",   description: "Respiratory PPE for chemical application",              minStockLevel: 10,  active: true, createdAt: now, updatedAt: now },
    { id: "p-16", sku: "GRD-0016", name: "Chemical-Resistant Gloves (Pair)",categoryId: "cat-6", unit: "Pair",   description: "Nitrile gloves rated for pesticide handling",           minStockLevel: 50,  active: true, createdAt: now, updatedAt: now },
  ];

  // ─── Warehouse inventory (central store) ────────────────────────────────
  const warehouseBalances = products.map((p, i) => ({
    id: `wbal-${p.id}`,
    productId: p.id,
    locationId: "warehouse",
    locationType: "warehouse" as const,
    quantity: [500, 400, 300, 250, 200, 150, 300, 250, 200, 250, 300, 400, 500, 30, 60, 400][i] ?? 100,
    updatedAt: now,
  }));

  // ─── Branch inventory ────────────────────────────────────────────────────
  const branchBalances = branches.flatMap((branch, bi) =>
    products.map((p, pi) => ({
      id: `bbal-${branch.id}-${p.id}`,
      productId: p.id,
      locationId: branch.id,
      locationType: "branch" as const,
      quantity: [
        [80, 60, 45, 35, 28, 18, 45, 35, 28, 35, 45, 60, 80, 5, 10, 60],
        [65, 50, 38, 30, 22, 15, 38, 30, 22, 28, 38, 50, 65, 4, 8,  50],
        [90, 68, 50, 40, 30, 20, 50, 40, 30, 40, 50, 68, 90, 6, 12, 68],
        [70, 55, 42, 32, 25, 17, 42, 32, 25, 32, 42, 55, 70, 5, 9,  55],
        [55, 42, 32, 25, 18, 12, 32, 25, 18, 25, 32, 42, 55, 3, 7,  42],
      ][bi]?.[pi] ?? 20,
      updatedAt: now,
    }))
  );

  const inventoryBalances = [...warehouseBalances, ...branchBalances];

  // ─── Users ───────────────────────────────────────────────────────────────
  const adminHash = await hashPassword(seedPassword("admin"));
  const staffHash = await hashPassword(seedPassword("staff"));

  const users = [
    { id: "u-admin-1", employeeId: "EMP001", name: "Sarah Al-Hassan",      email: "admin@gardenia.com",        role: "admin"             as const, branchId: null,       active: true, passwordHash: adminHash, createdAt: now, updatedAt: now },
    { id: "u-wm-1",    employeeId: "EMP002", name: "Omar Al-Farsi",         email: "warehouse@gardenia.com",    role: "warehouse_manager" as const, branchId: null,       active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-mgmt-1",  employeeId: "EMP003", name: "Fatima Al-Rashid",      email: "management@gardenia.com",   role: "management"        as const, branchId: null,       active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    // Branch 1 – Al Ain Region
    { id: "u-bm-1",    employeeId: "EMP101", name: "Khalid Al-Amri",        email: "manager.b1@gardenia.com",   role: "branch_manager"    as const, branchId: "branch-1", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sk-1",    employeeId: "EMP102", name: "Mariam Al-Hosani",      email: "store.b1@gardenia.com",     role: "branch_storekeeper"as const, branchId: "branch-1", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-1a",   employeeId: "EMP103", name: "Zayed Al-Blooshi",      email: "sales1.b1@gardenia.com",    role: "salesperson"       as const, branchId: "branch-1", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-1b",   employeeId: "EMP104", name: "Reem Al-Kubaisi",       email: "sales2.b1@gardenia.com",    role: "salesperson"       as const, branchId: "branch-1", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    // Branch 2 – Abu Dhabi Central
    { id: "u-bm-2",    employeeId: "EMP201", name: "Nadia Al-Sulaiti",      email: "manager.b2@gardenia.com",   role: "branch_manager"    as const, branchId: "branch-2", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sk-2",    employeeId: "EMP202", name: "Yousef Al-Hajeri",      email: "store.b2@gardenia.com",     role: "branch_storekeeper"as const, branchId: "branch-2", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-2a",   employeeId: "EMP203", name: "Saeed Al-Murri",        email: "sales1.b2@gardenia.com",    role: "salesperson"       as const, branchId: "branch-2", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-2b",   employeeId: "EMP204", name: "Maitha Al-Qubaisi",     email: "sales2.b2@gardenia.com",    role: "salesperson"       as const, branchId: "branch-2", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    // Branch 3 – Dubai North
    { id: "u-bm-3",    employeeId: "EMP301", name: "Hassan Al-Zaabi",       email: "manager.b3@gardenia.com",   role: "branch_manager"    as const, branchId: "branch-3", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sk-3",    employeeId: "EMP302", name: "Aisha Al-Nuaimi",       email: "store.b3@gardenia.com",     role: "branch_storekeeper"as const, branchId: "branch-3", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-3a",   employeeId: "EMP303", name: "Hamad Al-Dosari",       email: "sales1.b3@gardenia.com",    role: "salesperson"       as const, branchId: "branch-3", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-3b",   employeeId: "EMP304", name: "Shaikha Al-Zaabi",      email: "sales2.b3@gardenia.com",    role: "salesperson"       as const, branchId: "branch-3", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    // Branch 4 – Sharjah & Northern Emirates
    { id: "u-bm-4",    employeeId: "EMP401", name: "Layla Al-Mansouri",     email: "manager.b4@gardenia.com",   role: "branch_manager"    as const, branchId: "branch-4", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sk-4",    employeeId: "EMP402", name: "Tariq Al-Shamsi",       email: "store.b4@gardenia.com",     role: "branch_storekeeper"as const, branchId: "branch-4", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-4a",   employeeId: "EMP403", name: "Mubarak Al-Dhaheri",    email: "sales1.b4@gardenia.com",    role: "salesperson"       as const, branchId: "branch-4", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-4b",   employeeId: "EMP404", name: "Noura Al-Ali",          email: "sales2.b4@gardenia.com",    role: "salesperson"       as const, branchId: "branch-4", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    // Branch 5 – Eastern Region
    { id: "u-bm-5",    employeeId: "EMP501", name: "Ibrahim Al-Marzouqi",   email: "manager.b5@gardenia.com",   role: "branch_manager"    as const, branchId: "branch-5", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sk-5",    employeeId: "EMP502", name: "Hessa Al-Ketbi",        email: "store.b5@gardenia.com",     role: "branch_storekeeper"as const, branchId: "branch-5", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-5a",   employeeId: "EMP503", name: "Faisal Al-Habsi",       email: "sales1.b5@gardenia.com",    role: "salesperson"       as const, branchId: "branch-5", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
    { id: "u-sp-5b",   employeeId: "EMP504", name: "Balqees Al-Mazrouei",   email: "sales2.b5@gardenia.com",    role: "salesperson"       as const, branchId: "branch-5", active: true, passwordHash: staffHash, createdAt: now, updatedAt: now },
  ];

  // ─── Sample Sales Requests ───────────────────────────────────────────────
  const d1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const d2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const d3 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const d4 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const salesRequests = [
    {
      id: "sr-001",
      requestNumber: "SR-2024-001",
      branchId: "branch-1",
      salespersonId: "u-sp-1a",
      customerName: "Al Ain Municipality – Parks Dept.",
      status: "issued" as const,
      lines: [
        { productId: "p-01", requestedQty: 20, approvedQty: 20, issuedQty: 20 },
        { productId: "p-09", requestedQty: 15, approvedQty: 15, issuedQty: 15 },
        { productId: "p-16", requestedQty: 30, approvedQty: 30, issuedQty: 30 },
      ],
      notes: "Mosquito control programme – public parks and wadis",
      approvedBy: "u-bm-1",
      approvalNotes: "Approved – municipal contract",
      approvedAt: d1,
      issuedBy: "u-sk-1",
      issuedAt: d1,
      createdAt: d1,
      updatedAt: d1,
    },
    {
      id: "sr-002",
      requestNumber: "SR-2024-002",
      branchId: "branch-2",
      salespersonId: "u-sp-2a",
      customerName: "ADNOC Housing Complex",
      status: "approved" as const,
      lines: [
        { productId: "p-05", requestedQty: 25, approvedQty: 25, issuedQty: null },
        { productId: "p-12", requestedQty: 20, approvedQty: 20, issuedQty: null },
      ],
      notes: "Rodent control – residential compound",
      approvedBy: "u-bm-2",
      approvalNotes: null,
      approvedAt: d2,
      issuedBy: null,
      issuedAt: null,
      createdAt: d2,
      updatedAt: d2,
    },
    {
      id: "sr-003",
      requestNumber: "SR-2024-003",
      branchId: "branch-1",
      salespersonId: "u-sp-1b",
      customerName: "Al Ain Zoo – Facilities",
      status: "pending" as const,
      lines: [
        { productId: "p-07", requestedQty: 10, approvedQty: null, issuedQty: null },
        { productId: "p-08", requestedQty: 8,  approvedQty: null, issuedQty: null },
        { productId: "p-15", requestedQty: 5,  approvedQty: null, issuedQty: null },
      ],
      notes: "Urgent – pre-construction termite treatment for new enclosure",
      approvedBy: null,
      approvalNotes: null,
      approvedAt: null,
      issuedBy: null,
      issuedAt: null,
      createdAt: d3,
      updatedAt: d3,
    },
    {
      id: "sr-004",
      requestNumber: "SR-2024-004",
      branchId: "branch-3",
      salespersonId: "u-sp-3a",
      customerName: "Jumeirah Hotel Group",
      status: "partially_issued" as const,
      lines: [
        { productId: "p-03", requestedQty: 15, approvedQty: 15, issuedQty: 12 },
        { productId: "p-13", requestedQty: 20, approvedQty: 20, issuedQty: 20 },
        { productId: "p-16", requestedQty: 50, approvedQty: 50, issuedQty: 40 },
      ],
      notes: "Cockroach & fly control programme – F&B areas",
      approvedBy: "u-bm-3",
      approvalNotes: "Approved",
      approvedAt: d2,
      issuedBy: "u-sk-3",
      issuedAt: d1,
      createdAt: d2,
      updatedAt: d1,
    },
    {
      id: "sr-005",
      requestNumber: "SR-2024-005",
      branchId: "branch-4",
      salespersonId: "u-sp-4a",
      customerName: "Sharjah Airport Authority",
      status: "rejected" as const,
      lines: [
        { productId: "p-04", requestedQty: 30, approvedQty: null, issuedQty: null },
        { productId: "p-11", requestedQty: 20, approvedQty: null, issuedQty: null },
      ],
      notes: "Perimeter insect control – airside facilities",
      approvedBy: "u-bm-4",
      approvalNotes: "Insufficient branch stock – request replenishment first",
      approvedAt: d2,
      issuedBy: null,
      issuedAt: null,
      createdAt: d3,
      updatedAt: d2,
    },
    {
      id: "sr-006",
      requestNumber: "SR-2024-006",
      branchId: "branch-5",
      salespersonId: "u-sp-5a",
      customerName: "RAK Hospital – Facilities Dept.",
      status: "pending" as const,
      lines: [
        { productId: "p-12", requestedQty: 30, approvedQty: null, issuedQty: null },
        { productId: "p-13", requestedQty: 25, approvedQty: null, issuedQty: null },
        { productId: "p-10", requestedQty: 10, approvedQty: null, issuedQty: null },
      ],
      notes: "Monthly disinfection & larvicide programme – healthcare facility",
      approvedBy: null,
      approvalNotes: null,
      approvedAt: null,
      issuedBy: null,
      issuedAt: null,
      createdAt: d4,
      updatedAt: d4,
    },
  ];

  // ─── Sample Replenishment Requests ──────────────────────────────────────
  const replenishmentRequests = [
    {
      id: "rr-001",
      requestNumber: "RR-2024-001",
      branchId: "branch-2",
      storekeeperIdRequesting: "u-sk-2",
      status: "received" as const,
      lines: [
        { productId: "p-01", requestedQty: 80, approvedQty: 80, dispatchedQty: 80, receivedQty: 80 },
        { productId: "p-12", requestedQty: 60, approvedQty: 60, dispatchedQty: 60, receivedQty: 60 },
      ],
      notes: "Stock replenishment – Cypermethrin and disinfectant low",
      approvedBy: "u-wm-1",
      approvalNotes: "Approved",
      approvedAt: d2,
      dispatchedBy: "u-wm-1",
      dispatchedAt: d1,
      receivedBy: "u-sk-2",
      receivedAt: d1,
      createdAt: d3,
      updatedAt: d1,
    },
    {
      id: "rr-002",
      requestNumber: "RR-2024-002",
      branchId: "branch-4",
      storekeeperIdRequesting: "u-sk-4",
      status: "dispatched" as const,
      lines: [
        { productId: "p-07", requestedQty: 40, approvedQty: 40, dispatchedQty: 40, receivedQty: null },
        { productId: "p-08", requestedQty: 30, approvedQty: 30, dispatchedQty: 30, receivedQty: null },
      ],
      notes: "Urgent – termiticide restock for upcoming contracts",
      approvedBy: "u-wm-1",
      approvalNotes: null,
      approvedAt: d2,
      dispatchedBy: "u-wm-1",
      dispatchedAt: d3,
      receivedBy: null,
      receivedAt: null,
      createdAt: d3,
      updatedAt: d3,
    },
    {
      id: "rr-003",
      requestNumber: "RR-2024-003",
      branchId: "branch-1",
      storekeeperIdRequesting: "u-sk-1",
      status: "pending" as const,
      lines: [
        { productId: "p-09", requestedQty: 30, approvedQty: null, dispatchedQty: null, receivedQty: null },
        { productId: "p-10", requestedQty: 25, approvedQty: null, dispatchedQty: null, receivedQty: null },
        { productId: "p-16", requestedQty: 80, approvedQty: null, dispatchedQty: null, receivedQty: null },
      ],
      notes: "Seasonal mosquito season – increase larvicide stock",
      approvedBy: null,
      approvalNotes: null,
      approvedAt: null,
      dispatchedBy: null,
      dispatchedAt: null,
      receivedBy: null,
      receivedAt: null,
      createdAt: d4,
      updatedAt: d4,
    },
    {
      id: "rr-004",
      requestNumber: "RR-2024-004",
      branchId: "branch-3",
      storekeeperIdRequesting: "u-sk-3",
      status: "approved" as const,
      lines: [
        { productId: "p-02", requestedQty: 50, approvedQty: 50, dispatchedQty: null, receivedQty: null },
        { productId: "p-05", requestedQty: 20, approvedQty: 20, dispatchedQty: null, receivedQty: null },
      ],
      notes: "Deltamethrin and rodenticide restock",
      approvedBy: "u-wm-1",
      approvalNotes: "Approved – ready for dispatch",
      approvedAt: d4,
      dispatchedBy: null,
      dispatchedAt: null,
      receivedBy: null,
      receivedAt: null,
      createdAt: d4,
      updatedAt: d4,
    },
  ];

  const workspace = {
    branches,
    productCategories,
    products,
    inventoryBalances,
    inventoryMovements: [],
    salesRequests,
    issueTickets: [],
    replenishmentRequests,
    users,
    sessions: [],
    notifications: [],
    counters: { salesRequest: 6, replenishment: 4, issueTicket: 0 },
  } as unknown as GardeniaWorkspace;
  normalizeWorkspace(workspace);
  return workspace;
}
