class ChainNode {
  ChainNode({required this.name, required this.type});

  final String name;
  final String type;

  factory ChainNode.fromJson(Map<String, dynamic> json) {
    return ChainNode(
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? '',
    );
  }
}

class Citation {
  Citation({
    required this.title,
    required this.url,
    this.retrievedAt,
    this.stale = false,
  });

  final String title;
  final String url;
  final String? retrievedAt;
  final bool stale;

  factory Citation.fromJson(Map<String, dynamic> json) {
    return Citation(
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
      retrievedAt: json['retrieved_at'] as String?,
      stale: json['stale'] as bool? ?? false,
    );
  }
}

class RelatedEntity {
  RelatedEntity({
    required this.id,
    required this.name,
    required this.slug,
    required this.type,
  });

  final String id;
  final String name;
  final String slug;
  final String type;

  factory RelatedEntity.fromJson(Map<String, dynamic> json) {
    return RelatedEntity(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      type: json['type'] as String? ?? '',
    );
  }
}

class RelatedEntities {
  RelatedEntities({
    required this.sameUltimateParent,
    required this.similarPeBacked,
  });

  final List<RelatedEntity> sameUltimateParent;
  final List<RelatedEntity> similarPeBacked;

  factory RelatedEntities.fromJson(Map<String, dynamic> json) {
    return RelatedEntities(
      sameUltimateParent: (json['same_ultimate_parent'] as List<dynamic>? ?? [])
          .map((e) => RelatedEntity.fromJson(e as Map<String, dynamic>))
          .toList(),
      similarPeBacked: (json['similar_pe_backed'] as List<dynamic>? ?? [])
          .map((e) => RelatedEntity.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class LookupResult {
  LookupResult({
    required this.matchedItem,
    required this.isPrivateEquityOwned,
    required this.ownershipChain,
    required this.citations,
    this.entityId,
    this.ultimateParent,
    this.related,
  });

  final String matchedItem;
  final String? entityId;
  final bool isPrivateEquityOwned;
  final ChainNode? ultimateParent;
  final List<ChainNode> ownershipChain;
  final List<Citation> citations;
  final RelatedEntities? related;

  factory LookupResult.fromJson(Map<String, dynamic> json) {
    return LookupResult(
      matchedItem: json['matched_item'] as String? ?? '',
      entityId: json['entity_id'] as String?,
      isPrivateEquityOwned: json['is_private_equity_owned'] as bool? ?? false,
      ultimateParent: json['ultimate_parent'] != null
          ? ChainNode.fromJson(json['ultimate_parent'] as Map<String, dynamic>)
          : null,
      ownershipChain: (json['ownership_chain'] as List<dynamic>? ?? [])
          .map((e) => ChainNode.fromJson(e as Map<String, dynamic>))
          .toList(),
      citations: (json['citations'] as List<dynamic>? ?? [])
          .map((e) => Citation.fromJson(e as Map<String, dynamic>))
          .toList(),
      related: json['related'] != null
          ? RelatedEntities.fromJson(json['related'] as Map<String, dynamic>)
          : null,
    );
  }
}

class EntitySummary {
  EntitySummary({
    required this.id,
    required this.slug,
    required this.name,
    required this.type,
    required this.isPeBacked,
    this.sector,
    this.countryCodes,
  });

  final String id;
  final String slug;
  final String name;
  final String type;
  final String? sector;
  final List<String>? countryCodes;
  final bool isPeBacked;

  factory EntitySummary.fromJson(Map<String, dynamic> json) {
    return EntitySummary(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? '',
      sector: json['sector'] as String?,
      countryCodes: (json['country_codes'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      isPeBacked: json['is_pe_backed'] as bool? ?? false,
    );
  }
}
