"use client";

import React, { useState } from "react";
import {
  submitRecipientNameActionDirect as submitRecipientNameAction,
  submitRecipientEmailActionDirect as submitRecipientEmailAction,
  submitRecipientAddressActionDirect as submitRecipientAddressAction,
  submitRecipientPhotoActionDirect as submitRecipientPhotoAction,
  submitRecipientEmergencyActionDirect as submitRecipientEmergencyAction,
  submitRecipientReviewActionDirect as submitRecipientReviewAction,
  skipRecipientStepActionDirect as skipRecipientStepAction,
} from "@/app/actions/recipient";

const STEP_ORDER = ["name", "email", "address", "photo", "emergency", "review"] as const;
type StepKey = (typeof STEP_ORDER)[number];

interface RecipientStepProps {
  token: string;
  order: { ysws?: { name: string } | null; org: { name: string } };
  recipient: {
    name?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    photoUrl?: string | null;
    emergencyContact?: string | null;
  } | null;
  completedSteps: string[];
}

type RecipientFormState = { error?: string; ok?: boolean; nextStep?: string } | undefined;

interface RecipientReviewProps {
  token: string;
  order: { ysws?: { name: string } | null; org: { name: string } };
  recipient: {
    name?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    photoUrl?: string | null;
    emergencyContact?: string | null;
  } | null;
  action: (formData: FormData) => Promise<RecipientFormState>;
  state: { error?: string; pending?: boolean } | undefined;
}

