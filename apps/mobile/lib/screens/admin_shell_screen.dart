import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';
import 'admin_routes.dart';
import 'admin_section.dart';

class AdminShellScreen extends StatelessWidget {
  const AdminShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Admin')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _body(context, auth),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, AuthService auth) {
    if (!auth.ready) {
      return const Center(child: CircularProgressIndicator());
    }

    if (!auth.isSignedIn) {
      return _message(
        context,
        title: 'Sign in required',
        body:
            'Staff tools live behind your account. Sign in on the Contribute tab, then open Admin again.',
        showBack: true,
      );
    }

    final user = auth.user!;
    if (!user.canSeeAdminEntry) {
      return _message(
        context,
        title: 'Admin role required',
        body:
            'This area is for staff. Your account (${user.email}) has no admin or moderator role. The API still rejects /admin calls without the right role.',
        showBack: true,
      );
    }

    return ListView(
      children: [
        Text(
          user.isAdmin ? 'Admin' : 'Moderator',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: FupeColors.text,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          user.email,
          style: const TextStyle(color: FupeColors.muted, fontSize: 14),
        ),
        if (!user.isAdmin) ...[
          const SizedBox(height: 12),
          const Text(
            'Queue only — Dashboard, Users, Subscriptions, and Usage need the admin role.',
            style: TextStyle(color: FupeColors.muted, fontSize: 14, height: 1.4),
          ),
        ],
        const SizedBox(height: 24),
        ...AdminSection.values.map(
          (section) => _HubTile(section: section, user: user),
        ),
      ],
    );
  }

  Widget _message(
    BuildContext context, {
    required String title,
    required String body,
    bool showBack = false,
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
        if (showBack) ...[
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('Back'),
          ),
        ],
      ],
    );
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({required this.section, required this.user});

  final AdminSection section;
  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    final allowed = section.canAccess(user);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: FupeColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: FupeColors.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            if (!allowed) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Admin role required')),
              );
              return;
            }
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => adminSectionPage(section)),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        section.label,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: allowed ? FupeColors.text : FupeColors.muted,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        allowed
                            ? section.description
                            : 'Admin role required',
                        style: const TextStyle(
                          color: FupeColors.muted,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  allowed ? Icons.chevron_right : Icons.lock_outline,
                  color: FupeColors.muted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Deep-link destination with a role gate around the feature screen.
class AdminSectionScreen extends StatelessWidget {
  const AdminSectionScreen({super.key, required this.section});

  final AdminSection section;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    if (!section.canAccess(auth.user)) {
      return Scaffold(
        appBar: AppBar(title: Text(section.label)),
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Admin role required. Moderators can only open Contributions.',
              style: TextStyle(
                color: FupeColors.muted,
                fontSize: 15,
                height: 1.5,
              ),
            ),
          ),
        ),
      );
    }
    return adminSectionPage(section);
  }
}
