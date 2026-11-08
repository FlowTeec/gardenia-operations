export type GardeniaRole =
  | "admin"
  | "salesperson"
  | "branch_manager"
  | "branch_storekeeper"
  | "warehouse_manager"
  | "management";

export type LocationType = "branch" | "warehouse";

export type Branch = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  active: boolean;
  position: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  unit: string;
  description: string;
  minStockLevel: number;
  /** Current catalog selling price. Historical requests keep their own unitPrice snapshot. */
  sellingPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryBalance = {
  id: string;
  productId: string;
  locationId: string; // branchId or "warehouse"
  locationType: LocationType;
  quantity: number;
  updatedAt: string;
};

export type MovementType =
  | "opening"
  | "adjustment"
  | "sale_issue"
  | "replenishment_dispatch"
  | "replenishment_receipt"
  | "transfer";

export type InventoryMovement = {
  id: string;
  productId: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  movementType: MovementType;
  sourceLocationId: string | null;
  destinationLocationId: string;
  relatedRequestId: string | null;
  performedBy: string;
  performedAt: string;
  notes: string | null;
};

export type SalesRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "returned"
  | "issued"
  | "partially_issued";

export type SalesRequestLine = {
  productId: string;
  requestedQty: number;
  /** Selling price captured when the request was submitted. Later catalog changes do not alter it. */
  unitPrice: number;
  approvedQty: number | null;
  issuedQty: number | null;
};

export type SalesRequest = {
  id: string;
  requestNumber: string;
  branchId: string;
  salespersonId: string;
  customerName: string;
  status: SalesRequestStatus;
  lines: SalesRequestLine[];
  notes: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  issueNotes: string | null;
  issueTicketId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueTicketLine = {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  requestedQty: number;
  approvedQty: number;
  issuedQty: number;
  unitPrice: number;
  lineTotal: number;
};

export type IssueTicket = {
  id: string;
  ticketNumber: string;
  salesRequestId: string;
  requestNumber: string;
  branchId: string;
  branchName: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  storekeeperId: string;
  storekeeperName: string;
  issuedAt: string;
  notes: string | null;
  lines: IssueTicketLine[];
  totalValue: number;
  status: "issued" | "partially_issued";
};

export type ReplenishmentStatus =
  | "pending"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "dispatched"
  | "received"
  | "partially_received";

export type ReplenishmentLine = {
  productId: string;
  requestedQty: number;
  approvedQty: number | null;
  dispatchedQty: number | null;
  receivedQty: number | null;
};

export type ReplenishmentRequest = {
  id: string;
  requestNumber: string;
  branchId: string;
  storekeeperIdRequesting: string;
  status: ReplenishmentStatus;
  lines: ReplenishmentLine[];
  notes: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  approvedAt: string | null;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  relatedRequestId: string | null;
  relatedType: "sales" | "replenishment" | "inventory" | null;
  createdAt: string;
};

export type GardeniaUser = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: GardeniaRole;
  branchId: string | null; // null for warehouse_manager, admin, management
  active: boolean;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type GardeniaWorkspace = {
  branches: Branch[];
  productCategories: ProductCategory[];
  products: Product[];
  inventoryBalances: InventoryBalance[];
  inventoryMovements: InventoryMovement[];
  salesRequests: SalesRequest[];
  issueTickets: IssueTicket[];
  replenishmentRequests: ReplenishmentRequest[];
  users: GardeniaUser[];
  sessions: AuthSession[];
  notifications: Notification[];
  counters: {
    salesRequest: number;
    replenishment: number;
    issueTicket: number;
  };
};
