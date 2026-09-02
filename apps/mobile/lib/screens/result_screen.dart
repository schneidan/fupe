import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/lookup_result.dart';
import '../services/api_service.dart';
import '../theme/fupe_theme.dart';
import '../utils/slug.dart';
import '../widgets/citations_list.dart';
import '../widgets/did_you_know.dart';
import '../widgets/ownership_chain.dart';
import '../widgets/verdict_hero.dart';
import 'suggest_edit_screen.dart';

class ResultScreen extends StatefulWidget {
  const ResultScreen({
    super.key,
    this.query,
    this.slug,
    this.result,
  }) : assert(query != null || slug != null || result != null);

  final String? query;
  final String? slug;
  final LookupResult? result;

  String? get lookupQuery =>
      query ?? (slug != null ? slugToQuery(slug!) : null);

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  LookupResult? _result;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.result != null) {
      _result = widget.result;
      _loading = false;
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    try {
      final result = await api.lookupText(widget.lookupQuery!);
      if (!mounted) return;
      setState(() {
        _result = result;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('ApiException: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('FUPE'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: FupeColors.muted),
            const SizedBox(height: 16),
            Text(
              'Tracing ownership for "${widget.lookupQuery}"…',
              style: const TextStyle(color: FupeColors.muted),
            ),
          ],
        ),
      );
    }

    if (_error != null || _result == null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _error ?? 'Not found',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                color: FupeColors.verdictYes,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Try again'),
            ),
          ],
        ),
      );
    }

    final result = _result!;

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        VerdictHero(result: result),
        const SizedBox(height: 32),
        OwnershipChain(chain: result.ownershipChain),
        const SizedBox(height: 16),
        CitationsList(citations: result.citations),
        const SizedBox(height: 16),
        DidYouKnow(result: result),
        if (result.entityId != null) ...[
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SuggestEditScreen(
                    entityId: result.entityId,
                    entityName: result.matchedItem,
                  ),
                ),
              );
            },
            child: const Text('Suggest an edit'),
          ),
        ],
        const SizedBox(height: 32),
        OutlinedButton(
          onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
          child: const Text('Search another'),
        ),
      ],
    );
  }
}
