import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../screens/admin_entry_screen.dart';
import '../screens/result_screen.dart';

/// Parses `fupe://entity/panera-bread` style URIs.
String? entitySlugFromUri(Uri uri) {
  if (uri.scheme != 'fupe') return null;
  if (uri.host != 'entity') return null;

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.isEmpty) return null;
  return Uri.decodeComponent(segments.first);
}

/// `fupe://admin` (and `fupe://admin/…` for later hub routes).
bool isAdminDeepLink(Uri uri) {
  if (uri.scheme != 'fupe') return false;
  if (uri.host == 'admin') return true;
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  return uri.host.isEmpty && segments.isNotEmpty && segments.first == 'admin';
}

/// Opens the YES/NO lookup result for an entity slug.
void openEntityResult(BuildContext context, {required String slug}) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => ResultScreen(slug: slug),
    ),
  );
}

void openAdminEntry(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => const AdminEntryScreen(),
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
      _handle(initial);
    }

    _appLinks.uriLinkStream.listen(_handle);
  }

  void _handle(Uri uri) {
    if (isAdminDeepLink(uri)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.navigatorKey.currentState?.push(
          MaterialPageRoute(
            builder: (_) => const AdminEntryScreen(),
          ),
        );
      });
      return;
    }

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
