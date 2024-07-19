import type { Term } from '@rdfjs/types';
import { Algebra, Util } from 'sparqlalgebrajs';
import { ITripleArgs, ITripleWithDependencies, Triple, IOneOf, type IStarPatternWithDependencies } from './Triple';

type OneOfRawData = Map<string, { oneOfs: IOneOf[], isVariable: boolean }>;

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

function handleCardinalityPropertyPath(element: any): { triple: ITripleArgs, isVariable: boolean } | undefined {
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
      triple: { subject: subject.value, predicate: predicate.value, object: object, cardinality },
      isVariable: subject.termType === "Variable"
    };
  }
}

function handleNegatedPropertySet(element: any): { triple: ITripleArgs, isVariable: boolean } | undefined {
  const subject = element.subject as Term;
  const object = element.object as Term;
  const predicates = element.predicate.iris;
  const negatedSet = new Set<string>();
  for (const predicate of predicates) {
    negatedSet.add(predicate.value);
  }

  return {
    triple: {
      subject: subject.value,
      predicate: Triple.PREDICATE_SET,
      object: object,
      negatedSet: negatedSet
    },
    isVariable: subject.termType === "Variable"
  };
}

function handleDirectPropertyPath(element: any, resp: Map<string, { triples: ITripleArgs[], isVariable: boolean }>, triple: { triple: ITripleArgs, isVariable: boolean } | undefined) {
  const subject = element.subject as Term;
  const startPattern = resp.get(subject.value);
  if (triple !== undefined) {
    if (startPattern === undefined) {
      resp.set(subject.value, { triples: [triple.triple], isVariable: triple.isVariable });
    } else {
      startPattern.triples.push(triple.triple);
    }
  }
}

function isACardinalityPropertyPath(predicateType: string): boolean {
  return predicateType === Algebra.types.ZERO_OR_MORE_PATH ||
    predicateType === Algebra.types.ZERO_OR_ONE_PATH ||
    predicateType === Algebra.types.ONE_OR_MORE_PATH;
}

/**
 * A query divided into subject group
 */
export interface IQuery {
  // star patterns indexed by subject
  starPatterns: Map<string, IStarPatternWithDependencies>;
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
  const resp = new Map<string, { triples: ITripleArgs[], isVariable: boolean }>();
  const oneOfs: OneOfRawData = new Map();
  // the binding value to the value
  const values = new Map<string, Term[]>();

  const addProperty = (quad: any): boolean => {
    const subject = quad.subject as Term;
    const predicate = quad.predicate as Term;
    const object = quad.object as Term;
    if (predicate.termType === 'NamedNode') {
      const startPattern = resp.get(subject.value);
      const propertyObject: ITripleArgs = {
        subject: subject.value,
        predicate: quad.predicate.value,
        object,
      };
      if (startPattern === undefined) {
        resp.set(subject.value, { triples: [propertyObject], isVariable: subject.termType === "Variable" });
      } else {
        startPattern.triples.push(propertyObject);
      }
    }
    return true;
  };


  const addValues = (element: any): boolean => {
    const bindings: Record<string, Term>[] = element.bindings;
    for (const binding of bindings) {
      for (const [key, term] of Object.entries(binding)) {
        const variableName = key.substring(1);
        const value = values.get(variableName);
        if (value !== undefined) {
          value.push(term);
        } else {
          values.set(variableName, [term]);
        }
      }
    }
    return true;
  }

  const handlePath = (element: any): boolean => {
    const path = element.predicate.type;
    if (path === Algebra.types.ALT) {
      handleAltPropertyPath(element, oneOfs);
    } else if (isACardinalityPropertyPath(path)) {
      const triple = handleCardinalityPropertyPath(element);
      handleDirectPropertyPath(element, resp, triple);
    } else if (path === Algebra.types.NPS) {
      const triple = handleNegatedPropertySet(element);
      handleDirectPropertyPath(element, resp, triple);
    }
    return true;
  };

  Util.recurseOperation(
    algebraQuery,
    {
      [Algebra.types.PATTERN]: addProperty,
      [Algebra.types.VALUES]: addValues,
      [Algebra.types.PATH]: handlePath
    },
  );

  return joinTriplesWithProperties(resp, values, oneOfs);
}

function joinTriplesWithProperties(
  tripleArgs: Map<string, { triples: ITripleArgs[], isVariable: boolean }>,
  values: Map<string, Term[]>,
  oneOfs: OneOfRawData
): IQuery {
  const innerQuery = new Map<string, IStarPatternWithDependencies>();
  const resp: IQuery = { starPatterns: innerQuery, filterExpression: "" };
  const unHandledOneOf = new Set<string>(oneOfs.keys());

  // generate the root star patterns
  for (const [starPatternSubject, { triples, isVariable }] of tripleArgs) {
    for (const tripleArg of triples) {
      let triple = new Triple(tripleArg);
      if (!Array.isArray(tripleArg.object) && tripleArg.object?.termType === "Variable") {
        const value = values.get(tripleArg.object.value);
        if (value !== undefined) {
          tripleArg.object = value;
          triple = new Triple(tripleArg);
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
