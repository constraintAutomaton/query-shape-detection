import type { Term } from '@rdfjs/types';
import { Algebra, Util } from 'sparqlalgebrajs';
import { ITripleWithDependencies, Triple, type IStarPatternWithDependencies, ITriple } from './Triple';
import { ICardinality } from './Shape';
import { DF } from './constant';

interface IAccumulatedTriples { triples: Map<string, ITriple>, isVariable: boolean }
/**
 * A query divided into star patterns
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
 * Divide a query into star patterns
 * @param {Algebra.Operation} algebraQuery - the algebra of a query
 * @returns {Query} - A query divided into subject group where the predicate has to be an IRI
 * @todo add support for the bind operator
 */
export function generateQuery(algebraQuery: Algebra.Operation, optional?: boolean): IQuery {
  const accumulatedTriples = new Map<string, IAccumulatedTriples>();
  // the binding value to the value
  const accumatedValues = new Map<string, Term[]>();
  const accumulatedUnion: IQuery[][] = [];

  QueryHandler.collectFromAlgebra(algebraQuery, accumulatedTriples, accumatedValues, accumulatedUnion, optional);

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
  addUnionDependencies(resp)
  return resp;
}

// could be made so that when adding a union we make sure to find the dependency
// function should be revisited
function addUnionDependencies(query: IQuery): void {
  if (query.union === undefined) {
    return;
  }
  //eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < query.union.length; i++) {
    const union = query.union[i];
    for (const branch of union) {
      for (const starPattern of branch.starPatterns.values()) {
        for (const triple of starPattern.starPattern.values()) {
          if (triple.dependencies === undefined) {
            const linkedStarPattern = triple.triple.getLinkedStarPattern();
            if (linkedStarPattern !== undefined) {
              const dependency = query.starPatterns.get(linkedStarPattern);
              if (dependency !== undefined) {
                triple.dependencies = dependency;
                continue;
              }
              //searchDependencyInUnion(query.union, i, triple);
            }
          }
        }
      }
    }
  }
}

/** 
 to figure out if it make sense
function searchDependencyInUnion(unions: IQuery[][], currentBranch: number, triple: ITripleWithDependencies) {
  const linkedStarPattern = triple.triple.getLinkedStarPattern();
  if (linkedStarPattern === undefined || triple.dependencies === undefined) {
    return;
  }
  for (let i = 0; i < unions.length; i++) {
    const union = unions[i];
    if (i === currentBranch) {
      continue;
    }
    for (const branch of union) {
      const dependency = branch.starPatterns.get(linkedStarPattern);
      if (dependency !== undefined) {
        triple.dependencies = dependency;
        return;
      }
    }
  }

}
*/

function addADependencyToStarPattern(
  tripleWithDependencies: ITripleWithDependencies,
  innerQuery: Map<string, IStarPatternWithDependencies>): void {
  const linkedStarPattern = tripleWithDependencies.triple.getLinkedStarPattern();
  if (linkedStarPattern !== undefined) {
    const dependentStarPattern = innerQuery.get(linkedStarPattern);
    if (dependentStarPattern !== undefined) {
      tripleWithDependencies.dependencies = dependentStarPattern
    }

  }

}

namespace QueryHandler {

  export function collectFromAlgebra(rootAlgebra: Algebra.Operation, accumulatedTriples: Map<string, IAccumulatedTriples>,
    accumatedValues: Map<string, Term[]>,
    accumulatedUnion: IQuery[][],
    optional?: boolean): void {
    Util.recurseOperation(
      rootAlgebra,
      {
        [Algebra.types.PATTERN]: handlePattern(accumulatedTriples, optional),
        [Algebra.types.VALUES]: handleValues(accumatedValues),
        [Algebra.types.UNION]: handleUnion(accumulatedUnion, optional),
        [Algebra.types.LEFT_JOIN]: handleLeftJoin(accumulatedTriples, accumatedValues, accumulatedUnion),
        [Algebra.types.PATH]: handlePropertyPath(accumulatedTriples, accumulatedUnion, accumatedValues, optional),
      },
    );
  }

