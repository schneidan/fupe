import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/lookup_result.dart';
import '../services/api_service.dart';
import '../theme/fupe_theme.dart';
import 'barcode_scan_screen.dart';
import 'image_lookup_screen.dart';
import 'result_screen.dart';

class AskScreen extends StatefulWidget {
  const AskScreen({super.key});

  @override
  State<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends State<AskScreen> {
  final _queryController = TextEditingController();
  bool _moreOpen = false;
  bool _loading = false;
  String? _error;

  void _search() {
    final query = _queryController.text.trim();
    if (query.isEmpty) return;

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ResultScreen(query: query)),
    );
  }

  Future<void> _runLookup(Future<LookupResult> Function() lookup) async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final result = await lookup();
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ResultScreen(result: result)),
      );
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('ApiException: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiService>();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          children: [
            const Spacer(),
            const Text(
              'FUPE',
              style: TextStyle(
                fontSize: 48,
                fontWeight: FontWeight.w900,
                letterSpacing: -1,
                color: FupeColors.text,
              ),
            ),
            const SizedBox(height: 48),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                const Text(
                  'Is',
                  style: TextStyle(fontSize: 24, color: FupeColors.text),
                ),
                SizedBox(
                  width: 180,
                  child: TextField(
                    controller: _queryController,
                    textAlign: TextAlign.center,
                    autofocus: true,
                    style: const TextStyle(
                      fontSize: 24,
                      color: FupeColors.text,
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      border: UnderlineInputBorder(
                        borderSide: BorderSide(color: FupeColors.border),
                      ),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: FupeColors.border),
                      ),
                      focusedBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: FupeColors.muted, width: 2),
                      ),
                      filled: false,
                      contentPadding: EdgeInsets.symmetric(vertical: 4),
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const Text(
                  'owned by PE?',
                  style: TextStyle(fontSize: 24, color: FupeColors.text),
                ),
              ],
            ),
            const SizedBox(height: 40),
            FilledButton(
              onPressed: _search,
              style: FilledButton.styleFrom(
                backgroundColor: FupeColors.text,
                foregroundColor: FupeColors.bg,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: const StadiumBorder(),
              ),
              child: const Text(
                'SEARCH',
                style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1.2),
              ),
            ),
            const SizedBox(height: 48),
            TextButton.icon(
              onPressed: () => setState(() => _moreOpen = !_moreOpen),
              icon: Text(_moreOpen ? '←' : '→'),
              label: Text(
                _moreOpen ? 'Hide' : 'More ways to search (barcode, photo)',
              ),
              style: TextButton.styleFrom(foregroundColor: FupeColors.muted),
            ),
            if (_moreOpen) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: FupeColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: FupeColors.border),
                ),
                child: Column(
                  children: [
                    OutlinedButton.icon(
                      onPressed: () async {
                        final gtin = await Navigator.of(context).push<String>(
                          MaterialPageRoute(
                            builder: (_) => const BarcodeScanScreen(),
                          ),
                        );
                        if (gtin == null) return;
                        await _runLookup(() => api.lookupBarcode(gtin));
                      },
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text('Scan barcode'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final result = await Navigator.of(context).push<LookupResult>(
                          MaterialPageRoute(
                            builder: (_) => const ImageLookupScreen(),
                          ),
                        );
                        if (result == null || !mounted) return;
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ResultScreen(result: result),
                          ),
                        );
                      },
                      icon: const Icon(Icons.photo_camera),
                      label: const Text('Packaging photo'),
                    ),
                  ],
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: FupeColors.verdictYes),
              ),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: CircularProgressIndicator(color: FupeColors.muted),
              ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }
}
