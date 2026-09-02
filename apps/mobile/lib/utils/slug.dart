String toSlug(String text) {
  return text
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9]+"), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}

String slugToQuery(String slug) {
  return Uri.decodeComponent(slug).replaceAll('-', ' ').trim();
}
