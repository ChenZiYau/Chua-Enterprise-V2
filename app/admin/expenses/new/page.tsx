import { Suspense } from "react";
import { EntryForm } from "@/components/rental/EntryForm";

export default function NewExpensePage() {
  return (
    <Suspense fallback={null}>
      <EntryForm kind="expense" />
    </Suspense>
  );
}
