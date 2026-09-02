import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/lookup_result.dart';
import '../services/api_service.dart';
import '../theme/fupe_theme.dart';
import 'result_screen.dart';

class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});

  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  final _searchController = TextEditingController();
  bool _peOnly = false;
  int _page = 1;
  bool _loading = true;
  String? _error;
  var _items = <EntitySummary>[];
  int _total = 0;

  static const _limit = 20;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      final data = await api.listEntities(
        q: _searchController.text.trim(),
        peOnly: _peOnly,
        page: _page,
        limit: _limit,
      );
      if (!mounted) return;
      setState(() {
        _items = data.items;
        _total = data.total;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  int get _totalPages => (_total / _limit).ceil().clamp(1, 999);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(24, 16, 24, 8),
            child: Text(
              'Browse directory',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: FupeColors.text,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by name…',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () {
                    _page = 1;
                    _load();
                  },
                ),
              ),
              onSubmitted: (_) {
                _page = 1;
                _load();
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Row(
              children: [
                Checkbox(
                  value: _peOnly,
                  onChanged: (v) {
                    setState(() => _peOnly = v ?? false);
                    _page = 1;
                    _load();
                  },
                ),
                const Text('PE-backed only', style: TextStyle(color: FupeColors.muted)),
              ],
            ),
          ),
          Expanded(child: _buildList()),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: FupeColors.muted),
      );
    }

    if (_error != null) {
      return Center(
        child: Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
      );
    }

    if (_items.isEmpty) {
      return const Center(
        child: Text('No entities match.', style: TextStyle(color: FupeColors.muted)),
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '$_total entities',
              style: const TextStyle(color: FupeColors.muted, fontSize: 13),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final entity = _items[i];
              return ListTile(
                title: Text(
                  entity.name,
                  style: const TextStyle(color: FupeColors.text),
                ),
                subtitle: Text(
                  '${entity.type.replaceAll('_', ' ')}${entity.sector != null ? ' · ${entity.sector}' : ''}',
                  style: const TextStyle(color: FupeColors.muted, fontSize: 12),
                ),
                trailing: entity.isPeBacked
                    ? const Text(
                        'PE',
                        style: TextStyle(
                          color: FupeColors.verdictYes,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      )
                    : null,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ResultScreen(query: entity.name),
                    ),
                  );
                },
              );
            },
          ),
        ),
        if (_totalPages > 1)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _page > 1
                      ? () {
                          _page--;
                          _load();
                        }
                      : null,
                  icon: const Icon(Icons.chevron_left),
                ),
                Text('Page $_page of $_totalPages',
                    style: const TextStyle(color: FupeColors.muted)),
                IconButton(
                  onPressed: _page < _totalPages
                      ? () {
                          _page++;
                          _load();
                        }
                      : null,
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
      ],
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
