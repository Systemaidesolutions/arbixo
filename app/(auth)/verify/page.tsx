import { Suspense } from "react";
import { VerifyForm } from "./VerifyForm";

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
