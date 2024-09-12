import type { Term } from '@rdfjs/types';
import { Algebra, Util } from 'sparqlalgebrajs';
import { ITripleWithDependencies, Triple, IOneOf, type IStarPatternWithDependencies, ITriple } from './Triple';

type OneOfRawData = Map<string, { oneOfs: IOneOf[], isVariable: boolean }>;

interface IAccumulatedTriples { triples: Map<string, ITriple>, isVariable: boolean }
/**
 * A query divided into subject group
 */
export interface IQuery {
  // star patterns indexed by subject
  starPatterns: Map<string, IStarPatternWithDependencies>;
  union?: Array<IQuery[]>;
  filterExpression?: string;
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
  const accumulatedOneOfs: OneOfRawData = new Map();
  // the binding value to the value
  const accumatedValues = new Map<string, Term[]>();
  const accumulatedUnion: Array<IQuery[]> = [];

  Util.recurseOperation(
    algebraQuery,
    {
      [Algebra.types.PATTERN]: handlePattern(accumulatedTriples),
      [Algebra.types.VALUES]: handleValues(accumatedValues),
      [Algebra.types.PATH]: handlePropertyPath(accumulatedTriples, accumulatedOneOfs),
      [Algebra.types.UNION]: handleUnion(accumulatedUnion)
    },
  );

  return buildQuery(accumulatedTriples, accumatedValues, accumulatedOneOfs, accumulatedUnion);
}

function buildQuery(
  tripleArgs: Map<string, IAccumulatedTriples>,
  values: Map<string, Term[]>,
  oneOfs: OneOfRawData,
  accumulatedUnion: IQuery[][]
): IQuery {
  const innerQuery = new Map<string, IStarPatternWithDependencies>();
  const resp: IQuery = { starPatterns: innerQuery, filterExpression: "" };
  if (accumulatedUnion.length > 0) {
    resp.union = accumulatedUnion;
  }
  const unHandledOneOf = new Set<string>(oneOfs.keys());

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
        unHandledOneOf.delete(starPatternSubject);
        innerQuery.set(starPatternSubject, {
          starPattern: new Map([
            [triple.predicate, predicateWithDependencies]
          ]),
          name: starPatternSubject,
          isVariable: isVariable,
          oneOfs: oneOfs.get(starPatternSubject)?.oneOfs ?? []
        });
      } else {
        const predicateWithDependencies: ITripleWithDependencies = { triple: triple, dependencies: undefined };
        starPattern.starPattern.set(triple.predicate, predicateWithDependencies);
      }
    }
  }
  // create a star pattern from the oneOf not nested in a current star pattern
  for (const starPatternSubject of unHandledOneOf) {
    innerQuery.set(starPatternSubject, {
      starPattern: new Map(),
      name: starPatternSubject,
      isVariable: oneOfs.get(starPatternSubject)!.isVariable,
      oneOfs: oneOfs.get(starPatternSubject)!.oneOfs
    });

    // set the dependencies of the oneOf
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < oneOfs.get(starPatternSubject)!.oneOfs.length; i++) {
      const oneOf = oneOfs.get(starPatternSubject)!.oneOfs[i];
      addADependencyToOneOf(oneOf, innerQuery);
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

function handleUnion(accumulatedUnion: IQuery[][]): (element: any) => boolean {
  return (element: any): boolean => {
    const branches: any[] = element.input;
    const currentUnion:IQuery[] = [];
    for (const branch of branches) {
      currentUnion.push(generateQuery(branch))
    }
    accumulatedUnion.push(currentUnion);
    return false;
  };
}

function handleValues(accumatedValues: Map<string, Term[]>): (element: any) => boolean {
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

function handlePattern(accumulatedTriples: Map<string, IAccumulatedTriples>): (element: any) => boolean {
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
        accumulatedTriples.set(subject.value, { triples: new Map([[triple.toString(), triple]]), isVariable: subject.termType === "Variable" });
      } else {
        startPattern.triples.set(triple.toString(), triple);
      }
    }
    return false;
  };
}

function handlePropertyPath(accumulatedTriples: Map<string, IAccumulatedTriples>, accumulatedOneOfs: OneOfRawData): (element: any) => boolean {
  return (element: any): boolean => {
    const path = element.predicate.type;
    if (path === Algebra.types.ALT) {
      handleAltPropertyPath(element, accumulatedOneOfs);
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

function handleAltPropertyPath(element: any, oneOfs: OneOfRawData) {
  const subject = element.subject as Term;
  const object = element.object as Term;
  const predicates = element.predicate.input;
  let currentOneOf = oneOfs.get(subject.value);
  if (!currentOneOf) {
    oneOfs.set(subject.value,
      {
        oneOfs: [],
        isVariable: subject.termType === "Variable",
      }
    );
    currentOneOf = oneOfs.get(subject.value)!;
  }
  currentOneOf.oneOfs.push({ options: [] });
  for (const predicate of predicates) {
    currentOneOf.oneOfs.at(-1)!.options.push({ triple: new Triple({ subject: subject.value, predicate: predicate.iri.value, object }) })
  }
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

function handleDirectPropertyPath(element: any, accumulatedTriples: Map<string, IAccumulatedTriples>, triple: { triple: ITriple, isVariable: boolean } | undefined) {
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

function addADependencyToStarPattern(tripleWithDependencies: ITripleWithDependencies, innerQuery: Map<string, IStarPatternWithDependencies>): void {
  const linkedSubjectGroup = tripleWithDependencies.triple.getLinkedStarPattern();
  if (linkedSubjectGroup !== undefined) {
    const dependenStarPattern = innerQuery.get(linkedSubjectGroup);
    if (dependenStarPattern !== undefined) {
      tripleWithDependencies.dependencies = dependenStarPattern
    }
  }
}

function addADependencyToOneOf(oneOf: IOneOf, innerQuery: Map<string, IStarPatternWithDependencies>): void {
  const triple = oneOf.options[0].triple;
  const linkedStarPatternName = triple.getLinkedStarPattern();
  if (linkedStarPatternName !== undefined) {
    const dependenStarPattern = innerQuery.get(linkedStarPatternName);
    if (dependenStarPattern !== undefined) {
      oneOf.dependencies = dependenStarPattern;
    }
  }
}