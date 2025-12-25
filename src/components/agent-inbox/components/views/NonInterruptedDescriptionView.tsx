import { EmailAttachments } from "../email-attachments";
import { Email } from "../../types";

interface NonInterruptedDescriptionViewProps {
  threadValues?: Record<string, any>;
}

export function NonInterruptedDescriptionView({
  threadValues,
}: NonInterruptedDescriptionViewProps) {
  // Extract email from thread values
  const email = threadValues?.email as Email | undefined;
  const hasAttachments =
    email?.attachments && email.attachments.length > 0;

  return (
    <div className="pt-6 pb-2 w-full">
      {!hasAttachments && (
        <p className="text-sm text-gray-500 italic">
          This thread has no additional description.
        </p>
      )}
      {hasAttachments && (
        <div className="flex flex-col gap-4">
          <EmailAttachments attachments={email.attachments!} />
        </div>
      )}
    </div>
  );
}
