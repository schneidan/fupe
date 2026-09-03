import 'package:flutter/material.dart';

import 'admin_contributions_screen.dart';
import 'admin_dashboard_screen.dart';
import 'admin_section.dart';
import 'admin_subscriptions_screen.dart';
import 'admin_usage_screen.dart';
import 'admin_users_screen.dart';

Widget adminSectionPage(AdminSection section) {
  return switch (section) {
    AdminSection.dashboard => const AdminDashboardScreen(),
    AdminSection.users => const AdminUsersScreen(),
    AdminSection.contributions => const AdminContributionsScreen(),
    AdminSection.subscriptions => const AdminSubscriptionsScreen(),
    AdminSection.usage => const AdminUsageScreen(),
  };
}
