import { Suspense } from "react";
import { EntryForm } from "@/components/rental/EntryForm";

export default function NewRevenuePage() {
  return (
    <Suspense fallback={null}>
      <EntryForm kind="revenue" />
    </Suspense>
  );
}
