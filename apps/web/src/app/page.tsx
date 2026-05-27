import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap, Shield, Globe, BarChart3, Users, Kanban } from "lucide-react";

export default function HomePage() {
  const features = [
    { icon: Users, title: "CRM", desc: "Manage contacts, leads & deals with smart pipelines" },
    { icon: Kanban, title: "Projects", desc: "Kanban boards, sprints, Gantt charts & time tracking" },
    { icon: BarChart3, title: "Analytics", desc: "Beautiful dashboards with real-time insights" },
    { icon: Zap, title: "Automation", desc: "No-code workflows that run 24/7 without you" },
    { icon: Shield, title: "Help Desk", desc: "SLA-powered ticketing with knowledge base" },
    { icon: Globe, title: "Forms", desc: "Drag-and-drop form builder with conditional logic" },
  ];

  const plans = [
    { name: "Free", price: "$0", features: ["5 users", "5 projects", "Basic CRM", "1GB storage"], highlight: false },
    { name: "Starter", price: "$12", features: ["15 users", "Unlimited projects", "Full CRM", "10GB storage", "Automations"], highlight: false },
    { name: "Professional", price: "$29", features: ["Unlimited users", "All modules", "Advanced analytics", "100GB storage", "Priority support"], highlight: true },
    { name: "Enterprise", price: "Custom", features: ["Custom limits", "SSO/SAML", "Dedicated infra", "SLA guarantee", "White-label"], highlight: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">ZenFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
          <Link
            href="/register"
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 text-brand-500 border border-brand-500/20 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
            <CheckCircle2 className="w-4 h-4" />
            Open-source Zoho alternative · Built for teams
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Everything{" "}
            <span className="gradient-text">Flows.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            ZenFlow is the all-in-one platform that replaces 13+ tools. CRM, Projects,
            HR, Help Desk, Accounting, Automation — beautifully unified.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25"
            >
              Start for free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="border border-border hover:border-brand-500/50 px-8 py-3.5 rounded-xl font-semibold transition-all hover:bg-muted flex items-center justify-center gap-2"
            >
              View demo
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">Free forever · No credit card · 5 minutes to set up</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">One platform. 13 modules.</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything your business needs — no more switching between apps or paying for 13 different subscriptions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-2xl p-6 hover:border-brand-500/50 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-brand-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm">
              + HR Management · Accounting · Inventory · Documents · Team Chat · App Builder
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border transition-all ${
                  plan.highlight
                    ? "border-brand-500 bg-brand-500/5 shadow-lg shadow-brand-500/10 relative"
                    : "border-border bg-card hover:border-brand-500/30"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.price !== "Custom" && <span className="text-muted-foreground text-sm">/user/mo</span>}
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.price === "Custom" ? "/contact" : "/register"}
                  className={`block text-center px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    plan.highlight
                      ? "bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/25"
                      : "border border-border hover:border-brand-500/50 hover:bg-muted"
                  }`}
                >
                  {plan.price === "Custom" ? "Contact sales" : "Get started"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to let everything flow?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join teams already using ZenFlow to streamline their business.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:scale-105 shadow-lg shadow-brand-500/25"
          >
            Get started for free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold gradient-text">ZenFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Mobilise App Lab Private Limited. Built with ❤️ for businesses everywhere.
          </p>
        </div>
      </footer>
    </div>
  );
}
