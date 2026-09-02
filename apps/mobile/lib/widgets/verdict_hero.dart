import 'package:flutter/material.dart';

import '../models/lookup_result.dart';
import '../theme/fupe_theme.dart';

class VerdictHero extends StatelessWidget {
  const VerdictHero({super.key, required this.result});

  final LookupResult result;

  @override
  Widget build(BuildContext context) {
    final isYes = result.isPrivateEquityOwned;
    final verdictColor = isYes ? FupeColors.verdictYes : FupeColors.verdictNo;

    return Column(
      children: [
        Text(
          isYes ? 'YES' : 'NO',
          style: TextStyle(
            fontSize: 88,
            fontWeight: FontWeight.w900,
            height: 1,
            color: verdictColor,
            shadows: [
              Shadow(
                color: verdictColor.withValues(alpha: 0.45),
                blurRadius: 40,
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Text(
          isYes
              ? '${result.matchedItem} is backed by Private Equity'
                  '${result.ultimateParent != null ? ' — ultimate parent: ${result.ultimateParent!.name}' : ''}'
              : 'We found no PE/VC firm in the ownership chain for ${result.matchedItem}.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 18,
            color: FupeColors.muted,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
