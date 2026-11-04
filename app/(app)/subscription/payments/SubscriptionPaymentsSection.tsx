"use client";

import { useState } from "react";
import { RenewClient, type RenewApp } from "./RenewClient";
import { PaymentsClient } from "./PaymentsClient";

// Coordinates the two independent client components: submitting a payment
// in RenewClient should immediately refresh the history table below it.
export function SubscriptionPaymentsSection({ showRenew, defaultApp }: { showRenew: boolean; defaultApp?: RenewApp }) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <>
      {showRenew && (
        <div className="mt-6">
          <RenewClient defaultApp={defaultApp} onSubmitted={() => setRefreshSignal((n) => n + 1)} />
        </div>
      )}
      <PaymentsClient refreshSignal={refreshSignal} />
    </>
  );
}
