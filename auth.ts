import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { AdapterUser } from "@auth/core/adapters";
import type { OIDCConfig } from "@auth/core/providers/oauth";
import { prisma } from "@/lib/prisma";
import { JWT_MAX_AGE_DAYS } from "@/lib/constants";

const prismaAdapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: {
    ...prismaAdapter,
    async createUser(user) {
      return (await prisma.user.create({
        data: {
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          emailVerified: user.emailVerified ?? null,
          slackId: (user as { slackId?: string }).slackId ?? null,
          hcaId: (user as { hcaId?: string }).hcaId ?? null,
        },
      })) as unknown as AdapterUser;
    },
    async updateUser(user) {
      // Only touch fields the caller actually provided — a partial update
      // must never null out slackId/hcaId/image.
      const data: Record<string, unknown> = {};
      if (user.name !== undefined) data.name = user.name;
      if (user.email !== undefined) data.email = user.email;
      if (user.image !== undefined) data.image = user.image;
      if (user.emailVerified !== undefined) data.emailVerified = user.emailVerified;
      const extra = user as { slackId?: string | null; hcaId?: string | null };
      if (extra.slackId !== undefined) data.slackId = extra.slackId;
      if (extra.hcaId !== undefined) data.hcaId = extra.hcaId;
      return (await prisma.user.update({
        where: { id: user.id! },
        data,
      })) as unknown as AdapterUser;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: JWT_MAX_AGE_DAYS * 24 * 60 * 60,
  },
  // Behind Caddy in production; remove if ever exposed directly.
  trustHost: true,
  providers: [
    {
      id: "hackclub",
      name: "Hack Club",
      type: "oidc",
      issuer: "https://auth.hackclub.com",
      // Single trusted IdP whose emails are verified (enforced in profile()
      // below: an unverified email means no email at all). If a second
      // provider is ever added, this MUST become false.
      allowDangerousEmailAccountLinking: true,
      clientId: process.env.AUTH_HCA_CLIENT_ID,
      clientSecret: process.env.AUTH_HCA_CLIENT_SECRET,
      authorization: {
        params: { scope: "openid profile email name slack_id" },
      },
      token: "https://auth.hackclub.com/oauth/token",
      userinfo: "https://auth.hackclub.com/api/v1/me",
      profile(profile) {
        const p = profile as Record<string, unknown>;
        const sub = typeof p.sub === "string" && p.sub ? p.sub : null;
        if (!sub) {
          // Never fall back to a shared id like "0" — that would funnel every
          // malformed login into one account.
          throw new Error("OIDC profile missing subject claim (sub)");
        }
        const emailVerified = p.email_verified === true;
        return {
          id: sub,
          name: (p.name as string) ?? null,
          // Unverified emails are dropped so account linking can only ever
          // happen on identity the IdP has confirmed.
          email: emailVerified ? ((p.email as string) ?? null) : null,
          emailVerified: emailVerified ? new Date() : null,
          image: (p.avatar as string) ?? (p.picture as string) ?? null,
          slackId: (p.slack_id as string) ?? null,
          hcaId: sub,
        };
      },
    } satisfies OIDCConfig<Record<string, unknown>>,
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const slackId = (user as { slackId?: string | null }).slackId;
        if (slackId !== undefined) token.slackId = slackId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      if (session.user) {
        session.user.slackId = (token.slackId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  events: {
    // OAuth sign-ins don't run the adapter's updateUser, so existing rows keep
    // stale/null profile data. Refresh HCA-linked fields on every login.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "hackclub") return;
      try {
        const p = profile as Record<string, unknown>;
        const slackId = typeof p.slack_id === "string" ? p.slack_id : null;
        const emailVerified = p.email_verified === true ? new Date() : null;
        if (!slackId && !emailVerified) return;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(slackId ? { slackId } : {}),
            ...(emailVerified ? { emailVerified } : {}),
          },
        });
      } catch (e) {
        // Bookkeeping must never break sign-in.
        console.warn("[auth] post-signIn profile refresh failed:", e);
      }
    },
  },
});
