"use client";

import { toast } from "sonner";
import { Loader2, Zap, Check, CreditCard } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: 0,
    cycle: "forever",
    users: 5,
    storage: "1 GB",
    features: [
      "5 team members",
      "Core CRM & Projects",
      "1 GB storage",
      "Community support",
    ],
    planKey: "FREE",
  },
  {
    name: "Starter",
    price: 29,
    cycle: "month",
    users: 25,
    storage: "10 GB",
    features: [
      "25 team members",
      "All modules",
      "10 GB storage",
      "API access",
      "Email support",
    ],
    planKey: "STARTER",
    popular: false,
  },
  {
    name: "Professional",
    price: 79,
    cycle: "month",
    users: 100,
    storage: "100 GB",
    features: [
      "100 team members",
      "All modules + Workflows",
      "100 GB storage",
      "Advanced analytics",
      "Priority support",
      "SSO",
    ],
    planKey: "PROFESSIONAL",
    popular: true,
  },
  {
    name: "Enterprise",
    price: null,
    cycle: "month",
    users: 999,
    storage: "Unlimited",
    features: [
      "Unlimited members",
      "All modules",
      "Unlimited storage",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
      "On-premise option",
    ],
    planKey: "ENTERPRISE",
  },
];

export default function BillingSettingsPage() {
  const { data: billing, isLoading } = api.settings.billing.get.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const usersPercent = billing
    ? Math.min(100, Math.round((billing.current_users / billing.max_users) * 100))
    : 0;

  const currentPlan = PLANS.find((p) => p.planKey === billing?.plan);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription plan and view usage.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Current Plan</CardTitle>
              <CardDescription>Your workspace is on the {billing?.plan} plan.</CardDescription>
            </div>
            <Badge variant="default" className="text-sm px-3 py-1">
              {billing?.plan}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {billing?.subscription && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium">
                  <Badge
                    variant={
                      billing.subscription.status === "ACTIVE"
                        ? "success"
                        : billing.subscription.status === "PAST_DUE"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {billing.subscription.status}
                  </Badge>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Billing Cycle</p>
                <p className="text-sm font-medium capitalize">
                  {billing.subscription.billing_cycle.toLowerCase()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-sm font-medium">
                  {formatCurrency(Number(billing.subscription.amount), billing.subscription.currency)}
                  /{billing.subscription.billing_cycle === "MONTHLY" ? "mo" : "yr"}
                </p>
              </div>
              {billing.subscription.expires_at && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Next Renewal</p>
                  <p className="text-sm font-medium">
                    {formatDate(billing.subscription.expires_at)}
                  </p>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Usage */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Usage</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Team Members</span>
                <span>
                  {billing?.current_users} / {billing?.max_users}
                </span>
              </div>
              <Progress value={usersPercent} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Upgrade Your Plan</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.planKey === billing?.plan;
            return (
              <Card
                key={plan.name}
                className={
                  plan.popular
                    ? "border-brand-500 ring-1 ring-brand-500/20"
                    : isCurrent
                    ? "border-green-500/50"
                    : ""
                }
              >
                {plan.popular && (
                  <div className="bg-brand-500 text-white text-xs font-semibold text-center py-1 rounded-t-xl -mt-px">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-brand-500" />
                    <CardTitle className="text-sm">{plan.name}</CardTitle>
                  </div>
                  <div className="mt-1">
                    {plan.price === null ? (
                      <p className="text-xl font-bold">Custom</p>
                    ) : plan.price === 0 ? (
                      <p className="text-xl font-bold">Free</p>
                    ) : (
                      <p className="text-xl font-bold">
                        ${plan.price}
                        <span className="text-xs font-normal text-muted-foreground">
                          /mo
                        </span>
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <ul className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="sm"
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() =>
                      toast.info("Billing integration coming soon. Contact sales@zenflow.app")
                    }
                  >
                    {isCurrent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Current Plan
                      </>
                    ) : plan.price === null ? (
                      "Contact Sales"
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment method placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
          <CardDescription>Manage your payment information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CreditCard className="w-5 h-5" />
            <span>No payment method on file.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info("Billing integration coming soon.")}
            >
              Add Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
