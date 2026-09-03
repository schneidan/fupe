import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/admin_api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';
import 'admin_routes.dart';
import 'admin_section.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  AdminStats? _stats;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    final token = auth.token;
    if (token == null) {
      setState(() {
        _error = 'Sign in required';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final stats = await context.read<AdminApiService>().fetchStats(token);
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _open(AdminSection section) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => adminSectionPage(section)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _stats == null
            ? ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: CircularProgressIndicator()),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: FupeColors.verdictYes),
                      ),
                    ),
                  if (_stats != null) ...[
                    _StatGrid(stats: _stats!, onOpen: _open),
                    const SizedBox(height: 24),
                    const Text(
                      'Pull to refresh. Tap a card to open that section.',
                      style: TextStyle(color: FupeColors.muted, fontSize: 13),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.stats, required this.onOpen});

  final AdminStats stats;
  final void Function(AdminSection) onOpen;

  @override
  Widget build(BuildContext context) {
    final cards = <({String label, int value, AdminSection? section})>[
      (label: 'Pending edits', value: stats.pendingEdits, section: AdminSection.contributions),
      (label: 'New users (7d)', value: stats.newUsers7d, section: AdminSection.users),
      (label: 'New users (24h)', value: stats.newUsers24h, section: AdminSection.users),
      (label: 'Paid subs', value: stats.paidSubscribers, section: AdminSection.subscriptions),
      (label: 'Ingest matches', value: stats.pendingIngestMatches, section: AdminSection.contributions),
      (label: 'Requests today', value: stats.requestsToday, section: AdminSection.usage),
      (label: 'Active keys', value: stats.totalApiKeys, section: AdminSection.usage),
      (label: 'Staff actions (7d)', value: stats.auditActions7d, section: null),
      (label: 'Total users', value: stats.totalUsers, section: AdminSection.users),
      (label: 'Verified', value: stats.verifiedUsers, section: AdminSection.users),
    ];

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: cards.map((c) {
        return SizedBox(
          width: (MediaQuery.of(context).size.width - 58) / 2,
          child: Material(
            color: FupeColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: FupeColors.border),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: c.section == null ? null : () => onOpen(c.section!),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.label.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                        color: FupeColors.muted,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${c.value}',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: FupeColors.text,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
