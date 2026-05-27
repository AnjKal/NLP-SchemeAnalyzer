
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Sidebar, SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import {
  HelpCircle,
  LogOut,
  Scale,
  Trash2,
  History as HistoryIcon,
  Search,
  X,
  User as UserIcon,
  ClipboardCheck,
  Workflow,
  FileText,
  UploadCloud,
  Network,
  LayoutGrid,
  GitCompareArrows,
  MessageSquare,
  Download,
  PlusSquare,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Loader2,
  Files,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GradientCard } from '@/components/ui/gradient-card';
import { Input } from '@/components/ui/input';
import Logo from '@/components/logo';
import Faq from '@/components/faq';
import { saveAs } from 'file-saver';
import { useAuth, useUser, type AuthUser } from '@/auth';
import { useRouter } from 'next/navigation';
import type { Document, HistoryItem } from '@/lib/history';
import { useHistory } from '@/hooks/use-history';
import { useDocuments } from '@/hooks/use-documents';

import Chat from '@/components/chat';
import DocumentViewer from '@/components/document-viewer';
import FileUpload from '@/components/file-upload';
import DocumentComparison from '@/components/document-comparison';
import type { DemystifyDocumentOutput } from '@/ai/flows/demystify';
import type { CompareDocumentsOutput } from '@/ai/flows/compare';

import SchemeForm from '@/components/scheme-form';
import SchemeResults from '@/components/scheme-results';
import GraphViewer from '@/components/graph-viewer';
import ProcessingStatus from '@/components/processing-status';
import RightContextPanel from '@/components/right-context-panel';
import {
  evaluateEligibility,
  computeGraphStats,
} from '@/lib/scheme-service';
import {
  INITIAL_PIPELINE,
  type CitizenProfile,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type PipelineStage,
  type SchemeEligibilityResult,
} from '@/lib/scheme-types';

type AppMode =
  | 'eligibility'
  | 'graph-generator'
  | 'chat'
  | 'compare'
  | 'my-documents'
  | 'history'
  | 'faq';
type UploadTab = 'upload' | 'paste' | 'ocr';

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

// --- Sidebar ---------------------------------------------------------------

function AppSidebar({
  onSwitchMode,
  activeMode,
  onNewSession,
  searchQuery,
  setSearchQuery,
  onLogout,
  user,
}: {
  onSwitchMode: (mode: AppMode) => void;
  activeMode: AppMode;
  onNewSession: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onLogout: () => void;
  user: AuthUser | null;
}) {
  const navItems: { mode: AppMode; label: string; icon: typeof ClipboardCheck }[] = [
    { mode: 'eligibility', label: 'Scheme Eligibility', icon: ClipboardCheck },
    { mode: 'graph-generator', label: 'PDF Graph Generator', icon: Workflow },
    { mode: 'chat', label: 'AI Document Helper', icon: FileText },
    { mode: 'compare', label: 'Compare Documents', icon: GitCompareArrows },
    { mode: 'my-documents', label: 'My Documents', icon: LayoutGrid },
    { mode: 'history', label: 'History', icon: HistoryIcon },
    { mode: 'faq', label: 'FAQ / Information', icon: HelpCircle },
  ];

  return (
    <Sidebar className="border-r" collapsible="icon" variant="sidebar">
      <div className="flex h-full flex-col bg-[#111317] text-gray-300">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-700 px-4">
          <Logo className="h-7 w-7 text-primary" />
          <h1 className="font-headline text-xl font-semibold text-white">Vidhik</h1>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-gray-800 border-gray-700 focus:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="flex flex-col gap-2 p-4 pt-0">
            {navItems.map(({ mode, label, icon: Icon }) => (
              <Button
                key={mode}
                variant="ghost"
                className={cn('justify-start gap-3', activeMode === mode ? 'bg-gray-700/50 text-white' : '')}
                onClick={() => onSwitchMode(mode)}
              >
                <Icon className={cn('h-5 w-5', activeMode === mode && 'text-primary')} />
                <span>{label}</span>
              </Button>
            ))}
            <Button variant="ghost" className="justify-start gap-3" onClick={onNewSession}>
              <PlusSquare className="h-5 w-5" />
              <span>New Session</span>
            </Button>
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Card className="bg-gradient-to-br from-orange-400 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-3">
                <Scale />
                <h3 className="text-lg font-semibold">Government Scheme Intelligence</h3>
              </div>
              <p className="text-sm text-orange-100">
                Discover eligible schemes, demystify documents, compare relief options, and explore
                scheme knowledge graphs powered by graph reasoning.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="border-t border-gray-700 p-4 space-y-2">
          {user && (
            <div className="flex items-center gap-3 px-2 text-sm">
              <UserIcon className="h-5 w-5" />
              <span className="truncate" title={user.email || ''}>{user.email}</span>
            </div>
          )}
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={onLogout}>
            <LogOut className="h-5 w-5" />
            <span>Log out</span>
          </Button>
        </div>
      </div>
    </Sidebar>
  );
}

