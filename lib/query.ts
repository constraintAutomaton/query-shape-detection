import type { Term } from '@rdfjs/types';
import { Algebra, Util } from 'sparqlalgebrajs';
import { ITripleWithDependencies, Triple, type IStarPatternWithDependencies, ITriple } from './Triple';
import { ICardinality } from './Shape';
import { DF } from './constant';

interface IAccumulatedTriples { triples: Map<string, ITriple>, isVariable: boolean }
/**
 * A query divided into subject group
 */
export interface IQuery {
  // star patterns indexed by subject
  starPatterns: Map<string, IStarPatternWithDependencies>;
  union?: IQuery[][];
  filterExpression?: string;
}

export function generateStarPatternUnion(union: IQuery[][], starPatternName: string): IStarPatternWithDependencies[][] {
  const resp: IStarPatternWithDependencies[][] = [];
  for (const unionSet of union) {
    const currentUnionSet: IStarPatternWithDependencies[] = [];
    for (const union of unionSet) {
      const requestedStarPattern = union.starPatterns.get(starPatternName);
      if (requestedStarPattern !== undefined) {
        currentUnionSet.push(requestedStarPattern);
      }
    }
    if (currentUnionSet.length > 0) {
      resp.push(currentUnionSet)
    }
  }
  return resp;
}

/**
 * Divide a query into subject group
 * @param {Algebra.Operation} algebraQuery - the algebra of a query
 * @returns {Query} - A query divided into subject group where the predicate has to be an IRI
 * @todo add support for the bind operator
 * @todo add support for optional property path
 */
export function generateQuery(algebraQuery: Algebra.Operation): IQuery {
  const accumulatedTriples = new Map<string, IAccumulatedTriples>();
  // the binding value to the value
  const accumatedValues = new Map<string, Term[]>();
  const accumulatedUnion: IQuery[][] = [];

  Util.recurseOperation(
    algebraQuery,
    {
      [Algebra.types.PATTERN]: QueryHandler.handlePattern(accumulatedTriples),
      [Algebra.types.VALUES]: QueryHandler.handleValues(accumatedValues),
      [Algebra.types.UNION]: QueryHandler.handleUnion(accumulatedUnion)
    },
  );

  Util.recurseOperation(
    algebraQuery,
    {
      [Algebra.types.PATH]: QueryHandler.handlePropertyPath(accumulatedTriples, accumulatedUnion, accumatedValues),
    },
  );

  return buildQuery(accumulatedTriples, accumatedValues, accumulatedUnion);
}

function buildQuery(
  tripleArgs: Map<string, IAccumulatedTriples>,
  values: Map<string, Term[]>,
  accumulatedUnion: IQuery[][]
): IQuery {
  const innerQuery = new Map<string, IStarPatternWithDependencies>();
  const resp: IQuery = { starPatterns: innerQuery, filterExpression: "" };
  if (accumulatedUnion.length > 0) {
    resp.union = accumulatedUnion;
  }

  // generate the root star patterns
  for (const [starPatternSubject, { triples, isVariable }] of tripleArgs) {
    for (let triple of triples.values()) {
      if (!Array.isArray(triple.object) && triple.object?.termType === "Variable") {
        const value = values.get(triple.object.value);
        if (value !== undefined) {
          triple = new Triple({
            subject: triple.subject,
            predicate: triple.predicate,
            object: value,
            cardinality: triple.cardinality,
            negatedSet: triple.negatedSet
          });
        }
      }
      const starPattern = innerQuery.get(starPatternSubject);

      if (starPattern === undefined) {
        const predicateWithDependencies: ITripleWithDependencies = { triple: triple, dependencies: undefined };
        innerQuery.set(starPatternSubject, {
          starPattern: new Map([
            [triple.predicate, predicateWithDependencies]
          ]),
          name: starPatternSubject,
          isVariable: isVariable,
        });
      } else {
        const predicateWithDependencies: ITripleWithDependencies = { triple: triple, dependencies: undefined };
        starPattern.starPattern.set(triple.predicate, predicateWithDependencies);
      }
    }
  }

  // set the dependencies of the star pattern
  for (const starPatternWithDependencies of innerQuery.values()) {
    for (const tripleWithDependencies of starPatternWithDependencies.starPattern.values()) {
      addADependencyToStarPattern(tripleWithDependencies, innerQuery);
    }
  }
  return resp;
}

function addADependencyToStarPattern(tripleWithDependencies: ITripleWithDependencies, innerQuery: Map<string, IStarPatternWithDependencies>): void {
  const linkedSubjectGroup = tripleWithDependencies.triple.getLinkedStarPattern();
  if (linkedSubjectGroup !== undefined) {
    const dependenStarPattern = innerQuery.get(linkedSubjectGroup);
    if (dependenStarPattern !== undefined) {
      tripleWithDependencies.dependencies = dependenStarPattern
    }
  }
}

