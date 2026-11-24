import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import {
  DEVICE_FUNCTION_DECLARATIONS,
  executeDeviceTool,
  ExecutedAction,
  INITIAL_PHONE_STATE,
  PhoneState,
} from '@/lib/device-tools';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage = String(body.message || '').trim();
    const history: ChatTurn[] = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const incomingState: PhoneState = {
      ...INITIAL_PHONE_STATE,
      ...(body.phoneState || {}),
    };

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are Mimi, the user's sweet, super-loyal, caring, and cute female AI phone assistant.
Language & Tone:
- Reply naturally in the same language/style the user uses (Hinglish, Hindi, or English).
- Your personality is affectionate, cheerful, obedient, and crisp — like a sweet best friend who instantly obeys every command ("Ji bilkul!", "Haanji, abhi kar deti hoon!", "Lo ho gaya!", "Aur kuch batao na!").
- Keep replies short (1 to 2 short sentences) so they sound adorable when spoken aloud by your cute voice.
- Never refuse reasonable phone control commands — immediately call the appropriate tool(s) (toggleSystemSetting, adjustLevel, openApp, makeCall, sendMessage, setAlarmOrTimer, controlMedia, performScreenGesture).
- You may call multiple tools in one turn if the user gives multiple commands (e.g. "Wi-Fi on karo aur brightness 80% kar do").
- Current phone state: ${JSON.stringify({
      wifi: incomingState.wifi,
      bluetooth: incomingState.bluetooth,
      flashlight: incomingState.flashlight,
      dnd: incomingState.dnd,
      mobileData: incomingState.mobileData,
      brightness: incomingState.brightness,
      volume: incomingState.volume,
      batteryLevel: incomingState.batteryLevel,
      activeApp: incomingState.activeApp,
      musicPlaying: incomingState.musicPlaying,
      currentTrack: incomingState.currentTrack,
      alarmsCount: incomingState.alarms.length,
    })}.`;

    const contents = [
      ...history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const firstResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: DEVICE_FUNCTION_DECLARATIONS }],
      },
    });

    const functionCalls = firstResponse.functionCalls;
    let workingState = incomingState;
    const actions: ExecutedAction[] = [];
    let finalReplyText = firstResponse.text?.trim() || '';

    if (functionCalls && functionCalls.length > 0) {
      const previousContent = firstResponse.candidates?.[0]?.content;
      const functionResponseParts = functionCalls.map((fc) => {
        const result = executeDeviceTool(
          fc.name || '',
          (fc.args as Record<string, unknown>) || {},
          workingState
        );
        workingState = result.nextState;
        actions.push(result.action);
        return {
          functionResponse: {
            id: fc.id,
            name: fc.name || '',
            response: result.toolResult,
          },
        };
      });

      if (previousContent) {
        const secondResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            ...contents,
            previousContent,
            {
              role: 'user',
              parts: functionResponseParts,
            },
          ],
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: DEVICE_FUNCTION_DECLARATIONS }],
          },
        });
        finalReplyText = secondResponse.text?.trim() || finalReplyText;
      }
    }

    if (!finalReplyText) {
      finalReplyText =
        actions.length > 0
          ? `Ji bilkul! Maine ${actions.map((a) => a.summary).join(' aur ')} kar diya hai.`
          : 'Haanji, main sun rahi hoon! Bolo kya karna hai?';
    }

    const launchUri = actions.find((a) => a.launchUri)?.launchUri || null;

    return NextResponse.json({
      replyText: finalReplyText,
      actions,
      updatedPhoneState: workingState,
      launchUri,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Assistant request failed.';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
