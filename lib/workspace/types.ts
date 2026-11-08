export const ZONE_CODES = ["A", "B", "C", "D", "E"] as const;

export type ZoneCode = (typeof ZONE_CODES)[number];

export const ZONE_NAMES: Record<ZoneCode, string> = {
  A: "ZONE A",
  B: "ZONE B",
  C: "ZONE C",
  D: "ZONE D",
  E: "ZONE E",
};

export const FACILITY_NAME = "Al Ain South Storage Facility";

export type Role = "ADMIN" | "SUPERVISOR" | "TEAM_LEADER" | "STORE_KEEPER" | "OPERATION_MANAGER";

export type RequestStatus =
  | "PENDING"
  | "PENDING_OPERATION_MANAGER"
  | "PARTIALLY_APPROVED"
  | "FULLY_APPROVED"
  | "APPROVED"
  | "OPERATION_MANAGER_APPROVED"
  | "REJECTED"
  | "PREPARED"
  | "ISSUED";

export type ItemDecision = "PENDING" | "APPROVED" | "REJECTED";

export type MovementType =
  | "OPENING"
  | "RECEIPT"
  | "DAMAGE"
  | "ADJUSTMENT"
  | "AVAILABILITY"
  | "STATUS"
  | "ISSUE"
  | "IMPORT"
  | "REVERSAL";

export type DemoUser = {
  id: string;
  displayName: string;
  role: Role;
  active: boolean;
  zoneCode: ZoneCode | null;
  /** Team leaders: the one supervisor they are actively assigned to. */
  supervisorId: string | null;
  /** Display name of the employee's team. It does not replace the zone or supervisor assignment. */
  teamName?: string | null;
};

export type Zone = {
  code: ZoneCode;
  name: string;
  supervisorId: string;
};

export type ZoneAvailability = "OPEN" | "CLOSED";

/** One zone's request availability for one calendar day in Asia/Dubai. No row means closed. */
export type ZoneRequestDay = {
  id: string;
  zoneCode: ZoneCode;
  requestDate: string;
  status: ZoneAvailability;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
  note: string | null;
};

/** Append-only record of an open or close. Rows are not deleted. */
export type ZoneRequestChange = {
  id: string;
  zoneCode: ZoneCode;
  requestDate: string;
  previousStatus: ZoneAvailability;
  newStatus: ZoneAvailability;
  changedBy: string;
  changedAt: string;
  note: string | null;
};

export type MaterialCategory = {
  id: string;
  name: string;
  /** PPE categories require a manually typed employee ID on each request. */
  requiresEmployee: boolean;
  active: boolean;
  position: number;
  updatedAt: string;
};

