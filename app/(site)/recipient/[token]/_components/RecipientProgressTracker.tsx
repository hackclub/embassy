"use client";

import { ReactNode } from "react";
import Link from "next/link";

interface Step {
  step: string;
  label: string;
  href: string;
}

interface RecipientProgressTrackerProps {
  steps: Step[];
  completedSteps: string[];
  currentStep: string | null;
}

export default function RecipientProgressTracker({ steps, completedSteps, currentStep }: RecipientProgressTrackerProps) {
  return (
    <nav className="mb-8" aria-label="Progress">
      <ol className="flex items-center" role="list">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.step);
          const isCurrent = currentStep === step.step;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.step} className="flex items-center">
              <Link
                href={isCompleted || isCurrent ? step.href : "#"}
                className={`flex flex-col items-center gap-2 ${
                  isCompleted
                    ? "text-hc-red"
                    : isCurrent
                    ? "text-hc-blue"
                    : "text-govuk-grey-4"
                }`}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={!isCompleted && !isCurrent}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${
                    isCompleted
                      ? "bg-hc-red border-hc-red text-white"
                      : isCurrent
                      ? "bg-hc-blue border-hc-blue text-white"
                      : "bg-white border-govuk-grey-4 text-govuk-grey-4"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="text-xs font-medium text-center max-w-[80px] hidden sm:block">
                  {step.label}
                </span>
              </Link>
              {!isLast && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    isCompleted ? "bg-hc-red" : "bg-govuk-grey-4"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-govuk-grey-4 text-center sm:hidden">
        {completedSteps.length} of {steps.length} steps completed
      </p>
    </nav>
  );
}