const RecipientReview = ({
  token,
  order,
  recipient,
  action,
  state,
}: RecipientReviewProps) => {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append("token", token);
        action(formData);
      }}
      className="space-y-6"
      noValidate
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="step" value="review" />

      <div className="border-2 border-govuk-black bg-govuk-grey-1 p-4 space-y-4">
        <h3 className="text-lg font-bold">Review your details</h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-govuk-grey-4">Full name</dt>
            <dd className="font-medium">{recipient?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-govuk-grey-4">Email</dt>
            <dd className="font-medium">{recipient?.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-govuk-grey-4">Address</dt>
            <dd className="font-medium">
              {recipient?.addressLine1}
              {recipient?.addressLine2 && <React.Fragment> <br /> {recipient.addressLine2} </React.Fragment>}
              <React.Fragment> <br /> {recipient?.city}, {recipient?.postalCode} </React.Fragment>
              <React.Fragment> <br /> {recipient?.country} </React.Fragment>
            </dd>
          </div>
          {recipient?.photoUrl && (
            <div>
              <dt className="text-sm text-govuk-grey-4">Photo</dt>
              <dd className="font-medium">Uploaded</dd>
            </div>
          )}
          {recipient?.emergencyContact && (
            <div>
              <dt className="text-sm text-govuk-grey-4">Emergency contact</dt>
              <dd className="font-medium">{recipient.emergencyContact}</dd>
            </div>
          )}
        </dl>
      </div>

      {state?.error && (
        <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
          <p className="font-semibold text-hc-red">{state.error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button type="submit" disabled={state?.pending} className="govuk-button">
          {state?.pending ? "Submitting..." : "Confirm & submit"}
        </button>
      </div>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="step" value="review" />
    </form>
  );
};
export default function RecipientStep({ token, order, recipient, completedSteps }: RecipientStepProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>(() => {
    const nextStep = STEP_ORDER.find((step) => !completedSteps.includes(step));
    return nextStep ?? "review";
  });

  const [nameError, setNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [emergencyError, setEmergencyError] = useState<string | undefined>();
  const [reviewError, setReviewError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);

  const handleSkip = async (step: StepKey) => {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("step", step);
    const result = await skipRecipientStepAction(formData);
    if (result?.ok && result.nextStep) {
      setCurrentStep(result.nextStep as StepKey);
    } else {
      const currentIndex = STEP_ORDER.indexOf(step);
      if (currentIndex !== -1 && currentIndex < STEP_ORDER.length - 1) {
        setCurrentStep(STEP_ORDER[currentIndex + 1] as StepKey);
      }
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<RecipientFormState>,
    setError: (error: string | undefined) => void
  ) => {
    e.preventDefault();
    setPending("submitting");
    setError(undefined);
    const formData = new FormData(e.currentTarget);
    formData.append("token", token);
    const result = await action(formData);
    setPending(null);
    if (result && result.error) {
      setError(result.error);
    } else if (result && result.ok && result.nextStep) {
      setCurrentStep(result.nextStep as StepKey);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "name":
        return (
          <form
            onSubmit={(e) => handleSubmit(e, submitRecipientNameAction as (formData: FormData) => Promise<RecipientFormState>, setNameError)}
            className="space-y-6"
            noValidate
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="name" />
            <div>
              <h3 className="text-lg font-bold mb-1">What is your full name?</h3>
              <p className="text-govuk-grey-4 text-sm">This will appear on your passport.</p>
            </div>
            {nameError && (
              <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
                <p className="font-semibold text-hc-red">{nameError}</p>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="recipientName" className="block font-bold text-sm">
                Full name <span className="text-hc-red ml-1" aria-hidden="true">*</span>
              </label>
              <input
                id="recipientName"
                name="recipientName"
                type="text"
                required
                defaultValue={recipient?.name ?? ""}
                autoComplete="name"
                className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
              />
              <p className="text-xs text-govuk-grey-4">This field is required</p>
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={pending === "submitting"} className="govuk-button">
                {pending === "submitting" ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => handleSkip("name")}
                disabled={pending === "submitting"}
                className="govuk-button govuk-button--secondary"
              >
                Skip for now
              </button>
            </div>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="name" />
          </form>
        );
      case "email":
        return (
          <form
            onSubmit={(e) => handleSubmit(e, submitRecipientEmailAction as (formData: FormData) => Promise<RecipientFormState>, setEmailError)}
            className="space-y-6"
            noValidate
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="email" />
            <div>
              <h3 className="text-lg font-bold mb-1">What is your email address?</h3>
              <p className="text-govuk-grey-4 text-sm">We&apos;ll send confirmation and updates to this email.</p>
            </div>
            {emailError && (
              <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
                <p className="font-semibold text-hc-red">{emailError}</p>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="recipientEmail" className="block font-bold text-sm">
                Email address <span className="text-hc-red ml-1" aria-hidden="true">*</span>
              </label>
              <input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                required
                defaultValue={recipient?.email ?? ""}
                autoComplete="email"
                className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
              />
              <p className="text-xs text-govuk-grey-4">This field is required</p>
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={pending === "submitting"} className="govuk-button">
                {pending === "submitting" ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => handleSkip("email")}
                disabled={pending === "submitting"}
                className="govuk-button govuk-button--secondary"
              >
                Skip for now
              </button>
            </div>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="email" />
          </form>
        );
      case "address":
        return (
          <form
            onSubmit={(e) => handleSubmit(e, submitRecipientAddressAction as (formData: FormData) => Promise<RecipientFormState>, setAddressError)}
            className="space-y-6"
            noValidate
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="address" />
            <div>
              <h3 className="text-lg font-bold mb-1">What is your shipping address?</h3>
              <p className="text-govuk-grey-4 text-sm">Your passport will be shipped to this address.</p>
            </div>
            {addressError && (
              <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
                <p className="font-semibold text-hc-red">{addressError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="addressLine1" className="block font-bold text-sm">
                  Address line 1 <span className="text-hc-red ml-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="addressLine1"
                  name="addressLine1"
                  type="text"
                  required
                  defaultValue={recipient?.addressLine1 ?? ""}
                  autoComplete="address-line1"
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
                />
                <p className="text-xs text-govuk-grey-4">This field is required</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="addressLine2" className="block font-bold text-sm">
                  Address line 2 (optional)
                </label>
                <input
                  id="addressLine2"
                  name="addressLine2"
                  type="text"
                  defaultValue={recipient?.addressLine2 ?? ""}
                  autoComplete="address-line2"
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="city" className="block font-bold text-sm">
                  City <span className="text-hc-red ml-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  defaultValue={recipient?.city ?? ""}
                  autoComplete="address-level2"
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
                />
                <p className="text-xs text-govuk-grey-4">This field is required</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="stateProvince" className="block font-bold text-sm">
                  State / Province (optional)
                </label>
                <input
                  id="stateProvince"
                  name="stateProvince"
                  type="text"
                  defaultValue={recipient?.stateProvince ?? ""}
                  autoComplete="address-level1"
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="postalCode" className="block font-bold text-sm">
                  Postal code <span className="text-hc-red ml-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  required
                  defaultValue={recipient?.postalCode ?? ""}
                  autoComplete="postal-code"
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
                />
                <p className="text-xs text-govuk-grey-4">This field is required</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="country" className="block font-bold text-sm">
                  Country <span className="text-hc-red ml-1" aria-hidden="true">*</span>
                </label>
                <select
                  id="country"
                  name="country"
                  required
                  defaultValue={recipient?.country ?? ""}
                  className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base bg-white"
                >
                  <option value="">Select</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="JP">Japan</option>
                  <option value="IN">India</option>
                  <option value="BR">Brazil</option>
                  <option value="MX">Mexico</option>
                  <option value="OTHER">Other</option>
                </select>
                <p className="text-xs text-govuk-grey-4">This field is required</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={pending === "submitting"} className="govuk-button">
                {pending === "submitting" ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => handleSkip("address")}
                disabled={pending === "submitting"}
                className="govuk-button govuk-button--secondary"
              >
                Skip for now
              </button>
            </div>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="address" />
          </form>
        );
      case "photo":
        return (
          <form
            onSubmit={(e) => handleSubmit(e, submitRecipientPhotoAction as (formData: FormData) => Promise<RecipientFormState>, setPhotoError)}
            className="space-y-6"
            noValidate
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="photo" />
            <div>
              <h3 className="text-lg font-bold mb-1">Upload a passport photo (optional)</h3>
              <p className="text-govuk-grey-4 text-sm">A clear photo helps with identification. JPEG, PNG, or WebP up to 5MB.</p>
            </div>
            {photoError && (
              <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
                <p className="font-semibold text-hc-red">{photoError}</p>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="photo" className="block font-bold text-sm">
                Passport photo
              </label>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={pending === "submitting"} className="govuk-button">
                {pending === "submitting" ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => handleSkip("photo")}
                disabled={pending === "submitting"}
                className="govuk-button govuk-button--secondary"
              >
                Skip photo
              </button>
            </div>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="photo" />
          </form>
        );
      case "emergency":
        return (
          <form
            onSubmit={(e) => handleSubmit(e, submitRecipientEmergencyAction as (formData: FormData) => Promise<RecipientFormState>, setEmergencyError)}
            className="space-y-6"
            noValidate
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="emergency" />
            <div>
              <h3 className="text-lg font-bold mb-1">Emergency contact (optional)</h3>
              <p className="text-govuk-grey-4 text-sm">Someone we can contact if there&apos;s an issue with delivery.</p>
            </div>
            {emergencyError && (
              <div role="alert" className="border-l-4 border-hc-red p-4 bg-govuk-grey-1">
                <p className="font-semibold text-hc-red">{emergencyError}</p>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="emergencyContact" className="block font-bold text-sm">
                Emergency contact name and phone
              </label>
              <input
                id="emergencyContact"
                name="emergencyContact"
                type="text"
                defaultValue={recipient?.emergencyContact ?? ""}
                placeholder="Jane Doe +1-555-123-4567"
                className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <button type="submit" disabled={pending === "submitting"} className="govuk-button">
                {pending === "submitting" ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => handleSkip("emergency")}
                disabled={pending === "submitting"}
                className="govuk-button govuk-button--secondary"
              >
                Skip
              </button>
            </div>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step" value="emergency" />
          </form>
        );
      case "review":
      default:
        return (
          <RecipientReview
            token={token}
            order={order}
            recipient={recipient}
            action={submitRecipientReviewAction as (formData: FormData) => Promise<RecipientFormState>}
            state={reviewError ? { error: reviewError } : undefined}
          />
        );
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-xl font-bold mb-1">
          Step {STEP_ORDER.indexOf(currentStep) + 1} of {STEP_ORDER.length}
        </h2>
        <p className="text-govuk-grey-4">
          {currentStep.charAt(0).toUpperCase() + currentStep.slice(1)}
        </p>
      </header>

      {renderStep()}
    </div>
  );
}