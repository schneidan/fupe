import { readFile } from 'fs/promises';
import { join } from 'path';
import { ImageResponse } from 'next/og';
import { resolveFupeEnv, faviconSlashColor } from '@/lib/fupe-env';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const slash = faviconSlashColor(resolveFupeEnv());
  const base = await readFile(join(process.cwd(), 'src/app/icon-base.png'));
  const src = `data:image/png;base64,${base.toString('base64')}`;

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
          width={64}
          height={64}
          style={{ width: 64, height: 64 }}
        />
        {slash ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 90,
              height: 10,
              background: slash,
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              borderRadius: 2,
            }}
          />
        ) : null}
      </div>
    ),
    { ...size },
  );
}
