import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/admin_api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class AdminSubscriptionsScreen extends StatefulWidget {
  const AdminSubscriptionsScreen({super.key});

  @override
  State<AdminSubscriptionsScreen> createState() =>
      _AdminSubscriptionsScreenState();
}

class _AdminSubscriptionsScreenState extends State<AdminSubscriptionsScreen> {
  List<AdminSubscriber> _items = [];
  int _total = 0;
  int _page = 1;
  Map<String, dynamic>? _health;
  String? _error;
  bool _loading = true;
  String? _busyId;
  final _note = TextEditingController();
  final _compEmail = TextEditingController();
  String _compTier = 'developer';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _note.dispose();
    _compEmail.dispose();
    super.dispose();
  }

  Future<void> _load({int page = 1}) async {
    final token = context.read<AuthService>().token;
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
      _page = page;
    });
    try {
      final api = context.read<AdminApiService>();
      final results = await Future.wait([
        api.fetchSubscriptions(token, page: page),
        api.fetchBillingHealth(token),
      ]);
      if (!mounted) return;
      final subs = results[0] as ({List<AdminSubscriber> subscribers, int total});
      setState(() {
        _items = subs.subscribers;
        _total = subs.total;
        _health = results[1] as Map<String, dynamic>;
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

  Future<void> _setTier(String userId, String tier) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() => _busyId = userId);
    try {
      await context.read<AdminApiService>().overrideTier(
            token,
            userId,
            tier,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          );
      _note.clear();
      await _load(page: _page);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _grantComp() async {
    final email = _compEmail.text.trim().toLowerCase();
    if (email.isEmpty) {
      setState(() => _error = 'Enter an email for complimentary upgrade');
      return;
    }
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() {
      _busyId = 'comp';
      _error = null;
    });
    try {
      final api = context.read<AdminApiService>();
      final found = await api.fetchUsers(token, q: email);
      AdminUserRow? match;
      for (final u in found.users) {
        if (u.email.toLowerCase() == email) {
          match = u;
          break;
        }
      }
      match ??= found.users.isEmpty ? null : found.users.first;
      if (match == null) throw Exception('No user with that email');
      await api.overrideTier(
        token,
        match.id,
        _compTier,
        note: _note.text.trim().isEmpty ? null : _note.text.trim(),
      );
      _note.clear();
      _compEmail.clear();
      await _load(page: _page);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _openStripe() async {
    final url = _health?['dashboard_url'] as String? ??
        'https://dashboard.stripe.com/test/subscriptions';
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  String _period(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    final d = DateTime.tryParse(iso);
    if (d == null) return '—';
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final pages = (_total / 50).ceil().clamp(1, 9999);
    final stale = _health?['stale'] == true;
    final configured = _health?['stripe_configured'] == true;

    return Scaffold(
      appBar: AppBar(
        title: Text('Subscriptions ($_total)'),
        actions: [
          IconButton(
            onPressed: _openStripe,
            icon: const Icon(Icons.open_in_new),
            tooltip: 'Stripe Dashboard',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(page: _page),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_health != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: FupeColors.elevated,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: !configured || stale
                        ? FupeColors.verdictYes.withValues(alpha: 0.4)
                        : FupeColors.border,
                  ),
                ),
                child: Text(
                  !configured
                      ? 'Stripe not configured'
                      : stale
                          ? 'Webhook sync stale — last: ${_health!['last_event_type'] ?? 'none'}'
                          : 'Webhooks OK · ${_health!['last_event_type']} · ${_health!['events_last_7d']} in 7d',
                  style: TextStyle(
                    color: !configured || stale
                        ? FupeColors.verdictYes
                        : FupeColors.muted,
                    fontSize: 13,
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: FupeColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: FupeColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Complimentary upgrade',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: FupeColors.text,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _compEmail,
                    decoration: const InputDecoration(
                      hintText: 'user@example.com',
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButton<String>(
                          value: _compTier,
                          isExpanded: true,
                          items: const [
                            DropdownMenuItem(
                              value: 'developer',
                              child: Text('developer'),
                            ),
                            DropdownMenuItem(
                              value: 'business',
                              child: Text('business'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _compTier = v);
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _busyId == 'comp' ? null : _grantComp,
                        child: const Text('Grant'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _note,
                    decoration: const InputDecoration(
                      hintText: 'Note for next override',
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: FupeColors.verdictYes),
                ),
              ),
            if (_loading && _items.isEmpty)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_items.isEmpty)
              const Text('No subscribers yet.',
                  style: TextStyle(color: FupeColors.muted))
            else
              ..._items.map((s) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: FupeColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: FupeColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.email,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: FupeColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${s.subscriptionStatus ?? '—'} · period ${_period(s.periodEnd)}',
                        style: const TextStyle(
                          color: FupeColors.muted,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      DropdownButton<String>(
                        value: s.subscriptionTier,
                        items: const [
                          DropdownMenuItem(value: 'free', child: Text('free')),
                          DropdownMenuItem(
                            value: 'developer',
                            child: Text('developer'),
                          ),
                          DropdownMenuItem(
                            value: 'business',
                            child: Text('business'),
                          ),
                        ],
                        onChanged: _busyId == s.id
                            ? null
                            : (v) {
                                if (v == null || v == s.subscriptionTier) {
                                  return;
                                }
                                _setTier(s.id, v);
                              },
                      ),
                    ],
                  ),
                );
              }),
            if (pages > 1)
              Row(
                children: [
                  TextButton(
                    onPressed: _page <= 1 || _loading
                        ? null
                        : () => _load(page: _page - 1),
                    child: const Text('←'),
                  ),
                  Text('Page $_page of $pages',
                      style: const TextStyle(color: FupeColors.muted)),
                  TextButton(
                    onPressed: _page >= pages || _loading
                        ? null
                        : () => _load(page: _page + 1),
                    child: const Text('→'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
