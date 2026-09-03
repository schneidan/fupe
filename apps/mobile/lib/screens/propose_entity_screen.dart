import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/lookup_result.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../theme/fupe_theme.dart';

class ProposeEntityScreen extends StatefulWidget {
  const ProposeEntityScreen({super.key});

  @override
  State<ProposeEntityScreen> createState() => _ProposeEntityScreenState();
}

class _ProposeEntityScreenState extends State<ProposeEntityScreen> {
  final _name = TextEditingController();
  final _sector = TextEditingController();
  final _countries = TextEditingController();
  final _parentQuery = TextEditingController();
  final _newParentName = TextEditingController();
  final _percentage = TextEditingController();
  final _citation = TextEditingController();

  String _entityType = 'BRAND';
  String _parentMode = 'none';
  String _newParentType = 'PARENT_CORP';
  EntitySummary? _selectedParent;
  List<EntitySummary> _hits = [];
  bool _busy = false;
  String? _error;

  static const _entityTypes = [
    ('BRAND', 'Brand'),
    ('SUBSIDIARY', 'Subsidiary'),
    ('PARENT_CORP', 'Parent corporation'),
    ('PE_FIRM', 'Private equity firm'),
    ('VC_FIRM', 'Venture capital firm'),
  ];

  static const _parentTypes = [
    ('PARENT_CORP', 'Parent corporation'),
    ('PE_FIRM', 'Private equity firm'),
    ('VC_FIRM', 'Venture capital firm'),
    ('SUBSIDIARY', 'Subsidiary'),
    ('BRAND', 'Brand'),
  ];

  @override
  void dispose() {
    _name.dispose();
    _sector.dispose();
    _countries.dispose();
    _parentQuery.dispose();
    _newParentName.dispose();
    _percentage.dispose();
    _citation.dispose();
    super.dispose();
  }

  Future<void> _searchParent(String q) async {
    if (_parentMode != 'existing' || q.length < 2) {
      setState(() => _hits = []);
      return;
    }
    try {
      final res = await context.read<ApiService>().listEntities(q: q, limit: 8);
      if (!mounted) return;
      setState(() => _hits = res.items);
    } catch (_) {
      if (mounted) setState(() => _hits = []);
    }
  }

  Future<void> _submit() async {
    final auth = context.read<AuthService>();
    if (!auth.isSignedIn) {
      setState(() => _error = 'Sign in on the Contribute tab first.');
      return;
    }
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Entity name is required.');
      return;
    }
    if (_citation.text.trim().isEmpty) {
      setState(() => _error = 'Citation URL is required.');
      return;
    }

    final countryCodes = _countries.text
        .split(RegExp(r'[,;\s]+'))
        .map((c) => c.trim().toUpperCase())
        .where((c) => RegExp(r'^[A-Z]{2}$').hasMatch(c))
        .toList();

    final proposed = <String, dynamic>{
      'create_entity': {
        'name': _name.text.trim(),
        'type': _entityType,
        if (_sector.text.trim().isNotEmpty) 'sector': _sector.text.trim(),
        if (countryCodes.isNotEmpty) 'country_codes': countryCodes,
      },
    };

    if (_parentMode == 'existing') {
      if (_selectedParent == null) {
        setState(() => _error = 'Pick an existing parent.');
        return;
      }
      proposed['ownership'] = {
        'parent_id': _selectedParent!.id,
        if (_percentage.text.trim().isNotEmpty)
          'percentage': double.tryParse(_percentage.text.trim()),
      };
    } else if (_parentMode == 'new') {
      if (_newParentName.text.trim().isEmpty) {
        setState(() => _error = 'Enter a parent name.');
        return;
      }
      proposed['new_parent'] = {
        'name': _newParentName.text.trim(),
        'type': _newParentType,
      };
      if (_percentage.text.trim().isNotEmpty) {
        proposed['ownership'] = {
          'percentage': double.tryParse(_percentage.text.trim()),
        };
      }
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await context.read<ApiService>().submitEdit(
            token: auth.token!,
            proposedData: proposed,
            citationUrl: _citation.text.trim(),
          );
      if (!mounted) return;
      final status = result['status'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            status == 'committed'
                ? 'Entity created.'
                : 'Submitted for moderator review.',
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
      appBar: AppBar(title: const Text('Propose new entity')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'New entities always require moderator approval.',
            style: TextStyle(color: FupeColors.muted, fontSize: 14),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Entity name'),
          ),
          DropdownButtonFormField<String>(
            value: _entityType,
            items: _entityTypes
                .map((t) => DropdownMenuItem(value: t.$1, child: Text(t.$2)))
                .toList(),
            onChanged: (v) => setState(() => _entityType = v!),
            decoration: const InputDecoration(labelText: 'Type'),
          ),
          TextField(
            controller: _sector,
            decoration: const InputDecoration(labelText: 'Sector (optional)'),
          ),
          TextField(
            controller: _countries,
            decoration: const InputDecoration(
              labelText: 'Country codes (optional, e.g. US, GB)',
            ),
          ),
          const SizedBox(height: 16),
          const Text('Initial parent (optional)', style: TextStyle(color: FupeColors.muted)),
          ...['none', 'existing', 'new'].map(
            (mode) => RadioListTile<String>(
              title: Text(
                mode == 'none'
                    ? 'No parent'
                    : mode == 'existing'
                        ? 'Existing entity'
                        : 'New parent',
              ),
              value: mode,
              groupValue: _parentMode,
              onChanged: (v) => setState(() => _parentMode = v!),
            ),
          ),
          if (_parentMode == 'existing') ...[
            TextField(
              controller: _parentQuery,
              decoration: const InputDecoration(labelText: 'Search parent'),
              onChanged: (v) => _searchParent(v.trim()),
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
          ],
          if (_parentMode == 'new') ...[
            TextField(
              controller: _newParentName,
              decoration: const InputDecoration(labelText: 'Parent name'),
            ),
            DropdownButtonFormField<String>(
              value: _newParentType,
              items: _parentTypes
                  .map((t) => DropdownMenuItem(value: t.$1, child: Text(t.$2)))
                  .toList(),
              onChanged: (v) => setState(() => _newParentType = v!),
              decoration: const InputDecoration(labelText: 'Parent type'),
            ),
          ],
          if (_parentMode != 'none')
            TextField(
              controller: _percentage,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Ownership % (optional)',
              ),
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
            child: Text(_busy ? 'Submitting…' : 'Propose new entity'),
          ),
        ],
      ),
    );
  }
}
