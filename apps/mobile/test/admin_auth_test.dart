import 'package:flutter_test/flutter_test.dart';

import 'package:fupe_mobile/navigation/deep_links.dart';
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

  test('fupe://admin is a staff deep link, not an entity slug', () {
    final admin = Uri.parse('fupe://admin');
    expect(isAdminDeepLink(admin), isTrue);
    expect(entitySlugFromUri(admin), isNull);

    expect(isAdminDeepLink(Uri.parse('fupe://admin/users')), isTrue);
    expect(isAdminDeepLink(Uri.parse('fupe://entity/panera-bread')), isFalse);
    expect(entitySlugFromUri(Uri.parse('fupe://entity/panera-bread')), 'panera-bread');
  });
}
