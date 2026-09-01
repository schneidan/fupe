import { Field, Float, ObjectType, registerEnumType } from '@nestjs/graphql';
import { EntityType } from './graph.types';

registerEnumType(EntityType, { name: 'EntityType' });

@ObjectType()
export class Entity {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => EntityType)
  type!: EntityType;
}

@ObjectType()
export class Product {
  @Field()
  gtin!: string;

  @Field()
  name!: string;

  @Field()
  category!: string;
}

@ObjectType()
export class OwnershipResult {
  @Field(() => Entity)
  entity!: Entity;

  @Field(() => [Entity])
  owners!: Entity[];

  @Field()
  isPeBacked!: boolean;

  @Field(() => [Entity])
  peFirms!: Entity[];
}

@ObjectType()
export class ProductOwnershipResult {
  @Field(() => Product)
  product!: Product;

  @Field(() => Entity, { nullable: true })
  manufacturer!: Entity | null;

  @Field(() => [Entity])
  owners!: Entity[];

  @Field()
  isPeBacked!: boolean;

  @Field(() => [Entity])
  peFirms!: Entity[];
}

@ObjectType()
export class SearchResult {
  @Field(() => [Entity])
  entities!: Entity[];

  @Field(() => Float)
  count!: number;
}