namespace QueryHandler {
  export function handlePropertyPath(
    accumulatedTriples: Map<string,
      IAccumulatedTriples>, accumulatedUnion: IQuery[][],
    accumatedValues: Map<string, Term[]>
  ): (element: any) => boolean {
    return (element: any): boolean => {
      const path = element.predicate.type;
      if (path === Algebra.types.ALT) {
        accumulatedUnion.push(handleAltPropertyPath(element.subject, element.predicate.input, element.object, accumatedValues));
      } else if (isACardinalityPropertyPath(path)) {
        const triple = handleCardinalityPropertyPath(element);
        handleDirectPropertyPath(element, accumulatedTriples, triple);
      } else if (path === Algebra.types.NPS) {
        const triple = handleNegatedPropertySet(element);
        handleDirectPropertyPath(element, accumulatedTriples, triple);
      }
      return false;
    };
  }

  export function handleUnion(accumulatedUnion: IQuery[][]): (element: any) => boolean {
    return (element: any): boolean => {
      const branches: any[] = element.input;
      const currentUnion: IQuery[] = [];
      for (const branch of branches) {
        currentUnion.push(generateQuery(branch))
      }
      accumulatedUnion.push(currentUnion);
      return false;
    };
  }

  export function handleValues(accumatedValues: Map<string, Term[]>): (element: any) => boolean {
    return (element: any): boolean => {
      const bindings: Record<string, Term>[] = element.bindings;
      for (const binding of bindings) {
        for (const [key, term] of Object.entries(binding)) {
          const variableName = key.substring(1);
          const value = accumatedValues.get(variableName);
          if (value !== undefined) {
            value.push(term);
          } else {
            accumatedValues.set(variableName, [term]);
          }
        }
      }
      return false;
    }
  }

  export function handlePattern(accumulatedTriples: Map<string, IAccumulatedTriples>): (element: any) => boolean {
    return (quad: any): boolean => {
      const subject = quad.subject as Term;
      const predicate = quad.predicate as Term;
      const object = quad.object as Term;
      if (predicate.termType === 'NamedNode') {
        const startPattern = accumulatedTriples.get(subject.value);
        const triple: ITriple = new Triple({
          subject: subject.value,
          predicate: quad.predicate.value,
          object,
        });
        if (startPattern === undefined) {
          accumulatedTriples.set(subject.value,
            { triples: new Map([[triple.toString(), triple]]), isVariable: subject.termType === "Variable" });
        } else {
          startPattern.triples.set(triple.toString(), triple);
        }
      }
      return false;
    };
  }

  function handleCardinalityPropertyPath(element: any): { triple: ITriple, isVariable: boolean } | undefined {
    const subject = element.subject as Term;
    const object = element.object as Term;
    const predicate = element.predicate.path.iri;
    const predicateCardinality = element.predicate.type;
    let cardinality = undefined;
    switch (predicateCardinality) {
      case Algebra.types.ZERO_OR_MORE_PATH:
        cardinality = { min: 0, max: -1 }
        break;
      case Algebra.types.ZERO_OR_ONE_PATH:
        cardinality = { min: 0, max: 1 };
        break;
      case Algebra.types.ONE_OR_MORE_PATH:
        cardinality = { min: 1, max: -1 };
        break;
    }
    if (cardinality) {
      return {
        triple: new Triple({ subject: subject.value, predicate: predicate.value, object: object, cardinality }),
        isVariable: subject.termType === "Variable"
      };
    }
  }

  function handleDirectPropertyPath(element: any,
    accumulatedTriples: Map<string, IAccumulatedTriples>,
    triple: { triple: ITriple, isVariable: boolean } | undefined): void {
    const subject = element.subject as Term;
    const startPattern = accumulatedTriples.get(subject.value);
    if (triple !== undefined) {
      if (startPattern === undefined) {
        accumulatedTriples.set(subject.value, { isVariable: triple.isVariable, triples: new Map([[triple.triple.toString(), triple.triple]]) });

      } else {
        startPattern.triples.set(triple.triple.toString(), triple.triple);
      }
    }
  }

  function isACardinalityPropertyPath(predicateType: string): boolean {
    return predicateType === Algebra.types.ZERO_OR_MORE_PATH ||
      predicateType === Algebra.types.ZERO_OR_ONE_PATH ||
      predicateType === Algebra.types.ONE_OR_MORE_PATH;
  }

