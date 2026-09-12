"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";
import { encryptPII } from "@/lib/encryption";
import { recipientDetailsEnabled } from "@/lib/flags";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { deliverOrderEmail } from "@/lib/services/email.service";
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } from "@/lib/constants";

const nameSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
});

const emailSchema = z.object({
  recipientEmail: z.string().email("Enter a valid email address").max(254),
});

const addressSchema = z.object({
  addressLine1: z.string().trim().min(2, "Enter address line 1").max(100, "Address line 1 is too long"),
  addressLine2: z.string().trim().max(100, "Address line 2 is too long").optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter city").max(60, "City name is too long"),
  stateProvince: z.string().trim().max(60, "State/province is too long").optional().or(z.literal("")),
  postalCode: z.string().trim().min(3, "Enter postal code").max(20, "Postal code is too long"),
  country: z.string().length(2, "Select a country"),
});

const emergencySchema = z.object({
  emergencyContact: z.string().trim().max(200, "Emergency contact is too long").optional().or(z.literal("")),
});

export type RecipientFormState = { error?: string; ok?: boolean; nextStep?: string } | undefined;

function getOrderByToken(token: string) {
  return prisma.passportOrder.findUnique({
    where: { recipientToken: token },
    include: { recipients: true },
  });
}

async function validateToken(token: string) {
  if (!recipientDetailsEnabled()) {
    return { error: "The recipient details form is currently closed. Please try again later or email passports@hackclub.com." };
  }
  // Bound token-guessing / abuse on this public, unauthenticated surface.
  const h = await headers();
  const rl = await rateLimit(
    { headers: h as unknown as Headers } as Request,
    RATE_LIMITS.recipient,
  );
  if (!rl.allowed) {
    return { error: "Too many attempts — please wait a minute and try again." };
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return { error: "Invalid or expired tracking link" };
  }
  const order = await getOrderByToken(token);
  if (!order) return { error: "Invalid or expired tracking link" };
  if (order.currentState !== "AWAITING_RECIPIENT_DETAILS") {
    return { error: "This order is no longer awaiting recipient details" };
  }
  return { order };
}

function getRecipientWhere(order: { id: string; recipientEmail: string | null }) {
  return { orderId_email: { orderId: order.id, email: order.recipientEmail ?? "" } };
}

