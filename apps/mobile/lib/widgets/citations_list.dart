import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/lookup_result.dart';
import '../theme/fupe_theme.dart';

class CitationsList extends StatelessWidget {
  const CitationsList({super.key, required this.citations});

  final List<Citation> citations;

  @override
  Widget build(BuildContext context) {
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
              'No citations yet.',
              style: TextStyle(color: FupeColors.muted, fontSize: 14),
            )
          else
            ...citations.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => launchUrl(Uri.parse(c.url)),
                  child: Text(
                    c.title,
                    style: const TextStyle(
                      color: FupeColors.text,
                      decoration: TextDecoration.underline,
                      decorationColor: FupeColors.muted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
