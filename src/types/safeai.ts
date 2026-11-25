export type AlertLevel = 'red' | 'orange' | 'green';

export type VoiceRegion = 'auto' | 'bac' | 'trung' | 'nam';

export interface UserAccount {
  phone: string;
  displayName: string;
  isGuest?: boolean;
}

export interface BoundingBox {
  x: number; // 0..1000 normalized left
  y: number; // 0..1000 normalized top
  w: number; // 0..1000 normalized width
  h: number; // 0..1000 normalized height
}

export interface VisualEvidenceItem {
  category: string;
  finding: string;
  severity: 'high' | 'medium' | 'low';
  bbox?: BoundingBox;
}

export interface ExtractedEntities {
  urls: string[];
  phones: string[];
  bankAccounts: string[];
  qrPayload: string;
}

export interface ImageQualityAssessment {
  isClear: boolean;
  note: string;
}

export interface ReceiptForensics {
  isReceiptLike: boolean;
  detectedBank: string;
  anomalies: string[];
}

export interface VietQrInfo {
  isVietQr: boolean;
  crcValid: boolean;
  pointOfInitiation: 'static' | 'dynamic' | 'unknown';
  bankBin: string;
  bankShortName: string;
  bankFullName: string;
  bankHotline: string;
  accountNumber: string;
  amount: number | null;
  amountFormatted: string;
  currencyCode: string;
  purpose: string;
  isPersonalAccount: boolean;
  rawPayload: string;
}

export interface ScanResult {
  id: string;
  sourceMode: 'image' | 'text' | 'audio';
  alertLevel: AlertLevel;
  scamType: string;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  visualEvidence: VisualEvidenceItem[];
  extractedText: string;
  extractedEntities: ExtractedEntities;
  actionSteps: string[];
  imageQuality?: ImageQualityAssessment;
  receiptForensics?: ReceiptForensics;
  vietQr?: VietQrInfo | null;
  familyChallengeTriggered?: boolean;
  impersonationWarning?: string;
  reply: string;
  userContext?: string;
  createdAt: string;
  imagePreviewUrl?: string;
}

export type FamilySyncRole = 'parent' | 'child';

export interface FamilyAlertEvent {
  id: string;
  code: string;
  senderName: string;
  senderRole: FamilySyncRole;
  alertLevel: AlertLevel;
  scamType: string;
  summary: string;
  entitiesSummary?: string;
  createdAt: string;
  acknowledgedBy?: string[];
}

export interface DeepfakeInspectResult {
  analyzedWithAi: boolean;
  riskLevel: AlertLevel;
  summary: string;
  indicators: string[];
  challengeTests: { title: string; instruction: string; whyItWorks: string }[];
}

export interface TrustedContact {
  id: string;
  label: string;
  identifier: string;
  kind: 'trusted' | 'blocked';
  createdAt: string;
}

export interface FamilyChallengeConfig {
  question: string;
  answerHint: string;
}

export interface DiaryEntry {
  id: string;
  createdAt: string;
  sourceMode: 'image' | 'text' | 'audio';
  sourceText: string;
  scamType: string;
  reply: string;
  alertLevel: AlertLevel;
  status: 'moi_ghi_nhan' | 'dang_xu_ly' | 'da_an_toan';
  notes: string;
  checklist: string[];
  situationKey: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  alertLevel?: AlertLevel;
  createdAt: string;
  attachmentSummary?: string;
  imagePreviewUrl?: string;
}

export interface UrlLookupResult {
  url: string;
  normalizedUrl: string;
  hostname: string;
  status: 'safe_signal' | 'suspicious' | 'danger' | 'unverified';
  reasons: string[];
  safeBrowsingChecked: boolean;
  redirectChain?: string[];
  finalUrl?: string;
  hasApkPayload?: boolean;
}

export interface PhoneLookupResult {
  phone: string;
  reportCount: number;
  categories: Record<string, number>;
  communityNote: string;
}

export interface TrainingScenario {
  id: string;
  title: string;
  categoryTag: 'otp' | 'receipt' | 'qr' | 'family';
  prompt: string;
  choices: { text: string; correct: boolean }[];
  lesson: string;
}

export interface TrainingProgress {
  scenarioId: string;
  bestScore: number;
  attempts: number;
  lastCompletedAt: string;
}

export interface BenchmarkCase {
  id: string;
  label: string;
  text: string;
  qrPayload?: string;
  expectedLevel: AlertLevel;
  category: string;
}

export interface BenchmarkReport {
  total: number;
  accuracy: number;
  recall: number;
  precision: number;
  falsePositiveRate: number;
  results: {
    id: string;
    label: string;
    category: string;
    expected: AlertLevel;
    actual: AlertLevel;
    passed: boolean;
  }[];
}
