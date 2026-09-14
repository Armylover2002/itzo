import crypto from 'node:crypto';
import { Blob } from 'node:buffer';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(DATA_URL_PATTERN);

  if (!match) {
    throw new ApiError(400, 'A valid base64 image data URL is required');
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = mimeType.split('/')[1] || 'jpg';

  return {
    mimeType,
    base64,
    extension,
  };
};

const buildSignature = (params, apiSecret) => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};

export const uploadDataUrlToCloudinary = async ({
  dataUrl,
  folder = env.cloudinary.folder,
  publicIdPrefix = 'driver-document',
  publicIdSuffix = '',
}) => {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new ApiError(500, 'Cloudinary credentials are not configured');
  }

  const { mimeType, base64, extension } = parseDataUrl(dataUrl);
  const buffer = Buffer.from(base64, 'base64');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `${publicIdPrefix}-${Date.now()}${publicIdSuffix ? `-${publicIdSuffix}` : ''}`;

  const signature = buildSignature(
    {
      folder,
      format: 'webp',
      public_id: publicId,
      timestamp,
    },
    env.cloudinary.apiSecret,
  );

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), `upload.${extension}`);
  formData.append('api_key', env.cloudinary.apiKey);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('format', 'webp');
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status || 502, payload?.error?.message || 'Cloudinary upload failed');
  }

  return {
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
    resourceType: payload.resource_type,
    format: payload.format,
    bytes: payload.bytes,
    width: payload.width,
    height: payload.height,
    originalFilename: payload.original_filename,
    createdAt: payload.created_at,
    raw: payload,
  };
};
