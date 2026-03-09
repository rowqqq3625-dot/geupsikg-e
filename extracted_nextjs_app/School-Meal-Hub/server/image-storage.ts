import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const isS3Configured = Boolean(
  process.env.S3_ENDPOINT &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET
);

let s3Client: S3Client | null = null;
if (isS3Configured) {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

export function generateKey(userId: string, date: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const hash = crypto.createHash("sha256").update(`${userId}:${date}:${Date.now()}`).digest("hex").slice(0, 8);
  return `cleanplate/${userId}/${date}_${hash}${ext}`;
}

export async function uploadImage(
  fileBuffer: Buffer,
  contentType: string,
  key: string
): Promise<{ url: string; key: string }> {
  if (isS3Configured && s3Client) {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }));
    const publicUrl = process.env.S3_PUBLIC_URL
      ? `${process.env.S3_PUBLIC_URL}/${key}`
      : `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
    return { url: publicUrl, key };
  }

  // 로컬 파일 저장 (개발 환경 fallback)
  // TODO: 추후 EXIF 제거(sharp 라이브러리) 확장 포인트
  const safeKey = key.replace(/\//g, "_");
  const filePath = path.join(UPLOADS_DIR, safeKey);
  fs.writeFileSync(filePath, fileBuffer);
  const url = `/uploads/${safeKey}`;
  return { url, key };
}

export { isS3Configured };
