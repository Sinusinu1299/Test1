import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const apkPath = path.join(
    process.cwd(),
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'debug',
    'app-debug.apk'
  );

  if (!fs.existsSync(apkPath)) {
    return NextResponse.json(
      {
        error:
          'Debug APK has not been built on this server yet. Run ./gradlew assembleDebug in /android or download via GitHub Actions.',
      },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(apkPath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="jassi-ai-debug.apk"',
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function HEAD() {
  const apkPath = path.join(
    process.cwd(),
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'debug',
    'app-debug.apk'
  );

  if (!fs.existsSync(apkPath)) {
    return new NextResponse(null, { status: 404 });
  }

  const stat = fs.statSync(apkPath);
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(stat.size),
    },
  });
}
