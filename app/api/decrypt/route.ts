import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Fixed IV - Production එකේදී random IV use කරන්න
const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03,
  0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0A, 0x0B,
  0x0C, 0x0D, 0x0E, 0x0F,
]);

/**
 * Decrypt bill number from encrypted URL-safe Base64 string
 */
function decryptBillNumber(encryptedText: string): string | null {
  try {
    // ✅ Runtime ENV validation
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      console.error('❌ ENCRYPTION_KEY not found in environment variables');
      return null;
    }

    if (key.length !== 16) {
      console.error(
        `❌ ENCRYPTION_KEY must be exactly 16 characters. Current length: ${key.length}`
      );
      return null;
    }

    // URL-safe Base64 → Standard Base64
    let base64 = encryptedText.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    // Decrypt
    const encryptedBuffer = Buffer.from(base64, 'base64');
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(key, 'utf8'),
      IV
    );

    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const result = decrypted.toString('utf8');

    // ✅ Basic validation - bill number format check
    if (!result || result.trim().length === 0) {
      console.error('❌ Decrypted value is empty');
      return null;
    }

    return result;
  } catch (error) {
    console.error('❌ Decryption error:', error);
    return null;
  }
}

/**
 * GET /api/decrypt?id=ENCRYPTED_ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const encryptedId = searchParams.get('id');

    // ⚠️ Validation: Missing ID
    if (!encryptedId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No encrypted ID provided',
          message: 'Please provide an encrypted bill ID in the URL',
        },
        { status: 400 }
      );
    }

    // ⚠️ Validation: ENV not configured
    if (!process.env.ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY is not configured!');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          message: 'Encryption key not configured. Please contact support.',
        },
        { status: 500 }
      );
    }

    // Decrypt the bill number
    const billNumber = decryptBillNumber(encryptedId);

    // ⚠️ Validation: Decryption failed
    if (!billNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid encrypted ID',
          message: 'The provided link is invalid or has expired',
        },
        { status: 400 }
      );
    }

    // ✅ Success response
    return NextResponse.json({
      success: true,
      billNumber,
      message: 'Bill number decrypted successfully',
    });
  } catch (error) {
    // ⚠️ Unexpected error
    console.error('❌ Unexpected error in decrypt API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - CORS support
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}