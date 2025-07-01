import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createJsonError } from "../utils/index.js";

export const getSinglePartPresignedUrl = async (s3Client: S3Client, {
  bucket,
  key,
  metadata,
}: {
  bucket: string;
  key: string;
  metadata?: { [key: string]: string };
}) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Metadata: metadata,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 6000 });

  return url;
};

export const getPartPresignedUrl = async (s3Client: S3Client, {
  bucket,
  key,
  uploadId,
  partNumber,
}: {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
}) => {
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 6000 });

  return url;
};

export const getMultipartPresignedUrl = async (s3Client: S3Client, {
  bucket,
  key,
  fileSize,
  partSize,
  metadata,
}: {
  bucket: string;
  key: string;
  fileSize: string;
  partSize?: string;
  metadata?: { [key: string]: string };
}) => {
  try {
    const segmentSize = partSize ? parseInt(partSize) : 1024 * 1024 * 10; // 10 MB
    const multipartUpload = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        Metadata: metadata,
      }),
    );

    const uploadId = multipartUpload.UploadId!;
    const segmentCount = Math.ceil(parseInt(fileSize) / segmentSize);

    const urlPromises = [];
    for (let i = 0; i < segmentCount; i++) {
      const partNumber = i + 1;

      urlPromises.push(
        getPartPresignedUrl(s3Client, {
          bucket,
          key,
          uploadId,
          partNumber,
        }),
      );
    }

    const urlPromiseResults = await Promise.all(urlPromises);
    return {
      urls: urlPromiseResults,
      uploadId,
    };
  } catch (err) {
    console.log("Error creating presigned URL", err);
    throw err;
  }
};

export const getPresignedUrl = async (
  s3Client: S3Client,
  {
    bucket,
    key,
    fileSize,
    partSize,
    region = "ap-northeast-2",
    metadata,
  }: {
    bucket: string;
    key: string;
    fileSize?: string;
    partSize?: string;
    region: string;
    metadata?: { [key: string]: string };
  },
  mode: "single" | "multipart" = "single",
): Promise<{
  mode: "single" | "multipart";
  urls: string[];
  uploadId?: string | undefined;
}> => {
  try {

    if (mode === "single") {
      const url = await getSinglePartPresignedUrl(s3Client, { bucket, key, metadata });

      return { urls: [url], mode: "single" };
    }

    if (!fileSize) {
      throw new Error("fileSize is required");
    }

    const multipartResults = await getMultipartPresignedUrl(s3Client, {
      bucket,
      key,
      fileSize,
      partSize,
      metadata,
    });

    return { ...multipartResults, mode: "multipart" };
  } catch (error) {
    console.log("Error creating presigned URL", error);
    throw error;
  }
};

export const completeMultipartUpload = async (s3Client: S3Client, {
  bucket,
  key,
  uploadId,
}: {
  bucket: string;
  key: string;
  uploadId: string;
}) => {
  try {
    const listPartsCommandOutput = await s3Client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );

    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: listPartsCommandOutput.Parts?.map((part) => ({
            ETag: part.ETag,
            PartNumber: part.PartNumber,
          })),
        },
      }),
    );
  } catch (err: any) {
    // MalformedXML: The XML you provided was not well-formed or did not validate against our published schema
    if (err.name === "MalformedXML") {
      throw createJsonError({
        statusCode: 400,
        code: "FileEmpty_MalformedXML",
        message: "File is not uploaded yet",
      });
    }

    console.log("Error completing multipart upload", err);
    throw err;
  }
};

export const getMetadata = async <T>(s3Client: S3Client, { bucket, key }: { bucket: string; key: string }) => {
  try {
    const headObjectCommandOutput = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const metadata = headObjectCommandOutput.Metadata;

    return metadata as T;
  } catch (err) {
    console.log("Error getting metadata", err);
    throw err;
  }
};

export const getObject = async (s3Client: S3Client, { bucket, key }: { bucket: string; key: string }) => {
  try {
    const getObjectCommandOutput = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return getObjectCommandOutput;
  } catch (err) {
    console.log("Error getting object", err);
    throw err;
  }
};

