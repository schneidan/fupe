import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';
import 'admin_entry_screen.dart';
import 'suggest_edit_screen.dart';
import 'propose_entity_screen.dart';

class ContributeScreen extends StatefulWidget {
  const ContributeScreen({super.key});

  @override
  State<ContributeScreen> createState() => _ContributeScreenState();
}

class _ContributeScreenState extends State<ContributeScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _registerMode = false;
  bool _busy = false;
  String? _error;
  List<QueueEdit> _edits = [];
  bool _loadingEdits = false;
  bool _editsRequested = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submitAuth() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthService>();
    try {
      if (_registerMode) {
        await auth.register(_email.text.trim(), _password.text);
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
      _password.clear();
      _editsRequested = true;
      await _loadEdits();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loadEdits() async {
    final auth = context.read<AuthService>();
    if (!auth.isSignedIn) return;
    setState(() => _loadingEdits = true);
    try {
      final edits = await context.read<ApiService>().listMyEdits(
            token: auth.token!,
          );
      if (!mounted) return;
      setState(() => _edits = edits);
    } catch (_) {
      if (mounted) setState(() => _edits = []);
    } finally {
      if (mounted) setState(() => _loadingEdits = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'Contribute',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: FupeColors.text,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Suggest ownership corrections with a citation. '
            'New accounts go to review; high-trust editors auto-commit.',
            style: TextStyle(color: FupeColors.muted, fontSize: 15, height: 1.5),
          ),
          const SizedBox(height: 24),
          if (!auth.ready)
            const Center(child: CircularProgressIndicator())
          else if (!auth.isSignedIn)
            _authCard()
          else ...[
            _accountCard(auth),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const SuggestEditScreen(),
                  ),
                ).then((_) => _loadEdits());
              },
              child: const Text('Suggest an edit'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ProposeEntityScreen(),
                  ),
                ).then((_) => _loadEdits());
              },
              child: const Text('Propose new entity'),
            ),
            if (auth.canSeeAdminEntry) ...[
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const AdminEntryScreen(),
                    ),
                  );
                },
                child: Text(
                  auth.isAdmin ? 'Admin' : 'Admin (queue)',
                ),
              ),
            ],
            const SizedBox(height: 28),
            Row(
              children: [
                const Text(
                  'MY EDITS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                    color: FupeColors.muted,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _loadingEdits ? null : _loadEdits,
                  child: const Text('Refresh'),
                ),
              ],
            ),
            if (_loadingEdits)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_edits.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'No suggestions yet.',
                  style: TextStyle(color: FupeColors.muted),
                ),
              )
            else
              ..._edits.map(_editTile),
          ],
        ],
      ),
    );
  }

  Widget _authCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FupeColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FupeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              TextButton(
                onPressed: () => setState(() => _registerMode = false),
                child: Text(
                  'Sign in',
                  style: TextStyle(
                    fontWeight:
                        _registerMode ? FontWeight.normal : FontWeight.bold,
                    color: FupeColors.text,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => setState(() => _registerMode = true),
                child: Text(
                  'Register',
                  style: TextStyle(
                    fontWeight:
                        _registerMode ? FontWeight.bold : FontWeight.normal,
                    color: FupeColors.text,
                  ),
                ),
              ),
            ],
          ),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submitAuth,
            child: Text(_busy
                ? 'Please wait…'
                : (_registerMode ? 'Create account' : 'Sign in')),
          ),
        ],
      ),
    );
  }

  Widget _accountCard(AuthService auth) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FupeColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FupeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(auth.user!.email, style: const TextStyle(color: FupeColors.text)),
          const SizedBox(height: 4),
          Text(
            'Trust score ${auth.user!.trustScore}'
            '${auth.user!.emailVerified ? '' : ' · email unverified'}'
            '${auth.user!.isAdmin ? ' · admin' : (auth.user!.isModerator ? ' · moderator' : '')}',
            style: const TextStyle(color: FupeColors.muted, fontSize: 13),
          ),
          if (!auth.user!.emailVerified)
            TextButton(
              onPressed: () async {
                try {
                  final msg = await auth.resendVerification();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$msg — check API console for the link')),
                  );
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        e.toString().replaceFirst('Exception: ', ''),
                      ),
                    ),
                  );
                }
              },
              child: const Text('Resend verification email'),
            ),
          TextButton(
            onPressed: () async {
              await auth.signOut();
              setState(() {
                _edits = [];
                _editsRequested = false;
              });
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }

  Widget _editTile(QueueEdit edit) {
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
          Row(
            children: [
              Expanded(
                child: Text(
                  edit.summary,
                  style: const TextStyle(color: FupeColors.text),
                ),
              ),
              Text(
                edit.status,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1,
                  color: FupeColors.muted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            edit.targetNodeId,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              color: FupeColors.muted,
            ),
          ),
        ],
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthService>();
    if (auth.isSignedIn && !_editsRequested) {
      _editsRequested = true;
      _loadEdits();
    }
  }
}
