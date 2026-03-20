import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Uploads a File or Blob to Backblaze B2 via the Supabase Edge Function proxy.
 * Returns the public CDN URL of the uploaded file.
 */
export async function uploadToB2(file: File | Blob, folder = 'recipes'): Promise<string> {
  // Get current session for auth header
  const { data: { session } } = await supabase.auth.getSession();

  const ext = file instanceof File
    ? file.name.split('.').pop() || 'jpg'
    : (file.type.split('/')[1] || 'jpg');
  const randomName = `${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
  const fileName = `${folder}/${randomName}`;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'x-file-name': fileName,
      'x-file-type': file instanceof File ? file.type : 'image/jpeg',
    },
    body: file,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Upload to B2 failed');
  }

  const result = await response.json();
  return result.url as string;
}

/**
 * Deletes a file from B2 storage using its public URL.
 */
export async function deleteFromB2(url: string): Promise<void> {
  if (!url || !url.includes('backblazeb2.com')) return;

  try {
    // Extract the storage path (e.g., 'recipes/filename.jpg') from the full URL
    // Format: https://f004.backblazeb2.com/file/KitchenNZ/recipes/abc-123.jpg
    const parts = url.split('/file/KitchenNZ/');
    if (parts.length < 2) return;
    const fileName = parts[1];

    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'x-file-name': fileName,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      console.error('B2 delete failed:', err.error);
    }
  } catch (error) {
    console.error('Error during B2 deletion:', error);
  }
}
