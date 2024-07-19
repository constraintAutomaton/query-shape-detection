import type { Term } from '@rdfjs/types';
import { ICardinality } from './Shape';

/**
 * The information to create a query from a star pattern
 */
export interface IStarPatternWithDependencies {
  // indexed by predicate
  starPattern: Map<string, ITripleWithDependencies>;
  filterExpression?: string;
  name: string;
  isVariable: boolean;
  oneOfs: IOneOf[];
}

export interface IOneOf {
  options: ITripleWithDependencies[];
  dependencies?: IStarPatternWithDependencies;
}

export interface ITripleWithDependencies {
  triple: ITriple;
  dependencies?: IStarPatternWithDependencies;
}

/**
 * A Triple interface
 */
export interface ITriple extends ITripleArgs {
  toObject: () => ITripleArgs;
  getLinkedStarPattern: () => string | undefined
  toString: () => string;
}
/**
 * The type of alignment
 */
export const enum AlignmentType {
  WEAK,
  STRONG,
  None,
}
/**
 * A Triple object
 */
export interface ITripleArgs {
  subject: string;
  // The iri of a property
  predicate: string;
  // The object related to the property
  // if there are multiple object than it means that
  // the object was a variable and a VALUES clase was used
  // to bind it to multiple values
  object: Term | Term[];
  isOptional?: boolean;
  cardinality?: ICardinality;
}
/**
 * A Triple
 */
export class Triple implements ITriple {
  public readonly predicate: string;
  public readonly subject: string;
  public readonly object: Term | Term[];
  // the cardinality of the predicate
  public readonly cardinality: ICardinality;

  /**
   *
   * @param {ITripleArgs} tripleObject - A triple object
   */
  public constructor({ subject, predicate, object, cardinality }: ITripleArgs) {
    this.predicate = predicate;
    this.object = object;
    this.subject = subject;
    this.cardinality = cardinality ?? { min: 1, max: 1 };

    Object.freeze(this.predicate);
    Object.freeze(this.object);
    Object.freeze(this.subject);
    Object.freeze(this);
  }

  /**
   * Return a triple object
   * @returns {ITripleArgs} a Triple object
   */
  public toObject(): ITripleArgs {
    return {
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    };
  }

  public getLinkedStarPattern(): string | undefined {
    if (!Array.isArray(this.object) && (this.object?.termType === "Variable" || this.object?.termType === "NamedNode")) {
      return this.object.value
    }
  }

  public toString(): string {
    return `<${this.subject}> <${this.predicate}> <${JSON.stringify(this.object)}>`;
  }

}
