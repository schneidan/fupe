import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../screens/result_screen.dart';

/// Parses `fupe://entity/panera-bread` style URIs.
String? entitySlugFromUri(Uri uri) {
  if (uri.scheme != 'fupe') return null;
  if (uri.host != 'entity') return null;

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.isEmpty) return null;
  return Uri.decodeComponent(segments.first);
}

/// Opens the YES/NO lookup result for an entity slug.
void openEntityResult(BuildContext context, {required String slug}) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => ResultScreen(slug: slug),
    ),
  );
}

class DeepLinkListener extends StatefulWidget {
  const DeepLinkListener({
    super.key,
    required this.navigatorKey,
    required this.child,
  });

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  @override
  State<DeepLinkListener> createState() => _DeepLinkListenerState();
}

class _DeepLinkListenerState extends State<DeepLinkListener> {
  final _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    _initLinks();
  }

  Future<void> _initLinks() async {
    final initial = await _appLinks.getInitialLink();
    if (initial != null) {
      _openEntity(initial);
    }

    _appLinks.uriLinkStream.listen(_openEntity);
  }

  void _openEntity(Uri uri) {
    final slug = entitySlugFromUri(uri);
    if (slug == null) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => ResultScreen(slug: slug),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
