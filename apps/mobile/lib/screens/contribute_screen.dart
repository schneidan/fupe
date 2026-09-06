import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';
import 'admin_shell_screen.dart';
import 'propose_entity_screen.dart';
import 'reset_password_screen.dart';
import 'suggest_edit_screen.dart';

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
            'New accounts start in review; trust above 50 auto-commits '
            'ownership edits. New entities are always moderated.',
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
                      builder: (_) => const AdminShellScreen(),
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
          if (!_registerMode) ...[
            TextButton(
              onPressed: _busy ? null : _forgotPassword,
              child: const Text('Forgot password?'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ResetPasswordScreen(),
                  ),
                );
              },
              child: const Text('Have a reset token?'),
            ),
          ],
          if (_registerMode)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'By creating an account you agree to the Terms and Privacy Policy at fupe.app/legal.',
                style: TextStyle(color: FupeColors.muted, fontSize: 12, height: 1.4),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _forgotPassword() async {
    final email = _email.text.trim().isNotEmpty
        ? _email.text.trim()
        : await _promptEmail();
    if (email == null || email.isEmpty || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final msg = await context.read<AuthService>().forgotPassword(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '$msg Open the link on the web, or paste the token via “Have a reset token?”',
          ),
        ),
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _promptEmail() async {
    final controller = TextEditingController(text: _email.text);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: FupeColors.surface,
        title: const Text('Reset password'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Send link'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
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
            '${auth.user!.trustScore > 50 ? ' · ownership edits auto-commit' : ' · ownership edits need review'}'
            '${auth.user!.emailVerified ? '' : ' · email unverified'}'
            '${auth.user!.isAdmin ? ' · admin' : (auth.user!.isModerator ? ' · moderator' : '')}',
            style: const TextStyle(color: FupeColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 8),
          const Text(
            'Trust ladder: start at 0 (review queue). +5 approve / −10 reject. '
            'Above 50 auto-commits ownership edits. New entities always reviewed.',
            style: TextStyle(color: FupeColors.muted, fontSize: 12, height: 1.4),
          ),
          if (!auth.user!.emailVerified) ...[
            TextButton(
              onPressed: () async {
                try {
                  final msg = await auth.resendVerification();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        '$msg Open the link in the email (fupe.app) to verify.',
                      ),
                    ),
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
          ],
          TextButton(
            onPressed: () => _exportData(auth),
            child: const Text('Download my data'),
          ),
          TextButton(
            onPressed: () => _deleteAccount(auth),
            child: const Text(
              'Delete account',
              style: TextStyle(color: FupeColors.verdictYes),
            ),
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

  Future<void> _exportData(AuthService auth) async {
    try {
      final data = await auth.exportMyData();
      final pretty = const JsonEncoder.withIndent('  ').convert(data);
      await Clipboard.setData(ClipboardData(text: pretty));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account export copied to clipboard as JSON.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Future<void> _deleteAccount(AuthService auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: FupeColors.surface,
        title: const Text('Delete account?'),
        content: const Text(
          'Permanently delete your account and personal data? This cannot be undone.',
          style: TextStyle(color: FupeColors.muted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: FupeColors.verdictYes),
            ),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await auth.deleteAccount();
      if (!mounted) return;
      setState(() {
        _edits = [];
        _editsRequested = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account deleted.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
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
