import { readFile } from 'fs/promises';
import { join } from 'path';
import { ImageResponse } from 'next/og';
import { resolveFupeEnv, faviconSlashColor } from '@/lib/fupe-env';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const slash = faviconSlashColor(resolveFupeEnv());
  const base = await readFile(join(process.cwd(), 'src/app/icon-base.png'));
  const src = `data:image/png;base64,${base.toString('base64')}`;
  const barH = slash ? 22 : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#000000',
        }}
      >
        <img
          src={src}
          alt=""
          width={180}
          height={180}
          style={{ width: 180, height: 180 }}
        />
        {slash ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 250,
              height: barH,
              background: slash,
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              borderRadius: 4,
            }}
          />
        ) : null}
      </div>
    ),
    { ...size },
  );
}