export type Material = {
  id: string;
  itemCode: string;
  productName: string;
  activeIngredient: string;
  unit: string;
  beginningInventory: string;
  newStock: string;
  out: string;
  currentStock: string;
  categoryId: string | null;
  requestable: boolean;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type StockMovement = {
  id: string;
  materialId: string;
  type: MovementType;
  quantityBefore: string;
  quantityAfter: string;
  quantityChange: string;
  requestId: string | null;
  performedBy: string;
  reason: string;
  createdAt: string;
  reference: string | null;
  supplier: string | null;
  notes: string | null;
  receiptDate: string | null;
  idempotencyKey: string | null;
  reversesMovementId: string | null;
};

export type RequestItem = {
  id: string;
  materialId: string;
  itemCode: string;
  productName: string;
  unit: string;
  quantityRequested: string;
  quantityIssued: string;
  decision: ItemDecision;
  approvedQuantity: string;
  rejectionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  omDecision: ItemDecision;
  omApprovedQuantity: string;
  omRejectionReason: string | null;
  omDecidedBy: string | null;
  omDecidedAt: string | null;
};

/** Append-only item decision. A later decision is a new row, not a silent edit. */
export type ItemApproval = {
  id: string;
  requestId: string;
  itemId: string;
  materialId: string;
  supervisorId: string;
  decision: "APPROVED" | "REJECTED";
  quantityRequested: string;
  approvedQuantity: string;
  rejectionReason: string | null;
  createdAt: string;
  idempotencyKey: string | null;
  /** SUPERVISOR rows are the first approval. OPERATION_MANAGER rows are a later decision. */
  stage: "SUPERVISOR" | "OPERATION_MANAGER";
};

export type PpeAllocation = {
  id: string;
  employeeId: string;
  materialId: string;
  itemCode: string;
  productName: string;
  unit: string;
  quantity: string;
};

/** Actual quantity handed to one employee on one confirmed issue. */
export type PpeIssueLine = {
  employeeId: string;
  quantity: string;
};

export type IssueReceipt = {
  key: string;
  issuedBy: string;
  issuedAt: string;
  lines: { itemId: string; quantity: string; employees?: PpeIssueLine[] }[];
};

export type PpeReplacementInterval = {
  id: string;
  days: number;
  active: boolean;
};

export type PpeCycleStatus =
  | "Eligible"
  | "Within 3-Month Cycle"
  | "No Previous Issue"
  | "No PPE History";

/** Last confirmed issue for one employee and one PPE material. History rows are loaded separately. */
export type PpeEmployeeCheck = {
  employeeId: string;
  materialId: string;
  quantity: string;
  unit: string;
  issuedOnRequest: string;
  lastQuantity: string | null;
  lastIssuedAt: string | null;
  daysSince: number | null;
  intervalDays: number;
  status: PpeCycleStatus;
};

export type PpeHistoryRow = {
  issuedAt: string;
  quantity: string;
  unit: string;
  reference: string;
  itemCode: string;
  productName: string;
  issuedByName: string;
};

export type MaterialRequest = {
  id: string;
  requestNo: number;
  zoneCode: ZoneCode;
  teamLeaderId: string;
  supervisorId: string;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  preparedBy: string | null;
  preparedAt: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  operationReviewedBy: string | null;
  operationReviewedAt: string | null;
  items: RequestItem[];
  ppeAllocations: PpeAllocation[];
  issueReceipts: IssueReceipt[];
  decisionKeys: string[];
};

export type IssueTicketLine = {
  itemId: string;
  itemCode: string;
  description: string;
  unit: string;
  requested: string;
  approved: string;
  issued: string;
};

/** Frozen when a request is fully issued. One ticket per request. */
export type IssueTicket = {
  id: string;
  requestId: string;
  ticketNo: string;
  requestNo: number;
  zoneCode: ZoneCode;
  teamLeaderId: string;
  supervisorId: string;
  storeKeeperId: string;
  issuedAt: string;
  lines: IssueTicketLine[];
};

export type Workspace = {
  version: 1;
  users: DemoUser[];
  credentials: AccountCredential[];
  sessions: AuthSession[];
  zones: Zone[];
  zoneRequestDays: ZoneRequestDay[];
  zoneRequestChanges: ZoneRequestChange[];
  /** Days after an actual PPE issue before the same employee and material is eligible again. */
  ppeReplacementDays: number;
  /** Saved intervals. Eligibility uses the one marked active, mirrored in ppeReplacementDays. */
  ppeIntervals: PpeReplacementInterval[];
  categories: MaterialCategory[];
  materials: Material[];
  movements: StockMovement[];
  requests: MaterialRequest[];
  tickets: IssueTicket[];
  approvals: ItemApproval[];
  nextRequestNo: number;
};

export type Mutation<T = null> =
  | { ok: true; state: Workspace; replayed: boolean; data: T }
  | { ok: false; error: string };

export type Area = "store" | "supervisor" | "leader" | "admin" | "operations";

export type ActorSummary = {
  id: string;
  displayName: string;
  role: Role;
  zoneCode: ZoneCode | null;
  zoneName: string | null;
  teamName: string | null;
};

export type InventoryMaterial = {
  id: string;
  itemCode: string;
  productName: string;
  activeIngredient: string;
  unit: string;
  beginningInventory: string;
  newStock: string;
  out: string;
  currentStock: string;
  categoryId: string | null;
  categoryName: string | null;
  requestable: boolean;
  active: boolean;
  updatedAt: string;
  updatedByName: string;
};

export type MovementRow = {
  id: string;
  materialId: string;
  type: MovementType;
  quantityChange: string;
  quantityAfter: string;
  reason: string;
  performedByName: string;
  createdAt: string;
  requestNo: string | null;
};

export type InventoryPage = {
  actor: ActorSummary;
  categories: { id: string; name: string; active: boolean; requiresEmployee: boolean }[];
  materials: InventoryMaterial[];
  movements: MovementRow[];
};

export type RequestCard = {
  id: string;
  requestNo: string;
  status: RequestStatus;
  zoneCode: ZoneCode;
  zoneName: string;
  teamLeaderId: string;
  teamLeaderName: string;
  supervisorName: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  materialCount: number;
  approvalSummary: string;
  bulkEligible: boolean;
  issuedAt: string | null;
  totalApproved: string;
  totalIssued: string;
  ticketNo: string | null;
  ticketState: "none" | "in-progress" | "final";
  items: {
    name: string;
    quantity: string;
    unit: string;
    decision: ItemDecision;
    approvedQuantity: string;
    finalQuantity: string;
    issuedQuantity: string;
    rejectedQuantity: string;
  }[];
  ppe: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
  ppeChecks?: PpeEmployeeCheck[];
  canPrint: boolean;
};

export type ZoneQueue = {
  code: ZoneCode;
  name: string;
  supervisorName: string;
  leaders: { id: string; name: string; requests: RequestCard[] }[];
};

export type IssueBoard = {
  actor: ActorSummary;
  zones: ZoneQueue[];
};

export type RequestLine = {
  id: string;
  itemCode: string;
  productName: string;
  unit: string;
  quantityRequested: string;
  supervisorApproved: string;
  operationApproved: string;
  approvedQuantity: string;
  rejectedQuantity: string;
  decision: ItemDecision;
  rejectionReason: string | null;
  quantityIssued: string;
  remaining: string;
  onHand: string;
  issuable: boolean;
  ppeChecks: PpeEmployeeCheck[];
};

export type RequestDetail = {
  actor: ActorSummary;
  id: string;
  requestNo: string;
  ticketNo: string;
  status: RequestStatus;
  zoneName: string;
  teamLeaderName: string;
  supervisorName: string;
  requestedAt: string;
  approvedAt: string | null;
  preparedAt: string | null;
  preparedByName: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  rejectionReason: string | null;
  ppe: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
  canPrepare: boolean;
  canIssue: boolean;
  canPrint: boolean;
  items: RequestLine[];
  receipts: {
    at: string;
    by: string;
    lines: { itemCode: string; quantity: string }[];
  }[];
};

export type StoreDashboard = {
  actor: ActorSummary;
  pendingIssuance: number;
  prepared: number;
  issued: number;
};

export type IssuedRow = {
  id: string;
  requestNo: string;
  ticketNo: string;
  zoneName: string;
  teamLeaderName: string;
  storeKeeperName: string;
  issuedAt: string;
  lineCount: number;
};

export type IssuedHistory = {
  actor: ActorSummary;
  rows: IssuedRow[];
};

export type PublicMaterial = {
  id: string;
  itemCode: string;
  productName: string;
  unit: string;
  activeIngredient: string;
  categoryId: string | null;
  requiresEmployee: boolean;
};

export type LeaderRequest = {
  id: string;
  requestNo: string;
  status: RequestStatus;
  requestedAt: string;
  rejectionReason: string | null;
  items: {
    name: string;
    quantity: string;
    unit: string;
    decision: ItemDecision;
    approvedQuantity: string;
    operationDecision: ItemDecision;
    operationApproved: string;
    rejectionReason: string | null;
  }[];
  ppe: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
};

export type TeamLeaderHome = {
  actor: ActorSummary;
  supervisorName: string | null;
  canSubmit: boolean;
  /** False when the assigned zone is closed for today, or when the leader is not assigned. */
  zoneOpen: boolean;
  /** Set only when the leader is assigned and that zone is closed for new requests. */
  requestClosedMessage: string | null;
  peers: { id: string; displayName: string }[];
  categories: { id: string; name: string; requiresEmployee: boolean }[];
  materials: PublicMaterial[];
  requests: LeaderRequest[];
};

export type SupervisorTicketLine = {
  itemCode: string;
  description: string;
  unit: string;
  requested: string;
  approved: string;
  issued: string;
};

export type SupervisorTicket = {
  requestId: string;
  ticketNo: string;
  requestNo: string;
  zoneName: string;
  teamLeaderName: string;
  storeKeeperName: string;
  issuedAt: string;
  lines: SupervisorTicketLine[];
};

export type SupervisorHome = {
  actor: ActorSummary;
  peers: { id: string; displayName: string }[];
  leaders: { id: string; displayName: string }[];
  pending: RequestCard[];
  approved: RequestCard[];
  issued: RequestCard[];
  rejected: RequestCard[];
  tickets: SupervisorTicket[];
};

export type SupervisorReviewItem = {
  id: string;
  itemCode: string;
  productName: string;
  categoryName: string;
  unit: string;
  quantityRequested: string;
  decision: ItemDecision;
  approvedQuantity: string;
  rejectedQuantity: string;
  rejectionReason: string | null;
  quantityIssued: string;
  decidedAt: string | null;
  decidedByName: string | null;
  omDecision: ItemDecision;
  omApprovedQuantity: string;
  omRejectionReason: string | null;
  allocations: { employeeId: string; quantity: string; unit: string }[];
};

export type StockSignal = "Available" | "Low Stock" | "Insufficient Stock" | "Inactive Material";

/** Decision support only. It does not approve, reduce, or reject a request. */
export type UsageLevel =
  | "Normal Usage"
  | "Above Historical Usage"
  | "Above Recent Usage"
  | "No Previous Issue";

/** One confirmed store-keeper issue. Quantity is the amount physically issued. */
export type ConfirmedIssue = {
  issuedAt: string;
  quantity: string;
  reference: string;
};

export type MaterialUsage = {
  lastQuantity: string | null;
  lastIssuedAt: string | null;
  daysSince: number | null;
  recent: ConfirmedIssue[];
  days30: string;
  days60: string;
  days90: string;
  /** Last 90 days of actual issues ÷ 3, when history covers 90 days. Null means insufficient history. */
  averageMonthly: string | null;
  level: UsageLevel;
};

export type OperationMaterial = {
  id: string;
  itemCode: string;
  productName: string;
  categoryName: string;
  unit: string;
  quantityRequested: string;
  supervisorApproved: string;
  supervisorDecision: ItemDecision;
  supervisorReason: string | null;
  supervisorName: string | null;
  supervisorDecidedAt: string | null;
  omDecision: ItemDecision;
  omApprovedQuantity: string;
  omRejectionReason: string | null;
  currentStock: string;
  availableStock: string;
  active: boolean;
  signal: StockSignal;
  latestReceiptDate: string | null;
  latestReceiptQuantity: string | null;
  allocations: PpeEmployeeCheck[];
  usage: MaterialUsage;
};

export type ApprovalHistoryRow = {
  id: string;
  stage: "SUPERVISOR" | "OPERATION_MANAGER";
  actorName: string;
  decision: "APPROVED" | "REJECTED";
  quantityRequested: string;
  approvedQuantity: string;
  rejectionReason: string | null;
  createdAt: string;
  itemCode: string;
  productName: string;
};

export type OperationReview = {
  actor: ActorSummary;
  id: string;
  requestNo: string;
  teamLeaderName: string;
  supervisorName: string;
  zoneName: string;
  requestedAt: string;
  status: RequestStatus;
  canDecide: boolean;
  canOpenTicket: boolean;
  rejectionReason: string | null;
  items: OperationMaterial[];
  history: ApprovalHistoryRow[];
  ppe: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
};

export type OperationCard = {
  id: string;
  requestNo: string;
  status: RequestStatus;
  teamLeaderName: string;
  supervisorName: string;
  zoneName: string;
  requestedAt: string;
  materialCount: number;
  supervisorStatus: string;
  operationStatus: string;
  ticketState: "none" | "in-progress" | "final";
};

export type StockAlert = {
  itemCode: string;
  productName: string;
  unit: string;
  currentStock: string;
  signal: StockSignal;
};

export type OperationQueueLine = {
  requestId: string;
  requestNo: string;
  itemId: string;
  teamLeaderName: string;
  supervisorName: string;
  zoneCode: ZoneCode;
  zoneName: string;
  itemCode: string;
  productName: string;
  unit: string;
  quantityRequested: string;
  supervisorApproved: string;
  currentStock: string;
  availableStock: string;
  active: boolean;
  signal: StockSignal;
  approvalStatus: "Pending operation manager";
  selectable: boolean;
  hasPpe: boolean;
  ppeChecks: PpeEmployeeCheck[];
  usage: MaterialUsage;
};

export type OperationQueueGroup = {
  requestId: string;
  requestNo: string;
  teamLeaderName: string;
  supervisorName: string;
  zoneCode: ZoneCode;
  zoneName: string;
  requestedAt: string;
  lines: OperationQueueLine[];
};

export type OperationBulkResult = {
  approvedCount: number;
  requestCount: number;
  skippedInactive: number;
};

export type ZoneControlRow = {
  code: ZoneCode;
  name: string;
  status: ZoneAvailability;
  updatedByName: string | null;
  updatedAt: string | null;
  note: string | null;
};

export type ZoneChangeRow = {
  id: string;
  zoneCode: ZoneCode;
  zoneName: string;
  requestDate: string;
  previousStatus: ZoneAvailability;
  newStatus: ZoneAvailability;
  changedByName: string;
  changedAt: string;
  note: string | null;
};

export type OperationRecordLine = {
  key: string;
  requestId: string;
  requestNo: string;
  itemId: string;
  zoneCode: ZoneCode;
  zoneName: string;
  teamLeaderId: string;
  teamLeaderName: string;
  supervisorId: string;
  supervisorName: string;
  requestedAt: string;
  requestDate: string;
  itemCode: string;
  productName: string;
  unit: string;
  quantityRequested: string;
  supervisorApproved: string;
  omApprovedQuantity: string;
  rejectedQuantity: string;
  quantityIssued: string;
  omDecision: ItemDecision;
  omRejectionReason: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  status: RequestStatus;
  statusLabel: string;
  ticketNo: string | null;
  issuedAt: string | null;
};

export type HistoryQuery = {
  date: string;
  zone: string;
  teamLeaderId: string;
  supervisorId: string;
  material: string;
  status: string;
  requestId: string;
};

export type OperationHome = {
  actor: ActorSummary;
  peers: { id: string; displayName: string }[];
  pendingSupervisor: number;
  pendingOperation: number;
  pendingMaterials: number;
  approvedToday: number;
  rejectedToday: number;
  inProgress: number;
  approved: number;
  waitingStore: number;
  issued: number;
  lowStock: number;
  today: string;
  openZoneCodes: ZoneCode[];
  closedZoneCodes: ZoneCode[];
  zones: ZoneControlRow[];
  zoneChanges: ZoneChangeRow[];
  pending: OperationCard[];
  queue: OperationQueueGroup[];
  approvedRequests: OperationCard[];
  approvedLines: OperationRecordLine[];
  rejected: OperationCard[];
  rejectedLines: OperationRecordLine[];
  history: OperationRecordLine[];
  issuedRequests: OperationCard[];
  inProgressRequests: OperationCard[];
  alerts: StockAlert[];
  ppeReplacementDays: number;
  ppeIntervals: { id: string; days: number; active: boolean }[];
};

export type OperationConsumptionRow = {
  itemCode: string;
  productName: string;
  unit: string;
  teamLeaderName: string | null;
  issued: string;
};

export type OperationPpeReportRow = {
  employeeId: string;
  itemCode: string;
  productName: string;
  quantity: string;
  unit: string;
  reference: string;
  issuedAt: string;
  issuedByName: string;
};

export type OperationZoneReport = {
  code: ZoneCode;
  name: string;
  status: ZoneAvailability;
  pending: number;
  inProgress: number;
  rejected: number;
  issued: number;
};

export type OperationReports = {
  actor: ActorSummary;
  consumption: OperationConsumptionRow[];
  leaders: OperationConsumptionRow[];
  ppe: OperationPpeReportRow[];
  requestCounts: { label: string; count: number }[];
  zones: OperationZoneReport[];
  supervisorRejections: number;
  operationRejections: number;
  ppeReplacementDays: number;
};

export type SupervisorReview = {
  actor: ActorSummary;
  id: string;
  requestNo: string;
  teamLeaderName: string;
  zoneName: string;
  requestedAt: string;
  status: RequestStatus;
  approvalSummary: string;
  bulkEligible: boolean;
  canDecide: boolean;
  canOpenTicket: boolean;
  rejectionReason: string | null;
  items: SupervisorReviewItem[];
  ppe: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[];
};

export type AdminUser = {
  id: string;
  displayName: string;
  role: Role;
  active: boolean;
  zoneCode: ZoneCode | null;
  supervisorId: string | null;
  teamName: string | null;
  employeeId: string;
  email: string;
  hasPassword: boolean;
};

/** Sign-in identity. The password is stored only as a hash. */
export type AccountCredential = {
  userId: string;
  employeeId: string;
  email: string;
  passwordHash: string;
};

export type AuthSession = {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type SupervisorProfile = {
  id: string;
  displayName: string;
  active: boolean;
  zoneCode: ZoneCode | null;
  leaders: { id: string; displayName: string; active: boolean }[];
};

export type AdminHome = {
  actor: ActorSummary;
  zones: { code: ZoneCode; name: string; supervisorId: string }[];
  supervisors: { id: string; displayName: string }[];
  supervisorProfiles: SupervisorProfile[];
  unassignedLeaders: { id: string; displayName: string; active: boolean }[];
  users: AdminUser[];
  zoneChanges: ZoneChangeRow[];
};

export type TicketLine = {
  itemCode: string;
  description: string;
  unit: string;
  requested: string;
  /** Supervisor approved quantity. */
  supervisorApproved: string;
  /** Final quantity the store may issue, set by the operation manager. */
  approved: string;
  issued: string;
};

export type Ticket = {
  facility: string;
  title: "MATERIAL ISSUE TICKET";
  ticketNo: string;
  requestNo: string;
  zone: string;
  teamLeader: string;
  supervisor: string;
  storeKeeper: string;
  issueAt: string | null;
  status: RequestStatus;
  notes: string | null;
  lines: TicketLine[];
  lineCount: number;
  ppe: { employeeId: string; itemCode: string; description: string; unit: string; quantity: string; issued: string | null }[];
};

export type LedgerKind = "opening" | "receipt" | "issue" | "adjustment" | "reversal" | "status";

export type LedgerEntry = {
  id: string;
  createdAt: string;
  receiptDate: string | null;
  kind: LedgerKind;
  typeLabel: string;
  quantityChange: string;
  quantityBefore: string;
  quantityAfter: string;
  reference: string | null;
  supplier: string | null;
  teamLeaderName: string | null;
  supervisorName: string | null;
  storeKeeperName: string | null;
  performedByName: string;
  reason: string;
  requestHref: string | null;
  ticketHref: string | null;
  canReverse: boolean;
};

export type MaterialHistory = {
  actor: ActorSummary;
  categories: { id: string; name: string; active: boolean }[];
  material: InventoryMaterial & {
    transactionCount: number;
    canDelete: boolean;
  };
  entries: LedgerEntry[];
};
