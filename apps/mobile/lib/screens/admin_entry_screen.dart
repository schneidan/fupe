import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

/// Discovery + role gate for staff tools (full hub is Phase 7.6.2).
class AdminEntryScreen extends StatelessWidget {
  const AdminEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Admin')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _body(context, auth, user),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, AuthService auth, AuthUser? user) {
    if (!auth.ready) {
      return const Center(child: CircularProgressIndicator());
    }

    if (!auth.isSignedIn) {
      return _card(
        title: 'Sign in required',
        body:
            'Staff tools live behind your account. Sign in on the Contribute tab, then open Admin again.',
        actionLabel: 'Back',
        onAction: () => Navigator.of(context).maybePop(),
      );
    }

    if (user!.isAdmin) {
      return _card(
        title: 'Admin',
        body:
            'Signed in as ${user.email}. The full mobile hub (dashboard, users, queue, billing) ships in the next update. The API already requires role=admin for /api/v1/admin/*.',
      );
    }

    if (user.isModerator) {
      return _card(
        title: 'Moderator',
        body:
            'Signed in as ${user.email}. You can review the contribution queue; full admin sections stay admin-only. Queue tools on mobile land with the admin hub.',
      );
    }

    return _card(
      title: 'Admin role required',
      body:
          'This area is for staff. Your account (${user.email}) has no admin or moderator role. The API still rejects /admin calls without the right role.',
      actionLabel: 'Back',
      onAction: () => Navigator.of(context).maybePop(),
    );
  }

  Widget _card({
    required String title,
    required String body,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: FupeColors.text,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          body,
          style: const TextStyle(
            color: FupeColors.muted,
            fontSize: 15,
            height: 1.5,
          ),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 24),
          OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ],
    );
  }
}
