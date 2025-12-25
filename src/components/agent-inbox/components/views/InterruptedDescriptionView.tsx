import { MarkdownText } from "@/components/ui/markdown-text";
import { EmailAttachments } from "../email-attachments";
import { Email } from "../../types";

interface InterruptedDescriptionViewProps {
  description: string | undefined;
  threadValues?: Record<string, any>;
}

export function InterruptedDescriptionView({
  description,
  threadValues,
}: InterruptedDescriptionViewProps) {
  // Extract email from thread values
  const email = threadValues?.email as Email | undefined;
  const hasAttachments =
    email?.attachments && email.attachments.length > 0;

  return (
    <div className="pt-6 pb-2 flex flex-col gap-4">
      {description && (
        <MarkdownText className="text-wrap break-words whitespace-pre-wrap">
          {description}
        </MarkdownText>
      )}
      {hasAttachments && (
        <div className="mt-4">
          <EmailAttachments attachments={email.attachments!} />
        </div>
      )}
      {!description && !hasAttachments && (
        <p className="text-sm text-gray-500 italic">
          No description provided.
        </p>
      )}
    </div>
  );
}