  function handleLeftJoin(accumulatedTriples: Map<string, IAccumulatedTriples>,
    accumatedValues: Map<string, Term[]>,
    accumulatedUnion: IQuery[][]): (element: Algebra.LeftJoin) => boolean {
    return (element: Algebra.LeftJoin): boolean => {
      const joinElement = element.input;
      const requiredElements = joinElement[0];
      const optionalElements = joinElement[1];

      collectFromAlgebra(requiredElements, accumulatedTriples, accumatedValues, accumulatedUnion);
      collectFromAlgebra(optionalElements, accumulatedTriples, accumatedValues, accumulatedUnion, true);

      return false;
    }
  }

  function handlePropertyPath(
    accumulatedTriples: Map<string,
      IAccumulatedTriples>, accumulatedUnion: IQuery[][],
    accumatedValues: Map<string, Term[]>,
    optional?: boolean,
  ): (element: Algebra.Path) => boolean {
    return (element: Algebra.Path): boolean => {
      const path = element.predicate.type;
      if (element.predicate.type === Algebra.types.ALT) {
        accumulatedUnion.push(handleAltPropertyPath(element.subject, element.predicate.input, element.object, accumatedValues, optional));
      } else if (isACardinalityPropertyPath(path)) {
        const triple = handleCardinalityPropertyPath(element, optional);
        handleDirectPropertyPath(element, accumulatedTriples, triple);
      } else if (path === Algebra.types.NPS) {
        const triple = handleNegatedPropertySet(element, optional);
        handleDirectPropertyPath(element, accumulatedTriples, triple);
      }
      return true;
    };
  }

  function handleUnion(accumulatedUnion: IQuery[][], optional?: boolean): (element: Algebra.Union) => boolean {
    return (element: Algebra.Union): boolean => {
      const branches: Algebra.Operation[] = element.input;
      const currentUnion: IQuery[] = [];
      for (const branch of branches) {
        currentUnion.push(generateQuery(branch, optional))
      }
      accumulatedUnion.push(currentUnion);
      return false;
    };
  }