  function handleAltPropertyPath(subject: Term, predicates: any[], object: Term, accumatedValues: Map<string, Term[]>): IQuery[] {
    const union: IQuery[] = [];
    for (const path of predicates) {
      const cardinality = getCardinality(path.type);
      if (cardinality !== undefined) {
        union.push(handleLinkQuery(path.path, accumatedValues, subject, object, cardinality));
      } else if (path.type === Algebra.types.LINK) {
        union.push(handleLinkQuery(path, accumatedValues, subject, object));
      } else if (path.type === Algebra.types.SEQ) {
        union.push(handleSeqPath(path, accumatedValues, subject, object));
      } else if (path.type === Algebra.types.NPS) {
        union.push(handleNegatedPropertyQuery(path, accumatedValues, subject, object));
      }
    }
    return union;
  }

  function handleSeqPath(element: any, accumatedValues: Map<string, Term[]>, subject: Term, object: Term): IQuery {
    const predicates = element.input;
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    const accumulatedUnion: IQuery[][] = [];

    let currentObject: Term = DF.blankNode(`${predicates[0].iri.value}_${subject.value}`);

    for (let i = 0; i < predicates.length; i++) {
      const path = predicates[i];
      const currentSubject: Term = i === 0 ? subject : currentObject;

      currentObject = i === predicates.length - 1 ? object : DF.blankNode(`${path.iri.value}_${subject.value}`);

      if (path.type === Algebra.types.LINK) {
        handleLink(path, accumulatedTriples, currentSubject, currentObject);
      } else if (path.type === Algebra.types.NPS) {
        handleNegatedPropertyLink(path, accumulatedTriples, currentSubject, currentObject)
      } else if (path.type === Algebra.types.ALT) {
        accumulatedUnion.push(handleAltPropertyPath(currentSubject, path.input, currentObject, accumatedValues));
      }
    }

    return buildQuery(accumulatedTriples, accumatedValues, accumulatedUnion);
  }


  function getCardinality(nodeType: string): ICardinality | undefined {
    switch (nodeType) {
      case Algebra.types.ZERO_OR_MORE_PATH:
        return { min: 0, max: -1 }
      case Algebra.types.ZERO_OR_ONE_PATH:
        return { min: 0, max: 1 };
      case Algebra.types.ONE_OR_MORE_PATH:
        return { min: 1, max: -1 };
      default:
        return undefined;
    }
  }

  function handleLink(element: any, accumulatedTriples: Map<string, IAccumulatedTriples>, subject: Term, object: Term, cardinality?: ICardinality): void {
    const triple: ITriple = new Triple({
      subject: subject.value,
      predicate: element.iri.value,
      object,
      cardinality
    });

    accumulatedTriples.set(subject.value,
      {
        triples: new Map([[triple.toString(), triple]]),
        isVariable: subject.termType === "Variable"
      });
  }

  function handleLinkQuery(element: any, accumatedValues: Map<string, Term[]>, subject: Term, object: Term, cardinality?: ICardinality): IQuery {
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    handleLink(element, accumulatedTriples, subject, object, cardinality);
    return buildQuery(accumulatedTriples, accumatedValues, []);
  }

  function handleNegatedPropertyLink(element: any, accumulatedTriples: Map<string, IAccumulatedTriples>, subject: Term, object: Term): void {
    const predicates = element.iris;
    const negatedSet = new Set<string>();
    for (const predicate of predicates) {
      negatedSet.add(predicate.value);
    }

    const triple: ITriple = new Triple({
      subject: subject.value,
      predicate: Triple.NEGATIVE_PREDICATE_SET,
      object,
      negatedSet
    });

    accumulatedTriples.set(subject.value,
      {
        triples: new Map([[triple.toString(), triple]]),
        isVariable: subject.termType === "Variable"
      });
  }

  function handleNegatedPropertyQuery(element: any, accumatedValues: Map<string, Term[]>, subject: Term, object: Term): IQuery {
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    handleNegatedPropertyLink(element, accumulatedTriples, subject, object);
    return buildQuery(accumulatedTriples, accumatedValues, []);
  }

  function handleNegatedPropertySet(element: any): { triple: ITriple, isVariable: boolean } | undefined {
    const subject = element.subject as Term;
    const object = element.object as Term;
    const predicates = element.predicate.iris;
    const negatedSet = new Set<string>();
    for (const predicate of predicates) {
      negatedSet.add(predicate.value);
    }

    return {
      triple: new Triple({
        subject: subject.value,
        predicate: Triple.NEGATIVE_PREDICATE_SET,
        object: object,
        negatedSet: negatedSet
      }),
      isVariable: subject.termType === "Variable"
    };
  }
}
