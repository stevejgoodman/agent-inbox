import { NextRequest, NextResponse } from "next/server";

/**
 * Generate a signed URL for Google Cloud Storage file access
 * This API route handles GCP authentication using a service account key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, bucketName, serviceAccountKey } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: "filePath is required" },
        { status: 400 }
      );
    }

    if (!bucketName) {
      return NextResponse.json(
        { error: "bucketName is required" },
        { status: 400 }
      );
    }

    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: "serviceAccountKey is required" },
        { status: 400 }
      );
    }

    // Parse the service account key
    let serviceAccount;
    try {
      serviceAccount =
        typeof serviceAccountKey === "string"
          ? JSON.parse(serviceAccountKey)
          : serviceAccountKey;
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid service account key format" },
        { status: 400 }
      );
    }

    // Extract object path from filePath
    // Handle various formats: gs://bucket/path, /bucket/path, or just path
    let objectPath = filePath;
    if (objectPath.startsWith("gs://")) {
      objectPath = objectPath.slice(5);
      // Remove bucket name if present
      if (objectPath.startsWith(`${bucketName}/`)) {
        objectPath = objectPath.slice(bucketName.length + 1);
      }
    } else if (objectPath.startsWith("/")) {
      objectPath = objectPath.slice(1);
      // Remove bucket name if present
      if (objectPath.startsWith(`${bucketName}/`)) {
        objectPath = objectPath.slice(bucketName.length + 1);
      }
    } else if (objectPath.includes("storage.googleapis.com")) {
      // Extract from full GCS URL
      const urlMatch = objectPath.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
      if (urlMatch) {
        objectPath = urlMatch[1];
      }
    }

    // Generate signed URL using Google Cloud Storage
    // We'll use the @google-cloud/storage library
    let Storage;
    try {
      const storageModule = await import("@google-cloud/storage");
      Storage = storageModule.Storage;
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        return NextResponse.json(
          {
            error:
              "@google-cloud/storage package not installed. Please run: yarn add @google-cloud/storage",
          },
          { status: 500 }
        );
      }
      throw error;
    }

    const storage = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    });

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);

    // Generate a signed URL that expires in 1 hour
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({ signedUrl });
  } catch (error: any) {
    console.error("Error generating GCS signed URL:", error);
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