// --- History list (handles all session types) -----------------------------

function historyTitle(item: HistoryItem): string {
  switch (item.type) {
    case 'eligibility':
      return `Eligibility check${item.profile.occupation ? ` · ${item.profile.occupation}` : ''}`;
    case 'graph':
      return `Graph: ${item.document.name}`;
    case 'chat':
      return item.document.name;
    case 'compare':
      return `Compare: ${item.documentA.name} vs ${item.documentB.name}`;
  }
}

function historySubtitle(item: HistoryItem): string {
  switch (item.type) {
    case 'eligibility': {
      const n = item.results?.filter((r) => r.status !== 'Not Eligible').length ?? 0;
      return item.results ? `${n} matched scheme(s)` : 'Awaiting evaluation…';
    }
    case 'graph':
      return item.graph ? `${item.graph.nodes.length} nodes · ${item.graph.edges.length} relationships` : 'Awaiting graph…';
    case 'chat':
      return item.analysis?.summary?.substring(0, 70) ?? 'Awaiting analysis…';
    case 'compare':
      return item.comparison?.summary?.substring(0, 70) ?? 'Awaiting comparison…';
  }
}

function historyIcon(item: HistoryItem) {
  if (item.type === 'eligibility') return ClipboardCheck;
  if (item.type === 'graph') return Network;
  if (item.type === 'compare') return GitCompareArrows;
  return FileText;
}

type HistoryListProps = {
  history: HistoryItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
  searchQuery: string;
  variant?: 'panel' | 'page';
};

