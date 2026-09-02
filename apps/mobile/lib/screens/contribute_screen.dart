import 'package:flutter/material.dart';

import '../theme/fupe_theme.dart';

class ContributeScreen extends StatelessWidget {
  const ContributeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Contribute',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: FupeColors.text,
              ),
            ),
            SizedBox(height: 16),
            Text(
              'Suggest ownership corrections with citations. '
              'Contributor accounts and edit submission are coming soon.',
              style: TextStyle(color: FupeColors.muted, fontSize: 15, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
