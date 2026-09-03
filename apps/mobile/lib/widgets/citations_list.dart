import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/lookup_result.dart';
import '../theme/fupe_theme.dart';

class CitationsList extends StatelessWidget {
  const CitationsList({super.key, required this.citations});

  final List<Citation> citations;

  @override
  Widget build(BuildContext context) {
    final weak = citations.isEmpty ||
        citations.length == 1 ||
        citations.every((c) => c.stale);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FupeColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FupeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CITATIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
              color: FupeColors.muted,
            ),
          ),
          const SizedBox(height: 12),
          if (citations.isEmpty)
            const Text(
              'No citations yet. Low confidence — treat as incomplete.',
              style: TextStyle(color: FupeColors.muted, fontSize: 14),
            )
          else ...[
            if (weak)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  citations.length == 1
                      ? 'Limited evidence — only one citation. Confirm with primary sources.'
                      : 'Limited evidence — citations may be outdated. Confirm with primary sources.',
                  style: const TextStyle(
                    color: FupeColors.muted,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ),
            ...citations.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => launchUrl(Uri.parse(c.url)),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: c.title,
                          style: const TextStyle(
                            color: FupeColors.text,
                            decoration: TextDecoration.underline,
                            decorationColor: FupeColors.muted,
                          ),
                        ),
                        if (c.stale)
                          const TextSpan(
                            text: ' (may be outdated)',
                            style: TextStyle(
                              color: FupeColors.muted,
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
