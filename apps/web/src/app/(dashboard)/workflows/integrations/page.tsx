"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  X,
  Loader2,
  Plug,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Integration catalog
// ─────────────────────────────────────────────────────────────────────────────

interface IntegrationCatalogItem {
  provider: string;
  name: string;
  description: string;
  color: string;
  initial: string;
  category: string;
  comingSoon?: boolean;
}

const INTEGRATIONS: IntegrationCatalogItem[] = [
  {
    provider: "slack",
    name: "Slack",
    description: "Send notifications and messages to Slack channels and users",
    color: "#4A154B",
    initial: "S",
    category: "Communication",
  },
  {
    provider: "google_workspace",
    name: "Google Workspace",
    description: "Sync with Google Calendar, Gmail, Drive, and Sheets",
    color: "#4285F4",
    initial: "G",
    category: "Productivity",
  },
  {
    provider: "microsoft_teams",
    name: "Microsoft Teams",
    description: "Post to Teams channels and trigger workflows from chats",
    color: "#5059C9",
    initial: "T",
    category: "Communication",
  },
  {
    provider: "zapier",
    name: "Zapier",
    description:
      "Connect to 5,000+ apps via Zapier to extend your automations",
    color: "#FF4A00",
    initial: "Z",
    category: "Automation",
  },
  {
    provider: "github",
    name: "GitHub",
    description: "Trigger workflows from pull requests, issues, and commits",
    color: "#181717",
    initial: "GH",
    category: "Development",
  },
  {
    provider: "stripe",
    name: "Stripe",
    description:
      "Automate payment events, invoice generation, and subscription changes",
    color: "#635BFF",
    initial: "St",
    category: "Finance",
  },
  {
    provider: "razorpay",
    name: "Razorpay",
    description:
      "Trigger workflows on Indian payment events and settlements",
    color: "#3395FF",
    initial: "R",
    category: "Finance",
  },
  {
    provider: "twilio",
    name: "Twilio",
    description: "Send SMS, WhatsApp messages, and make voice calls",
    color: "#F22F46",
    initial: "Tw",
    category: "Communication",
  },
  {
    provider: "sendgrid",
    name: "SendGrid",
    description: "Send transactional and marketing emails at scale",
    color: "#1A82E2",
    initial: "SG",
    category: "Email",
  },
  {
    provider: "mailchimp",
    name: "Mailchimp",
    description: "Sync contacts and trigger email campaigns automatically",
    color: "#FFE01B",
    initial: "MC",
    category: "Email",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const utils = api.useUtils();

  const { data: connected = [] } = api.workflows.integrations.list.useQuery({});

  const disconnectMutation = api.workflows.integrations.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Integration disconnected");
      void utils.workflows.integrations.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const connectMutation = api.workflows.integrations.connect.useMutation({
    onSuccess: () => {
      toast.success("Integration connected");
      void utils.workflows.integrations.list.invalidate();
      setConnectingProvider(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);

  const connectedMap = new Map(
    connected.map((c) => [c.provider, c])
  );

  function handleConnect(item: IntegrationCatalogItem) {
    setConnectingProvider(item.provider);
    setApiKey("");
  }

  function submitConnect() {
    const item = INTEGRATIONS.find((i) => i.provider === connectingProvider);
    if (!item) return;
    connectMutation.mutate({
      provider: item.provider,
      name: item.name,
      credentials: { api_key: apiKey },
    });
  }

  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect external services to power your automations
          </p>
        </div>
      </div>

      {/* Connected count */}
      {connected.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">
            <span className="font-semibold">{connected.length}</span> integration
            {connected.length !== 1 ? "s" : ""} connected
          </p>
        </div>
      )}

      {/* Integration cards by category */}
      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {INTEGRATIONS.filter((i) => i.category === cat).map((item) => {
              const conn = connectedMap.get(item.provider);
              const isConnected = !!conn && conn.status !== "DISCONNECTED";
              return (
                <div
                  key={item.provider}
                  className={cn(
                    "bg-card border rounded-2xl p-5 transition-all",
                    isConnected
                      ? "border-green-500/30 shadow-green-500/5 shadow-md"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-start gap-3 mb-4">
                    {/* Logo placeholder */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        {isConnected && (
                          <span className="text-xs text-green-600 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Connected
                          </span>
                        )}
                        {conn?.status === "ERROR" && (
                          <span className="text-xs text-red-600 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Error
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {isConnected ? (
                    <button
                      onClick={() =>
                        disconnectMutation.mutate({ id: conn!.id })
                      }
                      disabled={disconnectMutation.isPending}
                      className="w-full text-xs border border-border hover:border-red-500/30 hover:text-red-500 rounded-lg py-1.5 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(item)}
                      className="w-full text-xs bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 border border-brand-500/20 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plug className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Connect dialog */}
      {connectingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {(() => {
              const item = INTEGRATIONS.find(
                (i) => i.provider === connectingProvider
              );
              if (!item) return null;
              return (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.initial}
                      </div>
                      <h2 className="font-semibold">Connect {item.name}</h2>
                    </div>
                    <button
                      onClick={() => setConnectingProvider(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        API Key / Token
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key…"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your credentials are encrypted and stored securely.
                    </p>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => setConnectingProvider(null)}
                      className="flex-1 border border-border hover:bg-muted rounded-lg py-2 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitConnect}
                      disabled={!apiKey.trim() || connectMutation.isPending}
                      className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {connectMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Connect
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Coming soon dialog */}
      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <Plug className="w-7 h-7 text-brand-500" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Coming Soon</h2>
            <p className="text-muted-foreground text-sm mb-5">
              The {showComingSoon} integration is being built and will be
              available soon.
            </p>
            <button
              onClick={() => setShowComingSoon(null)}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
