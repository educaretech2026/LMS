import * as ImagePicker from 'expo-image-picker';
import { fetchApi } from './api';

export async function uploadMobileFile(
  uri: string,
  filename: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  try {
    // 1. Fetch presigned upload URL from API
    const query = `type=FILE&filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(mimeType)}`;
    const { uploadUrl, finalUrl } = await fetchApi<{ uploadUrl: string; finalUrl: string }>(
      `/study-materials/upload-url?${query}`
    );

    // 2. Fetch binary blob from local mobile uri
    const response = await fetch(uri);
    const blob = await response.blob();

    // 3. Upload directly to S3 / Cloudflare R2
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': mimeType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload to storage failed with status ${uploadResponse.status}`);
    }

    return finalUrl;
  } catch (error: any) {
    console.error('File upload failed:', error);
    throw new Error(error.message || 'Failed to upload attachment');
  }
}

export async function pickAndUploadImage(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    const filename = `img_${Date.now()}.jpg`;
    return await uploadMobileFile(asset.uri, filename, 'image/jpeg');
  } catch (err: any) {
    console.error('Error picking and uploading image:', err);
    throw err;
  }
}

