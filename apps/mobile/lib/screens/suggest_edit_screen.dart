import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/lookup_result.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class SuggestEditScreen extends StatefulWidget {
  const SuggestEditScreen({
    super.key,
    this.entityId,
    this.entityName,
  });

  final String? entityId;
  final String? entityName;

  @override
  State<SuggestEditScreen> createState() => _SuggestEditScreenState();
}

class _SuggestEditScreenState extends State<SuggestEditScreen> {
  late final TextEditingController _targetId;
  late final TextEditingController _targetName;
  final _parentQuery = TextEditingController();
  final _newParentName = TextEditingController();
  final _percentage = TextEditingController();
  final _citation = TextEditingController();

  bool _existingParent = true;
  String _newParentType = 'PARENT_CORP';
  EntitySummary? _selectedParent;
  List<EntitySummary> _hits = [];
  bool _busy = false;
  String? _error;

  static const _types = [
    ('PARENT_CORP', 'Parent corporation'),
    ('PE_FIRM', 'Private equity firm'),
    ('VC_FIRM', 'Venture capital firm'),
    ('SUBSIDIARY', 'Subsidiary'),
    ('BRAND', 'Brand'),
  ];

  @override
  void initState() {
    super.initState();
    _targetId = TextEditingController(text: widget.entityId ?? '');
    _targetName = TextEditingController(text: widget.entityName ?? '');
    _parentQuery.addListener(_onParentQuery);
  }

  @override
  void dispose() {
    _parentQuery.removeListener(_onParentQuery);
    _targetId.dispose();
    _targetName.dispose();
    _parentQuery.dispose();
    _newParentName.dispose();
    _percentage.dispose();
    _citation.dispose();
    super.dispose();
  }

  void _onParentQuery() {
    final q = _parentQuery.text.trim();
    if (!_existingParent || q.length < 2) {
      setState(() => _hits = []);
      return;
    }
    Future.delayed(const Duration(milliseconds: 250), () async {
      if (_parentQuery.text.trim() != q || !mounted) return;
      final api = context.read<ApiService>();
      try {
        final res = await api.listEntities(q: q, limit: 8);
        if (!mounted) return;
        setState(() {
          _hits = res.items.where((e) => e.id != _targetId.text.trim()).toList();
        });
      } catch (_) {
        if (mounted) setState(() => _hits = []);
      }
    });
  }

  Future<void> _submit() async {
    final auth = context.read<AuthService>();
    if (!auth.isSignedIn) {
      setState(() => _error = 'Sign in on the Contribute tab first.');
      return;
    }
    if (_targetId.text.trim().isEmpty) {
      setState(() => _error = 'Target entity id is required.');
      return;
    }
    if (_citation.text.trim().isEmpty) {
      setState(() => _error = 'Citation URL is required.');
      return;
    }

    Map<String, dynamic> proposed;
    if (_existingParent) {
      if (_selectedParent == null) {
        setState(() => _error = 'Pick an existing parent.');
        return;
      }
      proposed = {
        'ownership': {
          'parent_id': _selectedParent!.id,
          if (_percentage.text.trim().isNotEmpty)
            'percentage': double.tryParse(_percentage.text.trim()),
        },
      };
    } else {
      if (_newParentName.text.trim().isEmpty) {
        setState(() => _error = 'Enter a new parent name.');
        return;
      }
      proposed = {
        'new_parent': {
          'name': _newParentName.text.trim(),
          'type': _newParentType,
        },
        if (_percentage.text.trim().isNotEmpty)
          'ownership': {
            'percentage': double.tryParse(_percentage.text.trim()),
          },
      };
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await context.read<ApiService>().submitEdit(
            token: auth.token!,
            targetNodeId: _targetId.text.trim(),
            proposedData: proposed,
            citationUrl: _citation.text.trim(),
          );
      if (!mounted) return;
      final status = result['status'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            status == 'committed'
                ? 'Edit committed.'
                : 'Edit submitted for review.',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('ApiException: ', '');
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Suggest an edit')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            controller: _targetName,
            decoration: const InputDecoration(labelText: 'Target name'),
          ),
          TextField(
            controller: _targetId,
            decoration: const InputDecoration(labelText: 'Target entity id'),
          ),
          const SizedBox(height: 16),
          const Text('Proposed parent', style: TextStyle(color: FupeColors.muted)),
          RadioListTile<bool>(
            title: const Text('Existing entity'),
            value: true,
            groupValue: _existingParent,
            onChanged: (v) => setState(() => _existingParent = v!),
          ),
          RadioListTile<bool>(
            title: const Text('New parent'),
            value: false,
            groupValue: _existingParent,
            onChanged: (v) => setState(() => _existingParent = v!),
          ),
          if (_existingParent) ...[
            TextField(
              controller: _parentQuery,
              decoration: const InputDecoration(labelText: 'Search parent'),
            ),
            if (_selectedParent != null)
              Text(
                'Selected: ${_selectedParent!.name}',
                style: const TextStyle(color: FupeColors.text),
              ),
            ..._hits.map(
              (h) => ListTile(
                title: Text(h.name),
                subtitle: Text(h.type.replaceAll('_', ' ')),
                onTap: () {
                  setState(() {
                    _selectedParent = h;
                    _parentQuery.text = h.name;
                    _hits = [];
                  });
                },
              ),
            ),
          ] else ...[
            TextField(
              controller: _newParentName,
              decoration: const InputDecoration(labelText: 'Parent name'),
            ),
            DropdownButtonFormField<String>(
              value: _newParentType,
              items: _types
                  .map(
                    (t) => DropdownMenuItem(value: t.$1, child: Text(t.$2)),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _newParentType = v!),
              decoration: const InputDecoration(labelText: 'Type'),
            ),
          ],
          TextField(
            controller: _percentage,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Ownership % (optional)'),
          ),
          TextField(
            controller: _citation,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(labelText: 'Citation URL (required)'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: FupeColors.verdictYes)),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Submitting…' : 'Submit suggestion'),
          ),
        ],
      ),
    );
  }
}
