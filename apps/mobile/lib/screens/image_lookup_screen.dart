import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../theme/fupe_theme.dart';

class ImageLookupScreen extends StatefulWidget {
  const ImageLookupScreen({super.key});

  @override
  State<ImageLookupScreen> createState() => _ImageLookupScreenState();
}

class _ImageLookupScreenState extends State<ImageLookupScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _pickAndLookup());
  }

  Future<void> _pickAndLookup() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera);
    if (!mounted) return;

    if (image == null) {
      Navigator.of(context).pop();
      return;
    }

    try {
      final api = context.read<ApiService>();
      final result = await api.lookupImage(File(image.path));
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('ApiException: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Packaging photo')),
      body: Center(
        child: _error == null
            ? const CircularProgressIndicator(color: FupeColors.muted)
            : Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: FupeColors.verdictYes),
                ),
              ),
      ),
    );
  }
}
