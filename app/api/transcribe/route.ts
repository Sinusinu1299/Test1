import { NextRequest, NextResponse } from 'next/server';
import { formatGeminiError, getGeminiClient, withGeminiRetry } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const audioBase64 = String(body.audioBase64 || '').trim();
    const mimeType = String(body.mimeType || 'audio/webm');

    if (!audioBase64) {
      return NextResponse.json({ error: 'Audio payload is required.' }, { status: 400 });
    }

    const ai = getGeminiClient();

    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken Hinglish, Hindi, or English voice command accurately in Latin/Roman script or Devanagari as spoken. Return only the transcription text.',
            },
          ],
        },
      })
    );

    return NextResponse.json({
      text: (response.text || '').trim(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatGeminiError(error, 'Audio transcription failed.') },
      { status: 500 }
    );
  }
}
