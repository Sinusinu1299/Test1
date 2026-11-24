import { NextRequest, NextResponse } from 'next/server';
import { formatGeminiError, getGeminiClient, withGeminiRetry } from '@/lib/gemini';
import { getVoicePersonaConfig } from '@/lib/voice-personas';
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
    const personaConfig = getVoicePersonaConfig(body.persona);
    const history: ChatTurn[] = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const incomingState: PhoneState = {
      ...INITIAL_PHONE_STATE,
      ...(body.phoneState || {}),
    };

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are Mimi, the user's personal female AI phone assistant with full phone control.
Active Personality Mode (${personaConfig.label}):
- ${personaConfig.assistantPrompt}

Language & Execution Rules:
- Reply naturally in the same language/style the user uses (Hinglish, Hindi, or English).
- Keep replies short (1 to 2 short sentences) so they sound adorable and natural when spoken aloud by your cute voice.
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

    const firstResponse = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: DEVICE_FUNCTION_DECLARATIONS }],
        },
      })
    );

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
        const secondResponse = await withGeminiRetry(() =>
          ai.models.generateContent({
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
          })
        );
        finalReplyText = secondResponse.text?.trim() || finalReplyText;
      }
    }

    if (!finalReplyText) {
      const actionSummary = actions.map((a) => a.summary).join(' aur ');
      if (actions.length > 0) {
        finalReplyText =
          personaConfig.id === 'jaan'
            ? `Haan Jaan, maine ${actionSummary} kar diya hai!`
            : personaConfig.id === 'flirty'
              ? `Lo kar diya! ${actionSummary} — ab ek cute si smile toh banti hai na?`
              : personaConfig.id === 'friendly'
                ? `Done yaar! ${actionSummary} set ho gaya!`
                : `Ji bilkul! Maine ${actionSummary} kar diya hai.`;
      } else {
        finalReplyText =
          personaConfig.id === 'jaan'
            ? 'Haan Jaan, main sun rahi hoon! Bolo kya karna hai?'
            : 'Haanji, main sun rahi hoon! Bolo kya karna hai?';
      }
    }

    const launchUri = actions.find((a) => a.launchUri)?.launchUri || null;

    return NextResponse.json({
      replyText: finalReplyText,
      persona: personaConfig.id,
      actions,
      updatedPhoneState: workingState,
      launchUri,
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatGeminiError(error, 'Assistant request failed.') },
      { status: 500 }
    );
  }
}
