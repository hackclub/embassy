import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decryptPII, decryptPIIFields, PII_FIELDS } from "@/lib/encryption";
import { recipientDetailsEnabled } from "@/lib/flags";
import RecipientLayout from "./_components/RecipientLayout";
import RecipientProgressTracker from "./_components/RecipientProgressTracker";
import RecipientStep from "./_components/RecipientStep";

// Token-bearing URL exposes recipient PII — keep it out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const STEPS = [
  { step: "name", label: "Your name", href: "/name" },
  { step: "email", label: "Email address", href: "/email" },
  { step: "address", label: "Shipping address", href: "/address" },
  { step: "photo", label: "Passport photo", href: "/photo" },
  { step: "emergency", label: "Emergency contact", href: "/emergency" },
  { step: "review", label: "Review & submit", href: "/review" },
];

type StepKey = (typeof STEPS)[number]["step"];

interface OrderWithRelations {
  id: string;
  currentState: string;
  recipientToken: string;
  recipientName: string | null;
  recipientEmail: string | null;
  org: { name: string };
  ysws: { name: string } | null;
  recipients: Array<{
    id: string;
    name: string | null;
    email: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateProvince: string | null;
    postalCode: string | null;
    country: string | null;
    dateOfBirth: Date | null;
    emergencyContact: string | null;
    photoUrl: string | null;
  }>;
}

async function getOrder(token: string): Promise<OrderWithRelations | null> {
  const order = await prisma.passportOrder.findUnique({
    where: { recipientToken: token },
    include: { org: true, ysws: true, recipients: true },
  });
  return order as OrderWithRelations | null;
}

export default async function RecipientRootPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!recipientDetailsEnabled()) {
    redirect(`/track/${token}`);
  }
  const order = await getOrder(token);

  if (!order) {
    notFound();
  }

  if (order.currentState !== "AWAITING_RECIPIENT_DETAILS") {
    redirect(`/track/${token}`);
  }

  const rawRecipient = order.recipients[0] ?? {
    id: "",
    name: null,
    email: order.recipientEmail ?? "",
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateProvince: null,
    postalCode: null,
    country: null,
    dateOfBirth: null,
    emergencyContact: null,
    photoUrl: null,
  };
  const recipient = await decryptPIIFields(
    rawRecipient as unknown as Record<string, unknown>,
    PII_FIELDS
  ) as OrderWithRelations["recipients"][number];
  // photoUrl is an encrypted data URL (not part of PII_FIELDS).
  const photoDataUrl = recipient.photoUrl ? await decryptPII(recipient.photoUrl) : null;
  const completedSteps = [
    recipient.name ? "name" : null,
    recipient.email ? "email" : null,
    recipient.addressLine1 ? "address" : null,
    photoDataUrl ? "photo" : null,
    recipient.emergencyContact ? "emergency" : null,
  ].filter(Boolean) as StepKey[];

  return (
    <RecipientLayout order={order} token={token}>
      <RecipientProgressTracker steps={STEPS} completedSteps={completedSteps as StepKey[]} currentStep={null} />
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <RecipientStep
            token={token}
            order={order}
            recipient={{ ...recipient, photoUrl: photoDataUrl }}
            completedSteps={completedSteps as StepKey[]}
          />
        </div>
      </div>
    </RecipientLayout>
  );
}