  function handleValues(accumatedValues: Map<string, Term[]>): (element: Algebra.Values) => boolean {
    return (element: Algebra.Values): boolean => {
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

  function handlePattern(accumulatedTriples: Map<string, IAccumulatedTriples>, optional?: boolean): (element: Algebra.Pattern) => boolean {
    return (quad: Algebra.Pattern): boolean => {
      const subject = quad.subject as Term;
      const predicate = quad.predicate as Term;
      const object = quad.object as Term;
      if (predicate.termType === 'NamedNode') {
        const startPattern = accumulatedTriples.get(subject.value);
        const triple: ITriple = new Triple({
          subject: subject.value,
          predicate: quad.predicate.value,
          object,
          isOptional: optional
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

  function handleCardinalityPropertyPath(element: Algebra.Path, optional?: boolean): { triple: ITriple, isVariable: boolean } | undefined {
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
        triple: new Triple({
          subject: subject.value,
          predicate: predicate.value,
          object,
          cardinality,
          isOptional: optional
        }),
        isVariable: subject.termType === "Variable"
      };
    }
  }

  function handleDirectPropertyPath(element: Algebra.Path,
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

  function handleInvPath(element: Algebra.Inv,
    subject: Term,
    object: Term,
    accumatedValues: Map<string, Term[]>,
    optional?: boolean): IQuery[] {
    if (element.path.type === Algebra.types.ALT) {
      return handleAltPropertyPath(object, element.path.input, subject, accumatedValues, optional);
    } else {
      return handleAltPropertyPath(object, [element.path], subject, accumatedValues, optional);
    }
  }

  function handleAltPropertyPath(
    subject: Term,
    predicates: Algebra.Operation[],
    object: Term,
    accumatedValues: Map<string, Term[]>,
    optional?: boolean,
  ): IQuery[] {
    let union: IQuery[] = [];
    for (const path of predicates) {
      const cardinality = getCardinality(path.type);
      if (cardinality !== undefined) {
        union.push(handleLinkQuery(path.path, accumatedValues, subject, object, cardinality, optional));
      } else if (path.type === Algebra.types.LINK) {
        union.push(handleLinkQuery(path, accumatedValues, subject, object, undefined, optional));
      } else if (path.type === Algebra.types.SEQ) {
        union.push(handleSeqPathQuery(path, accumatedValues, subject, object, optional));
      } else if (path.type === Algebra.types.NPS) {
        union.push(handleNegatedPropertyQuery(path, accumatedValues, subject, object, optional));
      } else if (path.type === Algebra.types.INV) {
        const invOption = handleInvPath(path, subject, object, accumatedValues, optional);
        union = union.concat(invOption);
      }
    }
    return union;
  }

  function handleSeqPath(
    element: Algebra.Seq,
    accumatedValues: Map<string, Term[]>,
    accumulatedTriples: Map<string, IAccumulatedTriples>,
    accumulatedUnion: IQuery[][],
    subject: Term,
    object: Term,
    optional?: boolean): void {
    const predicates = element.input;
    let currentObject: Term = DF.blankNode(`${predicates[0].iri.value}_${subject.value}`);

    for (let i = 0; i < predicates.length; i++) {
      const path = predicates[i];
      const currentSubject: Term = i === 0 ? subject : currentObject;

      currentObject = i === predicates.length - 1 ? object : DF.blankNode(`${path.iri.value}_${subject.value}`);

      if (path.type === Algebra.types.LINK) {
        handleLink(path, accumulatedTriples, currentSubject, currentObject, undefined, optional);
      } else if (path.type === Algebra.types.NPS) {
        handleNegatedPropertyLink(path, accumulatedTriples, currentSubject, currentObject, optional)
      } else if (path.type === Algebra.types.ALT) {
        accumulatedUnion.push(handleAltPropertyPath(currentSubject, path.input, currentObject, accumatedValues, optional));
      }
    }

  }
  function handleSeqPathQuery(element: Algebra.Seq, accumatedValues: Map<string, Term[]>, subject: Term, object: Term, optional?: boolean): IQuery {
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    const accumulatedUnion: IQuery[][] = [];

    handleSeqPath(element, accumatedValues, accumulatedTriples, accumulatedUnion, subject, object, optional);

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

  function handleLink(element: Algebra.Link,
    accumulatedTriples: Map<string, IAccumulatedTriples>,
    subject: Term,
    object: Term,
    cardinality?: ICardinality,
    optional?: boolean
  ): void {
    const triple: ITriple = new Triple({
      subject: subject.value,
      predicate: element.iri.value,
      object,
      cardinality,
      isOptional: optional
    });

    accumulatedTriples.set(subject.value,
      {
        triples: new Map([[triple.toString(), triple]]),
        isVariable: subject.termType === "Variable"
      });
  }

  function handleLinkQuery(
    element: Algebra.Link,
    accumatedValues: Map<string, Term[]>,
    subject: Term,
    object: Term,
    cardinality?: ICardinality,
    optional?: boolean,
  ): IQuery {
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    handleLink(element, accumulatedTriples, subject, object, cardinality, optional);
    return buildQuery(accumulatedTriples, accumatedValues, []);
  }

  function handleNegatedPropertyLink(
    element: Algebra.Nps,
    accumulatedTriples: Map<string, IAccumulatedTriples>,
    subject: Term,
    object: Term,
    optional?: boolean,
  ): void {
    const predicates = element.iris;
    const negatedSet = new Set<string>();
    for (const predicate of predicates) {
      negatedSet.add(predicate.value);
    }

    const triple: ITriple = new Triple({
      subject: subject.value,
      predicate: Triple.NEGATIVE_PREDICATE_SET,
      object,
      negatedSet,
      isOptional: optional
    });

    accumulatedTriples.set(subject.value,
      {
        triples: new Map([[triple.toString(), triple]]),
        isVariable: subject.termType === "Variable"
      });

  }

  function handleNegatedPropertyQuery(
    element: Algebra.Nps,
    accumatedValues: Map<string, Term[]>,
    subject: Term,
    object: Term,
    optional?: boolean,
  ): IQuery {
    const accumulatedTriples = new Map<string, IAccumulatedTriples>();
    handleNegatedPropertyLink(element, accumulatedTriples, subject, object, optional);
    return buildQuery(accumulatedTriples, accumatedValues, []);
  }

  function handleNegatedPropertySet(element: Algebra.Path, optional?: boolean): { triple: ITriple, isVariable: boolean } | undefined {
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
        object,
        negatedSet: negatedSet,
        isOptional: optional
      }),
      isVariable: subject.termType === "Variable"
    };
  }
}
