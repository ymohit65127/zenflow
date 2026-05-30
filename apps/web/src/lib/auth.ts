import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@zenflow/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logAudit } from '@/lib/audit';
import { redis } from "./redis";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/register",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_ENTRA_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_ENTRA_CLIENT_SECRET!,
      issuer: process.env.MICROSOFT_ENTRA_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.MICROSOFT_ENTRA_TENANT_ID}/v2.0`
        : undefined,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Brute-force protection: rate-limit failed login attempts per email
        const RATE_LIMIT_KEY = `login_fail:${email.toLowerCase()}`;
        const MAX_ATTEMPTS = 5;
        const WINDOW_SECS = 15 * 60; // 15 minutes

        const attempts = await redis.incr(RATE_LIMIT_KEY);
        if (attempts === 1) {
          await redis.expire(RATE_LIMIT_KEY, WINDOW_SECS);
        }

        if (attempts > MAX_ATTEMPTS) {
          const ttl = await redis.ttl(RATE_LIMIT_KEY);
          throw new Error(
            `Too many failed login attempts. Please try again in ${Math.ceil(ttl / 60)} minutes.`
          );
        }

        const user = await prisma.user.findFirst({
          where: { email, deleted_at: null },
        });

        if (!user?.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          void logAudit(prisma, {
            orgId: user.organization_id ?? 'unknown',
            userId: user.id,
            action: 'LOGIN_FAILED',
            resourceType: 'user',
            resourceId: user.id,
          });
          return null;
        }

        // Login succeeded — clear the failed-attempt counter
        await redis.del(RATE_LIMIT_KEY);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            last_login_at: new Date(),
            login_count: { increment: 1 },
          },
        });

        void logAudit(prisma, {
          orgId: user.organization_id ?? 'unknown',
          userId: user.id,
          action: 'LOGIN',
          resourceType: 'user',
          resourceId: user.id,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
          organizationId: user.organization_id,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.organizationId = (user as { organizationId?: string }).organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { organizationId?: string }).organizationId = token.organizationId as string;
      }
      return session;
    },
  },
};

const nextAuth = NextAuth(authConfig);
export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut: typeof nextAuth.signOut = nextAuth.signOut;
