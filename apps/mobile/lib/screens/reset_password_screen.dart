import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

/// Paste the token from the reset email (or from the web reset URL).
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.initialToken});

  final String? initialToken;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final TextEditingController _token;
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _ok;

  @override
  void initState() {
    super.initState();
    _token = TextEditingController(text: widget.initialToken ?? '');
  }

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });
    try {
      final msg = await context.read<AuthService>().resetPassword(
            token: _token.text,
            password: _password.text,
          );
      if (!mounted) return;
      setState(() => _ok = msg);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FupeColors.bg,
      appBar: AppBar(
        title: const Text('Reset password'),
        backgroundColor: FupeColors.bg,
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'Paste the token from your reset email, then choose a new password '
            '(at least 8 characters). You can also open the link on fupe.app.',
            style: TextStyle(color: FupeColors.muted, height: 1.5),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _token,
            decoration: const InputDecoration(labelText: 'Reset token'),
          ),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'New password'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
          ],
          if (_ok != null) ...[
            const SizedBox(height: 8),
            Text(_ok!, style: const TextStyle(color: FupeColors.muted)),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Saving…' : 'Update password'),
          ),
        ],
      ),
    );
  }
}
