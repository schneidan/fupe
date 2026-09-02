import 'package:flutter/material.dart';

import '../models/lookup_result.dart';
import '../screens/result_screen.dart';
import '../theme/fupe_theme.dart';

class DidYouKnow extends StatelessWidget {
  const DidYouKnow({super.key, required this.result});

  final LookupResult result;

  @override
  Widget build(BuildContext context) {
    final siblings = result.related?.sameUltimateParent ?? [];
    final similar = result.related?.similarPeBacked ?? [];
    final isPe = result.isPrivateEquityOwned;
    final peParent = result.ultimateParent;

    Widget section({required Widget child}) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: FupeColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: FupeColors.border),
        ),
        child: child,
      );
    }

    if (isPe && siblings.isNotEmpty && peParent != null) {
      return section(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'DID YOU KNOW?',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 2,
                color: FupeColors.muted,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${result.matchedItem} shares ultimate parent ${peParent.name} with:',
              style: const TextStyle(color: FupeColors.text, fontSize: 14),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: siblings.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final entity = siblings[i];
                  return ActionChip(
                    label: Text(entity.name),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ResultScreen(query: entity.name),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      );
    }

    if (!isPe && similar.isNotEmpty) {
      return section(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'DID YOU KNOW?',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 2,
                color: FupeColors.muted,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Other PE-backed brands in the same sector:',
              style: TextStyle(color: FupeColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: similar.length.clamp(0, 6),
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final entity = similar[i];
                  return ActionChip(
                    label: Text(entity.name),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ResultScreen(query: entity.name),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      );
    }

    return section(
      child: const Text(
        'An increasing share of household brands are PE portfolio companies. Browse the directory to explore who owns what.',
        style: TextStyle(color: FupeColors.muted, fontSize: 14),
      ),
    );
  }
}
