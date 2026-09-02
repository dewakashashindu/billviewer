import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBillByNumber } from '@/lib/mockBills';

const ENCRYPTION_KEY = 'MySecretKey12345';
const IV = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F]);

function decryptBillNumber(encryptedText: string): string | null {
  try {
    let base64 = encryptedText.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const encryptedBuffer = Buffer.from(base64, 'base64');
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), IV);
    
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const encryptedId = searchParams.get('id');

  if (!encryptedId) {
    return NextResponse.json({ error: 'No encrypted ID provided' }, { status: 400 });
  }

  // Decrypt කරනවා
  const billNumber = decryptBillNumber(encryptedId);

  if (!billNumber) {
    return NextResponse.json({ error: 'Invalid encrypted ID' }, { status: 400 });
  }

  // Bill data එක හොයනවා
  const bill = getBillByNumber(billNumber);

  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, bill });
}