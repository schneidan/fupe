import 'package:flutter/material.dart';

import '../models/lookup_result.dart';
import '../theme/fupe_theme.dart';

class OwnershipChain extends StatelessWidget {
  const OwnershipChain({super.key, required this.chain});

  final List<ChainNode> chain;

  @override
  Widget build(BuildContext context) {
    if (chain.isEmpty) return const SizedBox.shrink();

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
            'OWNERSHIP CHAIN',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
              color: FupeColors.muted,
            ),
          ),
          const SizedBox(height: 16),
          ...chain.asMap().entries.map((entry) {
            final index = entry.key;
            final node = entry.value;
            final isPe = node.type == 'PE_FIRM' || node.type == 'VC_FIRM';

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: FupeColors.elevated,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${index + 1}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: FupeColors.muted,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: RichText(
                      text: TextSpan(
                        style: TextStyle(
                          fontSize: 15,
                          color: isPe ? FupeColors.verdictYes : FupeColors.text,
                          fontWeight: FontWeight.w500,
                        ),
                        children: [
                          TextSpan(text: node.name),
                          TextSpan(
                            text: '  ${node.type.replaceAll('_', ' ')}',
                            style: const TextStyle(
                              fontSize: 13,
                              color: FupeColors.muted,
                              fontWeight: FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
