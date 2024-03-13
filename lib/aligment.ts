import type { Term } from '@rdfjs/types';

export interface IPropertyObject {
  // / The iri of a property
  property_iri: string;
  // / The object related to the property
  object: Term;

  isAlignedWithShape: (shape: IShape) => boolean;
}

export class PropertyObject implements IPropertyObject {
  public readonly property_iri: string;

  public readonly object: Term;

  public constructor(property_iri: string, object: Term) {
    this.property_iri = property_iri;
    this.object = object;
  }

  public isAlignedWithShape(shape: IShape): boolean {
    if (shape.closed === false) {
      return true;
    }

    for (const predicat of shape.rejectedPredicate()) {
      if (predicat === this.property_iri) {
        return false;
      }
    }

    for (const predicat of shape.expectedPredicate()) {
      if (predicat === this.property_iri) {
        return true;
      }
    }

    return false;
  }
}

export function hasOneAlign(queryProperties: IPropertyObject[], shape: IShape): boolean | undefined {
  if (queryProperties.length === 0) {
    return undefined;
  }

  for (const property of queryProperties) {
    const isAlign = property.isAlignedWithShape(shape);
    if (isAlign) {
      return true;
    }
  }
  return false;
}

export interface IShape {
  name: string;
  expectedPredicate: () => string[];
  rejectedPredicate: () => string[];
  closed?: boolean;
}

export class ShapeWithPositivePredicate implements IShape {
  public readonly name: string;
  private readonly predicates: string[];
  public readonly closed?: boolean;

  public constructor(name: string, predicates: string[], closed?: boolean) {
    this.name = name;
    this.predicates = predicates;
    this.closed = closed === undefined ? false : closed;
  }

  public expectedPredicate(): string[] {
    return this.predicates;
  }

  public rejectedPredicate(): string[] {
    return [];
  }
}
