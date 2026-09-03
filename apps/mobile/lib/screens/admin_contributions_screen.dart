import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/admin_api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class AdminContributionsScreen extends StatefulWidget {
  const AdminContributionsScreen({super.key});

  @override
  State<AdminContributionsScreen> createState() =>
      _AdminContributionsScreenState();
}

class _AdminContributionsScreenState extends State<AdminContributionsScreen> {
  final _submitter = TextEditingController();
  List<StaffEdit> _edits = [];
  int _total = 0;
  int _page = 1;
  String _status = 'PENDING';
  String _kind = '';
  String? _error;
  bool _loading = true;
  String? _busyId;
  final Map<String, String> _notes = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _submitter.dispose();
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
      final res = await context.read<AdminApiService>().listEditQueue(
            token,
            status: _status,
            kind: _kind.isEmpty ? null : _kind,
            submitter:
                _submitter.text.trim().isEmpty ? null : _submitter.text.trim(),
            page: page,
          );
      if (!mounted) return;
      setState(() {
        _edits = res.edits;
        _total = res.total;
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

  Future<void> _decide(StaffEdit edit, String decision) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() {
      _busyId = edit.id;
      _error = null;
    });
    try {
      await context.read<AdminApiService>().reviewEdit(
            token,
            edit.id,
            decision: decision,
            reviewNote: _notes[edit.id],
          );
      _notes.remove(edit.id);
      await _load(page: _page);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _reopen(StaffEdit edit) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() {
      _busyId = edit.id;
      _error = null;
    });
    try {
      await context.read<AdminApiService>().reopenEdit(token, edit.id);
      await _load(page: _page);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = (_total / 50).ceil().clamp(1, 9999);

    return Scaffold(
      appBar: AppBar(title: Text('Contributions ($_total)')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                for (final s in ['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(s.toLowerCase()),
                      selected: _status == s,
                      onSelected: (_) {
                        setState(() => _status = s);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                for (final k in ['', 'ownership', 'create_entity', 'other'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(k.isEmpty ? 'all kinds' : k.replaceAll('_', ' ')),
                      selected: _kind == k,
                      onSelected: (_) {
                        setState(() => _kind = k);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _submitter,
                    decoration: const InputDecoration(
                      hintText: 'Filter by submitter email',
                      isDense: true,
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                IconButton(
                  onPressed: _loading ? null : () => _load(),
                  icon: const Icon(Icons.filter_list),
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(page: _page),
              child: _loading && _edits.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Center(child: CircularProgressIndicator()),
                      ],
                    )
                  : _edits.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 48),
                            Center(
                              child: Text(
                                'No edits in this filter.',
                                style: TextStyle(color: FupeColors.muted),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _edits.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final e = _edits[i];
                            final busy = _busyId == e.id;
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: FupeColors.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: FupeColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          e.summary,
                                          style: const TextStyle(
                                            color: FupeColors.text,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        e.status,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          letterSpacing: 1,
                                          color: FupeColors.muted,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${e.submitterEmail} · ${e.editKind} · ${e.targetNodeId}',
                                    style: const TextStyle(
                                      color: FupeColors.muted,
                                      fontSize: 12,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                  if (e.status == 'PENDING') ...[
                                    const SizedBox(height: 10),
                                    TextField(
                                      decoration: const InputDecoration(
                                        hintText: 'Optional review note',
                                        isDense: true,
                                      ),
                                      onChanged: (v) => _notes[e.id] = v,
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        FilledButton(
                                          onPressed: busy
                                              ? null
                                              : () => _decide(e, 'APPROVED'),
                                          child: const Text('Approve'),
                                        ),
                                        const SizedBox(width: 8),
                                        OutlinedButton(
                                          onPressed: busy
                                              ? null
                                              : () => _decide(e, 'REJECTED'),
                                          child: const Text('Reject'),
                                        ),
                                      ],
                                    ),
                                  ] else if (e.canReopen) ...[
                                    const SizedBox(height: 10),
                                    OutlinedButton(
                                      onPressed: busy ? null : () => _reopen(e),
                                      child: const Text('Reopen'),
                                    ),
                                  ],
                                  if (busy)
                                    const Padding(
                                      padding: EdgeInsets.only(top: 8),
                                      child: LinearProgressIndicator(),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ),
          if (pages > 1)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
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
            ),
        ],
      ),
    );
  }
}
