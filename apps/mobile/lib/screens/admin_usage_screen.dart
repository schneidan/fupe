import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/admin_api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class AdminUsageScreen extends StatefulWidget {
  const AdminUsageScreen({super.key});

  @override
  State<AdminUsageScreen> createState() => _AdminUsageScreenState();
}

class _AdminUsageScreenState extends State<AdminUsageScreen> {
  List<AdminKeyUsage> _usage = [];
  int _page = 1;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
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
      final rows =
          await context.read<AdminApiService>().fetchUsage(token, page: page);
      if (!mounted) return;
      setState(() {
        _usage = rows;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('API usage')),
      body: RefreshIndicator(
        onRefresh: () => _load(page: _page),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              "Today's requests per active key, including IMAGE 403s and rate-limit 429s.",
              style: TextStyle(color: FupeColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 12),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: FupeColors.verdictYes),
                ),
              ),
            if (_loading && _usage.isEmpty)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_usage.isEmpty)
              const Text('No API keys active yet.',
                  style: TextStyle(color: FupeColors.muted))
            else
              ..._usage.map((row) {
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
                        '${row.keyPrefix}… · ${row.name}',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: FupeColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${row.email} · ${row.tier}',
                        style: const TextStyle(
                          color: FupeColors.muted,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _metric('Requests', '${row.requestsToday}'),
                          _metric(
                            'IMAGE blocks',
                            row.imageBlocksToday == 0
                                ? '—'
                                : '${row.imageBlocksToday}',
                            warn: row.imageBlocksToday > 0,
                          ),
                          _metric(
                            'Rate limits',
                            row.rateLimitHitsToday == 0
                                ? '—'
                                : '${row.rateLimitHitsToday}',
                            warn: row.rateLimitHitsToday > 0,
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 8),
            Row(
              children: [
                TextButton(
                  onPressed:
                      _page <= 1 || _loading ? null : () => _load(page: _page - 1),
                  child: const Text('←'),
                ),
                Text('Page $_page',
                    style: const TextStyle(color: FupeColors.muted)),
                TextButton(
                  onPressed: _loading || _usage.length < 50
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

  Widget _metric(String label, String value, {bool warn = false}) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9,
              letterSpacing: 1,
              color: FupeColors.muted,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: warn ? FupeColors.verdictYes : FupeColors.text,
            ),
          ),
        ],
      ),
    );
  }
}
