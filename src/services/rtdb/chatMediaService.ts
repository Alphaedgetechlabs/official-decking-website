import imageCompression from 'browser-image-compression';
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { storage } from '../../firebase';
import type { ChatMediaType } from '../../types/chat';

const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.75,
};

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
]);

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getMediaTypeFromFile(file: File): ChatMediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';

  return null;
}

export async function compressChatImage(file: File): Promise<File> {
  return imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
}

export async function generateVideoThumbnail(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
    });

    video.currentTime = Math.min(1, video.duration / 4 || 0);

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create thumbnail');

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Failed to generate thumbnail'));
        },
        'image/jpeg',
        0.7,
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadFileWithProgress(
  path: string,
  file: Blob,
  onProgress: (progress: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const progress =
          snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : 0;
        onProgress(progress);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
}

export interface UploadedChatMedia {
  mediaUrl: string;
  mediaType: ChatMediaType;
  thumbnailUrl?: string;
  fileName: string;
}

export async function uploadChatMedia(
  storageFolder: string,
  file: File,
  mediaType: ChatMediaType,
  onProgress: (progress: number) => void,
): Promise<UploadedChatMedia> {
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name);
  let uploadFile: File | Blob = file;
  let thumbnailUrl: string | undefined;

  if (mediaType === 'image') {
    uploadFile = await compressChatImage(file);
  }

  if (mediaType === 'video') {
    const thumbnailBlob = await generateVideoThumbnail(file);
    thumbnailUrl = await uploadFileWithProgress(
      `${storageFolder}/${timestamp}_thumb.jpg`,
      thumbnailBlob,
      () => {},
    );
  }

  const mediaUrl = await uploadFileWithProgress(
    `${storageFolder}/${timestamp}_${safeName}`,
    uploadFile,
    onProgress,
  );

  return {
    mediaUrl,
    mediaType,
    thumbnailUrl,
    fileName: file.name,
  };
}

export function getMediaPreviewLabel(mediaType: ChatMediaType, fileName?: string): string {
  if (mediaType === 'image') return 'Photo';
  if (mediaType === 'video') return 'Video';
  return fileName ?? 'Document';
}
