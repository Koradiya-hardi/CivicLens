// Shapes returned by the Week 5 backend endpoints.

export const CATEGORIES = [
  "Transportation",
  "Housing",
  "Student Services",
  "Financial Aid",
  "Healthcare",
  "Immigration",
  "Taxes",
  "Other",
] as const;

export interface ResourceSummary {
  _id: string;
  title: string;
  category: string;
  description: string;
}

/** One row from GET /api/search/resources (already one-per-document). */
export interface SearchHit {
  resourceId: string;
  title: string;
  category: string;
  description: string;
  snippet: string; // the passage that matched
  score: number; // 0..1, higher = closer in meaning
}

export interface DeadlineItem {
  _id: string;
  title: string;
  dueDate: string; // ISO string, midnight UTC
  note?: string;
  completed: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface DashboardData {
  stats: { savedCount: number; conversationCount: number };
  recentConversations: ConversationSummary[];
  savedResources: ResourceSummary[];
  deadlines: DeadlineItem[];
}

// ───────────────────────── Week 6: admin panel ─────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  conversationCount: number;
  lastActiveAt: string | null;
  isSelf: boolean; // true on the signed-in admin's own row
}

export interface AdminResource {
  id: string;
  title: string;
  category: string;
  description: string;
  isPublished: boolean;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  sourceUrl: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  searchable: boolean; // published AND has search chunks
}

export interface Paged<T> {
  total: number;
  page: number;
  pages: number;
  items: T[];
}

export interface AnalyticsData {
  windowDays: number;
  since: string;
  generatedAt: string;
  totals: {
    users: number;
    admins: number;
    publishedResources: number;
    draftResources: number;
    chunks: number;
    conversations: number;
    messages: number;
    savedResources: number;
    deadlines: number;
  };
  usage: {
    questions: number;
    searches: number;
    answered: number;
    noAnswer: number;
    answerRate: number | null; // 0..1, null when no questions yet
    activeUsers: number;
    newUsers: number;
  };
  series: { date: string; questions: number; searches: number }[];
  topQueries: { query: string; count: number; lastAsked: string; avgScore: number | null; answeredRate: number }[];
  topCategories: { category: string; count: number }[];
  unanswered: { query: string; count: number; lastAsked: string; bestScore: number | null }[];
}

export type HealthStatus = "healthy" | "degraded" | "down";

export interface SystemHealth {
  status: HealthStatus;
  issues: string[];
  checkedAt: string;
  api: {
    status: string;
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
    memoryMB: { rss: number; heapUsed: number };
  };
  database: { status: string; latencyMs: number | null; name: string | null; detail?: string };
  vectorIndex: {
    name: string;
    status: "ready" | "building" | "failed" | "missing" | "unknown";
    queryable: boolean;
    numDimensions: number | null;
    expectedDimensions: number;
    detail?: string;
  };
  embeddings: { model: string; dimensions: number; status: string };
  llm: { provider: string; model: string; configured: boolean };
  content: {
    publishedResources: number;
    draftResources: number;
    publishedWithoutChunks: number;
    orphanChunks: number;
    orphanSaves: number;
  };
}