export const getContentLength = async (s3Client: S3Client, { bucket, key }: { bucket: string; key: string }) => {
  try {
    const headObjectCommandOutput = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return headObjectCommandOutput.ContentLength;
  } catch (err) {
    console.log("Error getting metadata", err);
    throw err;
  }
};

export const getHeadCommandOutput = async (s3Client: S3Client, { bucket, key }: { bucket: string; key: string }) => {
  try {
    const headObjectCommandOutput = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return headObjectCommandOutput;
  } catch (err) {
    console.log("Error getting metadata", err);
    throw err;
  }
};

export const getListObjects = async (s3Client: S3Client, {
  bucket,
  prefix,
  ctoken,
}: {
  bucket: string;
  prefix: string;
  ctoken?: string;
}) => {
  try {
    const listObjectsCommandOutput = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: ctoken,
      }),
    );

    return listObjectsCommandOutput;
  } catch (err) {
    console.log("Error listing objects", err);
    throw err;
  }
};

// only for v1
export const getLatestVersionOfS3Object = async ({ bucket, seq }: { bucket: string; seq: string }) => {
  const s3Client = new S3Client();
  const params = {
    Bucket: bucket,
    Prefix: `${seq}/`,
    Delimiter: "/",
  };

  try {
    const data = await s3Client.send(new ListObjectsV2Command(params));
    let latest_version = 1;

    if (data.CommonPrefixes) {
      for (const prefixObject of data.CommonPrefixes) {
        if (!prefixObject.Prefix) {
          continue;
        }

        const ver = Number(prefixObject.Prefix.split("/")[1]);
        if (!isNaN(ver) && ver > latest_version) {
          latest_version = ver;
        }
      }
    }

    return latest_version;
  } catch (error) {
    console.log("Error listing objects:", error);
    throw error;
  }
};

export async function uploadToS3(
  fileContent: any,
  bucketName: string,
  s3Key: string,
  awsAccessKey: string,
  awsSecretKey: string,
  sessionToken?: string,
  contentType?: string,
) {
  console.log("📢 uploadToS3");
  console.log({
    fileContent: bucketName,
    s3Key,
    awsAccessKey,
    awsSecretKey,
    sessionToken,
  });

  // Set up AWS SDK v3 with your credentials
  const s3 = new S3Client({
    credentials: {
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
      sessionToken,
    },
    useGlobalEndpoint: true,
  });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        // ContentType: contentType || "text/plain",
      }),
    );
    console.log("File uploaded successfully.");
  } catch (error: any) {
    if (error.name === "PermanentRedirect") {
      function extractRegionFromEndpoint(endpoint: string) {
        // This regex pattern matches the region part of the S3 endpoint URL
        const match = endpoint.match(/s3[-.]([a-zA-Z0-9-]+)\.amazonaws\.com/);
        return match ? match[1] : null;
      }
      console.log("PermanentRedirect error:", error.Message);
      console.log("Please use the endpoint:", error.Endpoint);
      // Optional: Update your S3Client region based on the correct endpoint
      let correctRegion = extractRegionFromEndpoint(error.Endpoint);
      if (!correctRegion || correctRegion == undefined || correctRegion == null || correctRegion == "") {
        correctRegion = "us-east-1";
      }
      console.log("Updating region to:", correctRegion);
      const s3c2 = new S3Client({
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
          sessionToken,
        },
        region: correctRegion?.toString(),
      });
      // Retry the upload
      try {
        const retryResponse = await s3c2.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
          }),
        );
        console.log("File uploaded successfully after region update:", retryResponse);
      } catch (retryError) {
        console.log("Error uploading file after region update:", retryError);
      }
    } else {
      console.log("Error uploading file:", error);
    }
    console.log("Error uploading file:", error);
  }
}

export const getDownloadPresignedUrl = async (s3Client: S3Client, {
  bucket,
  key,
  downloadFileName,
}: {
  bucket: string;
  key: string;
  downloadFileName?: string;
}) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition:
        "attachment;" + (downloadFileName ? ` filename="${encodeURI(downloadFileName)}"` : ""),
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 6000 });

    return url;
  } catch (error) {
    console.log("Error creating presigned URL", error);
    throw error;
  }
};