export async function submitRecipientNameAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const parsed = nameSchema.safeParse({ recipientName: formData.get("recipientName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const order = validation.order!;
  await prisma.passportRecipient.upsert({
    where: getRecipientWhere(order),
    create: { orderId: order.id, name: parsed.data.recipientName, email: order.recipientEmail ?? "" },
    update: { name: parsed.data.recipientName },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_NAME_SUBMITTED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient submitted name for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  return { ok: true, nextStep: "email" };
}

export async function submitRecipientEmailAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const parsed = emailSchema.safeParse({ recipientEmail: formData.get("recipientEmail") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const order = validation.order!;
  const newEmail = parsed.data.recipientEmail.toLowerCase().trim();
  await prisma.passportRecipient.upsert({
    where: getRecipientWhere(order),
    create: { orderId: order.id, email: newEmail, name: order.recipientName ?? "" },
    update: { email: newEmail },
  });

  await prisma.passportOrder.update({
    where: { id: order.id },
    data: { recipientEmail: newEmail },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_EMAIL_SUBMITTED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient submitted email for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  return { ok: true, nextStep: "address" };
}

export async function submitRecipientAddressAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const parsed = addressSchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city"),
    stateProvince: formData.get("stateProvince") || undefined,
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid address" };
  }

  // Shipping addresses are PII — encrypt at rest (AES-GCM, PII_ENCRYPTION_KEY).
  const encrypted = {
    addressLine1: await encryptPII(parsed.data.addressLine1),
    addressLine2: parsed.data.addressLine2 ? await encryptPII(parsed.data.addressLine2) : null,
    city: await encryptPII(parsed.data.city),
    stateProvince: parsed.data.stateProvince ? await encryptPII(parsed.data.stateProvince) : null,
    postalCode: await encryptPII(parsed.data.postalCode),
    country: await encryptPII(parsed.data.country),
  };

  const order = validation.order!;
  await prisma.passportRecipient.upsert({
    where: getRecipientWhere(order),
    create: {
      orderId: order.id,
      email: order.recipientEmail ?? "",
      name: order.recipientName ?? "",
      ...encrypted,
    },
    update: encrypted,
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_ADDRESS_SUBMITTED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient submitted address for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  return { ok: true, nextStep: "photo" };
}

const photoSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_FILE_SIZE, "File too large (max 5MB)")
  .refine(
    (f) => (ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type),
    "Invalid file type (JPEG, PNG, WebP only)"
  );

export async function submitRecipientPhotoAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const photo = formData.get("photo");
  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const parsed = photoSchema.safeParse(photo);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid photo" };
    }
    // No object storage in this deployment: persist the image itself,
    // encrypted, in the row (the old code stored a /uploads path that was
    // never written to disk).
    const bytes = Buffer.from(await photo.arrayBuffer());
    const dataUrl = `data:${photo.type};base64,${bytes.toString("base64")}`;
    photoUrl = await encryptPII(dataUrl);
  }

  const order = validation.order!;
  await prisma.passportRecipient.upsert({
    where: getRecipientWhere(order),
    create: {
      orderId: order.id,
      email: order.recipientEmail ?? "",
      name: order.recipientName ?? "",
      photoUrl,
    },
    update: { photoUrl },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_PHOTO_SUBMITTED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient submitted photo for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  return { ok: true, nextStep: "emergency" };
}

export async function submitRecipientEmergencyAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const parsed = emergencySchema.safeParse({ emergencyContact: formData.get("emergencyContact") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid emergency contact" };
  }

  const order = validation.order!;
  await prisma.passportRecipient.upsert({
    where: getRecipientWhere(order),
    create: {
      orderId: order.id,
      email: order.recipientEmail ?? "",
      name: order.recipientName ?? "",
      emergencyContact: parsed.data.emergencyContact ? await encryptPII(parsed.data.emergencyContact) : null,
    },
    update: {
      emergencyContact: parsed.data.emergencyContact ? await encryptPII(parsed.data.emergencyContact) : null,
    },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_EMERGENCY_SUBMITTED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient submitted emergency contact for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  return { ok: true, nextStep: "review" };
}

export async function submitRecipientReviewAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const order = validation.order!;
  const recipient = await prisma.passportRecipient.findUnique({ where: getRecipientWhere(order) });
  if (!recipient || !recipient.name || !recipient.email || !recipient.addressLine1 || !recipient.city || !recipient.country) {
    return { error: "Please complete all required steps first" };
  }

  // Transition order to RECIPIENT_DETAILS_RECEIVED
  await prisma.passportOrder.update({
    where: { id: order.id },
    data: { currentState: "RECIPIENT_DETAILS_RECEIVED", status: "CONFIRMED" },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      eventType: "RECIPIENT_DETAILS_SUBMITTED",
      status: "CONFIRMED",
      previousState: "AWAITING_RECIPIENT_DETAILS",
      newState: "RECIPIENT_DETAILS_RECEIVED",
      actor: "recipient",
      actorType: "RECIPIENT",
      description: `Recipient details submitted for order ${order.id}`,
    },
  });

  // Confirmation email — status reflects what actually happened.
  await deliverOrderEmail(order.id, "details");

  await auditLog({
    entityType: "PassportOrder",
    entityId: order.id,
    action: "RECIPIENT_DETAILS_COMPLETED",
    actor: "recipient",
    actorType: "RECIPIENT",
    description: `Recipient completed all details for order ${order.id}`,
    requestId: await getRequestId(),
  });

  revalidatePath(`/recipient/${token}`);
  revalidatePath(`/track/${token}`);
  redirect(`/track/${token}`);
}

export async function skipRecipientStepAction(
  _prev: RecipientFormState,
  formData: FormData
): Promise<RecipientFormState> {
  const token = formData.get("token") as string;
  const step = formData.get("step") as string;

  if (!token) return { error: "Missing token" };

  const validation = await validateToken(token);
  if (validation.error) return { error: validation.error };

  const stepOrder = ["name", "email", "address", "photo", "emergency", "review"];
  const currentIndex = stepOrder.indexOf(step);
  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return { error: "Cannot skip this step" };
  }

  const nextStep = stepOrder[currentIndex + 1];
  return { ok: true, nextStep };
}

// Wrapper functions for direct form action usage (only take FormData)
export async function submitRecipientNameActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientNameAction(undefined, formData);
}

export async function submitRecipientEmailActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientEmailAction(undefined, formData);
}

export async function submitRecipientAddressActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientAddressAction(undefined, formData);
}

export async function submitRecipientPhotoActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientPhotoAction(undefined, formData);
}

export async function submitRecipientEmergencyActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientEmergencyAction(undefined, formData);
}

export async function submitRecipientReviewActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return submitRecipientReviewAction(undefined, formData);
}

export async function skipRecipientStepActionDirect(
  formData: FormData
): Promise<RecipientFormState> {
  return skipRecipientStepAction(undefined, formData);
}
