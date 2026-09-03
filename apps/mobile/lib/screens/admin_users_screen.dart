import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/admin_api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final _search = TextEditingController();
  List<AdminUserRow> _users = [];
  int _total = 0;
  int _page = 1;
  String? _error;
  bool _loading = true;
  String _roleFilter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
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
      final res = await context.read<AdminApiService>().fetchUsers(
            token,
            q: _search.text.trim().isEmpty ? null : _search.text.trim(),
            role: _roleFilter.isEmpty ? null : _roleFilter,
            page: page,
          );
      if (!mounted) return;
      setState(() {
        _users = res.users;
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

  Future<void> _openDetail(AdminUserRow user) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: FupeColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _UserDetailSheet(
        user: user,
        onChanged: () => _load(page: _page),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = (_total / 50).ceil().clamp(1, 9999);

    return Scaffold(
      appBar: AppBar(title: Text('Users ($_total)')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      hintText: 'Search email',
                      isDense: true,
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _loading ? null : () => _load(),
                  icon: const Icon(Icons.search),
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                for (final r in ['', 'user', 'moderator', 'admin'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(r.isEmpty ? 'all roles' : r),
                      selected: _roleFilter == r,
                      onSelected: (_) {
                        setState(() => _roleFilter = r);
                        _load();
                      },
                    ),
                  ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(page: _page),
              child: _loading && _users.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Center(child: CircularProgressIndicator()),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _users.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final u = _users[i];
                        return Material(
                          color: FupeColors.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: FupeColors.border),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => _openDetail(u),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    u.email,
                                    style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontSize: 13,
                                      color: FupeColors.text,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${u.role} · trust ${u.trustScore}'
                                    '${u.emailVerified ? '' : ' · unverified'}'
                                    '${u.disabled ? ' · disabled' : ''}'
                                    ' · ${u.subscriptionTier}'
                                    ' · ${u.apiKeyCount} keys',
                                    style: const TextStyle(
                                      color: FupeColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
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

class _UserDetailSheet extends StatefulWidget {
  const _UserDetailSheet({required this.user, required this.onChanged});

  final AdminUserRow user;
  final VoidCallback onChanged;

  @override
  State<_UserDetailSheet> createState() => _UserDetailSheetState();
}

class _UserDetailSheetState extends State<_UserDetailSheet> {
  late String _role;
  late int _trust;
  late bool _verified;
  late bool _disabled;
  List<AdminUserKey> _keys = [];
  bool _loadingKeys = true;
  String? _error;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _role = widget.user.role;
    _trust = widget.user.trustScore;
    _verified = widget.user.emailVerified;
    _disabled = widget.user.disabled;
    _loadKeys();
  }

  Future<void> _loadKeys() async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    try {
      final keys = await context
          .read<AdminApiService>()
          .fetchUserKeys(token, widget.user.id);
      if (!mounted) return;
      setState(() {
        _keys = keys;
        _loadingKeys = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loadingKeys = false;
      });
    }
  }

  Future<void> _patch(Map<String, dynamic> patch, String label) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() {
      _busy = label;
      _error = null;
    });
    try {
      final updated = await context
          .read<AdminApiService>()
          .patchUser(token, widget.user.id, patch);
      if (!mounted) return;
      setState(() {
        _role = updated.role;
        _trust = updated.trustScore;
        _verified = updated.emailVerified;
        _disabled = updated.disabled;
        _busy = null;
      });
      widget.onChanged();
      if (patch['disabled'] == true) await _loadKeys();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _busy = null;
      });
    }
  }

  Future<void> _revoke(AdminUserKey key) async {
    final token = context.read<AuthService>().token;
    if (token == null) return;
    setState(() => _busy = key.id);
    try {
      await context.read<AdminApiService>().revokeKey(token, key.id);
      await _loadKeys();
      widget.onChanged();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.user.email,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w600,
                color: FupeColors.text,
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: FupeColors.verdictYes),
                ),
              ),
            const Text('Role', style: TextStyle(color: FupeColors.muted, fontSize: 12)),
            DropdownButton<String>(
              value: _role,
              isExpanded: true,
              items: const [
                DropdownMenuItem(value: 'user', child: Text('user')),
                DropdownMenuItem(value: 'moderator', child: Text('moderator')),
                DropdownMenuItem(value: 'admin', child: Text('admin')),
              ],
              onChanged: _busy != null
                  ? null
                  : (v) {
                      if (v == null || v == _role) return;
                      _patch({'role': v}, 'role');
                    },
            ),
            const SizedBox(height: 8),
            const Text('Trust', style: TextStyle(color: FupeColors.muted, fontSize: 12)),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: _trust.toDouble(),
                    min: 0,
                    max: 100,
                    divisions: 20,
                    label: '$_trust',
                    onChanged: _busy != null
                        ? null
                        : (v) => setState(() => _trust = v.round()),
                    onChangeEnd: (v) => _patch({'trust_score': v.round()}, 'trust'),
                  ),
                ),
                Text('$_trust', style: const TextStyle(color: FupeColors.text)),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Email verified'),
              value: _verified,
              onChanged: _busy != null
                  ? null
                  : (v) => _patch({'email_verified': v}, 'verify'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Disabled'),
              value: _disabled,
              onChanged: _busy != null
                  ? null
                  : (v) => _patch({'disabled': v}, 'disable'),
            ),
            const SizedBox(height: 8),
            const Text(
              'API KEYS',
              style: TextStyle(
                fontSize: 11,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w600,
                color: FupeColors.muted,
              ),
            ),
            const SizedBox(height: 8),
            if (_loadingKeys)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_keys.isEmpty)
              const Text('No keys', style: TextStyle(color: FupeColors.muted))
            else
              ..._keys.map((k) {
                final revoked = k.revokedAt != null;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    '${k.keyPrefix}… · ${k.name}',
                    style: const TextStyle(fontSize: 13, color: FupeColors.text),
                  ),
                  subtitle: Text(
                    '${k.tier} · ${k.usageToday} today'
                    '${revoked ? ' · revoked' : ''}',
                    style: const TextStyle(color: FupeColors.muted, fontSize: 12),
                  ),
                  trailing: revoked
                      ? null
                      : TextButton(
                          onPressed: _busy != null ? null : () => _revoke(k),
                          child: const Text('Revoke'),
                        ),
                );
              }),
            if (_busy != null)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: LinearProgressIndicator(),
              ),
          ],
        ),
      ),
    );
  }
}
