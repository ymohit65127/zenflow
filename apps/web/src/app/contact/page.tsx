"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, MessageSquare, Building2, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, send to API / CRM
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Message Received!</h1>
          <p className="text-muted-foreground">
            Thanks for reaching out. Our team will get back to you within 24 hours.
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </Link>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-medium">Contact Sales</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left — info */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Talk to our{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                Enterprise team
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Get a custom plan tailored to your organization. Volume pricing, dedicated support,
              custom integrations, and SLA guarantees.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Building2, title: "Custom Deployment", desc: "On-premise or private cloud options" },
              { icon: MessageSquare, title: "Dedicated Support", desc: "24/7 priority support & dedicated CSM" },
              { icon: Mail, title: "Custom Integrations", desc: "Connect to your existing tools & ERP" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-500/10 p-2 mt-0.5">
                  <Icon className="h-5 w-5 text-brand-500" />
                </div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Send us a message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Mohit Yadav"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="mohit@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">How can we help?</Label>
              <Textarea
                id="message"
                placeholder="Tell us about your team size, current tools, and what you're looking for..."
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white">
              Send Message
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            We typically respond within 24 hours on business days.
          </p>
        </div>
      </div>
    </div>
  );
}
