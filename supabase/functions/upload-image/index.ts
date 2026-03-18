import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { crypto } from 'https://deno.land/std@0.119.0/crypto/mod.ts';
import { encode as encodeBase64 } from 'https://deno.land/std@0.119.0/encoding/base64.ts';

const BUCKET_NAME = 'KitchenNZ';
const REGION = 'us-west-004';
const ENDPOINT = `https://s3.${REGION}.backblazeb2.com`;
const KEY_ID = Deno.env.get('B2_KEY_ID')!;
const APP_KEY = Deno.env.get('B2_APP_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-file-name, x-file-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// AWS SigV4 signing for B2 S3-compatible API
async function hmacSHA256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const keyObj = await crypto.subtle.importKey(
    'raw', key instanceof ArrayBuffer ? key : key.buffer,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(message));
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSHA256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, service);
  const kSigning = await hmacSHA256(kService, 'aws4_request');
  return kSigning;
}

async function signRequest(
  method: string,
  url: string,
  body: ArrayBuffer,
  contentType: string
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;

  const bodyHash = await sha256Hex(body);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const requestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest).buffer);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${requestHash}`;

  const signingKey = await getSigningKey(APP_KEY, dateStamp, REGION, 's3');
  const signatureBuffer = await hmacSHA256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorizationHeader,
    'Content-Type': contentType,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': amzDate,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const fileName = req.headers.get('x-file-name') || `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const contentType = req.headers.get('x-file-type') || 'image/jpeg';

    const bodyBuffer = await req.arrayBuffer();

    const uploadUrl = `${ENDPOINT}/${BUCKET_NAME}/${fileName}`;
    const headers = await signRequest('PUT', uploadUrl, bodyBuffer, contentType);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Length': bodyBuffer.byteLength.toString() },
      body: bodyBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('B2 upload error:', errText);
      throw new Error(`B2 upload failed: ${uploadRes.status} ${errText}`);
    }

    // Public URL — bucket must be set to "Public" in B2
    const publicUrl = `https://f004.backblazeb2.com/file/${BUCKET_NAME}/${fileName}`;

    return new Response(JSON.stringify({ url: publicUrl, key: fileName }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
