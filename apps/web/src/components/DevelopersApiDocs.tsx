'use client';

const SAMPLE_RESPONSE = {
  matched_item: 'Panera Bread',
  entity_id: 'e_panera',
  is_private_equity_owned: true,
  ultimate_parent: { name: 'JAB Holding Company', type: 'PE_FIRM' },
  ownership_chain: [
    { name: 'Panera Bread', type: 'BRAND' },
    { name: 'Panera Brands', type: 'PARENT_CORP' },
    { name: 'JAB Holding Company', type: 'PE_FIRM' },
  ],
  citations: [
    {
      title: 'Example ownership source',
      url: 'https://example.com/panera-ownership',
      retrieved_at: '2026-01-15T00:00:00.000Z',
      stale: false,
    },
  ],
  related: {
    same_ultimate_parent: [
      {
        id: 'e_einstein',
        name: 'Einstein Bros. Bagels',
        slug: 'einstein-bros-bagels',
        type: 'BRAND',
      },
    ],
    similar_pe_backed: [],
  },
};

const CURL_EXAMPLE = `curl -s -X POST http://localhost:3000/api/v1/lookup \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: fupe_YOUR_KEY" \\
  -d '{"type":"TEXT","query":"Panera Bread"}'`;

export function DevelopersApiDocs() {
  return (
    <section className="space-y-6 text-sm text-fupe-muted">
      <div>
        <h2 className="font-semibold text-fupe-text">API documentation</h2>
        <p className="mt-2">
          Interactive OpenAPI (Swagger) lives at{' '}
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fupe-text underline-offset-2 hover:underline"
          >
            /api/docs
          </a>
          . Raw spec:{' '}
          <a
            href="/api/docs-json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fupe-text underline-offset-2 hover:underline"
          >
            /api/docs-json
          </a>
          .
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-fupe-text">
          Example — <code className="text-fupe-text">POST /api/v1/lookup</code>
        </h3>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-fupe-border bg-fupe-bg p-4 text-xs text-fupe-text">
          {CURL_EXAMPLE}
        </pre>
      </div>

      <div>
        <h3 className="font-semibold text-fupe-text">Example response</h3>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-fupe-border bg-fupe-bg p-4 text-xs text-fupe-text">
          {JSON.stringify(SAMPLE_RESPONSE, null, 2)}
        </pre>
      </div>
    </section>
  );
}
