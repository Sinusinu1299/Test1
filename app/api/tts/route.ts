import { NextRequest, NextResponse } from 'next/server';
import { formatGeminiError, getGeminiClient, withGeminiRetry } from '@/lib/gemini';
import { getVoicePersonaConfig, type VoicePersonaId } from '@/lib/voice-personas';

export type { VoicePersonaId };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text || '').trim();
    const config = getVoicePersonaConfig(body.persona);

    if (!text) {
      return NextResponse.json({ error: 'Text is required for speech.' }, { status: 400 });
    }

    const ai = getGeminiClient();

    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: config.ttsStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voiceName,
              },
            },
          },
        },
      })
    );

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return NextResponse.json(
        { error: 'No audio returned from Gemini TTS.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      persona: config.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatGeminiError(error, 'TTS generation failed.') },
      { status: 500 }
    );
  }
}
