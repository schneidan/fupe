import 'package:flutter_test/flutter_test.dart';

import 'package:fupe_mobile/navigation/deep_links.dart';
import 'package:fupe_mobile/screens/admin_section.dart';
import 'package:fupe_mobile/services/auth_service.dart';

AuthUser _user(String role) => AuthUser(
      id: '1',
      email: 'a@b.c',
      trustScore: 10,
      role: role,
      emailVerified: true,
    );

void main() {
  test('AuthUser.isAdmin is admin-only; isModerator includes admin', () {
    expect(_user('admin').isAdmin, isTrue);
    expect(_user('admin').isModerator, isTrue);
    expect(_user('admin').canSeeAdminEntry, isTrue);

    expect(_user('moderator').isAdmin, isFalse);
    expect(_user('moderator').isModerator, isTrue);
    expect(_user('moderator').canSeeAdminEntry, isTrue);

    expect(_user('user').isAdmin, isFalse);
    expect(_user('user').isModerator, isFalse);
    expect(_user('user').canSeeAdminEntry, isFalse);
  });

  test('moderators may open Contributions only; admin opens every section', () {
    final admin = _user('admin');
    final mod = _user('moderator');
    final user = _user('user');

    for (final s in AdminSection.values) {
      expect(s.canAccess(admin), isTrue);
      expect(s.canAccess(user), isFalse);
    }
    expect(AdminSection.contributions.canAccess(mod), isTrue);
    expect(AdminSection.dashboard.canAccess(mod), isFalse);
    expect(AdminSection.users.canAccess(mod), isFalse);
    expect(AdminSection.subscriptions.canAccess(mod), isFalse);
    expect(AdminSection.usage.canAccess(mod), isFalse);
  });

  test('fupe://admin is a staff deep link, not an entity slug', () {
    final admin = Uri.parse('fupe://admin');
    expect(isAdminDeepLink(admin), isTrue);
    expect(entitySlugFromUri(admin), isNull);

    expect(isAdminDeepLink(Uri.parse('fupe://admin/users')), isTrue);
    expect(adminSectionFromUri(Uri.parse('fupe://admin')), isNull);
    expect(
      adminSectionFromUri(Uri.parse('fupe://admin/contributions')),
      AdminSection.contributions,
    );
    expect(
      adminSectionFromUri(Uri.parse('fupe://admin/users')),
      AdminSection.users,
    );
    expect(isAdminDeepLink(Uri.parse('fupe://entity/panera-bread')), isFalse);
    expect(entitySlugFromUri(Uri.parse('fupe://entity/panera-bread')), 'panera-bread');
  });
}
