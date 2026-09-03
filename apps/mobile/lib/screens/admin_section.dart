import '../services/auth_service.dart';

enum AdminSection {
  dashboard,
  users,
  contributions,
  subscriptions,
  usage;

  String get label => switch (this) {
        AdminSection.dashboard => 'Dashboard',
        AdminSection.users => 'Users',
        AdminSection.contributions => 'Contributions',
        AdminSection.subscriptions => 'Subscriptions',
        AdminSection.usage => 'API usage',
      };

  String get description => switch (this) {
        AdminSection.dashboard => 'Counts for edits, users, and paid subs.',
        AdminSection.users => 'Roles, trust, verification, and keys.',
        AdminSection.contributions => 'Approve or reject pending edits.',
        AdminSection.subscriptions => 'Tiers, period end, complimentary upgrades.',
        AdminSection.usage => 'Requests, IMAGE blocks, rate-limit hits.',
      };

  String get pathSegment => name;

  /// Moderators may open Contributions; everything else is admin-only.
  bool get adminOnly => this != AdminSection.contributions;

  bool canAccess(AuthUser? user) {
    if (user == null) return false;
    if (user.isAdmin) return true;
    if (user.isModerator && !adminOnly) return true;
    return false;
  }

  static AdminSection? tryParse(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    for (final s in AdminSection.values) {
      if (s.pathSegment == raw || s.name == raw) return s;
    }
    if (raw == 'edits') return AdminSection.contributions;
    return null;
  }
}