function HistoryList({
  history,
  activeSessionId,
  onSelectSession,
  onClearHistory,
  onDeleteItem,
  searchQuery,
  variant = 'panel',
}: HistoryListProps) {
  const q = searchQuery.toLowerCase();
  const filtered = history.filter((item) => historyTitle(item).toLowerCase().includes(q));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">History</h2>
        <span className="text-sm text-muted-foreground">{history.length}</span>
      </div>
      <div
        className={cn(
          'mt-4 flex-1 overflow-y-auto',
          variant === 'page'
            ? 'grid auto-rows-min grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'
            : 'space-y-2'
        )}
      >
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
        {filtered.map((item) => {
          const Icon = historyIcon(item);
          return (
            <div key={item.id} className="group relative">
              <button
                onClick={() => onSelectSession(item.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted',
                  item.id === activeSessionId ? 'bg-muted' : 'bg-card'
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="overflow-hidden">
                  <p className="truncate font-medium">{historyTitle(item)}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{historySubtitle(item)}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item.id);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="mt-4 w-full" disabled={history.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear History
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onClearHistory}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Page ------------------------------------------------------------------

export default function Page() {
  const { user, isLoading: isUserLoading } = useUser();
  const { history, addHistoryItem, updateHistoryItem, deleteHistoryItem, clearHistory } = useHistory(user?.id);
  const allDocuments = useDocuments(user?.id);

  const [mode, setMode] = useState<AppMode>('eligibility');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Eligibility workflow state
  const [eligibilityProfile, setEligibilityProfile] = useState<CitizenProfile | undefined>(undefined);
  const [eligibilityResults, setEligibilityResults] = useState<SchemeEligibilityResult[] | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SchemeEligibilityResult | null>(null);

  // Graph generator workflow state
  type UploadItem = {
    id: string;
    name: string;
    s3Key: string | null;
    status: 'uploading' | 'done' | 'error';
    error?: string;
  };
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(INITIAL_PIPELINE);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Document helper (chat) + compare workflow state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>('ocr');
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);

  const { toast } = useToast();
  const auth = useAuth();
  const router = useRouter();

  const graphStats = useMemo(() => (graph ? computeGraphStats(graph) : null), [graph]);
  const activeSession = history.find((item) => item.id === activeSessionId) || null;

  const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await auth.getIdToken();
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // --- Eligibility handlers ---
  const handleRunEligibility = async (profile: CitizenProfile) => {
    setEligibilityProfile(profile);
    setSelectedResult(null);
    setIsEvaluating(true);
    toast({ title: 'Evaluating eligibility…', description: 'Traversing the scheme graph and generating reasoning.' });
    try {
      const token = await auth.getIdToken();
      const results = await evaluateEligibility(profile, token);
      setEligibilityResults(results);
      if (user) {
        const session: Omit<Extract<HistoryItem, { type: 'eligibility' }>, 'id' | 'createdAt'> = {
          userId: user.id,
          type: 'eligibility',
          profile,
          results,
        };
        const id = await addHistoryItem(session);
        setActiveSessionId(id);
      }
    } catch (e: any) {
      toast({ title: 'Evaluation failed', description: e?.message ?? 'Unknown error.', variant: 'destructive' });
    } finally {
      setIsEvaluating(false);
    }
  };

  // --- Graph generator handlers ---
  const handleFilesSelected = async (files: File[]) => {
    const pdfs = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdfs.length === 0) {
      toast({ title: 'No PDFs found', description: 'Only PDF files can be processed into a graph.', variant: 'destructive' });
      return;
    }

    // Create pending entries immediately so the user sees the list
    const newItems: UploadItem[] = pdfs.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      s3Key: null,
      status: 'uploading' as const,
    }));
    setUploadItems((prev) => [...prev, ...newItems]);
    setGraph(null);
    setSelectedNode(null);
    setPipeline(INITIAL_PIPELINE.map((s) => ({ ...s, status: 'pending' as const })));

    const token = await auth.getIdToken();

    // Upload all PDFs in parallel
    await Promise.all(
      pdfs.map(async (file, i) => {
        const itemId = newItems[i].id;
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/upload-graph-pdf', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const json = await res.json().catch(() => ({ error: 'Upload failed' }));
          if (!res.ok) throw new Error(json.error ?? 'Upload failed');
          setUploadItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, s3Key: json.key, status: 'done' } : it)),
          );
        } catch (e: any) {
          setUploadItems((prev) =>
            prev.map((it) =>
              it.id === itemId ? { ...it, status: 'error', error: e?.message ?? 'Upload failed' } : it,
            ),
          );
        }
      }),
    );

    toast({ title: `${pdfs.length} PDF(s) uploaded`, description: 'Click "Generate Graph" to build the knowledge graph.' });
  };

  const handleGenerateGraph = async () => {
    const readyItems = uploadItems.filter((it) => it.status === 'done' && it.s3Key);
    if (readyItems.length === 0) return;

    setIsProcessing(true);
    setGraph(null);

    // Mark upload stages as already done (files are in S3)
    setPipeline((prev) =>
      prev.map((s, i) => (i <= 1 ? { ...s, status: 'done' as const } : { ...s, status: 'pending' as const })),
    );

    try {
      // Animate stages 2–5 (text extraction → neo4j)
      for (let i = 2; i <= 5; i++) {
        setPipeline((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'running' } : s)));
        await wait(700);
        setPipeline((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)));
      }

      // Stage 6: call the Python backend for each uploaded file
      setPipeline((prev) => prev.map((s, idx) => (idx === 6 ? { ...s, status: 'running' } : s)));

      const token = await auth.getIdToken();
      const results = await Promise.allSettled(
        readyItems.map((it) =>
          fetch('/api/generate-graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ s3Key: it.s3Key }),
          }).then(async (r) => {
            if (!r.ok) {
              const e = await r.json().catch(() => ({ error: 'Generation failed' }));
              throw new Error(e.error ?? 'Graph generation failed');
            }
            return r.json() as Promise<GraphData>;
          }),
        ),
      );

      // Merge all successful graphs (dedup nodes and edges by id)
      const mergedNodes = new Map<string, GraphNode>();
      const mergedEdges = new Map<string, GraphEdge>();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const g = result.value;
        for (const n of g.nodes ?? []) mergedNodes.set(n.id, n);
        for (const e of g.edges ?? []) mergedEdges.set(e.id, e);
      }

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (mergedNodes.size === 0) throw new Error('All graph generation requests failed.');

      const merged: GraphData = {
        nodes: [...mergedNodes.values()],
        edges: [...mergedEdges.values()],
      };

      setPipeline((prev) => prev.map((s, idx) => (idx === 6 ? { ...s, status: 'done' } : s)));
      setGraph(merged);

      if (user) {
        const docName = readyItems.map((it) => it.name).join(', ');
        const session: Omit<Extract<HistoryItem, { type: 'graph' }>, 'id' | 'createdAt'> = {
          userId: user.id,
          type: 'graph',
          document: { name: docName, url: '', mimeType: 'application/pdf' },
          graph: merged,
        };
        const id = await addHistoryItem(session);
        setActiveSessionId(id);
      }

      const desc = `${merged.nodes.length} entities · ${merged.edges.length} relationships · ${readyItems.length - failed} of ${readyItems.length} file(s) processed.`;
      toast({ title: 'Graph generated', description: desc });
      if (failed > 0) {
        toast({ title: `${failed} file(s) failed`, description: 'Check server logs for details.', variant: 'destructive' });
      }
    } catch (e: any) {
      setPipeline((prev) => prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)));
      toast({ title: 'Graph generation failed', description: e?.message ?? 'Unknown error.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Document helper (chat / demystify) handlers ---
  const handleDocumentSelect = async (document: Document) => {
    if (!user) return;
    const newSession: Omit<Extract<HistoryItem, { type: 'chat' }>, 'id' | 'createdAt'> = {
      userId: user.id,
      type: 'chat',
      document,
      analysis: null,
      messages: [],
    };
    const newId = await addHistoryItem(newSession);
    setMode('chat');
    setActiveSessionId(newId);
  };

  const handleDemystify = async () => {
    if (!activeSession || activeSession.type !== 'chat') return;
    setIsAnalyzing(true);
    toast({ title: 'Analyzing Document...', description: 'This may take a moment. Please wait.' });
    try {
      const res = await authFetch('/api/demystify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: activeSession.document }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Demystify failed');
      const result = json as DemystifyDocumentOutput;
      await updateHistoryItem(activeSession.id, { analysis: result });
    } catch (e: any) {
      toast({
        title: 'Analysis Failed',
        description: `Server returned: ${e.message || 'An unknown error occurred during analysis.'}`,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRiskLevelChange = async (clauseIndex: number, newRiskLevel: 'High' | 'Medium' | 'Low') => {
    if (!activeSession || activeSession.type !== 'chat' || !activeSession.analysis) return;
    const updatedAnalysis = {
      ...activeSession.analysis,
      riskAnalysis: activeSession.analysis.riskAnalysis.map((risk, index) =>
        index === clauseIndex ? { ...risk, riskLevel: newRiskLevel } : risk
      ),
    };
    await updateHistoryItem(activeSession.id, { analysis: updatedAnalysis });
  };

  // --- Compare handlers ---
  const handleComparisonComplete = async (
    documentA: Document,
    documentB: Document,
    comparison: CompareDocumentsOutput
  ) => {
    if (!user) return;
    const newSession: Omit<Extract<HistoryItem, { type: 'compare' }>, 'id' | 'createdAt'> = {
      userId: user.id,
      type: 'compare',
      documentA,
      documentB,
      comparison,
    };
    const newId = await addHistoryItem(newSession);
    setActiveSessionId(newId);
  };

  // --- My Documents handlers ---
  const handleDownload = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const downloadUrl = doc.s3Key
        ? (
            await authFetch('/api/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: doc.s3Key }),
            }).then((r) => r.json())
          ).url
        : doc.url;

      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      saveAs(blob, doc.name);
      toast({ title: 'Download Started', description: `${doc.name} is being downloaded.` });
    } catch (error) {
      toast({ title: 'Download Failed', description: 'Could not download the document.', variant: 'destructive' });
    }
  };

  // --- Session/history handlers ---
  const handleSwitchMode = (newMode: AppMode) => {
    setMode(newMode);
    setIsChatVisible(false);
  };

  const handleNewSession = () => setIsNewSessionDialogOpen(true);

  const handleStartNewSession = (newMode: AppMode) => {
    setMode(newMode);
    setActiveSessionId(null);
    setIsNewSessionDialogOpen(false);
    setIsChatVisible(false);
    if (newMode === 'graph-generator') {
      setUploadItems([]);
      setGraph(null);
      setSelectedNode(null);
      setPipeline(INITIAL_PIPELINE);
    }
  };

  const handleSelectSession = (id: string) => {
    const s = history.find((x) => x.id === id);
    if (!s) return;
    setActiveSessionId(id);
    if (s.type === 'eligibility') {
      setMode('eligibility');
      setEligibilityProfile(s.profile);
      setEligibilityResults(s.results);
      setSelectedResult(null);
    } else if (s.type === 'graph') {
      setMode('graph-generator');
      setUploadItems(
        s.document
          ? [{ id: 'history-0', name: s.document.name, s3Key: null, status: 'done' as const }]
          : [],
      );
      setGraph(s.graph);
      setSelectedNode(null);
      setPipeline(
        s.graph
          ? INITIAL_PIPELINE.map((stage) => ({ ...stage, status: 'done' as const }))
          : INITIAL_PIPELINE,
      );
    } else if (s.type === 'chat') {
      setMode('chat');
      setIsChatVisible(!!s.analysis);
    } else if (s.type === 'compare') {
      setMode('compare');
    }
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setActiveSessionId(null);
    toast({ title: 'History Cleared', description: 'Your session history has been deleted.' });
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await deleteHistoryItem(id);
    if (activeSessionId === id) setActiveSessionId(null);
    toast({ title: 'Session Deleted', description: 'The selected session has been removed.' });
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      toast({ title: 'Logout Failed', description: 'An error occurred during logout.', variant: 'destructive' });
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // --- View renderers (invoked as functions to preserve child state) ---

  const renderHistoryAside = () => (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-card p-4 lg:flex">
      <HistoryList
        history={history}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onClearHistory={handleClearHistory}
        onDeleteItem={handleDeleteHistoryItem}
        searchQuery={searchQuery}
        variant="panel"
      />
    </aside>
  );

  const renderEligibility = () => (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">Scheme Eligibility &amp; Recommendation</h1>
        </header>
        <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
          <GradientCard className="flex h-full min-h-0 flex-col">
            <SchemeForm
              initialProfile={eligibilityProfile}
              isLoading={isEvaluating}
              onSubmit={handleRunEligibility}
            />
          </GradientCard>
          <GradientCard className="flex h-full min-h-0 flex-col">
            <ScrollArea className="h-full">
              <div className="p-5">
                {isEvaluating ? (
                  <div className="flex h-full flex-col items-center justify-center py-20 text-center text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="mt-4 text-sm">Traversing scheme graph &amp; generating reasoning…</p>
                  </div>
                ) : (
                  <SchemeResults results={eligibilityResults} onInspect={setSelectedResult} />
                )}
              </div>
            </ScrollArea>
          </GradientCard>
        </main>
      </div>
      <RightContextPanel mode="eligibility" result={selectedResult} />
    </div>
  );

  const renderGraphGenerator = () => {
    const readyCount = uploadItems.filter((it) => it.status === 'done' && it.s3Key).length;
    const hasUploading = uploadItems.some((it) => it.status === 'uploading');
    const showPipeline = pipeline.some((s) => s.status !== 'pending');

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) handleFilesSelected(files);
      e.target.value = '';
    };

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFilesSelected(files);
    };

    return (
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
            <h1 className="text-lg font-semibold">PDF → Knowledge Graph Generator</h1>
          </header>
          <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_1fr]">
            <GradientCard className="flex h-full min-h-0 flex-col">
              <ScrollArea className="h-full">
                <div className="space-y-4 p-5">
                  {/* Drop zone */}
                  <div
                    className={cn(
                      'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                      isProcessing ? 'pointer-events-none opacity-60' : 'hover:border-primary/50',
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                  >
                    <UploadCloud className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="mt-2 font-headline text-sm font-semibold">
                      Drag &amp; drop PDFs here
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      or choose files / a folder below
                    </p>

                    {/* Hidden file inputs */}
                    <Input
                      id="pdf-graph-upload"
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      className="sr-only"
                      disabled={isProcessing}
                      onChange={onFileInputChange}
                    />
                    <input
                      ref={(el) => {
                        if (el) {
                          el.setAttribute('webkitdirectory', '');
                          el.setAttribute('directory', '');
                        }
                      }}
                      id="pdf-folder-upload"
                      type="file"
                      accept=".pdf"
                      className="sr-only"
                      disabled={isProcessing}
                      onChange={onFileInputChange}
                    />

                    <div className="mt-4 flex gap-2 justify-center">
                      <label
                        htmlFor="pdf-graph-upload"
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted',
                          isProcessing && 'pointer-events-none opacity-50',
                        )}
                      >
                        <Files className="h-3.5 w-3.5" />
                        Select PDFs
                      </label>
                      <label
                        htmlFor="pdf-folder-upload"
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted',
                          isProcessing && 'pointer-events-none opacity-50',
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Select Folder
                      </label>
                    </div>
                  </div>

                  {/* Uploaded file list */}
                  {uploadItems.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {uploadItems.length} file(s)
                      </p>
                      {uploadItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="flex-1 truncate text-xs" title={item.name}>
                            {item.name}
                          </span>
                          {item.status === 'uploading' && (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                          )}
                          {item.status === 'done' && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          )}
                          {item.status === 'error' && (
                            <span title={item.error}>
                              <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            </span>
                          )}
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setUploadItems((prev) => prev.filter((it) => it.id !== item.id))
                            }
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pipeline stages — shown only during / after graph generation */}
                  {showPipeline && <ProcessingStatus stages={pipeline} />}

                  {/* Generate Graph button */}
                  {readyCount > 0 && !isProcessing && (
                    <Button onClick={handleGenerateGraph} className="w-full">
                      <Workflow className="mr-2 h-4 w-4" />
                      Generate Graph{readyCount > 1 ? ` (${readyCount} files)` : ''}
                    </Button>
                  )}

                  {hasUploading && (
                    <p className="text-center text-xs text-muted-foreground">
                      Uploading… please wait
                    </p>
                  )}

                  {/* Clear all button */}
                  {uploadItems.length > 0 && !isProcessing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setUploadItems([]);
                        setGraph(null);
                        setSelectedNode(null);
                        setPipeline(INITIAL_PIPELINE);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Clear All
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </GradientCard>

            <GradientCard className="flex h-full min-h-0 flex-col">
              {graph ? (
                <GraphViewer
                  graph={graph}
                  selectedNodeId={selectedNode?.id ?? null}
                  onNodeClick={(n) => setSelectedNode((cur) => (cur?.id === n.id ? null : n))}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Network className="h-12 w-12" />
                  <h2 className="mt-4 text-lg font-semibold text-foreground">No graph yet</h2>
                  <p className="mt-1 max-w-sm text-sm">
                    Upload one or more scheme PDFs, then click "Generate Graph" to explore the
                    combined knowledge graph.
                  </p>
                </div>
              )}
            </GradientCard>
          </main>
        </div>
        <RightContextPanel
          mode="graph"
          graph={graph}
          stats={graphStats}
          selectedNode={selectedNode}
          onSelectNode={(id) => {
            const n = graph?.nodes.find((x) => x.id === id) ?? null;
            setSelectedNode(n);
          }}
        />
      </div>
    );
  };

  const AnalysisLoadingSkeleton = () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-6 h-8 w-1/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">AI Document Helper</h1>
          <div className="flex items-center gap-2">
            {activeSession?.type === 'chat' && activeSession.analysis && (
              <Button variant="ghost" size="icon" onClick={() => setIsChatVisible(!isChatVisible)}>
                <MessageSquare className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
              <HistoryIcon className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className={cn('grid flex-1 gap-4 overflow-hidden p-4', isChatVisible ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
          <GradientCard className="flex h-full min-h-0 flex-col">
            {!activeSession && (
              <FileUpload onDocumentSelect={handleDocumentSelect} activeTab={uploadTab} onTabChange={setUploadTab} />
            )}
            {activeSession?.type === 'chat' && !activeSession.analysis && !isAnalyzing && (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 font-headline text-lg font-semibold">{activeSession.document.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">Ready to be demystified.</p>
                <Button onClick={handleDemystify} className="mt-6">
                  Demystify Document
                </Button>
              </div>
            )}
            {isAnalyzing && (
              <div className="p-4">
                <h2 className="mb-2 text-lg font-semibold">Analyzing...</h2>
                <AnalysisLoadingSkeleton />
              </div>
            )}
            {activeSession?.type === 'chat' && activeSession.analysis && !isAnalyzing && (
              <DocumentViewer
                document={activeSession.document}
                analysis={activeSession.analysis}
                onRiskLevelChange={handleRiskLevelChange}
              />
            )}
          </GradientCard>
          {isChatVisible && (
            <GradientCard className="hidden h-full min-h-0 flex-col md:flex">
              <Chat
                key={activeSessionId}
                session={activeSession?.type === 'chat' ? activeSession : null}
                searchQuery={searchQuery}
                onMessagesChange={(messages) => {
                  if (activeSessionId !== null && activeSession?.type === 'chat') {
                    updateHistoryItem(activeSessionId, { messages });
                  }
                }}
              />
            </GradientCard>
          )}
        </main>
      </div>
      {isHistoryVisible && renderHistoryAside()}
    </div>
  );

  const renderCompare = () => (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">Compare Documents</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
            <HistoryIcon className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <DocumentComparison
            session={activeSession?.type === 'compare' ? activeSession : null}
            onComparisonComplete={handleComparisonComplete}
          />
        </main>
      </div>
      {isHistoryVisible && renderHistoryAside()}
    </div>
  );

  const renderMyDocuments = () => {
    const filteredDocuments = allDocuments.filter((doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <h1 className="text-lg font-semibold">My Documents</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {filteredDocuments.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredDocuments.map((doc, index) => (
                <Card key={index} className="flex flex-col transition-shadow hover:shadow-lg">
                  <CardHeader className="flex-row items-start gap-4 space-y-0 pb-2">
                    <FileText className="mt-1 h-8 w-8 text-primary" />
                    <CardTitle
                      className="flex-1 cursor-pointer truncate text-base font-medium"
                      title={doc.name}
                      onClick={() => handleDocumentSelect(doc)}
                    >
                      {doc.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent
                    className="flex-1 cursor-pointer text-sm text-muted-foreground"
                    onClick={() => handleDocumentSelect(doc)}
                  >
                    <p className="line-clamp-3">
                      {doc.summary || 'Click to open this document in the AI Document Helper.'}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-4">
                    <Button variant="outline" size="sm" className="w-full" onClick={(e) => handleDownload(doc, e)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <LayoutGrid className="h-12 w-12" />
              <h2 className="mt-6 text-xl font-semibold">
                {searchQuery ? 'No Matching Documents' : 'No Documents Found'}
              </h2>
              <p className="mt-2">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Start by uploading a document in the "AI Document Helper" to see it here.'}
              </p>
            </div>
          )}
        </main>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold">History</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <HistoryList
          history={history}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onClearHistory={handleClearHistory}
          onDeleteItem={handleDeleteHistoryItem}
          searchQuery={searchQuery}
          variant="page"
        />
      </main>
    </div>
  );

  const renderFaq = () => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold">Information &amp; FAQ</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <Faq onStartSession={handleNewSession} />
        </div>
      </main>
    </div>
  );

  const renderContent = () => {
    switch (mode) {
      case 'eligibility':
        return renderEligibility();
      case 'graph-generator':
        return renderGraphGenerator();
      case 'chat':
        return renderChat();
      case 'compare':
        return renderCompare();
      case 'my-documents':
        return renderMyDocuments();
      case 'history':
        return renderHistory();
      case 'faq':
        return renderFaq();
      default:
        return renderEligibility();
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <AppSidebar
          onSwitchMode={handleSwitchMode}
          activeMode={mode}
          onNewSession={handleNewSession}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onLogout={handleLogout}
          user={user}
        />
        <SidebarInset>{renderContent()}</SidebarInset>
        <Dialog open={isNewSessionDialogOpen} onOpenChange={setIsNewSessionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a new session</DialogTitle>
              <DialogDescription>Choose the type of session you would like to begin.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <Button variant="outline" className="h-20 flex-col" onClick={() => handleStartNewSession('chat')}>
                <FileText className="mb-2 h-6 w-6" />
                AI Document Helper
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => handleStartNewSession('compare')}>
                <GitCompareArrows className="mb-2 h-6 w-6" />
                Compare Documents
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => handleStartNewSession('eligibility')}>
                <ClipboardCheck className="mb-2 h-6 w-6" />
                Scheme Eligibility
              </Button>
              <Button variant="outline" className="h-20 flex-col" onClick={() => handleStartNewSession('graph-generator')}>
                <Workflow className="mb-2 h-6 w-6" />
                PDF Graph Generator
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
