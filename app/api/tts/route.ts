import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export type VoicePersonaId = 'bubbly' | 'sweet' | 'calm';

const VOICE_STYLE_MAP: Record<VoicePersonaId, { voiceName: string; style: string }> = {
  bubbly: {
    voiceName: 'Zephyr',
    style:
      'Cute, cheerful, bubbly young girl voice with bright warmth, affectionate energy, and natural Hindi/Hinglish/English pronunciation',
  },
  sweet: {
    voiceName: 'Kore',
    style:
      'Sweet, gentle, friendly young female voice with a soft smile, caring tone, and natural Indian-friendly Hinglish clarity',
  },
  calm: {
    voiceName: 'Kore',
    style:
      'Soft-spoken, soothing, attentive young woman assistant voice, warm and comforting',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text || '').trim();
    const persona = (body.persona as VoicePersonaId) || 'bubbly';

    if (!text) {
      return NextResponse.json({ error: 'Text is required for speech.' }, { status: 400 });
    }

    const config = VOICE_STYLE_MAP[persona] || VOICE_STYLE_MAP.bubbly;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style: config.style,
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
    });

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
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'TTS generation failed.';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
