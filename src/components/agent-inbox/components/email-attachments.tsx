"use client";

import { EmailAttachment } from "../types";
import { FileText, Download, ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useThreadsContext } from "../contexts/ThreadContext";
import { useLocalStorage } from "../hooks/use-local-storage";
import {
  LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY,
  GCP_SERVICE_ACCOUNT_KEY_LOCAL_STORAGE_KEY,
} from "../constants";

interface EmailAttachmentsProps {
  attachments: EmailAttachment[];
  className?: string;
  bucketName?: string; // Optional bucket name for Google Cloud Storage
}

/**
 * Extract filename from URL if not provided
 */
function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop();
    if (filename && filename.length > 0) {
      return decodeURIComponent(filename);
    }
  } catch (e) {
    // If URL parsing fails, try to extract from string
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length > 0) {
      return decodeURIComponent(lastPart.split("?")[0]);
    }
  }
  return null;
}

/**
 * Normalize attachment data to ensure it has required fields
 */
function normalizeAttachment(att: any, index: number): EmailAttachment | null {
  if (!att) {
    console.log(`Attachment ${index} is null/undefined`);
    return null;
  }

  // Log the raw attachment for debugging
  console.log(`Normalizing attachment ${index}:`, att);

  // First, try to get the URL - this is often the most reliable field
  // Make sure it's a string, not a function
  let url: string | undefined =
    att.url ||
    att.file_url ||
    att.fileUrl ||
    att.download_url ||
    att.downloadUrl ||
    att.link ||
    att.href ||
    att.pdf_url ||
    att.pdfUrl ||
    att.PDF_url ||
    att.PDFUrl;

  // If URL is a function, try to call it or skip it
  if (typeof url === "function") {
    console.warn(`URL is a function for attachment ${index}, skipping`);
    url = undefined;
  }

  // If the attachment itself is a string (just a URL), use it
  if (!url && typeof att === "string") {
    url = att;
  }

  // Extract filename - try multiple sources, including extracting from URL
  let filename =
    att.filename ||
    att.name ||
    att.file_name ||
    att.fileName ||
    att.FileName ||
    att.Filename ||
    att.title ||
    att.display_name;

  // If no filename found but we have a URL, extract it from the URL
  if (!filename && url) {
    filename = extractFilenameFromUrl(url);
  }

  // Only use fallback if we absolutely can't find a filename
  if (!filename) {
    console.warn(`No filename found for attachment ${index}, using fallback`);
    filename = `attachment-${index + 1}`;
  }

  const contentType =
    att.content_type ||
    att.contentType ||
    att.type ||
    att.mime_type ||
    att.mimeType ||
    (filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");
  const id =
    att.id ||
    att.attachment_id ||
    att.attachmentId ||
    att.file_id ||
    att.fileId ||
    url || // Use URL as ID if available
    `att-${index}`;
  const content = att.content || att.data || att.base64 || att.base64Content;
  const size = att.size || att.file_size || att.fileSize || att.length;

  const normalized = {
    id,
    filename,
    content_type: contentType,
    size,
    url,
    content,
  };

  console.log(`Normalized attachment ${index}:`, normalized);
  return normalized;
}

/**
 * Component to display email attachments, with special handling for PDFs.
 */
export function EmailAttachments({
  attachments,
  className,
  bucketName,
}: EmailAttachmentsProps) {
  console.log("EmailAttachments received:", attachments);
  console.log("Attachments type:", typeof attachments);
  console.log("Is array:", Array.isArray(attachments));
  console.log("Length:", attachments?.length);

  if (!attachments) {
    console.log("Attachments is null/undefined");
    return (
      <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-sm text-gray-600">Attachments data is missing.</p>
      </div>
    );
  }

  if (!Array.isArray(attachments)) {
    console.log("Attachments is not an array, attempting to convert");
    // If it's a string (single URL), convert to array
    if (typeof attachments === "string") {
      console.log("Attachments is a string URL, converting to array");
      const filename = extractFilenameFromUrl(attachments) || "attachment";
      const normalized: EmailAttachment = {
        id: attachments,
        filename: filename,
        content_type: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        url: attachments,
      };
      return (
        <EmailAttachments
          attachments={[normalized]}
          className={className}
        />
      );
    }
    // Try to convert object to array
    if (typeof attachments === "object" && attachments !== null) {
      const asArray = Object.values(attachments);
      console.log("Converted to array:", asArray);
      // Check if array contains strings (URLs)
      if (asArray.length > 0) {
        const normalized = asArray.map((item, idx) => {
          if (typeof item === "string") {
            const filename = extractFilenameFromUrl(item) || `attachment-${idx + 1}`;
            return {
              id: item,
              filename: filename,
              content_type: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
              url: item,
            } as EmailAttachment;
          }
          return item as EmailAttachment;
        });
        return (
          <EmailAttachments attachments={normalized} className={className} />
        );
      }
    }
    return (
      <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-sm text-gray-600">
          Attachments is not in the expected format.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Type: {typeof attachments}, Value: {JSON.stringify(attachments)}
        </p>
      </div>
    );
  }

  // Check if array contains strings (URLs) and convert them
  if (attachments.length > 0 && typeof attachments[0] === "string") {
    console.log("Attachments array contains strings (URLs), converting to objects");
    const normalized = attachments.map((url, idx) => {
      const urlStr = typeof url === "string" ? url : String(url);
      const filename = extractFilenameFromUrl(urlStr) || `attachment-${idx + 1}`;
      return {
        id: urlStr,
        filename: filename,
        content_type: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        url: urlStr,
      } as EmailAttachment;
    });
    return (
      <EmailAttachments attachments={normalized} className={className} />
    );
  }

  if (attachments.length === 0) {
    console.log("Attachments array is empty");
    return (
      <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-sm text-gray-600">No attachments found.</p>
      </div>
    );
  }

  // Normalize all attachments
  const normalizedAttachments = attachments
    .map((att, index) => normalizeAttachment(att as any, index))
    .filter((att): att is EmailAttachment => att !== null);

  console.log("Normalized attachments:", normalizedAttachments);

  if (normalizedAttachments.length === 0) {
    return (
      <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-sm text-gray-600">
          No valid attachments found after normalization.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Raw data: {JSON.stringify(attachments)}
        </p>
      </div>
    );
  }

  const pdfAttachments = normalizedAttachments.filter(
    (att) =>
      att.content_type === "application/pdf" ||
      att.filename.toLowerCase().endsWith(".pdf")
  );
  const otherAttachments = normalizedAttachments.filter(
    (att) =>
      att.content_type !== "application/pdf" &&
      !att.filename.toLowerCase().endsWith(".pdf")
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {pdfAttachments.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            PDF Attachments ({pdfAttachments.length})
          </h3>
          <div className="flex flex-col gap-3">
            {pdfAttachments.map((attachment) => (
              <PdfAttachmentViewer
                key={attachment.id}
                attachment={attachment}
                bucketName={bucketName}
              />
            ))}
          </div>
        </div>
      )}

      {otherAttachments.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Other Attachments ({otherAttachments.length})
          </h3>
          <div className="flex flex-col gap-2">
            {otherAttachments.map((attachment) => (
              <AttachmentItem
                key={attachment.id}
                attachment={attachment}
                bucketName={bucketName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PdfAttachmentViewerProps {
  attachment: EmailAttachment;
  bucketName?: string;
}

/**
 * Construct Google Cloud Storage URL from file path
 */
function constructGcsUrl(filePath: string, bucketName?: string): string | null {
  // If it's already an absolute URL (http:// or https://), use it directly
  // This handles S3 URLs, GCS URLs, cloud storage URLs, etc.
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // Check if it's a Google Cloud Storage path format
  // GCS paths can be: gs://bucket-name/path/to/file or just /bucket-name/path/to/file
  let gcsPath = filePath;
  
  // Remove gs:// prefix if present
  if (gcsPath.startsWith("gs://")) {
    gcsPath = gcsPath.slice(5);
  }
  
  // Remove leading slash if present
  if (gcsPath.startsWith("/")) {
    gcsPath = gcsPath.slice(1);
  }

  // Extract bucket name and object path
  const parts = gcsPath.split("/");
  const bucket = bucketName || parts[0];
  const objectPath = parts.slice(1).join("/");

  if (!bucket || !objectPath) {
    console.error("Invalid GCS path format:", filePath);
    return null;
  }

  // Construct Google Cloud Storage public URL
  // Format: https://storage.googleapis.com/bucket-name/path/to/file
  const gcsUrl = `https://storage.googleapis.com/${bucket}/${objectPath}`;
  console.log(`Constructed GCS URL: ${gcsUrl} from path: ${filePath}`);
  return gcsUrl;
}

/**
 * Construct full URL for fetching file from third-party server
 * Files can come from various sources: Google Cloud Storage, S3, local file system (via proxy), etc.
 */
function constructFileServerUrl(
  filePath: string,
  deploymentUrl?: string,
  bucketName?: string
): string | null {
  // If it's already an absolute URL (http:// or https://), use it directly
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // Try to construct Google Cloud Storage URL first
  const gcsUrl = constructGcsUrl(filePath, bucketName);
  if (gcsUrl) {
    return gcsUrl;
  }

  // Check if it's a local file system path
  const isLocalPath =
    filePath.startsWith("/Users/") ||
    filePath.startsWith("/home/") ||
    filePath.startsWith("/var/") ||
    filePath.startsWith("/tmp/") ||
    filePath.startsWith("C:\\") ||
    filePath.startsWith("D:\\");

  if (isLocalPath) {
    // Local file paths cannot be accessed directly from the browser
    // Try to construct GCS URL if bucket name is provided
    if (bucketName) {
      // Assume the local path structure maps to GCS
      const gcsPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
      return `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
    }
    
    console.error("Local file path cannot be accessed from browser:", filePath);
    console.error("Please provide a bucket name or use Google Cloud Storage paths");
    return null;
  }

  // For relative paths, if we have a deployment URL, try to construct full URL
  if (deploymentUrl && filePath.startsWith("/")) {
    const baseUrl = deploymentUrl.replace(/\/$/, "");
    return `${baseUrl}${filePath}`;
  }

  // If it's a relative path without a base URL, we can't construct a valid URL
  console.error("Cannot construct URL for relative path without base URL:", filePath);
  return null;
}

/**
 * Generate a signed URL for Google Cloud Storage using the API route
 */
async function generateGcsSignedUrl(
  filePath: string,
  bucketName: string,
  serviceAccountKey: string
): Promise<string | null> {
  try {
    const response = await fetch("/api/gcs-signed-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath,
        bucketName,
        serviceAccountKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to generate GCS signed URL:", error);
      return null;
    }

    const data = await response.json();
    return data.signedUrl;
  } catch (error) {
    console.error("Error generating GCS signed URL:", error);
    return null;
  }
}

/**
 * Fetch file from Google Cloud Storage or other third-party server and convert to blob URL
 */
async function fetchFileAsBlobUrl(
  filePath: string,
  apiKey?: string,
  deploymentUrl?: string,
  bucketName?: string,
  serviceAccountKey?: string
): Promise<string | null> {
  try {
    // If we have a bucket name and service account key, use signed URLs for GCS
    if (bucketName && serviceAccountKey && filePath) {
      console.log("Generating GCS signed URL for authenticated access");
      const signedUrl = await generateGcsSignedUrl(
        filePath,
        bucketName,
        serviceAccountKey
      );

      if (signedUrl) {
        console.log(`Using signed URL for GCS file: ${signedUrl}`);
        try {
          const response = await fetch(signedUrl, {
            method: "GET",
            headers: {
              "Accept": "*/*",
            },
            mode: "cors",
            credentials: "omit",
          });

          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            console.log(
              `Successfully fetched file from GCS using signed URL (${blob.size} bytes)`
            );
            return blobUrl;
          } else {
            console.error(
              `Failed to fetch file using signed URL: ${response.status} ${response.statusText}`
            );
          }
        } catch (fetchError) {
          console.error("Error fetching file using signed URL:", fetchError);
        }
      } else {
        console.log("Failed to generate signed URL, falling back to direct access");
      }
    }

    // Construct the server URL for fetching the file
    const serverUrl = constructFileServerUrl(filePath, deploymentUrl, bucketName);
    
    if (!serverUrl) {
      console.error("Could not construct server URL for file:", filePath);
      return null;
    }

    // Validate that serverUrl is absolute (starts with http)
    if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
      console.error("Constructed URL is not absolute:", serverUrl);
      return null;
    }

    console.log(`Fetching file from server: ${serverUrl}`);
    console.log(`Original file path: ${filePath}`);
    if (bucketName) {
      console.log(`Using bucket: ${bucketName}`);
    }

    // Set up headers for the request
    const headers: Record<string, string> = {
      "Accept": "*/*", // Accept any content type
    };

    // For non-GCS URLs, use API key if provided
    if (apiKey && !serverUrl.includes("storage.googleapis.com")) {
      headers["x-api-key"] = apiKey;
      console.log("Using API key for authentication");
    }

    // Make the fetch request
    // Use mode: 'cors' to ensure cross-origin requests work
    const response = await fetch(serverUrl, {
      method: "GET",
      headers,
      mode: "cors", // Enable CORS
      credentials: "omit", // Don't send cookies
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
        `URL: ${serverUrl}`
      );
      
      // If GCS URL failed, try alternative GCS URL formats
      if (bucketName && filePath) {
        const gcsPath = filePath.startsWith("gs://") 
          ? filePath.slice(5) 
          : filePath.startsWith("/") 
            ? filePath.slice(1) 
            : filePath;
        
        const alternativeUrls = [
          `https://storage.cloud.google.com/${gcsPath}`,
          `https://${bucketName}.storage.googleapis.com/${gcsPath.replace(/^[^/]+\//, "")}`,
        ];

        console.log("Trying alternative GCS URL formats...");
        for (const altUrl of alternativeUrls) {
          console.log(`Trying alternative GCS URL: ${altUrl}`);
          try {
            const altResponse = await fetch(altUrl, {
              method: "GET",
              headers: { "Accept": "*/*" },
              mode: "cors",
              credentials: "omit",
            });

            console.log(`Alternative GCS URL response: ${altResponse.status} ${altResponse.statusText}`);

            if (altResponse.ok) {
              const blob = await altResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              console.log(`Successfully fetched from alternative GCS URL: ${altUrl}`);
              return blobUrl;
            }
          } catch (altError) {
            console.log(`Alternative GCS URL failed: ${altUrl}`, altError);
          }
        }
      }

      return null;
    }

    // Convert response to blob
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    console.log(`Successfully fetched file (${blob.size} bytes) and created blob URL`);
    return blobUrl;
  } catch (error) {
    console.error("Error fetching file:", error);
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      console.error("This might be a CORS issue. Ensure your GCS bucket has CORS configured");
      console.error("Or the bucket/file might not be publicly accessible");
    }
    return null;
  }
}

/**
 * Component to display and view PDF attachments inline.
 */
function PdfAttachmentViewer({
  attachment,
  bucketName,
}: PdfAttachmentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { agentInboxes } = useThreadsContext();
  const { getItem } = useLocalStorage();

  // Get API key, deployment URL, and GCP service account key for authenticated requests
  const selectedInbox = agentInboxes.find((i) => i.selected);
  const apiKey = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY) || undefined;
  const deploymentUrl = selectedInbox?.deploymentUrl;
  const serviceAccountKey = getItem(GCP_SERVICE_ACCOUNT_KEY_LOCAL_STORAGE_KEY) || undefined;
  
  // Extract bucket name from attachment URL if not provided as prop
  const extractedBucketName =
    bucketName ||
    (attachment.url?.includes("storage.googleapis.com")
      ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
      : undefined);

  // Fetch file when URL is available
  useEffect(() => {
    if (attachment.url && !blobUrlRef.current) {
      console.log("Starting file fetch:", {
        filePath: attachment.url,
        deploymentUrl: deploymentUrl,
        bucketName: extractedBucketName,
        hasApiKey: !!apiKey,
      });

      setLoading(true);
      fetchFileAsBlobUrl(
        attachment.url,
        apiKey,
        deploymentUrl,
        extractedBucketName,
        serviceAccountKey
      )
        .then((url) => {
          if (url) {
            blobUrlRef.current = url;
            setBlobUrl(url);
            console.log("File fetched successfully, blob URL created");
          } else {
            console.error("File fetch returned null");
            setError(true);
          }
        })
        .catch((err) => {
          console.error("File fetch error:", err);
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
    }

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [attachment.url, apiKey, deploymentUrl, extractedBucketName, serviceAccountKey]);

  // Determine the PDF source URL
  const getPdfUrl = (): string | null => {
    // Prefer blob URL if available
    if (blobUrl) {
      return blobUrl;
    }
    // Fall back to original URL if blob not ready
    if (attachment.url) {
      return attachment.url;
    }
    // Use base64 content if available
    if (attachment.content) {
      const base64Content = attachment.content.startsWith("data:")
        ? attachment.content
        : `data:application/pdf;base64,${attachment.content}`;
      return base64Content;
    }
    return null;
  };

  const pdfUrl = getPdfUrl();

  const handleDownload = async () => {
    if (!pdfUrl) {
      if (attachment.url && !blobUrl) {
        // Fetch file if not already fetched
        setLoading(true);
        const extractedBucketName =
          bucketName ||
          (attachment.url?.includes("storage.googleapis.com")
            ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
            : undefined);
        const fetchedUrl = await fetchFileAsBlobUrl(
          attachment.url,
          apiKey,
          deploymentUrl,
          extractedBucketName,
          serviceAccountKey
        );
        if (fetchedUrl) {
          setBlobUrl(fetchedUrl);
          blobUrlRef.current = fetchedUrl;
          const link = document.createElement("a");
          link.href = fetchedUrl;
          link.download = attachment.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          setError(true);
        }
        setLoading(false);
      }
      return;
    }

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = async () => {
    if (!pdfUrl) {
      if (attachment.url && !blobUrl) {
        // Fetch file if not already fetched
        setLoading(true);
        const extractedBucketName =
          bucketName ||
          (attachment.url?.includes("storage.googleapis.com")
            ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
            : undefined);
        const fetchedUrl = await fetchFileAsBlobUrl(
          attachment.url,
          apiKey,
          deploymentUrl,
          extractedBucketName,
          serviceAccountKey
        );
        if (fetchedUrl) {
          setBlobUrl(fetchedUrl);
          blobUrlRef.current = fetchedUrl;
          window.open(fetchedUrl, "_blank");
        } else {
          setError(true);
        }
        setLoading(false);
      }
      return;
    }
    window.open(pdfUrl, "_blank");
  };

  if (!pdfUrl) {
    return (
      <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
        <p className="text-sm text-gray-600">
          PDF attachment "{attachment.filename}" has no accessible content.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Attachment header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
          <button
            onClick={handleOpenInNewTab}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate text-left"
            title={`Open ${attachment.filename} in new tab`}
          >
            {attachment.filename}
          </button>
          {attachment.size && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              ({(attachment.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInNewTab}
            className="h-8 px-2"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 px-2"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-3 text-xs"
          >
            {isExpanded ? "Collapse" : "View PDF"}
          </Button>
        </div>
      </div>

      {/* PDF viewer */}
      {isExpanded && (
        <div className="relative w-full" style={{ minHeight: "600px" }}>
          {loading ? (
            <div className="p-6 text-center">
              <LoaderCircle className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-600">Loading PDF...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                Failed to load PDF. You can try downloading it instead.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full border-0"
              style={{ height: "600px", minHeight: "600px" }}
              title={attachment.filename}
              onError={() => setError(true)}
            />
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                No PDF URL available.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AttachmentItemProps {
  attachment: EmailAttachment;
  bucketName?: string;
}

/**
 * Component to display non-PDF attachments.
 */
function AttachmentItem({
  attachment,
  bucketName: propBucketName,
}: AttachmentItemProps) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { agentInboxes } = useThreadsContext();
  const { getItem } = useLocalStorage();

  // Get API key, deployment URL, and GCP service account key for authenticated requests
  const selectedInbox = agentInboxes.find((i) => i.selected);
  const apiKey = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY) || undefined;
  const deploymentUrl = selectedInbox?.deploymentUrl;
  const serviceAccountKey = getItem(GCP_SERVICE_ACCOUNT_KEY_LOCAL_STORAGE_KEY) || undefined;

  // Extract bucket name from attachment URL if not provided as prop
  const bucketName =
    propBucketName ||
    (attachment.url?.includes("storage.googleapis.com")
      ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
      : undefined);

  // Fetch file when URL is available
  useEffect(() => {
    if (attachment.url && !blobUrlRef.current && !attachment.content) {
      setLoading(true);
      fetchFileAsBlobUrl(attachment.url, apiKey, deploymentUrl, bucketName, serviceAccountKey)
        .then((url) => {
          if (url) {
            blobUrlRef.current = url;
            setBlobUrl(url);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [attachment.url, apiKey, deploymentUrl, bucketName, attachment.content, serviceAccountKey]);

  const getFileUrl = (): string | null => {
    // Prefer blob URL if available
    if (blobUrl) {
      return blobUrl;
    }
    // Use base64 content if available
    if (attachment.content) {
      const base64Content = attachment.content.startsWith("data:")
        ? attachment.content
        : `data:${attachment.content_type};base64,${attachment.content}`;
      return base64Content;
    }
    // Fall back to original URL
    if (attachment.url) {
      return attachment.url;
    }
    return null;
  };

  const handleDownload = async () => {
    let url = getFileUrl();

    if (!url && attachment.url) {
      // Fetch file if not already fetched
      setLoading(true);
      const extractedBucketName =
        bucketName ||
        (attachment.url?.includes("storage.googleapis.com")
          ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
          : undefined);
      const fetchedUrl = await fetchFileAsBlobUrl(
        attachment.url,
        apiKey,
        deploymentUrl,
        extractedBucketName,
        serviceAccountKey
      );
      if (fetchedUrl) {
        setBlobUrl(fetchedUrl);
        blobUrlRef.current = fetchedUrl;
        url = fetchedUrl;
      } else {
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = async () => {
    let url = getFileUrl();

    if (!url && attachment.url) {
      // Fetch file if not already fetched
      setLoading(true);
      const extractedBucketName =
        bucketName ||
        (attachment.url?.includes("storage.googleapis.com")
          ? attachment.url.split("storage.googleapis.com/")[1]?.split("/")[0]
          : undefined);
      const fetchedUrl = await fetchFileAsBlobUrl(
        attachment.url,
        apiKey,
        deploymentUrl,
        extractedBucketName,
        serviceAccountKey
      );
      if (fetchedUrl) {
        setBlobUrl(fetchedUrl);
        blobUrlRef.current = fetchedUrl;
        url = fetchedUrl;
      } else {
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (url) {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <button
          onClick={handleOpenInNewTab}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate text-left"
          title={`Open ${attachment.filename} in new tab`}
        >
          {attachment.filename}
        </button>
        {attachment.size && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            ({(attachment.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {loading ? (
          <LoaderCircle className="w-4 h-4 animate-spin text-gray-600" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-8 px-2"
              title="Open in new tab"
              disabled={loading}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-2"
              title="Download"
              disabled={loading}
            >
              <Download className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

